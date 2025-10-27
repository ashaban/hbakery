const {
  recordTransferLedger,
  deleteTransferLedger,
  determineOriginDestination,
  validateTransferAvailability,
} = require("./productledger");
const {
  performQualityAdjustment,
  undoTransferAdjustments,
} = require("./qualityAdjustment");

/**
 * Create a new transfer with quality adjustments
 */
async function createTransfer(
  client,
  from_outlet_id,
  to_outlet_id,
  remarks,
  items,
  movement_date,
  created_by
) {
  // Validate transfer availability
  const { origin } = await determineOriginDestination(
    client,
    from_outlet_id,
    to_outlet_id
  );
  await validateTransferAvailability(client, origin, items);

  // Insert transfer header
  const hdr = await client.query(
    `INSERT INTO stock_transfer (from_outlet_id, to_outlet_id, type, remarks, transfer_date, created_by)
     VALUES ($1,$2,'OUTWARD',$3,$4,$5) RETURNING id`,
    [
      from_outlet_id,
      to_outlet_id,
      remarks || null,
      movement_date || new Date(),
      created_by,
    ]
  );

  const transferId = hdr.rows[0].id;
  return transferId;
}

/**
 * Update an existing transfer
 */
async function updateTransfer(
  client,
  transferId,
  from_outlet_id,
  to_outlet_id,
  remarks,
  movement_date,
  items,
  updated_by
) {
  // Update transfer header
  await client.query(
    `UPDATE stock_transfer
     SET from_outlet_id=$1, to_outlet_id=$2, remarks=$3, transfer_date=$4, updated_by=$5, updated_at=NOW()
     WHERE id=$6`,
    [
      from_outlet_id,
      to_outlet_id,
      remarks || null,
      movement_date,
      updated_by,
      transferId,
    ]
  );

  return transferId;
}

/**
 * Insert transfer items
 */
async function insertTransferItems(client, transferId, items) {
  const insertItem = `
    INSERT INTO stock_transfer_item 
    (transfer_id, product_id, quantity, quality, from_quality, to_quality, is_replacement, replacement_note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`;

  for (const it of items) {
    await client.query(insertItem, [
      transferId,
      it.product_id,
      it.quantity,
      it.to_quality, // quality field
      it.from_quality, // from_quality field
      it.to_quality, // to_quality field
      it.is_replacement || false,
      it.is_replacement ? it.replacement_note : null,
    ]);
  }
}

/**
 * Process transfer with quality adjustments
 */
async function processTransferWithQualityAdjustments(
  client,
  from_outlet_id,
  to_outlet_id,
  remarks,
  items,
  movement_date,
  created_by,
  transferId = null // for updates
) {
  const adjustmentIds = [];
  const isUpdate = !!transferId;

  // Step 1: Perform quality adjustments for items with quality changes
  for (const it of items) {
    if (it.from_quality !== it.to_quality) {
      const adjustment = await performQualityAdjustment(client, {
        outlet_id: from_outlet_id,
        product_id: it.product_id,
        from_quality: it.from_quality,
        to_quality: it.to_quality,
        quantity: it.quantity,
        remarks: `Transfer ${isUpdate ? "Update" : "Creation"}: ${
          remarks || "Quality adjustment"
        }`,
        movement_date,
        reference_type: "TRANSFER",
        reference_id: transferId,
        created_by,
      });
      adjustmentIds.push(adjustment.adjustmentId);
    }
  }

  // Step 2: Create or update transfer
  if (isUpdate) {
    await updateTransfer(
      client,
      transferId,
      from_outlet_id,
      to_outlet_id,
      remarks,
      movement_date,
      items,
      created_by
    );
  } else {
    transferId = await createTransfer(
      client,
      from_outlet_id,
      to_outlet_id,
      remarks,
      items,
      movement_date,
      created_by
    );
  }

  if (!isUpdate) {
    for (const adjustmentId of adjustmentIds) {
      await updateAdjustmentReference(client, adjustmentId, transferId);
    }
  }

  // Step 3: Insert transfer items
  await insertTransferItems(client, transferId, items);

  // Step 4: Record ledger entries (items now have adjusted quality)
  const transferItems = items.map((it) => ({
    ...it,
    from_quality: it.to_quality, // After adjustment, we're transferring the new quality
  }));

  await recordTransferLedger(
    client,
    transferId,
    from_outlet_id,
    to_outlet_id,
    transferItems,
    movement_date
  );

  return {
    transferId,
    adjustmentIds,
    action: isUpdate ? "updated" : "created",
  };
}

async function updateAdjustmentReference(client, adjustmentId, transferId) {
  const query = `
    UPDATE stock_quality_adjustment 
    SET reference_id = $1 
    WHERE id = $2
  `;
  await client.query(query, [transferId, adjustmentId]);
}

module.exports = {
  createTransfer,
  updateTransfer,
  insertTransferItems,
  processTransferWithQualityAdjustments,
};
