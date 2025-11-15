// routes/item.js
const express = require("express");
const router = express.Router();
const formidable = require("formidable");
const pool = require("../db");
const { requireTask } = require("../middleware/auth");

router.get(
  "/availableStock",
  requireTask("can_see_settings"),
  async (req, res) => {
    try {
      const sql = `
      SELECT 
        i.id AS item_id,
        i.name AS item_name,
        i.human_readable_unit,
        i.conversion_factor,
        u.name AS base_unit,
        COALESCE(SUM(CASE WHEN il.type = 'IN' THEN il.quantity ELSE 0 END), 0) AS total_in,
        COALESCE(SUM(CASE WHEN il.type = 'OUT' THEN il.quantity ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN il.type = 'IN' THEN il.quantity ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN il.type = 'OUT' THEN il.quantity ELSE 0 END), 0) AS available_qty,
        MAX(il.movement_date) AS last_movement_date
      FROM item i
      LEFT JOIN itemunit u ON i.unit_id = u.id
      LEFT JOIN item_ledger il ON il.item_id = i.id
      GROUP BY i.id, i.name, i.human_readable_unit, i.conversion_factor, u.name
      ORDER BY i.name;
    `;

      const result = await pool.query(sql);
      res.json(result.rows);
    } catch (err) {
      console.error("❌ Error fetching available stock:", err);
      res.status(500).json({ error: "Failed to fetch available stock" });
    }
  }
);

// Create Item
router.post("/", requireTask("can_add_settings"), async (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      const result = await pool.query(
        "INSERT INTO item (name, unit_id, human_readable_unit, conversion_factor) VALUES ($1, $2, $3, $4) RETURNING *",
        [
          fields.name?.[0],
          fields.unit?.[0],
          fields.human_readable_unit?.[0] || null,
          fields.conversion_factor?.[0] || 1,
        ]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// Get all Items with Unit name and conversion data
router.get("/", requireTask("can_see_settings"), async (_, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        i.id, 
        i.name, 
        u.name AS unit, 
        u.id as unitid,
        i.human_readable_unit,
        i.conversion_factor
      FROM item i
      LEFT JOIN itemunit u ON i.unit_id = u.id
      ORDER BY i.id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Item
router.put("/:id", requireTask("can_add_settings"), async (req, res) => {
  const { id } = req.params;
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      const result = await pool.query(
        "UPDATE item SET name=$1, unit_id=$2, human_readable_unit=$3, conversion_factor=$4 WHERE id=$5 RETURNING *",
        [
          fields.name?.[0],
          fields.unit?.[0],
          fields.human_readable_unit?.[0] || null,
          fields.conversion_factor?.[0] || 1,
          id,
        ]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// Delete Item
router.delete("/:id", requireTask("can_add_settings"), async (req, res) => {
  try {
    await pool.query("DELETE FROM item WHERE id=$1", [req.params.id]);
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
