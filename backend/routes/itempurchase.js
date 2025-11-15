const formidable = require("formidable");
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken, requireTask } = require("../middleware/auth");

// Get all Purchases with Item info
router.get("/", requireTask("can_see_ingredients_stock"), async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Filters
    const { item_id, date, date_from, date_to, date_gt, date_lt } = req.query;

    // Build dynamic WHERE clause
    let whereClauses = [];
    let params = [];
    let paramIndex = 1;

    if (item_id) {
      whereClauses.push(`p.item_id = $${paramIndex++}`);
      params.push(item_id);
    }

    if (date) {
      whereClauses.push(`p.date::date = $${paramIndex++}`);
      params.push(date);
    }

    if (date_from && date_to) {
      whereClauses.push(
        `p.date::date BETWEEN $${paramIndex++} AND $${paramIndex++}`
      );
      params.push(date_from, date_to);
    } else if (date_from) {
      whereClauses.push(`p.date::date >= $${paramIndex++}`);
      params.push(date_from);
    } else if (date_to) {
      whereClauses.push(`p.date::date <= $${paramIndex++}`);
      params.push(date_to);
    }

    if (date_gt) {
      whereClauses.push(`p.date::date > $${paramIndex++}`);
      params.push(date_gt);
    }

    if (date_lt) {
      whereClauses.push(`p.date::date < $${paramIndex++}`);
      params.push(date_lt);
    }

    const whereSQL =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Main query with pagination
    const mainQuery = `
      SELECT 
        p.id,
        i.name AS item_name,
        i.id AS item_id,
        p.quantity AS quantity,
        p.price AS price,
        p.quantity * p.price AS total,
        TO_CHAR(p.date::date, 'DD-MM-YYYY') AS date
      FROM itempurchase p
      LEFT JOIN item i ON p.item_id = i.id
      ${whereSQL}
      ORDER BY p.id
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    params.push(limit, offset);

    const result = await pool.query(mainQuery, params);

    // Count total matching records
    const countQuery = `
      SELECT COUNT(*) FROM itempurchase p
      ${whereSQL};
    `;
    const countResult = await pool.query(
      countQuery,
      params.slice(0, paramIndex - 3)
    ); // exclude pagination params
    const totalRecords = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalRecords / limit);

    // Totals (quantity & amount) for filtered data
    const totalsQuery = `
      SELECT 
        SUM(p.quantity) AS total_quantity,
        SUM(ROUND(p.quantity * p.price, 2)) AS total_amount
      FROM itempurchase p
      ${whereSQL};
    `;
    const totalsResult = await pool.query(
      totalsQuery,
      params.slice(0, paramIndex - 3)
    );
    const { total_quantity, total_amount } = totalsResult.rows[0];
    // Response
    res.json({
      page,
      limit,
      totalRecords,
      totalPages,
      total_quantity,
      total_amount,
      data: result.rows,
    });
  } catch (err) {
    console.error("Error loading purchases:", err);
    res.status(500).json({ error: err.message });
  }
});

// Create Purchase
router.post("/", requireTask("can_purchase_ingredients"), async (req, res) => {
  try {
    const result = await pool.query(
      "INSERT INTO itempurchase (item_id, quantity, price, date) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.body.item_id, req.body.quantity, req.body.price, req.body.date]
    );
    const purchaseId = result.rows[0].id;
    await pool.query(
      `
        INSERT INTO item_ledger (item_id, purchase_id, type, quantity, unit_price, movement_date)
        VALUES ($1, $2, 'IN', $3, $4, $5)`,
      [
        req.body.item_id,
        purchaseId,
        req.body.quantity,
        req.body.price,
        req.body.date,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Purchase
router.put(
  "/:id",
  requireTask("can_edit_ingredients_purchase"),
  async (req, res) => {
    const { id } = req.params;
    let quantity = req.body.quantity;
    let item_id = req.body.item_id;
    try {
      const cur = await pool.query(
        `SELECT item_id, quantity::numeric, price::numeric FROM itempurchase WHERE id = $1`,
        [id]
      );
      if (cur.rows.length === 0) {
        await pool.query("ROLLBACK");
        return res.status(404).json({ error: "Not found" });
      }
      const old = cur.rows[0];
      // consumed from this lot (sum of OUT ledger pointing to this purchase)
      const used = await pool.query(
        `SELECT COALESCE(SUM(quantity),0)::numeric AS used_qty
        FROM item_ledger WHERE purchase_id = $1 AND type = 'OUT'`,
        [id]
      );
      const usedQty = Number(used.rows[0].used_qty);
      // Prevent shrinking below used
      const newQty = quantity != null ? Number(quantity) : Number(old.quantity);
      if (newQty < usedQty) {
        await pool.query("ROLLBACK");
        return res.status(400).json({
          error: "PURCHASE_QUANTITY_TOO_LOW",
          message: `Cannot reduce below already consumed quantity (${usedQty}).`,
        });
      }
      // Prevent changing item_id if any OUT exists
      const newItemId = item_id || old.item_id;
      if (Number(newItemId) !== Number(old.item_id) && usedQty > 0) {
        await pool.query("ROLLBACK");
        return res.status(400).json({
          error: "ITEM_CHANGE_BLOCKED",
          message:
            "Cannot change item for a purchase that already has consumption.",
        });
      }
      const result = await pool.query(
        "UPDATE itempurchase SET item_id=$1, quantity=$2, price=$3, date=$4 WHERE id=$5 RETURNING *",
        [req.body.item_id, quantity, req.body.price, req.body.date, id]
      );
      // Remove old IN ledger for this purchase (if any), then re-insert to reflect new qty/price
      await pool.query(
        `DELETE FROM item_ledger WHERE purchase_id = $1 AND type = 'IN'`,
        [id]
      );
      await pool.query(
        `INSERT INTO item_ledger (item_id, purchase_id, type, quantity, unit_price, movement_date)
        VALUES ($1, $2, 'IN', $3, $4, $5)`,
        [newItemId, id, newQty, req.body.price ?? old.price, req.body.date]
      );

      await pool.query("COMMIT");
      res.json(result.rows[0]);
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("Update purchase failed", err);
      res.status(500).json({ error: "Failed to update purchase" });
    }
  }
);

/** Delete purchase (only if no OUT consumption from this purchase) */
router.delete(
  "/:id",
  requireTask("can_delete_ingredients_purchases"),
  async (req, res) => {
    try {
      const { id } = req.params;

      await pool.query("BEGIN");

      const used = await pool.query(
        `SELECT COUNT(*)::int AS c
       FROM item_ledger
       WHERE purchase_id = $1 AND type = 'OUT'`,
        [id]
      );
      if (used.rows[0].c > 0) {
        await pool.query("ROLLBACK");
        return res.status(400).json({
          error: "PURCHASE_HAS_CONSUMPTION",
          message:
            "Cannot delete; stock from this purchase has already been consumed.",
        });
      }

      await pool.query(`DELETE FROM item_ledger WHERE purchase_id = $1`, [id]); // delete IN
      const del = await pool.query(`DELETE FROM itempurchase WHERE id = $1`, [
        id,
      ]);

      await pool.query("COMMIT");
      if (del.rowCount === 0)
        return res.status(404).json({ error: "Not found" });
      res.json({ id, message: "Purchase deleted" });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("Delete purchase failed", err);
      res.status(500).json({ error: "Failed to delete purchase" });
    } finally {
      pool.release();
    }
  }
);

module.exports = router;
