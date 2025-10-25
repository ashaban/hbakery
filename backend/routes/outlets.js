const express = require("express");
const pool = require("../db");
const router = express.Router();

/**
 * GET /outlets - Get all outlets with pagination and filtering
 */
router.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : "%";
  const type = req.query.type || "%";

  try {
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM outlet 
       WHERE name ILIKE $1 AND type ILIKE $2 AND is_active = true`,
      [search, type]
    );
    const totalRecords = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalRecords / limit);

    // Get outlets
    const result = await pool.query(
      `SELECT id, name, type, is_active, is_main, location,
              TO_CHAR(created_at, 'DD-MM-YYYY') AS created_at
       FROM outlet 
       WHERE name ILIKE $1 AND type ILIKE $2 AND is_active = true
       ORDER BY 
         CASE type 
           WHEN 'MAIN' THEN 1
           WHEN 'SHOP' THEN 2
           WHEN 'CAR' THEN 3
           ELSE 4
         END,
         name
       LIMIT $3 OFFSET $4`,
      [search, type, limit, offset]
    );
    res.json({
      data: result.rows,
      totalRecords,
      totalPages,
      currentPage: page,
    });
  } catch (err) {
    console.error("Error fetching outlets:", err);
    res.status(500).json({ error: "Failed to fetch outlets" });
  }
});

/**
 * GET /outlets/:id - Get single outlet by ID
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, type, is_active, is_main, location, created_at
       FROM outlet WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Outlet not found" });
    }

    res.json({ outlet: result.rows[0] });
  } catch (err) {
    console.error("Error fetching outlet:", err);
    res.status(500).json({ error: "Failed to fetch outlet" });
  }
});

/**
 * POST /outlets - Create new outlet
 */
router.post("/", async (req, res) => {
  const { name, type, location, is_main = false } = req.body;
  console.log(JSON.stringify(req.body, 0, 2));
  // Validate required fields
  if (!name || !type) {
    return res.status(400).json({ error: "Name and type are required" });
  }

  // Validate type
  const validTypes = ["MAIN", "SHOP", "CAR"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: "Type must be MAIN, SHOP, or CAR" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // If this is being set as main outlet, unset any existing main outlet
    if (is_main) {
      await client.query(
        "UPDATE outlet SET is_main = false WHERE is_main = true"
      );
    }

    const result = await client.query(
      `INSERT INTO outlet (name, type, location, is_main)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, type, location, is_main, created_at`,
      [name, type, location || null, is_main]
    );

    await client.query("COMMIT");
    res.status(201).json({
      message: "Outlet created successfully",
      outlet: result.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating outlet:", err);

    if (err.code === "23505") {
      // Unique constraint violation
      res.status(400).json({ error: "Outlet name already exists" });
    } else {
      res.status(500).json({ error: "Failed to create outlet" });
    }
  } finally {
    client.release();
  }
});

/**
 * PUT /outlets/:id - Update outlet
 */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, type, location, is_active, is_main } = req.body;

  // Validate type if provided
  if (type) {
    const validTypes = ["MAIN", "SHOP", "CAR"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "Type must be MAIN, SHOP, or CAR" });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // If this is being set as main outlet, unset any existing main outlet
    if (is_main) {
      await client.query(
        "UPDATE outlet SET is_main = false WHERE is_main = true AND id != $1",
        [id]
      );
    }

    const result = await client.query(
      `UPDATE outlet 
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           location = $3,
           is_active = COALESCE($4, is_active),
           is_main = COALESCE($5, is_main)
       WHERE id = $6
       RETURNING id, name, type, location, is_active, is_main, created_at`,
      [name, type, location, is_active, is_main, id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Outlet not found" });
    }

    await client.query("COMMIT");
    res.json({
      message: "Outlet updated successfully",
      outlet: result.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating outlet:", err);

    if (err.code === "23505") {
      res.status(400).json({ error: "Outlet name already exists" });
    } else {
      res.status(500).json({ error: "Failed to update outlet" });
    }
  } finally {
    client.release();
  }
});

/**
 * DELETE /outlets/:id - Soft delete outlet (set is_active = false)
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if outlet exists and is not the main outlet
    const checkResult = await client.query(
      "SELECT is_main FROM outlet WHERE id = $1",
      [id]
    );

    if (checkResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Outlet not found" });
    }

    if (checkResult.rows[0].is_main) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot delete main outlet" });
    }

    // Soft delete by setting is_active = false
    await client.query("UPDATE outlet SET is_active = false WHERE id = $1", [
      id,
    ]);

    await client.query("COMMIT");
    res.json({ message: "Outlet deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting outlet:", err);
    res.status(500).json({ error: "Failed to delete outlet" });
  } finally {
    client.release();
  }
});

/**
 * GET /outlets/types/count - Get count of outlets by type
 */
router.get("/types/count", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT type, COUNT(*) as count 
       FROM outlet 
       WHERE is_active = true
       GROUP BY type
       ORDER BY type`
    );

    const counts = {
      total: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
      byType: result.rows,
    };

    res.json(counts);
  } catch (err) {
    console.error("Error fetching outlet counts:", err);
    res.status(500).json({ error: "Failed to fetch outlet counts" });
  }
});

module.exports = router;
