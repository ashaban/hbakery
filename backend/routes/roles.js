// routes/roles.js
const express = require("express");
const pool = require("../db");
const logger = require("../winston");
const { requireTask } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /roles
 * GET /roles/:id
 * Returns roles and optionally their tasks
 */
router.get(["/", "/:id"], requireTask("can_see_settings"), async (req, res) => {
  try {
    const { id } = req.params;
    const rolesRes = await pool.query(
      `SELECT id, name, display FROM roles ${
        id ? "WHERE id = $1" : ""
      } ORDER BY id`,
      id ? [id] : []
    );

    const roleIds = rolesRes.rows.map((r) => r.id);
    if (roleIds.length === 0) {
      return res.json([]);
    }

    const tasksRes = await pool.query(
      `
      SELECT rt.role_id, t.id, t.code, t.display, t.category
      FROM role_tasks rt
      JOIN tasks t ON t.id = rt.task_id
      WHERE rt.role_id = ANY($1::int[])
      ORDER BY rt.role_id, t.id
      `,
      [roleIds]
    );

    const tasksByRole = tasksRes.rows.reduce((acc, row) => {
      if (!acc[row.role_id]) acc[row.role_id] = [];
      acc[row.role_id].push({
        id: row.id,
        code: row.code,
        display: row.display,
        category: row.category,
      });
      return acc;
    }, {});

    const rolesWithTasks = rolesRes.rows.map((r) => ({
      ...r,
      tasks: tasksByRole[r.id] || [],
    }));

    res.json(rolesWithTasks);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /roles
 * body: { name, display }
 */
router.post("/", requireTask("can_add_settings"), async (req, res) => {
  try {
    const { name, display } = req.body;
    const result = await pool.query(
      `
        INSERT INTO roles (name, display)
        VALUES ($1, $2)
        RETURNING id, name, display
        `,
      [name, display]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /roles/:id
 * body: { name, display }
 */
router.put("/:id", requireTask("can_add_settings"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display } = req.body;

    const result = await pool.query(
      `
        UPDATE roles
           SET name = $1,
               display = $2
         WHERE id = $3
         RETURNING id, name, display
        `,
      [name, display, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /roles/:id
 */
router.delete("/:id", requireTask("can_add_settings"), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM roles WHERE id = $1`, [id]);
    res.json({ message: "Role deleted" });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /roles/:id/tasks
 * body: { tasks: [taskId1, taskId2, ...] }
 */
router.post("/:id/tasks", requireTask("can_add_settings"), async (req, res) => {
  const { id } = req.params;
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: "tasks must be an array of IDs" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM role_tasks WHERE role_id = $1`, [id]);

    for (const taskId of tasks) {
      await client.query(
        `INSERT INTO role_tasks (role_id, task_id) VALUES ($1, $2)`,
        [id, taskId]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Role tasks updated successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

module.exports = router;
