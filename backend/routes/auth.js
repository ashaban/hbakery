const express = require("express");
const formidable = require("formidable");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const logger = require("../winston");
const config = require("../config");

const router = express.Router();
const tokenDuration = config.get("auth:tokenDuration");
const secret = config.get("auth:secret");

/**
 * POST /auth/login
 * body: { email, password }
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const userRes = await pool.query(
      `SELECT id, name, email, password 
       FROM users 
       WHERE email = $1`,
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = userRes.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      logger.warn(`Password mismatch for user ${email}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Fetch roles
    const rolesRes = await pool.query(
      `
      SELECT r.id, r.name, r.display
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
      ORDER BY r.id
      `,
      [user.id]
    );
    const roles = rolesRes.rows;
    console.log(JSON.stringify(roles, 0, 2));

    // Fetch tasks via roles
    const tasksRes = await pool.query(
      `
      SELECT DISTINCT t.code
      FROM user_roles ur
      JOIN role_tasks rt ON rt.role_id = ur.role_id
      JOIN tasks t ON t.id = rt.task_id
      WHERE ur.user_id = $1
      ORDER BY t.code
      `,
      [user.id]
    );
    const tasks = tasksRes.rows.map((r) => r.code);
    console.log(JSON.stringify(tasks, 0, 2));

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: roles.map((r) => ({ id: r.id, name: r.name, display: r.display })),
      tasks,
    };

    const token = jwt.sign(payload, secret, { expiresIn: tokenDuration });

    res.json({
      username: user.email,
      name: user.name,
      roles,
      tasks,
      id: user.id,
      token,
      user: payload,
    });
  } catch (error) {
    logger.error("Login error", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------
// REFRESH TOKEN
// --------------------
router.post("/refreshToken", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, secret, (err, user) => {
      if (err) return res.sendStatus(403);
      const newToken = jwt.sign({ id: user.id }, secret, {
        expiresIn: tokenDuration,
      });

      res.json({ token: newToken });
    });
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

module.exports = router;
