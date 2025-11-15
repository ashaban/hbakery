// middleware/auth.js
const jwt = require("jsonwebtoken");
const logger = require("../winston");
const config = require("../config");

const secret = config.get("auth:secret");

/**
 * Verify JWT and attach user payload to req.user
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      logger.error("JWT verify error", err);
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
}

/**
 * Require a specific task code, e.g. 'can_add_sale'
 */
function requireTask(taskCode) {
  return (req, res, next) => {
    const token = req.headers["authorization"];
    jwt.verify(token, secret, (err, user) => {
      if (err) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!user || !Array.isArray(user.tasks)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (!user.tasks.includes(taskCode)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      next();
    });
  };
}

/**
 * Optional helper: require one of several tasks
 */
function requireAnyTask(taskCodes = []) {
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.tasks)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const has =
      taskCodes.length === 0 ||
      taskCodes.some((code) => req.user.tasks.includes(code));

    if (!has) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireTask,
  requireAnyTask,
};
