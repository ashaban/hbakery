const express = require("express");
const formidable = require("formidable");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const logger = require("../winston");
const config = require("../config");
const { recordAudit } = require("../modules/auditLog");

const router = express.Router();
const tokenDuration = config.get("auth:tokenDuration");
const secret = config.get("auth:secret");

/**
 * Builds the JWT payload for a user: identity plus the roles, tasks and
 * outlets every guard downstream reads.
 *
 * Both login and refresh go through here. Refresh in particular MUST
 * produce the full shape — requireTask rejects any token whose `tasks`
 * is not an array, so a refresh that returned identity alone would
 * silently 403 every task-gated call for the rest of the session.
 * Re-reading from the database rather than copying the old claims also
 * means a role change takes effect at the next refresh instead of
 * lingering until the token finally expires.
 *
 * Returns null if the user no longer exists.
 */
async function buildUserPayload(userId) {
  const userRes = await pool.query(
    `SELECT id, name, email FROM users WHERE id = $1`,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) return null;

  const [rolesRes, tasksRes, outletsRes] = await Promise.all([
    pool.query(
      `SELECT r.id, r.name, r.display
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
       ORDER BY r.id`,
      [userId]
    ),
    pool.query(
      `SELECT DISTINCT t.code
       FROM user_roles ur
       JOIN role_tasks rt ON rt.role_id = ur.role_id
       JOIN tasks t ON t.id = rt.task_id
       WHERE ur.user_id = $1
       ORDER BY t.code`,
      [userId]
    ),
    pool.query(
      `SELECT os.outlet_id, o.name
       FROM outlet_staff os
       JOIN outlet o ON o.id = os.outlet_id
       WHERE os.user_id = $1
       ORDER BY o.id`,
      [userId]
    ),
  ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: rolesRes.rows.map((r) => ({ id: r.id, name: r.name, display: r.display })),
    tasks: tasksRes.rows.map((r) => r.code),
    outlets: outletsRes.rows,
  };
}


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

    const payload = await buildUserPayload(user.id);
    if (!payload) return res.status(401).json({ error: "Invalid credentials" });
    const { roles, tasks, outlets } = payload;

    const token = jwt.sign(payload, secret, { expiresIn: tokenDuration });

    await recordAudit(pool, {
      user: payload,
      action: "LOGIN",
      entity_type: "users",
      entity_id: user.id,
      description: `${user.name} logged in`,
    });

    res.json({
      username: user.email,
      name: user.name,
      roles,
      tasks,
      outlets,
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

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      return res.sendStatus(403);
    }

    // Rebuild the whole payload. Re-signing just { id } here was
    // dropping roles, tasks and outlets, which made every task-gated
    // route 403 from the first refresh onwards.
    const payload = await buildUserPayload(decoded.id);
    if (!payload) return res.sendStatus(401);

    res.json({
      token: jwt.sign(payload, secret, { expiresIn: tokenDuration }),
      user: payload,
      tasks: payload.tasks,
    });
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

module.exports = router;
