const express = require("express");
const router = express.Router();
const pool = require("../db");
const {
  recordTransferLedger,
  deleteTransferLedger,
  getProductAvailableQty,
  determineOriginDestination,
  validateTransferAvailability,
} = require("../modules/productledger");

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
  const {
    outlet_id,
    product_id,
    from_quality,
    to_quality,
    quantity,
    remarks,
    movement_date,
  } = req.body;

  if (!outlet_id || !product_id || !from_quality || !to_quality || !quantity) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const available = await getProductAvailableQty(
      client,
      outlet_id,
      product_id,
      from_quality
    );
    if (quantity > available) {
      throw {
        code: "INSUFFICIENT_STOCK",
        message: `Not enough ${from_quality} stock to reclassify.`,
      };
    }

    // FIFO selection (reuse logic from recordTransferLedger)
    const batches = await client.query(
      `
      SELECT production_id,
        SUM(
          CASE
            WHEN movement_type IN ('IN','TRANSFER_IN','QUALITY_CHANGE') THEN quantity
            WHEN movement_type IN ('OUT','TRANSFER_OUT','SALE') THEN -quantity
            ELSE 0
          END
        ) AS available_qty
      FROM product_ledger
      WHERE outlet_id=$1 AND product_id=$2 AND quality=$3
      GROUP BY production_id
      HAVING SUM(
        CASE
          WHEN movement_type IN ('IN','TRANSFER_IN','QUALITY_CHANGE') THEN quantity
          WHEN movement_type IN ('OUT','TRANSFER_OUT','SALE') THEN -quantity
          ELSE 0
        END
      ) > 0
      ORDER BY production_id ASC
    `,
      [outlet_id, product_id, from_quality]
    );

    let remaining = quantity;

    for (const batch of batches.rows) {
      if (remaining <= 0) break;
      const moveQty = Math.min(remaining, Number(batch.available_qty));
      remaining -= moveQty;

      // OUT (old quality)
      await client.query(
        `INSERT INTO product_ledger
          (product_id, outlet_id, movement_type, quantity, quality,
           production_id, movement_date, remarks)
         VALUES ($1,$2,'QUALITY_CHANGE',-$3,$4,$5,$6,$7)`,
        [
          product_id,
          outlet_id,
          moveQty,
          from_quality,
          batch.production_id,
          movement_date,
          remarks,
        ]
      );

      // IN (new quality)
      await client.query(
        `INSERT INTO product_ledger
          (product_id, outlet_id, movement_type, quantity, quality,
           production_id, movement_date, remarks)
         VALUES ($1,$2,'QUALITY_CHANGE',$3,$4,$5,$6,$7)`,
        [
          product_id,
          outlet_id,
          moveQty,
          to_quality,
          batch.production_id,
          movement_date,
          remarks,
        ]
      );
    }

    // optional audit trail
    await client.query(
      `INSERT INTO stock_quality_adjustment
        (outlet_id, product_id, from_quality, to_quality, quantity, remarks, movement_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        outlet_id,
        product_id,
        from_quality,
        to_quality,
        quantity,
        remarks,
        movement_date,
      ]
    );

    await client.query("COMMIT");
    res.json({ message: "Quality adjusted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Quality adjustment failed:", err);
    res.status(500).json({ error: "Failed to adjust quality" });
  } finally {
    client.release();
  }
});

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

    // 1) figure origin/destination + pre-validate
    const { origin } = await determineOriginDestination(
      client,
      from_outlet_id,
      to_outlet_id
    );
    await validateTransferAvailability(client, origin, items);

    // 2) insert header
    const hdr = await client.query(
      `INSERT INTO stock_transfer (from_outlet_id, to_outlet_id, type, remarks, transfer_date, created_by)
       VALUES ($1,$2,'OUTWARD',$3,$4,$5) RETURNING id`,
      [
        from_outlet_id,
        to_outlet_id,
        remarks || null,
        movement_date || new Date(),
        req.user?.id || 1,
      ]
    );
    const transferId = hdr.rows[0].id;

    // 3) insert items
    const insertItem = `
      INSERT INTO stock_transfer_item (transfer_id, product_id, quantity, quality, from_quality, to_quality, is_replacement, replacement_note)
      VALUES ($1,$2,$3,$4,$5,$6)`;
    for (const it of items) {
      await client.query(insertItem, [
        transferId,
        it.product_id,
        it.quantity,
        it.to_quality,
        it.from_quality,
        it.to_quality,
        it.is_replacement || false,
        it.is_replacement ? it.replacement_note : null,
      ]);
      if (it.from_quality !== it.to_quality) {
        await client.query(
          `INSERT INTO stock_quality_adjustment
            (outlet_id, product_id, from_quality, to_quality, quantity, remarks, movement_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            from_outlet_id,
            it.product_id,
            it.from_quality,
            it.to_quality,
            it.quantity,
            remarks,
            movement_date,
          ]
        );
      }
    }

    // 4) ledger (has internal safety validation too)
    await recordTransferLedger(
      client,
      transferId,
      from_outlet_id,
      to_outlet_id,
      items,
      movement_date
    );

    await client.query("COMMIT");
    res.json({ id: transferId, message: "Transfer recorded successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "INSUFFICIENT_STOCK") {
      return res
        .status(400)
        .json({ error: err.code, message: err.message, details: err.meta });
    }
    console.error("❌ Transfer create failed:", err);
    res.status(500).json({ error: "Failed to create transfer" });
  } finally {
    client.release();
  }
});

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

    // 0) remove existing items + ledger so availability reflects the new ask
    await client.query(`DELETE FROM stock_transfer_item WHERE transfer_id=$1`, [
      id,
    ]);
    await deleteTransferLedger(client, id);

    // 1) work out origin/destination for new data, then pre-validate
    const { origin } = await determineOriginDestination(
      client,
      from_outlet_id,
      to_outlet_id
    );
    await validateTransferAvailability(client, origin, items);

    // 2) update header
    await client.query(
      `UPDATE stock_transfer
         SET from_outlet_id=$1, to_outlet_id=$2, remarks=$3, transfer_date=$4, updated_by=$5, updated_at=NOW()
       WHERE id=$6`,
      [
        from_outlet_id,
        to_outlet_id,
        remarks || null,
        movement_date,
        req.user?.id || 1,
        id,
      ]
    );

    // 3) reinsert items
    const insertItem = `
      INSERT INTO stock_transfer_item (transfer_id, product_id, quantity, quality, is_replacement, replacement_note)
      VALUES ($1,$2,$3,$4,$5,$6)`;
    for (const it of items) {
      await client.query(insertItem, [
        id,
        it.product_id,
        it.quantity,
        it.quality || "GOOD",
        it.is_replacement || false,
        it.is_replacement ? it.replacement_note : null,
      ]);
    }

    // 4) rebuild ledger (still validates inside)
    await recordTransferLedger(
      client,
      id,
      from_outlet_id,
      to_outlet_id,
      items,
      movement_date
    );

    await client.query("COMMIT");
    res.json({ id, message: "Stock transfer updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "INSUFFICIENT_STOCK") {
      return res
        .status(400)
        .json({ error: err.code, message: err.message, details: err.meta });
    }
    console.error("❌ Transfer update failed:", err);
    res.status(500).json({ error: "Failed to update transfer" });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");
    await deleteTransferLedger(client, id);
    await client.query(`DELETE FROM stock_transfer_item WHERE transfer_id=$1`, [
      id,
    ]);
    const del = await client.query(`DELETE FROM stock_transfer WHERE id=$1`, [
      id,
    ]);
    await client.query("COMMIT");

    if (del.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ id, message: "Transfer deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Delete transfer failed:", err);
    res.status(500).json({ error: "Failed to delete transfer" });
  } finally {
    client.release();
  }
});

module.exports = router;
