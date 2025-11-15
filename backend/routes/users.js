// routes/users.js
const express = require("express");
const formidable = require("formidable");
const bcrypt = require("bcrypt");
const pool = require("../db");
const logger = require("../winston");
const { requireTask } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /users/addUser
 */
router.post("/addUser", requireTask("can_add_users"), async (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields) => {
    try {
      if (err) return res.status(400).json({ error: "Invalid form data" });

      // Flatten arrays produced by Formidable v3
      for (const key in fields) {
        if (Array.isArray(fields[key])) fields[key] = fields[key][0];
      }

      const { name, title, email, phone, password } = fields;

      // Outlets: can be a JSON string or array
      let outlets = [];
      if (fields.outlets) {
        try {
          outlets = Array.isArray(fields.outlets)
            ? fields.outlets
            : JSON.parse(fields.outlets);
        } catch {
          outlets = [fields.outlets];
        }
      }

      // Roles: same logic
      let roles = [];
      if (fields.roles) {
        try {
          roles = Array.isArray(fields.roles)
            ? fields.roles
            : JSON.parse(fields.roles);
        } catch {
          roles = [fields.roles];
        }
      }

      const passwordHash = bcrypt.hashSync(password, 8);

      // Check if user exists
      const existing = await pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "User exists" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const primaryRoleId = roles[0] || null;

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
          primaryRoleId,
          passwordHash,
        ]);
        const userId = userResult.rows[0].id;

        // user_roles
        if (roles.length > 0) {
          for (const roleId of roles) {
            await client.query(
              `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
              [userId, roleId]
            );
          }
        }

        // outlets
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
        logger.error(error);
        res.status(500).json({ error: "Internal server error" });
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

/**
 * POST /users/editUser/:id
 */
router.post(
  ["/editUser", "/editUser/:id"],
  requireTask("can_edit_users"),
  (req, res) => {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields) => {
      try {
        if (err) return res.status(400).json({ error: "Invalid form data" });

        for (const key in fields) {
          if (Array.isArray(fields[key])) fields[key] = fields[key][0];
        }

        const userId = req.params.id;
        const { name, title, email, phone, password } = fields;

        // outlets as JSON string
        let outlets = [];
        if (fields.outlets) {
          try {
            outlets = JSON.parse(fields.outlets);
          } catch {
            outlets = [];
          }
        }

        // roles as JSON string
        let roles = [];
        if (fields.roles) {
          try {
            roles = JSON.parse(fields.roles);
          } catch {
            roles = [];
          }
        }

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

          const primaryRoleId = roles[0] || null;

          let userSql;
          let userParams;

          if (password && password !== "unchangedpassword") {
            const passwordHash = bcrypt.hashSync(password, 8);
            userSql = `
            UPDATE users
               SET name = $1, title = $2, email = $3, phone = $4, role = $5, password = $6
             WHERE id = $7
          `;
            userParams = [
              name,
              title,
              email,
              phone,
              primaryRoleId,
              passwordHash,
              userId,
            ];
          } else {
            userSql = `
            UPDATE users
               SET name = $1, title = $2, email = $3, phone = $4, role = $5
             WHERE id = $6
          `;
            userParams = [name, title, email, phone, primaryRoleId, userId];
          }

          await client.query(userSql, userParams);

          // Update user_roles
          await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [
            userId,
          ]);
          if (roles.length > 0) {
            for (const roleId of roles) {
              await client.query(
                `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
                [userId, roleId]
              );
            }
          }

          // Update outlet associations
          await client.query(`DELETE FROM outlet_staff WHERE user_id = $1`, [
            userId,
          ]);
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
          logger.error(error);
          res.status(500).json({ error: "Internal server error" });
        } finally {
          client.release();
        }
      } catch (error) {
        logger.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }
);

/**
 * DELETE /users/deleteUser/:id
 */
router.delete(
  "/deleteUser/:id",
  requireTask("can_delete_users"),
  async (req, res) => {
    try {
      await pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET /users/getUsers
 * GET /users/getUsers/:id
 * Returns users with roles[] and outlets[]
 */
router.get(
  ["/getUsers", "/getUsers/:id"],
  requireTask("can_see_users"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const sql = `
      SELECT 
        u.id,
        u.name,
        u.title,
        u.email,
        u.phone,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', r.id,
              'name', r.name,
              'display', r.display
            )
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'::json
        ) AS roles,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', o.id,
              'name', o.name
            )
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'::json
        ) AS outlets
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN outlet_staff os ON os.user_id = u.id
      LEFT JOIN outlet o ON o.id = os.outlet_id
      ${id ? `WHERE u.id = $1` : ""}
      GROUP BY u.id, u.name, u.title, u.email, u.phone
      ORDER BY u.id
    `;
      const result = await pool.query(sql, id ? [id] : []);
      res.json(result.rows);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET /users/getRoles
 * GET /users/getRoles/:id
 */
router.get(
  ["/getRoles", "/getRoles/:id"],
  requireTask("can_see_roles"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const sql = `SELECT * FROM roles ${
        id ? `WHERE id = $1` : ""
      } ORDER BY id`;
      const result = await pool.query(sql, id ? [id] : []);
      res.json(result.rows);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports = router;
