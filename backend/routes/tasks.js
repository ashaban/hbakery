// routes/tasks.js
const express = require("express");
const pool = require("../db");
const logger = require("../winston");
const { authenticateToken, requireTask } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /tasks
 */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, code, display, category FROM tasks ORDER BY id`
    );
    res.json(result.rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /tasks
 * body: { code, display, category }
 */
router.post("/", requireTask("manage_tasks"), async (req, res) => {
  try {
    const { code, display, category } = req.body;
    const result = await pool.query(
      `
        INSERT INTO tasks (code, display, category)
        VALUES ($1, $2, $3)
        RETURNING id, code, display, category
        `,
      [code, display, category || null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /tasks/:id
 */
router.put("/:id", requireTask("manage_tasks"), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, display, category } = req.body;

    const result = await pool.query(
      `
        UPDATE tasks
           SET code = $1,
               display = $2,
               category = $3
         WHERE id = $4
         RETURNING id, code, display, category
        `,
      [code, display, category || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /tasks/:id
 */
router.delete("/:id", requireTask("manage_tasks"), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM tasks WHERE id = $1`, [id]);
    res.json({ message: "Task deleted" });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
