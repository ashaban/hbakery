// routes/itemunit.js
const formidable = require("formidable");
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask } = require("../middleware/auth");
const { recordAudit } = require("../modules/auditLog");

// Create Unit
router.post("/", requireTask("can_add_settings"), (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      const result = await pool.query(
        "INSERT INTO itemunit (name, shortname) VALUES ($1, $2) RETURNING *",
        [fields.name?.[0], fields.shortname?.[0]]
      );
      await recordAudit(pool, {
        user: req.user,
        action: "UNIT_CREATE",
        entity_type: "itemunit",
        entity_id: result.rows[0].id,
        description: `Added unit ${result.rows[0].name}`,
      });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// Get all Units
router.get("/", async (_, res) => {
  try {
    const result = await pool.query("SELECT * FROM itemunit ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Unit
router.put("/:id", requireTask("can_add_settings"), async (req, res) => {
  const { id } = req.params;
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      const result = await pool.query(
        "UPDATE itemunit SET name=$1, shortname=$2 WHERE id=$3 RETURNING *",
        [fields.name?.[0], fields.shortname?.[0], id]
      );
      await recordAudit(pool, {
        user: req.user,
        action: "UNIT_EDIT",
        entity_type: "itemunit",
        entity_id: Number(id),
        description: `Edited unit ${result.rows[0]?.name || `#${id}`}`,
      });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// Delete Unit
router.delete("/:id", requireTask("can_add_settings"), async (req, res) => {
  try {
    const existing = await pool.query("SELECT name FROM itemunit WHERE id=$1", [req.params.id]);
    await pool.query("DELETE FROM itemunit WHERE id=$1", [req.params.id]);
    await recordAudit(pool, {
      user: req.user,
      action: "UNIT_DELETE",
      entity_type: "itemunit",
      entity_id: Number(req.params.id),
      description: `Deleted unit ${existing.rows[0]?.name || `#${req.params.id}`}`,
    });
    res.json({ message: "Unit deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
