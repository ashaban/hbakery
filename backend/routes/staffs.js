const express = require("express");
const formidable = require("formidable");
const moment = require("moment");
const pool = require("../db");
const router = express.Router();
const { requireTask } = require("../middleware/auth");

/**
 * 🟢 GET /staff — with pagination, search, and status filter
 */
router.get("/", requireTask("can_see_staffs"), async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 10, 1);
  const offset = (page - 1) * limit;
  const search = (req.query.search || "").trim();
  const status = (req.query.status || "").trim();

  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(`s.name ILIKE $${params.length}`);
  }

  if (status) {
    params.push(status);
    where.push(`s.status = $${params.length}`);
  }

  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const totalSql = `SELECT COUNT(*)::int AS total FROM staff s ${whereSQL}`;
    const totalRes = await pool.query(totalSql, params);
    const totalRecords = totalRes.rows[0].total;
    const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

    const dataSql = `
      SELECT 
        s.id, s.name, s.phone, s.position,
        s.salary, TO_CHAR(s.hired_at, 'DD-MM-YYYY') AS hired_at,
        s.status
      FROM staff s
      ${whereSQL}
      ORDER BY s.name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const dataRes = await pool.query(dataSql, [...params, limit, offset]);

    res.json({
      data: dataRes.rows,
      totalPages,
      totalRecords,
    });
  } catch (err) {
    console.error("Error fetching staff:", err);
    res.status(500).json({ error: "Failed to load staff" });
  }
});

/**
 * 🟢 GET /staff/contracts/history — get all contract history
 */
router.get(
  "/contracts/history",
  requireTask("can_see_staffs"),
  async (req, res) => {
    try {
      const sql = `
      SELECT 
        sc.id,
        s.name AS staff_name,
        sc.position,
        sc.salary,
        TO_CHAR(sc.start_date, 'DD-MM-YYYY') AS start_date,
        TO_CHAR(sc.end_date, 'DD-MM-YYYY') AS end_date,
        sc.end_reason,
        sc.notes,
        s.status
      FROM staff_contracts sc
      JOIN staff s ON s.id = sc.staff_id
      ORDER BY sc.start_date DESC, s.name ASC
    `;

      const { rows } = await pool.query(sql);
      res.json({ data: rows });
    } catch (err) {
      console.error("Error fetching contract history:", err);
      res.status(500).json({ error: "Failed to load contract history" });
    }
  }
);

/**
 * 🟢 GET /staff/:id/contracts — get contract history for specific staff
 */
/**
 * 🟢 GET /staff/:id/contracts — get contract history for specific staff
 */
router.get(
  "/:id/contracts",
  requireTask("can_see_staffs"),
  async (req, res) => {
    const { id } = req.params;
    try {
      // First get the max id with null end_date
      const maxIdRes = await pool.query(
        `SELECT MAX(id) as max_id 
       FROM staff_contracts 
       WHERE staff_id = $1`,
        [id]
      );

      const maxActiveId = maxIdRes.rows[0]?.max_id || null;

      const sql = `
      SELECT 
        id,
        TO_CHAR(start_date, 'DD-MM-YYYY') AS start_date,
        TO_CHAR(end_date, 'DD-MM-YYYY') AS end_date,
        CASE 
          WHEN end_date IS NULL AND id = $2 THEN 'Current'
          WHEN end_date IS NULL THEN 'N/A'
          ELSE TO_CHAR(end_date, 'DD-MM-YYYY')
        END as display_end_date,
        end_reason,
        position,
        salary,
        notes,
        CASE 
          WHEN end_date IS NULL AND id = $2 THEN 'Contract Active'
          WHEN end_date IS NULL THEN 'Contract Activated'
          ELSE COALESCE(end_reason, 'Ended')
        END as display_status,
        (end_date IS NULL AND id = $2) as is_current
      FROM staff_contracts
      WHERE staff_id = $1
      ORDER BY id DESC
    `;

      const { rows } = await pool.query(sql, [id, maxActiveId]);
      res.json({ data: rows });
    } catch (err) {
      console.error("Error fetching staff contracts:", err);
      res.status(500).json({ error: "Failed to load staff contracts" });
    }
  }
);

/**
 * 🟢 POST /staff/contracts/end — end a staff contract
 */
router.post(
  "/contracts/end",
  requireTask("can_edit_staffs"),
  async (req, res) => {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields) => {
      if (err) return res.status(400).json({ error: "Invalid form data" });

      const staff_id = fields.staff_id?.[0] || fields.staff_id;
      let end_date = fields.end_date?.[0] || fields.end_date;
      end_date = moment(end_date, "DD-MM-YYYY").format("YYYY-MM-DD");
      const end_reason = fields.end_reason?.[0] || fields.end_reason;
      const notes = fields.notes?.[0] || "";
      const status = fields.status?.[0] || fields.status || "Resigned";

      if (!staff_id || !end_date || !end_reason) {
        return res
          .status(400)
          .json({ error: "Staff ID, end date, and reason are required" });
      }

      try {
        // Begin transaction
        await pool.query("BEGIN");

        // 1. Get current staff details
        const staffRes = await pool.query(
          "SELECT hired_at, position, salary FROM staff WHERE id = $1",
          [staff_id]
        );

        if (staffRes.rows.length === 0) {
          await pool.query("ROLLBACK");
          return res.status(404).json({ error: "Staff not found" });
        }

        const staff = staffRes.rows[0];

        // 2. Record contract end in staff_contracts table
        await pool.query(
          `INSERT INTO staff_contracts (staff_id, start_date, end_date, end_reason, position, salary, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            staff_id,
            staff.hired_at,
            end_date,
            end_reason,
            staff.position,
            staff.salary,
            notes,
          ]
        );

        // 3. Update staff status
        await pool.query("UPDATE staff SET status = $1 WHERE id = $2", [
          status,
          staff_id,
        ]);

        // Commit transaction
        await pool.query("COMMIT");

        res.json({ message: "Contract ended successfully" });
      } catch (err) {
        await pool.query("ROLLBACK");
        console.error("Error ending contract:", err);
        res.status(500).json({ error: "Failed to end contract" });
      }
    });
  }
);

/**
 * 🟢 POST /staff/contracts/rehire — rehire a staff member
 */
router.post(
  "/contracts/rehire",
  requireTask("can_edit_staffs"),
  async (req, res) => {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields) => {
      if (err) return res.status(400).json({ error: "Invalid form data" });

      const staff_id = fields.staff_id?.[0] || fields.staff_id;
      const position = fields.position?.[0] || fields.position;
      const salary = Number(fields.salary?.[0] || fields.salary || 0);
      let rehire_date = fields.rehire_date?.[0] || fields.rehire_date;
      rehire_date = moment(rehire_date, "DD-MM-YYYY").format("YYYY-MM-DD");
      const notes = fields.notes?.[0] || "";
      if (!staff_id || !position || !salary || !rehire_date) {
        return res.status(400).json({
          error: "Staff ID, position, salary, and rehire date are required",
        });
      }

      try {
        // Begin transaction
        await pool.query("BEGIN");

        // 1. Update staff details and set status to Active
        await pool.query(
          `UPDATE staff 
         SET position = $1, salary = $2, status = 'Active', hired_at = $3
         WHERE id = $4`,
          [position, salary, rehire_date, staff_id]
        );

        // 2. Record new contract in staff_contracts table
        await pool.query(
          `INSERT INTO staff_contracts (staff_id, start_date, position, salary, notes)
         VALUES ($1, $2, $3, $4, $5)`,
          [staff_id, rehire_date, position, salary, notes]
        );

        // Commit transaction
        await pool.query("COMMIT");

        res.json({ message: "Staff rehired successfully" });
      } catch (err) {
        await pool.query("ROLLBACK");
        console.error("Error rehiring staff:", err);
        res.status(500).json({ error: "Failed to rehire staff" });
      }
    });
  }
);

/**
 * 🟢 GET /staff/:id
 */
router.get("/:id", requireTask("can_see_staffs"), async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT s.*, 
              TO_CHAR(s.hired_at, 'DD-MM-YYYY') AS hired_at_formatted,
              (SELECT COUNT(*) FROM staff_contracts WHERE staff_id = s.id) as contract_count
       FROM staff s 
       WHERE s.id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

/**
 * 🟢 POST /staff
 */
router.post("/", requireTask("can_add_staffs"), async (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields) => {
    if (err) return res.status(400).json({ error: "Invalid form data" });

    const name = fields.name?.[0] || fields.name;
    let hired_at = fields.hired_at?.[0] || fields.hired_at;
    hired_at = moment(hired_at, "DD-MM-YYYY").format("YYYY-MM-DD");
    const phone = fields.phone?.[0] || "";
    const position = fields.position?.[0] || "";
    const salary = Number(fields.salary?.[0] || fields.salary || 0);
    const status = fields.status?.[0] || fields.status || "Active";

    if (!name) return res.status(400).json({ error: "Name is required" });

    try {
      // Begin transaction
      await pool.query("BEGIN");

      // 1. Insert into staff table
      const { rows } = await pool.query(
        `INSERT INTO staff (name, phone, position, salary, status, hired_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, phone || null, position || null, salary, status, hired_at]
      );

      const newStaff = rows[0];

      // 2. Record initial contract
      await pool.query(
        `INSERT INTO staff_contracts (staff_id, start_date, position, salary)
         VALUES ($1, $2, $3, $4)`,
        [newStaff.id, hired_at, position || null, salary]
      );

      // Commit transaction
      await pool.query("COMMIT");

      res.json({ message: "Staff added successfully", staff: newStaff });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Failed to add staff" });
    }
  });
});

/**
 * 🟢 PUT /staff/:id
 */
router.put("/:id", requireTask("can_edit_staffs"), async (req, res) => {
  const { id } = req.params;
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields) => {
    if (err) return res.status(400).json({ error: "Invalid form data" });

    const name = fields.name?.[0] || fields.name;
    let hired_at = fields.hired_at?.[0] || fields.hired_at;
    hired_at = moment(hired_at, "DD-MM-YYYY").format("YYYY-MM-DD");
    const phone = fields.phone?.[0] || "";
    const position = fields.position?.[0] || "";
    const salary = Number(fields.salary?.[0] || fields.salary || 0);
    const status = fields.status?.[0] || fields.status || "Active";

    if (!name) return res.status(400).json({ error: "Name is required" });

    try {
      await pool.query("BEGIN");
      const { rowCount } = await pool.query(
        `UPDATE staff
         SET name=$1, phone=$2, position=$3, salary=$4, status=$5, hired_at=$6
         WHERE id=$7`,
        [name, phone || null, position || null, salary, status, hired_at, id]
      );

      if (rowCount === 0) {
        await pool.query("ROLLBACK");
        return res.status(404).json({ error: "Staff not found" });
      }

      await pool.query(
        `UPDATE staff_contracts 
           SET position = $1, 
               salary = $2,
               start_date = $3
           WHERE id = (SELECT id FROM staff_contracts WHERE staff_id = $4 ORDER BY id DESC LIMIT 1)`,
        [position, salary, hired_at, id]
      );
      await pool.query("COMMIT");
      res.json({ message: "Staff updated successfully" });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Failed to update staff" });
    }
  });
});

/**
 * 🔴 DELETE /staff/:id
 */
router.delete("/:id", requireTask("can_delete_staffs"), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("BEGIN");

    // Delete contracts first (due to foreign key)
    await pool.query("DELETE FROM staff_contracts WHERE staff_id = $1", [id]);

    // Then delete staff
    const { rowCount } = await pool.query("DELETE FROM staff WHERE id = $1", [
      id,
    ]);

    await pool.query("COMMIT");

    if (rowCount === 0)
      return res.status(404).json({ error: "Staff not found" });

    res.json({ message: "Staff deleted successfully" });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to delete staff" });
  }
});

module.exports = router;
