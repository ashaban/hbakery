const { getProductAvailableQty } = require("./productledger");

/**
 * Perform quality adjustment with full audit trail and undo capability
 */
async function performQualityAdjustment(
  client,
  {
    outlet_id,
    product_id,
    from_quality,
    to_quality,
    quantity,
    remarks,
    movement_date,
    reference_type = "DIRECT",
    reference_id = null,
    created_by = null,
  }
) {
  // Validate inputs
  if (!outlet_id || !product_id || !from_quality || !to_quality || !quantity) {
    throw new Error("Missing required fields for quality adjustment");
  }

  if (from_quality === to_quality) {
    throw new Error("From quality and to quality cannot be the same");
  }

  const available = await getProductAvailableQty(
    client,
    outlet_id,
    product_id,
    from_quality
  );

  if (quantity > available) {
    throw {
      code: "INSUFFICIENT_STOCK",
      message: `Not enough ${from_quality} stock to reclassify. Available: ${available}, Requested: ${quantity}`,
      meta: {
        outlet_id,
        product_id,
        from_quality,
        available,
        requested: quantity,
      },
    };
  }

  // FIFO batch selection
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
    WHERE outlet_id = $1 AND product_id = $2 AND quality = $3
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
  const adjustmentDetails = [];

  // Process each batch
  for (const batch of batches.rows) {
    if (remaining <= 0) break;

    const moveQty = Math.min(remaining, Number(batch.available_qty));
    remaining -= moveQty;

    // Record OUT movement (old quality)
    await client.query(
      `INSERT INTO product_ledger
        (product_id, outlet_id, movement_type, quantity, quality,
         production_id, movement_date, remarks)
       VALUES ($1,$2,'QUALITY_CHANGE',$3,$4,$5,$6,$7)`,
      [
        product_id,
        outlet_id,
        -moveQty,
        from_quality,
        batch.production_id,
        movement_date,
        remarks,
      ]
    );

    // Record IN movement (new quality)
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

    adjustmentDetails.push({
      production_id: batch.production_id,
      quantity: moveQty,
      from_quality,
      to_quality,
      movement_date: movement_date.toISOString?.() || movement_date,
    });
  }

  if (remaining > 0) {
    throw {
      code: "INSUFFICIENT_STOCK",
      message: `Unexpected error: Could not allocate full quantity for quality adjustment`,
      meta: { allocated: quantity - remaining, requested: quantity },
    };
  }

  // Create audit trail
  const adjustmentResult = await client.query(
    `INSERT INTO stock_quality_adjustment
      (outlet_id, product_id, from_quality, to_quality, quantity, remarks, 
       movement_date, reference_type, reference_id, adjustment_details, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) 
     RETURNING id, outlet_id, product_id, from_quality, to_quality, quantity`,
    [
      outlet_id,
      product_id,
      from_quality,
      to_quality,
      quantity,
      remarks,
      movement_date,
      reference_type,
      reference_id,
      JSON.stringify(adjustmentDetails),
      created_by,
    ]
  );

  return {
    adjustmentId: adjustmentResult.rows[0].id,
    details: adjustmentDetails,
    summary: adjustmentResult.rows[0],
  };
}

/**
 * Undo a quality adjustment by reversing all ledger entries
 */
async function undoQualityAdjustment(client, adjustmentId) {
  // Get adjustment details
  const adjustment = await client.query(
    `SELECT * FROM stock_quality_adjustment WHERE id = $1 AND is_reversed = false`,
    [adjustmentId]
  );

  if (adjustment.rows.length === 0) {
    throw new Error("Adjustment not found or already reversed");
  }

  const adj = adjustment.rows[0];
  const details = JSON.parse(adj.adjustment_details || "[]");

  if (details.length === 0) {
    throw new Error("No adjustment details found to reverse");
  }

  // Reverse each batch movement
  for (const detail of details) {
    // IN (old quality) - reverse the OUT
    await client.query(
      `INSERT INTO product_ledger
        (product_id, outlet_id, movement_type, quantity, quality,
         production_id, movement_date, remarks)
       VALUES ($1,$2,'QUALITY_CHANGE',$3,$4,$5,$6,$7)`,
      [
        adj.product_id,
        adj.outlet_id,
        detail.quantity,
        detail.from_quality,
        detail.production_id,
        adj.movement_date,
        `REVERSED: ${adj.remarks}`,
      ]
    );

    // OUT (new quality) - reverse the IN
    await client.query(
      `INSERT INTO product_ledger
        (product_id, outlet_id, movement_type, quantity, quality,
         production_id, movement_date, remarks)
       VALUES ($1,$2,'QUALITY_CHANGE',$3,$4,$5,$6,$7)`,
      [
        adj.product_id,
        adj.outlet_id,
        -detail.quantity,
        detail.to_quality,
        detail.production_id,
        adj.movement_date,
        `REVERSED: ${adj.remarks}`,
      ]
    );
  }

  // Mark adjustment as reversed
  await client.query(
    `UPDATE stock_quality_adjustment 
     SET is_reversed = true, reversed_at = NOW() 
     WHERE id = $1`,
    [adjustmentId]
  );

  return {
    adjustmentId,
    reversedAt: new Date(),
    originalAdjustment: adj,
  };
}

/**
 * Get adjustments by reference
 */
async function getAdjustmentsByReference(client, reference_type, reference_id) {
  const result = await client.query(
    `SELECT * FROM stock_quality_adjustment 
     WHERE reference_type = $1 AND reference_id = $2 
     ORDER BY movement_date DESC, id DESC`,
    [reference_type, reference_id]
  );

  return result.rows;
}

/**
 * Undo all adjustments for a transfer
 */
async function undoTransferAdjustments(client, transferId) {
  const adjustments = await getAdjustmentsByReference(
    client,
    "TRANSFER",
    transferId
  );
  const results = [];

  for (const adj of adjustments) {
    if (!adj.is_reversed) {
      try {
        const result = await undoQualityAdjustment(client, adj.id);
        results.push(result);
      } catch (error) {
        console.error(`Failed to undo adjustment ${adj.id}:`, error);
        results.push({ adjustmentId: adj.id, error: error.message });
      }
    }
  }

  return results;
}

module.exports = {
  performQualityAdjustment,
  undoQualityAdjustment,
  getAdjustmentsByReference,
  undoTransferAdjustments,
};
