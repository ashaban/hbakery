const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask } = require("../middleware/auth");
const { getCustomerDebtStatement } = require("../modules/customerDebt");

// GET /customers?search=&page=&limit=&active=true|false
// Deliberately not gated by can_see_settings: the customer list is basic
// reference data the Sales page needs to attribute a sale/debt to a
// customer, regardless of whether that user manages customer records.
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const active = req.query.active;

    let where = [];
    let params = [];
    let i = 0;

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      i++;
      where.push(`LOWER(name) LIKE $${i}`);
    }

    if (active === "true") {
      params.push(true);
      i++;
      where.push(`is_active = $${i}`);
    } else if (active === "false") {
      params.push(false);
      i++;
      where.push(`is_active = $${i}`);
    }

    const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";

    // Count
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM customer ${whereSQL}`,
      params
    );
    const totalRecords = Number(countRes.rows[0].count);
    const totalPages = Math.ceil(totalRecords / limit);

    // Data
    params.push(limit, offset);
    const dataRes = await pool.query(
      `
      SELECT id, name, phone, is_active, created_at
      FROM customer
      ${whereSQL}
      ORDER BY name ASC
      LIMIT $${i + 1} OFFSET $${i + 2}
      `,
      params
    );

    res.json({
      data: dataRes.rows,
      totalRecords,
      totalPages,
      currentPage: page,
    });
  } catch (err) {
    console.error("❌ Customer fetch failed", err);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// GET /customers/:id/debts - full debt statement (every named debt this
// customer has ever been given, across all sales, with repayment history)
router.get("/:id/debts", requireTask("can_see_debtors_report"), async (req, res) => {
  try {
    const rows = await getCustomerDebtStatement(pool, req.params.id);
    res.json({
      data: rows,
      totalOwed: rows.reduce((s, r) => s + Number(r.balance), 0),
    });
  } catch (err) {
    console.error("❌ Fetch customer debts failed", err);
    res.status(500).json({ error: "Failed to fetch customer debts" });
  }
});

module.exports = router;
