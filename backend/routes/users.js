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
      const outlets = Array.isArray(fields.outlets)
        ? fields.outlets
        : fields.outlets
        ? [fields.outlets]
        : [];

      // Check if user exists
      const existing = await pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "User exists" });
      }

      // Start transaction
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Insert user
        const insertUserSQL = `
          INSERT INTO users (name, title, email, phone, role, password)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `;
        const userResult = await client.query(insertUserSQL, [
          name,
          title,
          email,
          phone,
          role,
          passwordHash,
        ]);

        const userId = userResult.rows[0].id;

        // Insert outlet associations
        if (outlets.length > 0) {
          const outletInsertSQL = `
            INSERT INTO outlet_staff (user_id, outlet_id) 
            VALUES ($1, $2)
          `;
          for (const outletId of outlets) {
            await client.query(outletInsertSQL, [userId, outletId]);
          }
        }

        await client.query("COMMIT");
        res.json({ message: "User added successfully" });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
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
      //fields.outlets is a stringified array
      const outlets = JSON.parse(fields.outlets);

      // Check duplicate email
      const duplicate = await pool.query(
        `SELECT id FROM users WHERE email = $1 AND id != $2`,
        [email, userId]
      );
      if (duplicate.rows.length > 0) {
        return res.status(400).json({ error: "User exists" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        let userSql, userParams;

        if (password && password !== "unchangedpassword") {
          const passwordHash = bcrypt.hashSync(password, 8);
          userSql = `
            UPDATE users 
            SET name = $1, title = $2, email = $3, phone = $4, role = $5, password = $6
            WHERE id = $7
          `;
          userParams = [name, title, email, phone, role, passwordHash, userId];
        } else {
          userSql = `
            UPDATE users 
            SET name = $1, title = $2, email = $3, phone = $4, role = $5
            WHERE id = $6
          `;
          userParams = [name, title, email, phone, role, userId];
        }

        await client.query(userSql, userParams);

        // Update outlet associations
        // First remove existing associations
        await client.query("DELETE FROM outlet_staff WHERE user_id = $1", [
          userId,
        ]);
        // Then add new associations
        if (outlets.length > 0) {
          const outletInsertSQL = `
            INSERT INTO outlet_staff (user_id, outlet_id) 
            VALUES ($1, $2)
          `;
          for (const outletId of outlets) {
            await client.query(outletInsertSQL, [userId, outletId]);
          }
        }

        await client.query("COMMIT");
        res.json({ message: "User updated successfully" });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

router.delete("/deleteUser/:id", async (req, res) => {
  try {
    // outlet_staff records will be automatically deleted due to ON DELETE CASCADE
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
        r.id AS roleid,
        COALESCE(
          json_agg(
            json_build_object(
              'id', o.id,
              'name', o.name
            ) 
            ORDER BY o.name
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'
        ) as outlets
      FROM users u
      INNER JOIN roles r ON r.id = u.role
      LEFT JOIN outlet_staff os ON os.user_id = u.id
      LEFT JOIN outlet o ON o.id = os.outlet_id
      ${id ? `WHERE u.id = $1` : ""}
      GROUP BY u.id, u.name, u.title, u.email, u.phone, r.name, r.id
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
