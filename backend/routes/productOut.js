// routes/productOut.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

const {
  validateOutAvailability,
  recordOutLedger,
  undoOutLedger,
  reverseOutLedger,
} = require("../modules/productOutLedger");

/** ---------------------------
 * Helpers for detail payloads
 * --------------------------- */
async function getOutDetail(client, outId) {
  const hdr = await client.query(
    `
    SELECT po.*,
           o.name AS outlet_name,
           o.type AS outlet_type,
           u.name  AS created_by_name
    FROM product_out po
    JOIN outlet o ON o.id = po.outlet_id
    LEFT JOIN users u ON u.id = po.created_by
    WHERE po.id = $1
    `,
    [outId]
  );
  if (!hdr.rows.length) return null;

  const items = await client.query(
    `
    SELECT i.*, p.name AS product_name
    FROM product_out_item i
    JOIN product p ON p.id = i.product_id
    WHERE i.out_id = $1
    ORDER BY i.id
    `,
    [outId]
  );

  // optional: compute money-valued total using ledger (cost valuation)
  const valuation = await client.query(
    `
    SELECT COALESCE(SUM(quantity * unit_cost),0) AS total_cost_value
    FROM product_ledger
    WHERE product_out_id=$1 AND movement_type='OUT'
    `,
    [outId]
  );

  return {
    out: {
      ...hdr.rows[0],
      total_cost_value: Number(valuation.rows[0].total_cost_value) || 0,
    },
    items: items.rows,
  };
}

/** ---------------------------
 * POST /productOut (create)
 * --------------------------- */
router.post("/", async (req, res) => {
  const { outlet_id, out_date, reason, notes, items = [] } = req.body;
  if (!outlet_id || !items.length) {
    return res.status(400).json({ error: "Missing outlet or items" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Validate availability (aggregated by product/quality)
    await validateOutAvailability(client, outlet_id, items);

    // Header
    const ins = await client.query(
      `
      INSERT INTO product_out (outlet_id, out_date, reason, notes, status, created_by)
      VALUES ($1, $2, $3, $4, 'POSTED', $5)
      RETURNING id
      `,
      [
        outlet_id,
        out_date ?? new Date(),
        reason || "N/A",
        notes || null,
        req.user?.id || 1,
      ]
    );
    const outId = ins.rows[0].id;

    // Items
    for (const it of items) {
      await client.query(
        `
        INSERT INTO product_out_item (out_id, product_id, quantity, quality, remarks)
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          outId,
          it.product_id,
          it.quantity,
          (it.quality || "GOOD").toUpperCase(),
          it.remarks || null,
        ]
      );
    }

    // Ledger (FIFO per lot)
    await recordOutLedger(client, outId, outlet_id, items, out_date, notes);

    await client.query("COMMIT");
    const detail = await getOutDetail(client, outId);
    res.status(201).json({ message: "Product OUT recorded", ...detail });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "INSUFFICIENT_STOCK") return res.status(400).json(err);
    console.error("❌ Product OUT create failed:", err);
    res.status(500).json({ error: "Failed to record OUT" });
  } finally {
    client.release();
  }
});

/** ---------------------------
 * PUT /productOut/:id (edit)
 * --------------------------- */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { outlet_id, out_date, reason, notes, items = [] } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exists = await client.query(
      `SELECT id FROM product_out WHERE id=$1 AND status!='CANCELLED'`,
      [id]
    );
    if (!exists.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Record not found or cancelled" });
    }

    // Validate new items stock first
    await validateOutAvailability(client, outlet_id, items);

    // Remove previous ledger for this OUT (we’ll reapply from items)
    await undoOutLedger(client, id);

    // Update header
    await client.query(
      `
      UPDATE product_out
      SET outlet_id=$1, out_date=$2, reason=$3, notes=$4
      WHERE id=$5
      `,
      [outlet_id, out_date ?? new Date(), reason || "N/A", notes || null, id]
    );

    // Replace items
    await client.query(`DELETE FROM product_out_item WHERE out_id=$1`, [id]);
    for (const it of items) {
      await client.query(
        `INSERT INTO product_out_item (out_id, product_id, quantity, quality, remarks)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          id,
          it.product_id,
          it.quantity,
          (it.quality || "GOOD").toUpperCase(),
          it.remarks || null,
        ]
      );
    }

    // Re-apply ledger (FIFO)
    await recordOutLedger(client, id, outlet_id, items, out_date, notes);

    await client.query("COMMIT");
    const detail = await getOutDetail(client, id);
    res.json({ message: "Product OUT updated", ...detail });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "INSUFFICIENT_STOCK") return res.status(400).json(err);
    console.error("❌ Product OUT update failed:", err);
    res.status(500).json({ error: "Failed to update OUT" });
  } finally {
    client.release();
  }
});

/** ---------------------------
 * DELETE /productOut/:id (cancel/reverse)
 * Keeps header but marks CANCELLED and restores stock per lot.
 * --------------------------- */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exists = await client.query(
      `SELECT id FROM product_out WHERE id=$1 AND status!='CANCELLED'`,
      [id]
    );
    if (!exists.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found or already cancelled" });
    }

    // Reverse per lot (insert negative OUT rows)
    await reverseOutLedger(client, id, new Date(), "Reversal: OUT Cancelled");

    // Mark cancelled (retain audit)
    await client.query(
      `UPDATE product_out SET status='CANCELLED' WHERE id=$1`,
      [id]
    );

    await client.query("COMMIT");
    res.json({ id, message: "Product OUT cancelled" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Product OUT cancel failed:", err);
    res.status(500).json({ error: "Failed to cancel OUT" });
  } finally {
    client.release();
  }
});

/** ---------------------------
 * GET /productOut/:id (detail)
 * --------------------------- */
router.get("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const detail = await getOutDetail(client, req.params.id);
    if (!detail) return res.status(404).json({ error: "Not found" });
    res.json(detail);
  } catch (err) {
    console.error("❌ Product OUT fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch detail" });
  } finally {
    client.release();
  }
});

/** ---------------------------
 * GET /productOut (listing + filters + pagination)
 * Filters: outlet_id, start_date, end_date, reason (ILIKE), status
 * --------------------------- */
router.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  let i = 0;

  if (req.query.outlet_id) {
    params.push(req.query.outlet_id);
    i++;
    where.push(`po.outlet_id = $${i}`);
  }
  if (req.query.status) {
    params.push(req.query.status);
    i++;
    where.push(`po.status = $${i}`);
  }
  if (req.query.start_date) {
    params.push(req.query.start_date);
    i++;
    where.push(`po.out_date >= $${i}`);
  }
  if (req.query.end_date) {
    params.push(req.query.end_date);
    i++;
    where.push(`po.out_date <= $${i}`);
  }
  if (req.query.reason) {
    params.push(`%${req.query.reason}%`);
    i++;
    where.push(`po.reason ILIKE $${i}`);
  }

  const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";

  // Count header rows
  const countRes = await pool.query(
    `SELECT COUNT(*) FROM product_out po ${whereSQL}`,
    params
  );
  const totalRecords = Number(countRes.rows[0].count) || 0;
  const totalPages = Math.ceil(totalRecords / limit);

  // Listing with quick rollups
  params.push(limit, offset);
  const list = await pool.query(
    `
    SELECT
      po.*,
      o.name AS outlet_name,
      o.type AS outlet_type,
      -- value the OUT using ledger (so matches FIFO cost)
      (
        SELECT COALESCE(SUM(quantity * unit_cost),0)
        FROM product_ledger
        WHERE product_out_id = po.id
          AND movement_type='OUT'
      ) AS total_cost_value,
      -- items_count
      (SELECT COUNT(*) FROM product_out_item i WHERE i.out_id = po.id) AS items_count,
      -- total_qty
      (SELECT COALESCE(SUM(quantity),0) FROM product_out_item i WHERE i.out_id = po.id) AS total_qty
    FROM product_out po
    JOIN outlet o ON o.id = po.outlet_id
    ${whereSQL}
    ORDER BY po.out_date DESC, po.id DESC
    LIMIT $${i + 1} OFFSET $${i + 2}
    `,
    params
  );

  res.json({
    data: list.rows,
    totalRecords,
    totalPages,
    currentPage: page,
  });
});

module.exports = router;
