const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask } = require("../middleware/auth");

// GET /customers?search=&page=&limit=&active=true|false
router.get("/", requireTask("can_see_settings"), async (req, res) => {
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

module.exports = router;
