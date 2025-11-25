// routes/sales.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const salesController = require("../modules/salesDashboard");
const { authenticateToken, requireTask } = require("../middleware/auth");

const {
  validateSaleAvailability,
  recordSaleLedger,
  undoSaleLedger,
  reverseSaleLedger,
  getProductAvailableQty,
} = require("../modules/saleLedger");

// =========================
// Helpers
// =========================

async function resolveCustomer(client, payload) {
  let { customer_id, customer_name } = payload;

  if (!customer_id && customer_name) {
    const res = await client.query(
      `
      INSERT INTO customer (name, is_active)
      VALUES ($1, true)
      RETURNING id;
      `,
      [customer_name.trim()]
    );
    customer_id = res.rows[0].id;
  }

  return customer_id || null;
}

// Compute sale totals: amount, paid, balance
async function getSaleMoneySummary(client, saleId) {
  const totalRes = await client.query(
    `SELECT COALESCE(SUM(quantity * unit_price),0) AS total_amount
     FROM sale_item WHERE sale_id = $1`,
    [saleId]
  );
  const paidRes = await client.query(
    `SELECT COALESCE(SUM(amount),0) AS total_paid
     FROM sale_payment WHERE sale_id = $1`,
    [saleId]
  );
  const total = Number(totalRes.rows[0].total_amount);
  const paid = Number(paidRes.rows[0].total_paid);
  const balance = Math.max(total - paid, 0);

  return { total_amount: total, total_paid: paid, balance };
}

// Format detail response for UI
async function getSaleDetail(client, saleId) {
  const sale = await client.query(
    `
    SELECT 
      s.*, 
      c.name AS customer_name,
      o.name AS outlet_name,
      o.type AS outlet_type
    FROM sale s
    LEFT JOIN customer c ON c.id = s.customer_id
    LEFT JOIN outlet o ON o.id = s.outlet_id
    WHERE s.id = $1
    `,
    [saleId]
  );

  if (!sale.rows.length) return null;

  const items = await client.query(
    `
    SELECT 
      si.*, 
      p.name AS product_name
    FROM sale_item si
    JOIN product p ON p.id = si.product_id
    WHERE si.sale_id = $1
    ORDER BY si.id
    `,
    [saleId]
  );

  const payments = await client.query(
    `
    SELECT *
    FROM sale_payment
    WHERE sale_id = $1
    ORDER BY payment_date DESC, id DESC
    `,
    [saleId]
  );

  const money = await getSaleMoneySummary(client, saleId);

  return {
    sale: {
      ...sale.rows[0],
      ...money,
    },
    items: items.rows,
    payments: payments.rows,
  };
}

router.get("/salesanalytics/analytics", salesController.getSalesAnalytics);
router.get("/salesanalytics", salesController.getSales);
router.get("/salesanalytics/:id", salesController.getSaleDetails);

// =========================
// API Endpoints
// =========================

/**
 * POST /sales
 * Create immediate POSTED sale
 * Deducts stock immediately
 */
router.post("/", requireTask("can_add_sale"), async (req, res) => {
  const { outlet_id, sale_date, notes, items = [], payments = [] } = req.body;

  if (!outlet_id || !items.length) {
    return res.status(400).json({ error: "Missing outlet or items" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const customer_id = await resolveCustomer(client, req.body);

    // 1 Validate availability
    await validateSaleAvailability(client, outlet_id, items);

    // 2 Create sale header
    const ins = await client.query(
      `INSERT INTO sale (outlet_id, customer_id, sale_date, status, notes)
       VALUES ($1,$2,$3,'POSTED',$4)
       RETURNING id`,
      [outlet_id, customer_id, sale_date ?? new Date(), notes ?? null]
    );
    const saleId = ins.rows[0].id;

    // 3 Insert items
    for (const it of items) {
      await client.query(
        `INSERT INTO sale_item (sale_id, product_id, quantity, unit_price, quality)
         VALUES ($1,$2,$3,$4,$5)`,
        [saleId, it.product_id, it.quantity, it.unit_price ?? 0, it.quality]
      );
    }

    // 4 Insert payments (optional)
    for (const p of payments) {
      await client.query(
        `INSERT INTO sale_payment (sale_id, amount, payment_date, method, reference)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          saleId,
          p.amount,
          p.payment_date ?? new Date(),
          p.method ?? null,
          p.reference ?? null,
        ]
      );
    }

    // 5 Ledger outflow
    await recordSaleLedger(client, saleId, outlet_id, items, sale_date, notes);

    await client.query("COMMIT");

    const detail = await getSaleDetail(client, saleId);
    res.status(201).json({ message: "Sale created", ...detail });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "INSUFFICIENT_STOCK") return res.status(400).json(err);
    console.error("❌ Sale creation failed:", err);
    res.status(500).json({ error: "Failed to create sale" });
  } finally {
    client.release();
  }
});

/**
 * PUT /sales/:id
 * Edit sale: Undo ledger, reapply new items
 */
router.put("/:id", requireTask("can_edit_sale"), async (req, res) => {
  const { id } = req.params;
  const { outlet_id, sale_date, notes, items = [], payments = [] } = req.body;

  if (!outlet_id || !items.length) {
    return res.status(400).json({ error: "Missing outlet or items" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const saleQ = await client.query(
      `SELECT outlet_id FROM sale WHERE id = $1`,
      [id]
    );
    if (!saleQ.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Sale not found" });
    }

    // Validate new items stock
    await validateSaleAvailability(client, outlet_id, items);

    // Undo previous ledger
    await undoSaleLedger(client, id);

    const customer_id = await resolveCustomer(client, req.body);

    // Replace header
    await client.query(
      `UPDATE sale SET outlet_id=$1, customer_id=$2, sale_date=$3, notes=$4 
       WHERE id=$5`,
      [outlet_id, customer_id, sale_date ?? new Date(), notes ?? null, id]
    );

    // Replace items
    await client.query(`DELETE FROM sale_item WHERE sale_id=$1`, [id]);
    for (const it of items) {
      await client.query(
        `INSERT INTO sale_item (sale_id, product_id, quantity, unit_price, quality)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, it.product_id, it.quantity, it.unit_price ?? 0, it.quality]
      );
    }

    await client.query(`DELETE FROM sale_payment WHERE sale_id=$1`, [id]);
    for (const p of payments) {
      await client.query(
        `INSERT INTO sale_payment (sale_id, amount, payment_date, method, reference)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          id,
          p.amount,
          p.payment_date ?? new Date(),
          p.method ?? null,
          p.reference ?? null,
        ]
      );
    }

    // Re-apply ledger
    await recordSaleLedger(client, id, outlet_id, items, sale_date, notes);

    await client.query("COMMIT");

    const detail = await getSaleDetail(client, id);
    res.json({ message: "Sale updated", ...detail });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "INSUFFICIENT_STOCK") return res.status(400).json(err);
    console.error("❌ Sale update failed:", err);
    res.status(500).json({ error: "Failed to update sale" });
  } finally {
    client.release();
  }
});

/**
 * DELETE /sales/:id
 * CANCEL sale - reverse ledger safely (no deletion)
 */
router.delete("/:id", requireTask("can_delete_sale"), async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const saleQ = await client.query(`SELECT id FROM sale WHERE id=$1`, [id]);
    if (!saleQ.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Sale not found" });
    }

    // Reverse ledger (restore stock)
    await reverseSaleLedger(client, id, new Date(), "Sale cancelled");

    // Mark sale cancelled
    await client.query(`UPDATE sale SET status='CANCELLED' WHERE id=$1`, [id]);

    await client.query("COMMIT");
    res.json({ id, message: "Sale cancelled" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Cancel sale failed:", err);
    res.status(500).json({ error: "Failed to cancel sale" });
  } finally {
    client.release();
  }
});

/**
 * POST /sales/:id/payment
 * Add payment and return money summary
 */
router.post(
  "/:id/payment",
  requireTask("can_add_payment"),
  async (req, res) => {
    const { id } = req.params;
    const { amount, method, reference } = req.body;

    if (!amount) return res.status(400).json({ error: "Missing amount" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const saleQ = await client.query(
        `SELECT id FROM sale WHERE id = $1 AND status != 'CANCELLED'`,
        [id]
      );
      if (!saleQ.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Sale not found or cancelled" });
      }

      await client.query(
        `INSERT INTO sale_payment (sale_id, amount, method, reference)
       VALUES ($1,$2,$3,$4)`,
        [id, amount, method ?? null, reference ?? null]
      );

      await client.query("COMMIT");

      const detail = await getSaleDetail(client, id);
      res.json({ message: "Payment added", ...detail });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Payment failed:", err);
      res.status(500).json({ error: "Failed to add payment" });
    } finally {
      client.release();
    }
  }
);

/**
 * GET /sales/:id - detail
 */
router.get("/:id", requireTask("can_see_sales"), async (req, res) => {
  const client = await pool.connect();
  try {
    const detail = await getSaleDetail(client, req.params.id);
    if (!detail) return res.status(404).json({ error: "Not found" });
    res.json(detail);
  } catch (err) {
    console.error("❌ Fetch sale failed:", err);
    res.status(500).json({ error: "Failed to fetch sale" });
  } finally {
    client.release();
  }
});

/**
 * GET /sales - listing with filters + pagination
 */
router.get("/", requireTask("can_see_sales"), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  let where = ["status != 'CANCELLED'"];
  let params = [];
  let i = 0;

  if (req.query["outlet_id[]"] || req.query.outlet_id) {
    let outletIds = req.query["outlet_id[]"] || req.query.outlet_id;

    // Normalize into an array
    if (!Array.isArray(outletIds)) {
      outletIds = outletIds.toString().split(",").map(Number);
    } else {
      outletIds = outletIds.map(Number);
    }

    i++;
    params.push(outletIds);
    where.push(`s.outlet_id = ANY($${i})`);
  } else {
    i++;
    params.push([-1]);
    where.push(`s.outlet_id = ANY($${i})`);
  }

  if (req.query.start_date) {
    params.push(req.query.start_date);
    i++;
    where.push(`s.sale_date >= $${i}`);
  }

  if (req.query.end_date) {
    params.push(req.query.end_date);
    i++;
    where.push(`s.sale_date <= $${i}`);
  }
  if (req.query.payment_status === "PAID") {
    where.push(`(SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id) >=
              (SELECT SUM(quantity * unit_price) FROM sale_item si WHERE si.sale_id=s.id)`);
  }

  if (req.query.payment_status === "PART") {
    where.push(`(SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id) <
              (SELECT SUM(quantity * unit_price) FROM sale_item si WHERE si.sale_id=s.id)`);
  }

  const whereSQL = where.join(" AND ");

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM sale s WHERE ${whereSQL}`,
    params
  );
  const totalRecords = Number(countRes.rows[0].count);
  const totalPages = Math.ceil(totalRecords / limit);

  params.push(limit, offset);

  const query = `
    SELECT 
      s.*,
      o.name AS outlet,
      o.type AS outlet_type,
      c.name AS customer_name,
      (SELECT COUNT(*) FROM sale_item si WHERE si.sale_id = s.id) AS items_count,
      (SELECT SUM(quantity) FROM sale_item si WHERE si.sale_id = s.id) AS total_qty,
      (SELECT SUM(quantity * unit_price) FROM sale_item si WHERE si.sale_id = s.id) AS total_amount,
      (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id = s.id) AS paid_amount,
      ((SELECT SUM(quantity * unit_price) FROM sale_item si WHERE si.sale_id = s.id)
        - (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id = s.id)) AS balance
    FROM sale s
    LEFT JOIN outlet o ON s.outlet_id = o.id
    LEFT JOIN customer c ON s.customer_id = c.id
    WHERE ${whereSQL}
    ORDER BY s.sale_date DESC, s.id DESC
    LIMIT $${i + 1} OFFSET $${i + 2}
  `;

  const result = await pool.query(query, params);

  res.json({
    data: result.rows,
    totalRecords,
    totalPages,
    currentPage: page,
  });
});

module.exports = router;
