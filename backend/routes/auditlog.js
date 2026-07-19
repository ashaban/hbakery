// routes/auditlog.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask } = require("../middleware/auth");

/**
 * GET /auditlog - list audit entries with filters + pagination
 * ?user_id=&action=&entity_type=&outlet_id=&date_from=&date_to=&search=&page=&limit=
 */
router.get("/", requireTask("can_see_audit_log"), async (req, res) => {
  try {
    const {
      user_id,
      action,
      entity_type,
      outlet_id,
      date_from,
      date_to,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const conditions = [];
    const params = [];

    if (user_id) {
      params.push(user_id);
      conditions.push(`al.user_id = $${params.length}`);
    }
    if (action) {
      params.push(action);
      conditions.push(`al.action = $${params.length}`);
    }
    if (entity_type) {
      params.push(entity_type);
      conditions.push(`al.entity_type = $${params.length}`);
    }
    if (outlet_id) {
      params.push(outlet_id);
      conditions.push(`al.outlet_id = $${params.length}`);
    }
    if (date_from) {
      params.push(date_from);
      conditions.push(`al.created_at >= $${params.length}`);
    }
    if (date_to) {
      params.push(date_to);
      conditions.push(`al.created_at < ($${params.length}::date + interval '1 day')`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(al.description ILIKE $${params.length} OR al.user_name ILIKE $${params.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const countRes = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_log al ${whereClause}`,
      params
    );
    const total = Number(countRes.rows[0].total);

    params.push(limitNum, offset);
    const rowsRes = await pool.query(
      `SELECT al.id, al.user_id, al.user_name, al.action, al.entity_type,
              al.entity_id, al.outlet_id, o.name AS outlet_name,
              al.description, al.details, al.created_at
       FROM audit_log al
       LEFT JOIN outlet o ON o.id = al.outlet_id
       ${whereClause}
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: rowsRes.rows,
      pagination: {
        currentPage: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    console.error("❌ Failed to fetch audit log:", err);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

/**
 * GET /auditlog/actions - distinct action codes present in the log, for
 * populating the filter dropdown without hardcoding every action type.
 */
router.get("/actions", requireTask("can_see_audit_log"), async (req, res) => {
  try {
    const rows = await pool.query(
      `SELECT DISTINCT action FROM audit_log ORDER BY action`
    );
    res.json({ data: rows.rows.map((r) => r.action) });
  } catch (err) {
    console.error("❌ Failed to fetch audit actions:", err);
    res.status(500).json({ error: "Failed to fetch audit actions" });
  }
});

module.exports = router;
