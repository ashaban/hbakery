const moment = require("moment");
const express = require("express");
const router = express.Router();
const pool = require("../db");

const {
  getAvailableQty,
  allocateFifoOut,
  revertProductionOuts,
} = require("../modules/ledger");

router.get("/discrepancyReasons", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, description FROM discrepancy_reason ORDER BY name"
    );
    res.json({ data: rows });
  } catch (err) {
    console.error("Failed to fetch discrepancy reasons:", err);
    res.status(500).json({ error: "Failed to fetch discrepancy reasons" });
  }
});

router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      product_id,
      mode,
      qty_product,
      base_ingredient_id,
      base_ingredient_qty,
      notes,
      ingredients,
      staffs,
      planned_at,
      produced_at,
      actual_qty,
      discrepancies,
    } = req.body;
    if (
      !product_id ||
      !qty_product ||
      !Array.isArray(ingredients) ||
      ingredients.length === 0
    ) {
      return res.status(400).json({ error: "Missing required data" });
    }

    // Validate stock via ledger before writing
    for (const ing of ingredients) {
      const available = await getAvailableQty(client, ing.item_id);
      if (Number(ing.qty_required) > available) {
        return res.status(400).json({
          error: "INSUFFICIENT_STOCK",
          message: `Insufficient stock for ingredient item_id=${ing.item_id}`,
          details: {
            item_id: ing.item_id,
            available,
            required: ing.qty_required,
          },
        });
      }
    }
    await client.query("BEGIN");

    // Header
    const hdr = await client.query(
      `INSERT INTO product_production
        (product_id, mode, qty_product, base_ingredient_id, base_ingredient_qty,
         produced_by, notes, planned_at, produced_at, actual_qty)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        product_id,
        mode,
        qty_product,
        base_ingredient_id || null,
        base_ingredient_qty || null,
        req.user?.id || 1,
        notes || null,
        planned_at || null,
        produced_at || null,
        actual_qty || null,
      ]
    );
    const productionId = hdr.rows[0].id;

    // Lines
    for (const ing of ingredients) {
      await client.query(
        `INSERT INTO product_production_item (production_id, item_id, qty_required)
         VALUES ($1,$2,$3)`,
        [productionId, ing.item_id, ing.qty_required]
      );
    }

    // Staff
    if (Array.isArray(staffs) && staffs.length > 0) {
      for (const s of staffs) {
        if (!s.staff_id?.id) continue;
        await client.query(
          `INSERT INTO product_production_staff (production_id, staff_id, role, notes)
          VALUES ($1,$2,$3,$4)`,
          [productionId, s.staff_id.id, s.role || null, s.notes || null]
        );
      }
    }

    // Discrepancy reasons
    for (const descrepancy of discrepancies) {
      await client.query(
        `INSERT INTO product_production_discrepancy (production_id, reason_id, notes)
         VALUES ($1,$2,$3)`,
        [productionId, descrepancy.id, descrepancy.notes || null]
      );
    }

    // Ledger OUT allocations (FIFO)
    for (const ing of ingredients) {
      await allocateFifoOut(
        client,
        productionId,
        ing.item_id,
        ing.qty_required,
        planned_at
      );
    }

    await client.query("COMMIT");
    res.json({ id: productionId, message: "Production created" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create production failed", err);
    if (String(err.message).startsWith("INSUFFICIENT_STOCK")) {
      return res
        .status(400)
        .json({ error: "INSUFFICIENT_STOCK", message: err.message });
    }
    res.status(500).json({ error: "Failed to create production" });
  } finally {
    client.release();
  }
});

router.put("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      product_id,
      mode,
      qty_product,
      base_ingredient_id,
      base_ingredient_qty,
      notes,
      ingredients,
      staffs,
      discrepancies,
      planned_at,
      produced_at,
      actual_qty,
    } = req.body;

    if (
      !id ||
      !product_id ||
      !qty_product ||
      !Array.isArray(ingredients) ||
      ingredients.length === 0
    ) {
      return res.status(400).json({ error: "Missing required data" });
    }
    await client.query("BEGIN");

    // Rebuild OUT ledger for this production
    await revertProductionOuts(client, id);

    // Check stock first (based on current global availability + we’ll revert old outs anyway)
    for (const ing of ingredients) {
      const available = await getAvailableQty(client, ing.item_id);
      // NOTE: Because we will delete *this production's* OUTs first before reallocating,
      // global available is safe to use here.
      if (Number(ing.qty_required) > available) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "INSUFFICIENT_STOCK",
          message: `Insufficient stock for ingredient item_id=${ing.item_id}`,
          details: {
            item_id: ing.item_id,
            available,
            required: ing.qty_required,
          },
        });
      }
    }

    // 1️⃣ Update header
    await client.query(
      `UPDATE product_production
         SET product_id = $1,
             mode = $2,
             qty_product = $3,
             base_ingredient_id = $4,
             base_ingredient_qty = $5,
             notes = $6,
             updated_at = NOW(),
             updated_by = $7,
             planned_at = $9,
             produced_at = $10,
             actual_qty = $11
       WHERE id = $8`,
      [
        product_id,
        mode,
        qty_product,
        base_ingredient_id || null,
        base_ingredient_qty || null,
        notes || null,
        req.user?.id || 1,
        id,
        planned_at,
        produced_at,
        actual_qty,
      ]
    );

    // 2️⃣ Replace production items
    await client.query(
      "DELETE FROM product_production_item WHERE production_id = $1",
      [id]
    );

    const insertItemSQL = `
      INSERT INTO product_production_item (production_id, item_id, qty_required)
      VALUES ($1, $2, $3)
    `;
    for (const ing of ingredients) {
      await client.query(insertItemSQL, [id, ing.item_id, ing.qty_required]);
    }

    // 3️⃣ Replace assigned staff
    await client.query(
      "DELETE FROM product_production_staff WHERE production_id = $1",
      [id]
    );
    if (Array.isArray(staffs) && staffs.length > 0) {
      for (const sid of staffs) {
        await client.query(
          `INSERT INTO product_production_staff (production_id, staff_id, role, notes)
           VALUES ($1, $2, $3, $4)`,
          [id, sid.staff_id.id, sid.role, sid.notes || ""]
        );
      }
    }

    // 4️⃣ Replace discrepancies
    await client.query(
      "DELETE FROM product_production_discrepancy WHERE production_id=$1",
      [id]
    );
    for (const d of discrepancies || []) {
      await client.query(
        `
        INSERT INTO product_production_discrepancy (production_id, reason_id, notes)
        VALUES ($1, $2, $3)
      `,
        [id, d.reason_id, d.notes || null]
      );
    }

    //use produced_at as movement date if available, else planned_at
    let movementDate = produced_at || planned_at;
    for (const ing of ingredients) {
      await allocateFifoOut(
        client,
        id,
        ing.item_id,
        ing.qty_required,
        movementDate
      );
    }

    await client.query("COMMIT");
    res.json({ id, message: "Production updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to update production:", err);
    res.status(500).json({ error: "Failed to update production" });
  } finally {
    client.release();
  }
});

router.get("/", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();

    let {
      planned_at,
      planned_end,
      planned_at_op,
      produced_at,
      produced_end,
      produced_at_op,
      team_leader,
      discrepancy_reason,
      status,
    } = req.query;

    console.log(planned_at);

    const where = [];
    const params = [];

    // 🔎 Product name search
    if (search) {
      params.push(`%${search}%`);
      where.push(`p.name ILIKE $${params.length}`);
    }

    if (req.query.product_id) {
      params.push(req.query.product_id);
      where.push(`pp.product_id = $${params.length}`);
    }

    // 🗓 Planned date filter
    if (planned_at) {
      if (planned_at.split(" ").length == 1 && !planned_at_op) {
        planned_at_op = "in";
        planned_end = planned_at + " 23:59";
      } else if (planned_end) {
        planned_end += " 23:59";
      }
      planned_at = moment(planned_at, "DD-MM-YYYY HH:mm").format(
        "YYYY-MM-DD HH:mm"
      );
      if (planned_at_op === "in" && planned_end) {
        planned_end = moment(planned_end, "DD-MM-YYYY HH:mm").format(
          "YYYY-MM-DD HH:mm"
        );
        params.push(planned_at, planned_end);
        where.push(
          `pp.planned_at BETWEEN $${params.length - 1} AND $${params.length}`
        );
      } else if (["=", ">", "<", ">=", "<="].includes(planned_at_op)) {
        params.push(planned_at);
        where.push(`pp.planned_at ${planned_at_op} $${params.length}`);
      }
    }

    // 🕒 Produced date filter
    if (produced_at) {
      if (produced_at.split(" ").length == 1 && !produced_at_op) {
        produced_at_op = "in";
        produced_end = produced_at + " 23:59";
      } else if (produced_end) {
        produced_end += " 23:59";
      }
      produced_at = moment(produced_at, "DD-MM-YYYY HH:mm").format(
        "YYYY-MM-DD HH:mm"
      );
      if (produced_at_op === "in" && produced_end) {
        produced_end = moment(produced_end, "DD-MM-YYYY HH:mm").format(
          "YYYY-MM-DD HH:mm"
        );
        params.push(produced_at, produced_end);
        where.push(
          `pp.produced_at BETWEEN $${params.length - 1} AND $${params.length}`
        );
      } else if (["=", ">", "<", ">=", "<="].includes(produced_at_op)) {
        params.push(produced_at);
        where.push(`pp.produced_at ${produced_at_op} $${params.length}`);
      }
    }

    // 🆕 Production Status Filter
    if (status) {
      if (status.toLowerCase() === "pending") {
        where.push(`pp.produced_at IS NULL`);
      } else if (status.toLowerCase() === "completed") {
        where.push(`pp.produced_at IS NOT NULL`);
      }
    }

    // 👷 Team leader (by name or id)
    if (team_leader) {
      params.push(team_leader);
      where.push(`EXISTS (
        SELECT 1
          FROM product_production_staff ps
          JOIN staff s ON s.id = ps.staff_id
         WHERE ps.production_id = pp.id
           AND ps.role = 'Team Leader'
           AND (s.name ILIKE $${params.length} OR s.id::text = $${params.length})
      )`);
    }

    // ⚠️ Discrepancy reason(s) (IDs and/or names; supports multiple)
    if (discrepancy_reason) {
      // Normalize to array (handles repeated or comma-separated)
      const raw = Array.isArray(discrepancy_reason)
        ? discrepancy_reason.flatMap((v) =>
            String(v)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          )
        : String(discrepancy_reason)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

      const reasonIds = [];
      const reasonNames = [];
      for (const r of raw) {
        if (/^\d+$/.test(r)) reasonIds.push(Number(r));
        else reasonNames.push(r);
      }

      const conds = [];
      if (reasonIds.length) {
        params.push(reasonIds);
        conds.push(`dr.id = ANY($${params.length}::int[])`);
      }
      if (reasonNames.length) {
        params.push(reasonNames);
        conds.push(`dr.name = ANY($${params.length}::text[])`);
      }

      if (conds.length) {
        where.push(`EXISTS (
          SELECT 1
            FROM product_production_discrepancy pd
            JOIN discrepancy_reason dr ON dr.id = pd.reason_id
           WHERE pd.production_id = pp.id
             AND (${conds.join(" OR ")})
        )`);
      }
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // 🧮 Total count (DISTINCT to avoid duplication from joins/exists)
    const totalSql = `
      SELECT COUNT(DISTINCT pp.id)::int AS total
        FROM product_production pp
        JOIN product p ON p.id = pp.product_id
        ${whereSQL}
    `;
    const totalRes = await pool.query(totalSql, params);
    const totalRecords = totalRes.rows[0]?.total || 0;
    const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

    // 🧾 Rows
    const rowsSql = `
      SELECT
        pp.id,
        TO_CHAR(pp.planned_at, 'DD-MM-YYYY HH24:MI') AS planned_at,
        TO_CHAR(pp.produced_at, 'DD-MM-YYYY HH24:MI') AS produced_at,
        pp.mode,
        pp.qty_product,
        pp.actual_qty,
        -- Aggregate discrepancy reasons as names
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT dr2.name)
            FROM product_production_discrepancy pd2
            JOIN discrepancy_reason dr2 ON dr2.id = pd2.reason_id
           WHERE pd2.production_id = pp.id
        ), '{}') AS discrepancy_reasons,
        p.id AS product_id,
        p.name AS product_name,
        p.unit AS product_unit,
        p.price AS product_price,
        -- Prefer Team Leader, else first staff name, else 'N/A'
        COALESCE(
          (
            SELECT s.name
              FROM product_production_staff ps
              JOIN staff s ON s.id = ps.staff_id
             WHERE ps.production_id = pp.id
               AND ps.role = 'Team Leader'
             ORDER BY ps.id
             LIMIT 1
          ),
          (
            SELECT s.name
              FROM product_production_staff ps
              JOIN staff s ON s.id = ps.staff_id
             WHERE ps.production_id = pp.id
             ORDER BY ps.id
             LIMIT 1
          ),
          'N/A'
        ) AS team_leader_name,
        COALESCE((
          SELECT COUNT(*) FROM product_production_staff ps
           WHERE ps.production_id = pp.id
        ), 0) AS staff_count,
        u.name AS produced_by_name
      FROM product_production pp
      JOIN product p ON p.id = pp.product_id
      LEFT JOIN users u ON u.id = pp.produced_by
      ${whereSQL}
      ORDER BY COALESCE(pp.produced_at, pp.planned_at) DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const rowsRes = await pool.query(rowsSql, [...params, limit, offset]);

    res.json({
      data: rowsRes.rows,
      totalPages,
      totalRecords,
    });
  } catch (err) {
    console.error("❌ Failed to fetch productions:", err);
    res.status(500).json({ error: "Failed to fetch productions" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Header
    const hdrRes = await pool.query(
      `
      SELECT 
        pp.*, 
        p.name AS product_name, 
        u.name AS produced_by_name
      FROM product_production pp
      JOIN product p ON p.id = pp.product_id
      LEFT JOIN users u ON u.id = pp.produced_by
      WHERE pp.id = $1
    `,
      [id]
    );

    if (hdrRes.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    // Lines
    const linesRes = await pool.query(
      `
      SELECT 
        ppi.item_id, 
        i.name AS item_name,
        ppi.qty_required,
        iu.shortname AS unit
      FROM product_production_item ppi
      JOIN item i ON i.id = ppi.item_id
      LEFT JOIN itemunit iu ON iu.id = i.unit_id
      WHERE ppi.production_id = $1
      ORDER BY i.name
    `,
      [id]
    );

    // Staff
    const staffRes = await pool.query(
      `
      SELECT s.id, s.name, ps.role, ps.notes
      FROM product_production_staff ps
      JOIN staff s ON s.id = ps.staff_id
      WHERE ps.production_id = $1
      ORDER BY s.name
    `,
      [id]
    );

    const discRes = await pool.query(
      `
      SELECT d.id, dr.name, d.notes, d.reason_id
      FROM product_production_discrepancy d
      JOIN discrepancy_reason dr ON dr.id = d.reason_id
      WHERE d.production_id=$1
    `,
      [id]
    );

    res.json({
      production: hdrRes.rows[0],
      items: linesRes.rows,
      staff: staffRes.rows,
      discrepancies: discRes.rows,
    });
  } catch (err) {
    console.error("❌ Error fetching production:", err);
    res.status(500).json({ error: "Failed to fetch production details" });
  }
});

/** DELETE production */
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query("BEGIN");

    // Remove ledger OUT movements for this production first
    await revertProductionOuts(client, id);

    // Then remove detail tables and header (ON DELETE CASCADE may already handle some)
    await client.query(
      `DELETE FROM product_production_discrepancy WHERE production_id = $1`,
      [id]
    );
    await client.query(
      `DELETE FROM product_production_staff WHERE production_id = $1`,
      [id]
    );
    await client.query(
      `DELETE FROM product_production_item WHERE production_id = $1`,
      [id]
    );

    const del = await client.query(
      `DELETE FROM product_production WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");
    if (del.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ id, message: "Production deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete production failed", err);
    res.status(500).json({ error: "Failed to delete production" });
  } finally {
    client.release();
  }
});

module.exports = router;
