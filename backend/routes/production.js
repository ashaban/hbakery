const moment = require("moment");
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { decodeToken, requireTask } = require("../middleware/auth");

const {
  getAvailableQty,
  allocateFifoOut,
  revertProductionOuts,
} = require("../modules/ledger");

const {
  recordProductLedger,
  deleteProductLedgerByProduction,
} = require("../modules/productledger");

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

router.post("/", requireTask("can_schedule_production"), async (req, res) => {
  const user = await decodeToken(req);
  const client = await pool.connect();
  try {
    const { notes, ingredients, staffs, products, planned_at, produced_at } =
      req.body;

    // backward compatibility — if single product fields exist
    if (!Array.isArray(products)) {
      req.body.products = [req.body];
    }
    const productList = req.body.products;

    if (!Array.isArray(productList) || productList.length === 0) {
      return res.status(400).json({ error: "No products provided" });
    }

    await client.query("BEGIN");

    // 1️⃣ Create a production batch
    const batchCode = `BATCH-${moment().format("YYYYMMDD-HHmmss")}`;
    const batchRes = await client.query(
      `INSERT INTO production_batch (batch_code, created_by)
       VALUES ($1, $2) RETURNING id`,
      [batchCode, req.user?.id || 1]
    );
    const batchId = batchRes.rows[0].id;

    // 2️⃣ Process each product as an independent production
    for (const prod of productList) {
      const {
        product_id,
        mode,
        qty_product,
        base_ingredient_id,
        base_ingredient_qty,
        notes,
        ingredients,
        discrepancies,
        group_choices,
        actual_qty,
        good_qty,
        damaged_qty,
        reject_qty,
      } = prod;

      if (
        !product_id ||
        !qty_product ||
        !Array.isArray(ingredients) ||
        ingredients.length === 0
      ) {
        throw new Error(`Invalid data for product ${product_id}`);
      }

      // 🧮 Stock check before allocation
      for (const ing of ingredients) {
        const available = await getAvailableQty(client, ing.item_id);
        if (Number(ing.qty_required) > available) {
          throw new Error(
            `INSUFFICIENT_STOCK:item=${ing.item_id}:available=${available}:required=${ing.qty_required}`
          );
        }
      }

      // 3️⃣ Create header
      const hdr = await client.query(
        `INSERT INTO product_production
          (batch_id, product_id, mode, qty_product,
           base_ingredient_id, base_ingredient_qty,
           notes, planned_at, produced_at,
           actual_qty, good_qty, damaged_qty, reject_qty,
           produced_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [
          batchId,
          product_id,
          mode,
          qty_product,
          base_ingredient_id || null,
          base_ingredient_qty || null,
          notes || null,
          planned_at || null,
          produced_at || null,
          actual_qty || null,
          good_qty || null,
          damaged_qty || null,
          reject_qty || null,
          user?.id,
        ]
      );
      const productionId = hdr.rows[0].id;

      // 4️⃣ Record ingredient groups and combinations
      if (Array.isArray(group_choices) && group_choices.length > 0) {
        for (const gc of group_choices) {
          await client.query(
            `INSERT INTO product_production_group_choice (production_id, group_id, combination_id)
             VALUES ($1, $2, $3)`,
            [productionId, gc.group_id, gc.combination_id]
          );
        }
      }

      // 5️⃣ Record ingredient items
      for (const ing of ingredients) {
        await client.query(
          `INSERT INTO product_production_item (production_id, item_id, qty_required, group_id, combination_id)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            productionId,
            ing.item_id,
            ing.qty_required,
            ing.group_id || null,
            ing.combination_id || null,
          ]
        );
      }

      // 6️⃣ Assign staff (if provided)
      if (Array.isArray(staffs) && staffs.length > 0) {
        for (const s of staffs) {
          if (!s.staff_id) continue;
          await client.query(
            `INSERT INTO product_production_staff (production_id, staff_id, role, notes)
             VALUES ($1,$2,$3,$4)`,
            [productionId, s.staff_id, s.role || null, s.notes || null]
          );
        }
      }

      // 7️⃣ Discrepancy reasons (if any)
      if (Array.isArray(discrepancies) && discrepancies.length > 0) {
        for (const descrepancy of discrepancies) {
          if (!descrepancy.id) {
            continue;
          }
          await client.query(
            `INSERT INTO product_production_discrepancy (production_id, reason_id, notes)
             VALUES ($1,$2,$3)`,
            [productionId, descrepancy.id, descrepancy.notes || null]
          );
        }
      }

      // 8️⃣ FIFO OUT allocations for ingredients
      for (const ing of ingredients) {
        await allocateFifoOut(
          client,
          productionId,
          ing.item_id,
          ing.qty_required,
          planned_at
        );
      }

      // 9️⃣ Ledger IN entries for produced goods
      if (actual_qty && produced_at) {
        await recordProductLedger(
          client,
          productionId,
          product_id,
          { good_qty, damaged_qty, reject_qty },
          produced_at
        );
      }
    }

    await client.query("COMMIT");
    res.json({
      batch_id: batchId,
      batch_code: batchCode,
      message: "Batch production created successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Batch production failed:", err);
    if (String(err.message).startsWith("INSUFFICIENT_STOCK")) {
      return res
        .status(400)
        .json({ error: "INSUFFICIENT_STOCK", message: err.message });
    }
    res.status(500).json({ error: "Failed to create production batch" });
  } finally {
    client.release();
  }
});

router.put(
  "/:batchId",
  requireTask("can_edit_production"),
  async (req, res) => {
    const user = await decodeToken(req);
    const client = await pool.connect();
    try {
      const { batchId } = req.params;
      const { notes, ingredients, staffs, products, planned_at, produced_at } =
        req.body;

      if (!batchId) {
        return res.status(400).json({ error: "Missing production ID" });
      }
      // backward compatibility — if single product fields exist
      let productList = products;
      if (!Array.isArray(productList)) {
        productList = [req.body];
      }

      if (!Array.isArray(productList) || productList.length === 0) {
        return res.status(400).json({ error: "No products provided" });
      }

      await client.query("BEGIN");

      // 2️⃣ Handle each product update (single product per PUT)
      for (const prod of productList) {
        const {
          production_id,
          product_id,
          mode,
          qty_product,
          base_ingredient_id,
          base_ingredient_qty,
          notes,
          ingredients,
          discrepancies,
          group_choices,
          actual_qty,
          good_qty,
          damaged_qty,
          reject_qty,
        } = prod;

        if (
          !product_id ||
          !qty_product ||
          !Array.isArray(ingredients) ||
          ingredients.length === 0
        ) {
          throw new Error(`Invalid data for product ${product_id}`);
        }

        // 3️⃣ Remove existing OUT and ledger records
        await revertProductionOuts(client, production_id);
        await deleteProductLedgerByProduction(client, production_id);

        // 4️⃣ Stock validation
        for (const ing of ingredients) {
          const available = await getAvailableQty(client, ing.item_id);
          if (Number(ing.qty_required) > available) {
            throw new Error(
              `INSUFFICIENT_STOCK:item=${ing.item_id}:available=${available}:required=${ing.qty_required}`
            );
          }
        }

        // 5️⃣ Update header
        await client.query(
          `UPDATE product_production
         SET product_id = $1,
             mode = $2,
             qty_product = $3,
             base_ingredient_id = $4,
             base_ingredient_qty = $5,
             notes = $6,
             planned_at = $7,
             produced_at = $8,
             actual_qty = $9,
             good_qty = $10,
             damaged_qty = $11,
             reject_qty = $12,
             updated_by = $13,
             updated_at = NOW()
         WHERE id = $14`,
          [
            product_id,
            mode,
            qty_product,
            base_ingredient_id || null,
            base_ingredient_qty || null,
            notes || null,
            planned_at || null,
            produced_at || null,
            actual_qty || null,
            good_qty || null,
            damaged_qty || null,
            reject_qty || null,
            user.id,
            production_id,
          ]
        );

        // 6️⃣ Rebuild group choices
        await client.query(
          `DELETE FROM product_production_group_choice WHERE production_id = $1`,
          [production_id]
        );
        if (Array.isArray(group_choices) && group_choices.length > 0) {
          for (const gc of group_choices) {
            await client.query(
              `INSERT INTO product_production_group_choice (production_id, group_id, combination_id)
             VALUES ($1, $2, $3)`,
              [production_id, gc.group_id, gc.combination_id]
            );
          }
        }

        // 7️⃣ Rebuild ingredients
        await client.query(
          `DELETE FROM product_production_item WHERE production_id = $1`,
          [production_id]
        );
        for (const ing of ingredients) {
          await client.query(
            `INSERT INTO product_production_item (production_id, item_id, qty_required, group_id, combination_id)
           VALUES ($1, $2, $3, $4, $5)`,
            [
              production_id,
              ing.item_id,
              ing.qty_required,
              ing.group_id || null,
              ing.combination_id || null,
            ]
          );
        }

        // 8️⃣ Rebuild staff
        await client.query(
          `DELETE FROM product_production_staff WHERE production_id = $1`,
          [production_id]
        );
        if (Array.isArray(staffs) && staffs.length > 0) {
          for (const s of staffs) {
            await client.query(
              `INSERT INTO product_production_staff (production_id, staff_id, role, notes)
             VALUES ($1,$2,$3,$4)`,
              [production_id, s.staff_id, s.role || null, s.notes || null]
            );
          }
        }

        // 9️⃣ Rebuild discrepancies
        await client.query(
          `DELETE FROM product_production_discrepancy WHERE production_id = $1`,
          [production_id]
        );
        if (Array.isArray(discrepancies) && discrepancies.length > 0) {
          for (const descrepancy of discrepancies) {
            if (!descrepancy.reason_id) {
              continue;
            }
            await client.query(
              `INSERT INTO product_production_discrepancy (production_id, reason_id, notes)
             VALUES ($1, $2, $3)`,
              [production_id, descrepancy.reason_id, descrepancy.notes || null]
            );
          }
        }

        // 🔟 FIFO OUT for ingredients
        for (const ing of ingredients) {
          await allocateFifoOut(
            client,
            production_id,
            ing.item_id,
            ing.qty_required,
            planned_at
          );
        }

        // 11️⃣ Ledger IN entries
        if (actual_qty && produced_at) {
          await recordProductLedger(
            client,
            production_id,
            product_id,
            { good_qty, damaged_qty, reject_qty },
            produced_at
          );
        }
      }

      await client.query("COMMIT");
      res.json({
        batch_id: batchId,
        message: "Production updated successfully",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Failed to update production:", err);
      if (String(err.message).startsWith("INSUFFICIENT_STOCK")) {
        return res
          .status(400)
          .json({ error: "INSUFFICIENT_STOCK", message: err.message });
      }
      res.status(500).json({ error: "Failed to update production" });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/batches/:batch_id/actual",
  requireTask("can_add_actual_production", "can_edit_actual_production"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { batch_id } = req.params;
      const { produced_at, notes, products } = req.body;

      if (!batch_id || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: "Invalid or missing payload" });
      }

      await client.query("BEGIN");

      // 🧾 Fetch all productions in this batch
      const batchRes = await client.query(
        `SELECT id, product_id FROM product_production WHERE batch_id = $1`,
        [batch_id]
      );
      const existingProductions = batchRes.rows;
      if (existingProductions.length === 0) {
        throw new Error(`No productions found for batch_id=${batch_id}`);
      }

      // 🕓 Update production header(s)
      for (const prod of products) {
        const {
          production_id,
          good_qty = 0,
          damaged_qty = 0,
          reject_qty = 0,
          actual_qty = 0,
          discrepancies = [],
        } = prod;

        // Ensure this production belongs to batch
        if (!existingProductions.find((p) => p.id === production_id)) {
          throw new Error(
            `Production ${production_id} not part of batch ${batch_id}`
          );
        }

        // 🧮 Update production quantities and timestamps
        await client.query(
          `UPDATE product_production
         SET good_qty=$1, damaged_qty=$2, reject_qty=$3,
             actual_qty=$4, produced_at=$5, notes=COALESCE($6, notes)
         WHERE id=$7`,
          [
            good_qty,
            damaged_qty,
            reject_qty,
            actual_qty,
            produced_at,
            notes,
            production_id,
          ]
        );

        // 🔁 Remove old product ledger entries for this production
        await deleteProductLedgerByProduction(client, production_id);

        // ✅ Record new product ledger entries
        await recordProductLedger(
          client,
          production_id,
          existingProductions.find((p) => p.id === production_id).product_id,
          { good_qty, damaged_qty, reject_qty },
          produced_at
        );

        // ⚙️ Update discrepancies (replace existing ones)
        await client.query(
          `DELETE FROM product_production_discrepancy WHERE production_id=$1`,
          [production_id]
        );
        for (const d of discrepancies) {
          if (!d.reason_id) continue;
          await client.query(
            `INSERT INTO product_production_discrepancy (production_id, reason_id, notes)
           VALUES ($1, $2, $3)`,
            [production_id, d.reason_id, d.notes || null]
          );
        }
      }

      await client.query("COMMIT");
      res.json({
        batch_id,
        message: "Actual production quantities saved successfully",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Failed to record actual production:", err);
      res.status(500).json({ error: "Failed to save actual production" });
    } finally {
      client.release();
    }
  }
);

router.get("/batches", requireTask("can_see_production"), async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const offset = (page - 1) * limit;

    const {
      search,
      product_id,
      team_leader,
      status,
      planned_start,
      planned_end,
      include_products,
    } = req.query;

    const where = [];
    const params = [];

    // 🔍 Search
    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        pb.batch_code ILIKE $${params.length}
        OR EXISTS (
          SELECT 1 FROM product_production pp
          JOIN product p ON p.id = pp.product_id
          WHERE pp.batch_id = pb.id AND p.name ILIKE $${params.length}
        )
      )`);
    }

    // 🎯 Product filter
    if (product_id) {
      params.push(product_id);
      where.push(`EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id AND pp.product_id = $${params.length}
      )`);
    }

    // 👷 Team leader filter
    if (team_leader) {
      params.push(`%${team_leader}%`);
      where.push(`EXISTS (
        SELECT 1
        FROM product_production pp
        JOIN product_production_staff ps ON ps.production_id = pp.id
        JOIN staff s ON s.id = ps.staff_id
        WHERE pp.batch_id = pb.id
          AND (ps.role = 'Team Leader' OR ps.role IS NULL)
          AND (s.name ILIKE $${params.length} OR s.id::text = $${params.length})
      )`);
    }

    // 🗓 Planned date range
    if (planned_start && planned_end) {
      params.push(planned_start, planned_end);
      where.push(`EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id
          AND pp.planned_at BETWEEN $${params.length - 1} AND $${params.length}
      )`);
    } else if (planned_start) {
      params.push(planned_start);
      where.push(`EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id AND pp.planned_at >= $${params.length}
      )`);
    } else if (planned_end) {
      params.push(planned_end);
      where.push(`EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id AND pp.planned_at <= $${params.length}
      )`);
    }

    // ⚙️ Status filter
    if (status?.toLowerCase() === "pending") {
      where.push(`EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id AND pp.produced_at IS NULL
      )`);
    } else if (status?.toLowerCase() === "completed") {
      where.push(`NOT EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id AND pp.produced_at IS NULL
      )`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // 1️⃣ Count total
    const countSql = `
      SELECT COUNT(DISTINCT pb.id)::int AS total
      FROM production_batch pb
      ${whereSQL}
    `;
    const countRes = await pool.query(countSql, params);
    const totalRecords = countRes.rows[0]?.total || 0;
    const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

    // 2️⃣ Fetch batches
    const listSql = `
      SELECT 
        pb.id,
        pb.batch_code,
        TO_CHAR(pb.created_at, 'DD-MM-YYYY HH24:MI') AS created_at,
        u.name AS created_by_name,
        COUNT(pp.id) AS total_products,
        SUM(pp.good_qty) AS total_good_qty,
        SUM(pp.damaged_qty) AS total_damaged_qty,
        SUM(pp.reject_qty) AS total_reject_qty,
        MIN(pp.planned_at) AS planned_at,
        MAX(pp.produced_at) AS produced_at,
        COUNT(*) FILTER (WHERE pp.produced_at IS NULL) AS unproduced_count,
        COUNT(*) FILTER (WHERE pp.produced_at IS NOT NULL) AS produced_count,
        COALESCE(
          (
            SELECT s.name
            FROM product_production_staff ps
            JOIN staff s ON s.id = ps.staff_id
            JOIN product_production ppx ON ppx.id = ps.production_id
            WHERE ppx.batch_id = pb.id
              AND ps.role = 'Team Leader'
            ORDER BY ps.id
            LIMIT 1
          ),
          (
            SELECT s.name
            FROM product_production_staff ps
            JOIN staff s ON s.id = ps.staff_id
            JOIN product_production ppx ON ppx.id = ps.production_id
            WHERE ppx.batch_id = pb.id
            ORDER BY ps.id
            LIMIT 1
          ),
          'N/A'
        ) AS team_leader_name
      FROM production_batch pb
      LEFT JOIN product_production pp ON pb.id = pp.batch_id
      LEFT JOIN users u ON u.id = pp.produced_by
      ${whereSQL}
      GROUP BY pb.id, pb.batch_code, pb.created_at, u.name
      ORDER BY COALESCE(MAX(pp.produced_at), MAX(pp.planned_at), pb.created_at) DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const listRes = await pool.query(listSql, [...params, limit, offset]);
    let batches = listRes.rows;

    // 3️⃣ Compute status field
    batches = batches.map((b) => {
      let status = "pending";
      if (b.produced_at) status = "completed";
      return { ...b, status };
    });

    // 4️⃣ Optionally include summarized products
    if (include_products === "true" && batches.length) {
      const batchIds = batches.map((b) => b.id);
      const prodRes = await pool.query(
        `
        SELECT 
          pp.batch_id,
          pp.id AS production_id,
          pp.product_id,
          p.name AS product_name,
          pp.qty_product,
          pp.actual_qty,
          pp.good_qty,
          pp.damaged_qty,
          pp.reject_qty,
          pp.produced_at
        FROM product_production pp
        JOIN product p ON p.id = pp.product_id
        WHERE pp.batch_id = ANY($1::int[])
        ORDER BY p.name
      `,
        [batchIds]
      );

      const productMap = {};
      for (const p of prodRes.rows) {
        if (!productMap[p.batch_id]) productMap[p.batch_id] = [];
        productMap[p.batch_id].push({
          production_id: p.production_id,
          product_id: p.product_id,
          product_name: p.product_name,
          qty_product: p.qty_product,
          actual_qty: p.actual_qty,
          good_qty: p.good_qty,
          damaged_qty: p.damaged_qty,
          reject_qty: p.reject_qty,
          produced: !!p.produced_at,
        });
      }

      batches = batches.map((b) => ({
        ...b,
        products: productMap[b.id] || [],
      }));
    }

    res.json({
      data: batches,
      totalRecords,
      totalPages,
      currentPage: page,
    });
  } catch (err) {
    console.error("❌ Failed to fetch batches:", err);
    res.status(500).json({ error: "Failed to fetch production batches" });
  }
});

router.get(
  "/batches/:id",
  requireTask("can_see_production"),
  async (req, res) => {
    const { id } = req.params;

    try {
      // 1️⃣ Batch header summary
      const batchHdrRes = await pool.query(
        `
      SELECT 
        pb.id,
        pb.batch_code,
        pb.created_at,
        u.name AS created_by_name,
        COUNT(pp.id) AS total_products,
        SUM(pp.good_qty) AS total_good_qty,
        SUM(pp.damaged_qty) AS total_damaged_qty,
        SUM(pp.reject_qty) AS total_reject_qty,
        COUNT(*) FILTER (WHERE pp.produced_at IS NULL) AS unproduced_count,
        COUNT(*) FILTER (WHERE pp.produced_at IS NOT NULL) AS produced_count,
        MIN(pp.planned_at) AS planned_at,
        MAX(pp.produced_at) AS produced_at,
        COALESCE(
          (
            SELECT s.name
            FROM product_production_staff ps
            JOIN staff s ON s.id = ps.staff_id
            JOIN product_production ppx ON ppx.id = ps.production_id
            WHERE ppx.batch_id = pb.id
              AND ps.role = 'Team Leader'
            ORDER BY ps.id
            LIMIT 1
          ),
          (
            SELECT s.name
            FROM product_production_staff ps
            JOIN staff s ON s.id = ps.staff_id
            JOIN product_production ppx ON ppx.id = ps.production_id
            WHERE ppx.batch_id = pb.id
            ORDER BY ps.id
            LIMIT 1
          ),
          'N/A'
        ) AS team_leader_name
      FROM production_batch pb
      LEFT JOIN product_production pp ON pp.batch_id = pb.id
      LEFT JOIN users u ON u.id = pb.created_by
      WHERE pb.id = $1
      GROUP BY pb.id, pb.batch_code, pb.created_at, u.name
      `,
        [id]
      );

      if (batchHdrRes.rows.length === 0)
        return res.status(404).json({ error: "Batch not found" });

      const batch = batchHdrRes.rows[0];

      // 🧮 Compute status
      let status = "pending";
      if (batch.produced_at) status = "completed";
      // 2️⃣ Fetch all product productions in this batch
      const productsRes = await pool.query(
        `
      SELECT 
        pp.id AS production_id,
        pp.product_id,
        p.name AS product_name,
        pp.qty_product,
        pp.actual_qty,
        pp.good_qty,
        pp.damaged_qty,
        pp.reject_qty,
        TO_CHAR(pp.planned_at, 'DD-MM-YYYY HH24:MI') AS planned_at,
        TO_CHAR(pp.produced_at, 'DD-MM-YYYY HH24:MI') AS produced_at,
        COALESCE(pp.notes, '') AS notes
      FROM product_production pp
      JOIN product p ON p.id = pp.product_id
      WHERE pp.batch_id = $1
      ORDER BY p.name
      `,
        [id]
      );

      const products = [];

      // 3️⃣ Attach each product’s ingredients, staff, and discrepancies
      for (const prod of productsRes.rows) {
        const [ingredientsRes, staffRes, discRes] = await Promise.all([
          pool.query(
            `
          SELECT 
            ppi.id,
            ppi.item_id,
            i.name AS item_name,
            ppi.qty_required,
            iu.shortname AS unit,
            ppi.group_id,
            pig.name AS group_name,
            pig.is_active AS group_active,
            ppi.combination_id,
            pigc.name AS combination_name
          FROM product_production_item ppi
          JOIN item i ON i.id = ppi.item_id
          LEFT JOIN itemunit iu ON iu.id = i.unit_id
          LEFT JOIN product_item_group pig ON pig.id = ppi.group_id
          LEFT JOIN product_item_group_combination pigc ON pigc.id = ppi.combination_id
          WHERE ppi.production_id = $1
          ORDER BY pig.name NULLS LAST, i.name
        `,
            [prod.production_id]
          ),
          pool.query(
            `
          SELECT 
            s.id AS staff_id, 
            s.name AS staff_name, 
            ps.role, 
            ps.notes
          FROM product_production_staff ps
          JOIN staff s ON s.id = ps.staff_id
          WHERE ps.production_id = $1
          ORDER BY s.name
        `,
            [prod.production_id]
          ),
          pool.query(
            `
          SELECT 
            d.id, 
            dr.name AS reason_name, 
            d.reason_id, 
            d.notes
          FROM product_production_discrepancy d
          JOIN discrepancy_reason dr ON dr.id = d.reason_id
          WHERE d.production_id = $1
          ORDER BY dr.name
        `,
            [prod.production_id]
          ),
        ]);

        products.push({
          ...prod,
          ingredients: ingredientsRes.rows,
          staff: staffRes.rows,
          discrepancies: discRes.rows,
        });
      }

      // ✅ Response
      res.json({
        batch: {
          ...batch,
          status,
        },
        products,
      });
    } catch (err) {
      console.error("❌ Failed to fetch batch details:", err);
      res.status(500).json({ error: "Failed to fetch batch details" });
    }
  }
);

router.delete(
  "/batches/:id",
  requireTask("can_delete_production"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;

      await client.query("BEGIN");

      // 1️⃣ Get all productions under this batch
      const { rows: productions } = await client.query(
        `SELECT id FROM product_production WHERE batch_id = $1`,
        [id]
      );

      if (!productions.length) {
        // No productions → safe to delete batch directly
        const delBatch = await client.query(
          `DELETE FROM production_batch WHERE id = $1`,
          [id]
        );
        await client.query("COMMIT");
        if (delBatch.rowCount === 0)
          return res.status(404).json({ error: "Batch not found" });
        return res.json({ id, message: "Batch deleted successfully" });
      }

      // 2️⃣ Loop through each production to revert its movements and delete its data
      for (const prod of productions) {
        const productionId = prod.id;

        // 2.1 Revert ingredient OUTs from item_ledger
        await revertProductionOuts(client, productionId);

        // 2.2 Revert product_ledger INs for this production
        await deleteProductLedgerByProduction(client, productionId);

        // 2.3 Delete subrecords
        await client.query(
          `DELETE FROM product_production_item WHERE production_id = $1`,
          [productionId]
        );
        await client.query(
          `DELETE FROM product_production_staff WHERE production_id = $1`,
          [productionId]
        );
        await client.query(
          `DELETE FROM product_production_group_choice WHERE production_id = $1`,
          [productionId]
        );
        await client.query(
          `DELETE FROM product_production_discrepancy WHERE production_id = $1`,
          [productionId]
        );

        // 2.4 Delete the production header
        await client.query(`DELETE FROM product_production WHERE id = $1`, [
          productionId,
        ]);
      }

      // 3️⃣ Finally delete the batch header itself
      const delBatch = await client.query(
        `DELETE FROM production_batch WHERE id = $1`,
        [id]
      );

      await client.query("COMMIT");

      if (delBatch.rowCount === 0)
        return res.status(404).json({ error: "Batch not found" });

      res.json({
        id,
        message: "Batch and related productions deleted successfully",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Failed to delete batch:", err);
      res.status(500).json({ error: "Failed to delete batch" });
    } finally {
      client.release();
    }
  }
);

router.get("/", requireTask("can_see_production"), async (req, res) => {
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
        pp.good_qty,
        pp.damaged_qty,
        pp.reject_qty,
        pp.batch_id,
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

router.get("/:id", requireTask("can_see_production"), async (req, res) => {
  const { id } = req.params;

  try {
    // 1️⃣ HEADER
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
      return res.status(404).json({ error: "Production not found" });
    }

    // 2️⃣ INGREDIENTS
    const linesRes = await pool.query(
      `
      SELECT 
        ppi.id,
        ppi.item_id, 
        i.name AS item_name,
        ppi.qty_required,
        iu.shortname AS unit,
        ppi.group_id,
        pig.name AS group_name,
        ppi.combination_id,
        pigc.name AS combination_name
      FROM product_production_item ppi
      JOIN item i ON i.id = ppi.item_id
      LEFT JOIN itemunit iu ON iu.id = i.unit_id
      LEFT JOIN product_item_group pig ON pig.id = ppi.group_id
      LEFT JOIN product_item_group_combination pigc ON pigc.id = ppi.combination_id
      WHERE ppi.production_id = $1
      ORDER BY pig.name NULLS LAST, i.name
    `,
      [id]
    );

    // 3️⃣ GROUP CHOICES
    const groupChoicesRes = await pool.query(
      `
      SELECT 
        gc.id,
        gc.group_id,
        pig.name AS group_name,
        gc.combination_id,
        pigc.name AS combination_name,
        gc.chosen_by,
        s.name AS chosen_by_name,
        gc.notes,
        gc.created_at
      FROM product_production_group_choice gc
      JOIN product_item_group pig ON pig.id = gc.group_id
      JOIN product_item_group_combination pigc ON pigc.id = gc.combination_id
      LEFT JOIN staff s ON s.id = gc.chosen_by
      WHERE gc.production_id = $1
      ORDER BY pig.name
    `,
      [id]
    );

    // 4️⃣ STAFF
    const staffRes = await pool.query(
      `
      SELECT 
        s.id AS staff_id, 
        s.name AS staff_name, 
        ps.role, 
        ps.notes
      FROM product_production_staff ps
      JOIN staff s ON s.id = ps.staff_id
      WHERE ps.production_id = $1
      ORDER BY s.name
    `,
      [id]
    );

    // 5️⃣ DISCREPANCIES
    const discRes = await pool.query(
      `
      SELECT 
        d.id, 
        dr.name AS reason_name, 
        d.reason_id, 
        d.notes
      FROM product_production_discrepancy d
      JOIN discrepancy_reason dr ON dr.id = d.reason_id
      WHERE d.production_id = $1
      ORDER BY dr.name
    `,
      [id]
    );

    // ✅ RESPONSE
    res.json({
      production: hdrRes.rows[0],
      items: linesRes.rows,
      group_choices: groupChoicesRes.rows,
      staff: staffRes.rows,
      discrepancies: discRes.rows,
    });
  } catch (err) {
    console.error("❌ Error fetching production:", err);
    res.status(500).json({ error: "Failed to fetch production details" });
  }
});

/** DELETE production */
router.delete(
  "/:id",
  requireTask("can_delete_production"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      await client.query("BEGIN");

      // Remove ledger OUT movements for this production first
      await revertProductionOuts(client, id);

      await deleteProductLedgerByProduction(client, id);

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
        `DELETE FROM product_production_group_choice WHERE production_id=$1`,
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
      if (del.rowCount === 0)
        return res.status(404).json({ error: "Not found" });
      res.json({ id, message: "Production deleted" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Delete production failed", err);
      res.status(500).json({ error: "Failed to delete production" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
