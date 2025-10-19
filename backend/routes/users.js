const express = require("express");
const formidable = require("formidable");
const bcrypt = require("bcrypt");
const pool = require("../db");
const logger = require("../winston");

const router = express.Router();

router.post("/addUser", async (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields) => {
    try {
      if (err) return res.status(400).json({ error: "Invalid form data" });

      // Handle Formidable v3 arrays
      for (const key in fields) {
        if (Array.isArray(fields[key])) fields[key] = fields[key][0];
      }

      const { name, title, email, phone, role } = fields;
      const passwordHash = bcrypt.hashSync(fields.password, 8);

      // Check if user exists
      const existing = await pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "User exists" });
      }

      // Insert user
      const insertSQL = `
        INSERT INTO users (name, title, email, phone, role, password)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      await pool.query(insertSQL, [
        name,
        title,
        email,
        phone,
        role,
        passwordHash,
      ]);

      res.json({ message: "User added successfully" });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

router.post(["/editUser", "/editUser/:id"], (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields) => {
    try {
      if (err) return res.status(400).json({ error: "Invalid form data" });

      // Flatten Formidable arrays
      for (const key in fields) {
        if (Array.isArray(fields[key])) fields[key] = fields[key][0];
      }

      const userId = req.params.id;
      const { name, title, email, phone, role, password } = fields;

      // Check duplicate email
      const duplicate = await pool.query(
        `SELECT id FROM users WHERE email = $1 AND id != $2`,
        [email, userId]
      );
      if (duplicate.rows.length > 0) {
        return res.status(400).json({ error: "User exists" });
      }

      let sql, params;

      if (password && password !== "unchangedpassword") {
        const passwordHash = bcrypt.hashSync(password, 8);
        sql = `
          UPDATE users 
          SET name = $1, title = $2, email = $3, phone = $4, role = $5, password = $6
          WHERE id = $7
        `;
        params = [name, title, email, phone, role, passwordHash, userId];
      } else {
        sql = `
          UPDATE users 
          SET name = $1, title = $2, email = $3, phone = $4, role = $5
          WHERE id = $6
        `;
        params = [name, title, email, phone, role, userId];
      }

      await pool.query(sql, params);
      res.json({ message: "User updated successfully" });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

router.delete("/deleteUser/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get(["/getUsers", "/getUsers/:id"], async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        u.id,
        u.name,
        u.title,
        u.email,
        u.phone,
        r.name AS role,
        r.id AS roleid
      FROM users u
      INNER JOIN roles r ON r.id = u.role
      ${id ? `WHERE u.id = $1` : ""}
      ORDER BY u.id
    `;
    const result = await pool.query(sql, id ? [id] : []);
    res.json(result.rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get(["/getRoles", "/getRoles/:id"], async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `SELECT * FROM roles ${id ? `WHERE id = $1` : ""} ORDER BY id`;
    const result = await pool.query(sql, id ? [id] : []);
    res.json(result.rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
