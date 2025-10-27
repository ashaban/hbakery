const express = require("express");
const router = express.Router();
const pool = require("../db");
const {
  getProductAvailableQty,
  deleteTransferLedger,
} = require("../modules/productledger");
const {
  performQualityAdjustment,
  undoQualityAdjustment,
  getAdjustmentsByReference,
  undoTransferAdjustments,
} = require("../modules/qualityAdjustment");
const {
  processTransferWithQualityAdjustments,
} = require("../modules/transferProcessor");

/**
 * GET /stock/available-all - Get available stock for all qualities at once
 */
router.get("/availableByQuality", async (req, res) => {
  const { outlet_id, product_id } = req.query;

  if (!outlet_id || !product_id) {
    return res
      .status(400)
      .json({ error: "Outlet ID and Product ID are required" });
  }

  try {
    const client = await pool.connect();

    // Get stock for all qualities in one query
    const result = await client.query(
      `
      SELECT 
        quality,
        COALESCE(SUM(
          CASE
            WHEN movement_type IN ('IN','TRANSFER_IN','QUALITY_CHANGE') THEN quantity
            WHEN movement_type IN ('OUT','TRANSFER_OUT','SALE') THEN -quantity
            ELSE 0
          END
        ),0) AS available
      FROM product_ledger
      WHERE outlet_id = $1 AND product_id = $2
      GROUP BY quality
      `,
      [outlet_id, product_id]
    );

    client.release();

    // Convert array to object { GOOD: X, DAMAGED: Y, REJECT: Z }
    const stock = { GOOD: 0, DAMAGED: 0, REJECT: 0 };
    result.rows.forEach((row) => {
      stock[row.quality] = Number(row.available) || 0;
    });

    res.json({ stock });
  } catch (err) {
    console.error("Error fetching all quality stock:", err);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});

/**
 * GET /stock/available - Get available stock for a product in an outlet
 */
router.get("/available", async (req, res) => {
  const { outlet_id, product_id, quality = "GOOD" } = req.query;

  if (!outlet_id || !product_id) {
    return res
      .status(400)
      .json({ error: "Outlet ID and Product ID are required" });
  }

  try {
    const available = await getProductAvailableQty(
      pool,
      outlet_id,
      product_id,
      quality
    );
    res.json({ available });
  } catch (err) {
    console.error("Error fetching available stock:", err);
    res.status(500).json({ error: "Failed to fetch available stock" });
  }
});

/**
 * GET /stock-transfers - Get transfers with filtering
 */
router.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    let whereConditions = ["1=1"];
    let params = [];
    let paramCount = 0;

    if (req.query.from_outlet_id) {
      paramCount++;
      whereConditions.push(`st.from_outlet_id = $${paramCount}`);
      params.push(req.query.from_outlet_id);
    }

    if (req.query.to_outlet_id) {
      paramCount++;
      whereConditions.push(`st.to_outlet_id = $${paramCount}`);
      params.push(req.query.to_outlet_id);
    }

    if (req.query.start_date) {
      paramCount++;
      whereConditions.push(`st.transfer_date >= $${paramCount}`);
      params.push(req.query.start_date);
    }

    if (req.query.end_date) {
      paramCount++;
      whereConditions.push(`st.transfer_date <= $${paramCount}`);
      params.push(req.query.end_date);
    }

    const whereClause = whereConditions.join(" AND ");

    // Count query
    const countQuery = `
      SELECT COUNT(*) 
      FROM stock_transfer st
      WHERE ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalRecords / limit);

    // Data query
    params.push(limit, offset);
    const dataQuery = `
      SELECT 
        st.id,
        st.from_outlet_id,
        src.name as from_outlet,
        src.type as from_outlet_type,
        st.to_outlet_id,
        dstn.name as to_outlet,
        dstn.type as to_outlet_type,
        st.transfer_date as transfer_date,
        st.remarks,
        (SELECT COUNT(*) FROM stock_transfer_item WHERE transfer_id = st.id) as items_count,
        (SELECT SUM(quantity) FROM stock_transfer_item WHERE transfer_id = st.id) as total_quantity
      FROM stock_transfer st
      LEFT JOIN outlet src ON st.from_outlet_id = src.id
      LEFT JOIN outlet dstn ON st.to_outlet_id = dstn.id
      WHERE ${whereClause}
      ORDER BY st.transfer_date DESC, st.id DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const result = await pool.query(dataQuery, params);

    res.json({
      data: result.rows,
      totalRecords,
      totalPages,
      currentPage: page,
    });
  } catch (err) {
    console.error("Error fetching transfers:", err);
    res.status(500).json({ error: "Failed to fetch transfers" });
  }
});

/**
 * GET /stock-transfers/:id - Get single transfer with items
 */
/**
 * GET /stock-transfers/:id - Get single transfer with items
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Get transfer header
    const transferResult = await pool.query(
      `SELECT st.*, src.name as from_outlet, src.type as from_outlet_type,
              dstn.name as to_outlet, dstn.type as to_outlet_type
       FROM stock_transfer st
       LEFT JOIN outlet src ON st.from_outlet_id = src.id
       LEFT JOIN outlet dstn ON st.to_outlet_id = dstn.id
       WHERE st.id = $1`,
      [id]
    );

    if (transferResult.rows.length === 0) {
      return res.status(404).json({ error: "Transfer not found" });
    }

    // Get transfer items with replacement info
    const itemsResult = await pool.query(
      `SELECT sti.*, p.name as product_name
       FROM stock_transfer_item sti
       LEFT JOIN product p ON sti.product_id = p.id
       WHERE sti.transfer_id = $1
       ORDER BY sti.id`,
      [id]
    );

    res.json({
      transfer: transferResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (err) {
    console.error("Error fetching transfer:", err);
    res.status(500).json({ error: "Failed to fetch transfer" });
  }
});

router.post("/adjust-quality", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      outlet_id,
      product_id,
      from_quality,
      to_quality,
      quantity,
      remarks,
      movement_date,
    } = req.body;

    if (
      !outlet_id ||
      !product_id ||
      !from_quality ||
      !to_quality ||
      !quantity
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await client.query("BEGIN");

    const result = await performQualityAdjustment(client, {
      outlet_id,
      product_id,
      from_quality,
      to_quality,
      quantity,
      remarks: remarks || "Direct quality adjustment",
      movement_date: movement_date || new Date(),
      created_by: req.user?.id || 1,
    });

    await client.query("COMMIT");

    res.json({
      adjustmentId: result.adjustmentId,
      message: "Quality adjusted successfully",
      summary: result.summary,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "INSUFFICIENT_STOCK") {
      return res.status(400).json({
        error: err.code,
        message: err.message,
        details: err.meta,
      });
    }
    console.error("❌ Quality adjustment failed:", err);
    res.status(500).json({ error: "Failed to adjust quality" });
  } finally {
    client.release();
  }
});

/**
 * POST / - Create transfer with quality adjustments
 */
router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const { from_outlet_id, to_outlet_id, remarks, items, movement_date } =
      req.body;

    if (
      !from_outlet_id ||
      !to_outlet_id ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({ error: "Missing required data" });
    }

    await client.query("BEGIN");

    const result = await processTransferWithQualityAdjustments(
      client,
      from_outlet_id,
      to_outlet_id,
      remarks,
      items,
      movement_date,
      req.user?.id || 1
    );

    await client.query("COMMIT");

    res.json({
      id: result.transferId,
      adjustmentIds: result.adjustmentIds,
      message: "Transfer recorded successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "INSUFFICIENT_STOCK") {
      return res.status(400).json({
        error: err.code,
        message: err.message,
        details: err.meta,
      });
    }
    console.error("❌ Transfer creation failed:", err);
    res.status(500).json({ error: "Failed to create transfer" });
  } finally {
    client.release();
  }
});

/**
 * PUT /:id - Update transfer with quality adjustment handling
 */
router.put("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { from_outlet_id, to_outlet_id, remarks, movement_date, items } =
      req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No transfer items provided" });
    }

    await client.query("BEGIN");

    // First, undo previous adjustments for this transfer
    const undoResults = await undoTransferAdjustments(client, id);
    console.log(
      `Undid ${undoResults.length} previous adjustments for transfer ${id}`
    );

    // Delete existing transfer data
    await client.query(
      `DELETE FROM stock_transfer_item WHERE transfer_id = $1`,
      [id]
    );
    await deleteTransferLedger(client, id);

    // Then process with new adjustments
    const result = await processTransferWithQualityAdjustments(
      client,
      from_outlet_id,
      to_outlet_id,
      remarks,
      items,
      movement_date,
      req.user?.id || 1,
      id
    );

    await client.query("COMMIT");

    res.json({
      id: result.transferId,
      adjustmentIds: result.adjustmentIds,
      undoneAdjustments: undoResults.length,
      message: "Transfer updated successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "INSUFFICIENT_STOCK") {
      return res.status(400).json({
        error: err.code,
        message: err.message,
        details: err.meta,
      });
    }
    console.error("❌ Transfer update failed:", err);
    res.status(500).json({ error: "Failed to update transfer" });
  } finally {
    client.release();
  }
});

/**
 * DELETE /:id - Delete transfer with adjustment cleanup
 */
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");

    // Undo all adjustments for this transfer
    const undoResults = await undoTransferAdjustments(client, id);

    // Delete transfer data
    await deleteTransferLedger(client, id);
    await client.query(
      `DELETE FROM stock_transfer_item WHERE transfer_id = $1`,
      [id]
    );
    const del = await client.query(`DELETE FROM stock_transfer WHERE id = $1`, [
      id,
    ]);

    if (del.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Transfer not found" });
    }

    await client.query("COMMIT");

    res.json({
      id,
      undoneAdjustments: undoResults.length,
      message: "Transfer deleted successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Delete transfer failed:", err);
    res.status(500).json({ error: "Failed to delete transfer" });
  } finally {
    client.release();
  }
});

/**
 * GET /adjustments/:reference_type/:reference_id - Get adjustments by reference
 */
router.get("/adjustments/:reference_type/:reference_id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { reference_type, reference_id } = req.params;

    const adjustments = await getAdjustmentsByReference(
      client,
      reference_type,
      reference_id
    );

    res.json({
      reference_type,
      reference_id,
      adjustments,
      count: adjustments.length,
    });
  } catch (err) {
    console.error("❌ Fetch adjustments failed:", err);
    res.status(500).json({ error: "Failed to fetch adjustments" });
  } finally {
    client.release();
  }
});

module.exports = router;
