const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken, requireTask } = require("../middleware/auth");

/* ------------------------------------------------------------------
   🧾 COST TYPES
------------------------------------------------------------------ */

router.get(
  "/summary",
  requireTask("can_see_expenditures"),
  async (req, res) => {
    try {
      const {
        type_id,
        start_date_from,
        start_date_to,
        end_date_from,
        end_date_to,
      } = req.query;
      const params = [];
      const where = [];

      if (type_id) {
        const typeIds = Array.isArray(type_id) ? type_id : [type_id];
        const placeholders = typeIds
          .map((_, i) => `$${params.length + i + 1}`)
          .join(",");
        where.push(`e.type_id IN (${placeholders})`);
        params.push(...typeIds);
      }

      if (start_date_from && start_date_to) {
        params.push(start_date_from, start_date_to);
        where.push(
          `e.start_date BETWEEN $${params.length - 1} AND $${params.length}`
        );
      }

      if (end_date_from && end_date_to) {
        params.push(end_date_from, end_date_to);
        where.push(
          `e.end_date BETWEEN $${params.length - 1} AND $${params.length}`
        );
      }

      const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const sql = `
      SELECT 
        SUM(e.amount)::numeric(14,2) AS total_expenditure,
        SUM(CASE WHEN c.category = 'Production Cost' THEN e.amount ELSE 0 END)::numeric(14,2) AS total_production_cost,
        SUM(CASE WHEN c.category = 'Sale Cost' THEN e.amount ELSE 0 END)::numeric(14,2) AS total_sale_cost
      FROM expenditure e
      JOIN cost_type c ON c.id = e.type_id
      ${whereSQL};
    `;
      const { rows } = await pool.query(sql, params);
      res.json(rows[0] || {});
    } catch (err) {
      console.error("❌ Failed to fetch expenditure summary:", err);
      res.status(500).json({ error: "Failed to fetch expenditure summary" });
    }
  }
);

// ➕ Add Cost Type
router.post("/types", async (req, res) => {
  try {
    const { name, category, affects_margin = "Yes" } = req.body;
    if (!name || !category)
      return res.status(400).json({ error: "Missing name or category" });

    // Validate affects_margin value
    if (affects_margin !== "Yes" && affects_margin !== "No") {
      return res
        .status(400)
        .json({ error: "affects_margin must be 'Yes' or 'No'" });
    }

    const { rows } = await pool.query(
      `INSERT INTO cost_type (name, category, affects_margin)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, category, affects_margin]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Failed to add cost type:", err);
    res.status(500).json({ error: "Failed to add cost type" });
  }
});

// ✏️ Edit Cost Type
router.put("/types/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, affects_margin } = req.body;

    if (!name || !category || !affects_margin) {
      return res.status(400).json({
        error: "Missing required fields: name, category, or affects_margin",
      });
    }

    // Validate affects_margin value
    if (affects_margin !== "Yes" && affects_margin !== "No") {
      return res
        .status(400)
        .json({ error: "affects_margin must be 'Yes' or 'No'" });
    }

    const { rows } = await pool.query(
      `UPDATE cost_type
       SET name = $1, category = $2, affects_margin = $3
       WHERE id = $4
       RETURNING *`,
      [name, category, affects_margin, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Cost type not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Failed to update cost type:", err);
    res.status(500).json({ error: "Failed to update cost type" });
  }
});

// ❌ Delete Cost Type
router.delete("/types/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if cost type exists and if it's being used in expenditures
    const checkResult = await pool.query(
      `SELECT ct.id, COUNT(e.id) as usage_count 
       FROM cost_type ct 
       LEFT JOIN expenditure e ON ct.id = e.type_id 
       WHERE ct.id = $1 
       GROUP BY ct.id`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Cost type not found" });
    }

    if (checkResult.rows[0].usage_count > 0) {
      return res.status(400).json({
        error: "Cannot delete cost type. It is being used in expenditures.",
      });
    }

    await pool.query("DELETE FROM cost_type WHERE id = $1", [id]);
    res.json({ message: "Cost type deleted successfully" });
  } catch (err) {
    console.error("❌ Failed to delete cost type:", err);
    res.status(500).json({ error: "Failed to delete cost type" });
  }
});

// 📋 Get All Cost Types
// GET /expenditures/types?page=1&limit=10&search=bread&category=Production%20Cost&affects_margin=Yes
router.get("/types", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const offset = (page - 1) * limit;

    const search = (req.query.search || "").trim();

    // category can be a single string or repeated query param -> array
    const catParam = req.query.category;
    const categories = Array.isArray(catParam)
      ? catParam
      : catParam
      ? [catParam]
      : [];

    // affects_margin filter
    const affectsMarginParam = req.query.affects_margin;

    const where = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(ct.name ILIKE $${params.length})`);
    }

    if (categories.length) {
      params.push(categories);
      where.push(`ct.category = ANY($${params.length})`);
    }

    if (affectsMarginParam) {
      // Validate affects_margin value
      if (affectsMarginParam !== "Yes" && affectsMarginParam !== "No") {
        return res
          .status(400)
          .json({ error: "affects_margin must be 'Yes' or 'No'" });
      }
      params.push(affectsMarginParam);
      where.push(`ct.affects_margin = $${params.length}`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // Total count
    const totalSql = `
      SELECT COUNT(*)::int AS total
      FROM cost_type ct
      ${whereSQL};
    `;
    const totalRes = await pool.query(totalSql, params);
    const totalRecords = totalRes.rows[0]?.total ?? 0;
    const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

    // Paged rows
    const rowsSql = `
      SELECT 
        ct.*,
        (SELECT COUNT(*) FROM expenditure e WHERE e.type_id = ct.id) as usage_count
      FROM cost_type ct
      ${whereSQL}
      ORDER BY ct.category, ct.name
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
    const rowsRes = await pool.query(rowsSql, [...params, limit, offset]);

    res.json({
      data: rowsRes.rows,
      totalPages,
      totalRecords,
    });
  } catch (err) {
    console.error("❌ Failed to fetch cost types:", err);
    res.status(500).json({ error: "Failed to fetch cost types" });
  }
});

// 🔍 Get Single Cost Type
router.get("/types/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT 
        ct.*,
        (SELECT COUNT(*) FROM expenditure e WHERE e.type_id = ct.id) as usage_count
       FROM cost_type ct
       WHERE ct.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Cost type not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Failed to fetch cost type:", err);
    res.status(500).json({ error: "Failed to fetch cost type" });
  }
});

// 📊 Get Cost Type Statistics
router.get("/types-stats", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*) as total_types,
        COUNT(CASE WHEN affects_margin = 'Yes' THEN 1 END) as affects_margin_count,
        COUNT(CASE WHEN affects_margin = 'No' THEN 1 END) as no_affect_margin_count,
        category,
        COUNT(*) as category_count
      FROM cost_type 
      GROUP BY category
      ORDER BY category
    `);

    const stats = {
      total_types: 0,
      affects_margin_count: 0,
      no_affect_margin_count: 0,
      categories: [],
    };

    if (rows.length > 0) {
      // Sum up totals from all categories
      rows.forEach((row) => {
        stats.total_types += parseInt(row.category_count);
        stats.affects_margin_count += parseInt(row.affects_margin_count);
        stats.no_affect_margin_count += parseInt(row.no_affect_margin_count);
        stats.categories.push({
          category: row.category,
          count: parseInt(row.category_count),
        });
      });
    }

    res.json(stats);
  } catch (err) {
    console.error("❌ Failed to fetch cost type statistics:", err);
    res.status(500).json({ error: "Failed to fetch cost type statistics" });
  }
});

/* ------------------------------------------------------------------
   💰 EXPENDITURES
------------------------------------------------------------------ */

// ➕ Add Expenditure
router.post("/", requireTask("can_add_expenditure"), async (req, res) => {
  try {
    const { type_id, start_date, end_date, amount, description } = req.body;
    if (!type_id || !start_date || !end_date || !amount)
      return res.status(400).json({ error: "Missing required fields" });

    const { rows } = await pool.query(
      `INSERT INTO expenditure (type_id, start_date, end_date, amount, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [type_id, start_date, end_date, amount, description || null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Failed to add expenditure:", err);
    res.status(500).json({ error: "Failed to add expenditure" });
  }
});

// ✏️ Edit Expenditure
router.put("/:id", requireTask("can_edit_expenditure"), async (req, res) => {
  try {
    const { id } = req.params;
    const { type_id, start_date, end_date, amount, description } = req.body;

    const { rows } = await pool.query(
      `UPDATE expenditure
         SET type_id = $1,
             start_date = $2,
             end_date = $3,
             amount = $4,
             description = $5,
             updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [type_id, start_date, end_date, amount, description || null, id]
    );

    if (!rows.length)
      return res.status(404).json({ error: "Expenditure not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Failed to update expenditure:", err);
    res.status(500).json({ error: "Failed to update expenditure" });
  }
});

// ❌ Delete Expenditure
router.delete(
  "/:id",
  requireTask("can_delete_expenditure"),
  async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM expenditure WHERE id = $1", [id]);
      res.json({ message: "Expenditure deleted successfully" });
    } catch (err) {
      console.error("❌ Failed to delete expenditure:", err);
      res.status(500).json({ error: "Failed to delete expenditure" });
    }
  }
);

// 📋 Get All Expenditures (with pagination and join)
router.get("/", requireTask("can_see_expenditures"), async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 20, 1);
    const offset = (page - 1) * limit;

    // 🧩 Extract filters
    const {
      type_id,
      start_date_from,
      start_date_to,
      end_date_from,
      end_date_to,
    } = req.query;

    const params = [];
    const where = [];

    /* ----------------------------------------------------------
       🏷️ Filter by cost types (multiple)
    ---------------------------------------------------------- */
    if (type_id) {
      const typeIds = Array.isArray(type_id) ? type_id : [type_id];
      const placeholders = typeIds
        .map((_, i) => `$${params.length + i + 1}`)
        .join(",");
      where.push(`e.type_id IN (${placeholders})`);
      params.push(...typeIds);
    }

    /* ----------------------------------------------------------
       🗓️ Filter by start_date range
    ---------------------------------------------------------- */
    if (start_date_from && start_date_to) {
      params.push(start_date_from, start_date_to);
      where.push(
        `e.start_date BETWEEN $${params.length - 1} AND $${params.length}`
      );
    } else if (start_date_from) {
      params.push(start_date_from);
      where.push(`e.start_date >= $${params.length}`);
    } else if (start_date_to) {
      params.push(start_date_to);
      where.push(`e.start_date <= $${params.length}`);
    }

    /* ----------------------------------------------------------
       🕒 Filter by end_date range
    ---------------------------------------------------------- */
    if (end_date_from && end_date_to) {
      params.push(end_date_from, end_date_to);
      where.push(
        `e.end_date BETWEEN $${params.length - 1} AND $${params.length}`
      );
    } else if (end_date_from) {
      params.push(end_date_from);
      where.push(`e.end_date >= $${params.length}`);
    } else if (end_date_to) {
      params.push(end_date_to);
      where.push(`e.end_date <= $${params.length}`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    /* ----------------------------------------------------------
       🔢 Total Count
    ---------------------------------------------------------- */
    const totalSql = `
      SELECT COUNT(*)::int AS total
      FROM expenditure e
      JOIN cost_type c ON c.id = e.type_id
      ${whereSQL}
    `;
    const totalRes = await pool.query(totalSql, params);
    const totalRecords = totalRes.rows[0]?.total || 0;
    const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

    /* ----------------------------------------------------------
       🧾 Main Data Query
    ---------------------------------------------------------- */
    const dataSql = `
      SELECT 
        e.id,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        e.amount,
        e.description,
        c.id AS type_id,
        c.name AS cost_type,
        c.category AS cost_category
      FROM expenditure e
      JOIN cost_type c ON c.id = e.type_id
      ${whereSQL}
      ORDER BY e.start_date DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const result = await pool.query(dataSql, [...params, limit, offset]);
    console.log(JSON.stringify(result.rows, 0, 2));
    res.json({
      data: result.rows,
      totalPages,
      totalRecords,
    });
  } catch (err) {
    console.error("❌ Failed to fetch expenditures:", err);
    res.status(500).json({ error: "Failed to fetch expenditures" });
  }
});

module.exports = router;
