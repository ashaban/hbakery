async function getProductAvailableQty(
  client,
  outletId,
  productId,
  quality = "GOOD"
) {
  const { rows } = await client.query(
    `
    SELECT COALESCE(SUM(
      CASE
        WHEN movement_type IN ('IN','TRANSFER_IN','QUALITY_CHANGE') THEN quantity
        WHEN movement_type IN ('OUT','TRANSFER_OUT','SALE') THEN -quantity
        ELSE 0
      END
    ),0) AS available
    FROM product_ledger
    WHERE outlet_id = $1 AND product_id = $2 AND quality = $3
  `,
    [outletId, productId, quality]
  );
  return Number(rows[0].available) || 0;
}

async function determineOriginDestination(client, fromOutletId, toOutletId) {
  const res = await client.query(
    `SELECT id, type FROM outlet WHERE id = ANY($1::int[])`,
    [[fromOutletId, toOutletId]]
  );
  const m = Object.fromEntries(res.rows.map((r) => [r.id, r.type]));
  const fromType = m[fromOutletId],
    toType = m[toOutletId];
  // Default: from -> to
  let origin = fromOutletId,
    destination = toOutletId;
  // Return case: SHOP/CAR -> MAIN
  if (toType === "MAIN" && fromType !== "MAIN") {
    origin = fromOutletId;
    destination = toOutletId;
  }
  return { origin, destination, fromType, toType };
}

async function validateTransferAvailability(client, originOutletId, items) {
  // aggregate by (product_id, quality)
  const map = new Map();
  for (const it of items) {
    const key = `${it.product_id}|${it.from_quality || it.quality || "GOOD"}`;
    map.set(key, (map.get(key) || 0) + Number(it.quantity));
  }
  for (const [key, required] of map.entries()) {
    const [pidStr, quality] = key.split("|");
    const product_id = Number(pidStr);
    const available = await getProductAvailableQty(
      client,
      originOutletId,
      product_id,
      quality
    );
    if (required > available) {
      const err = new Error(
        `INSUFFICIENT_STOCK: outlet ${originOutletId} has ${available} of product ${product_id} (${quality}), required ${required}`
      );
      err.code = "INSUFFICIENT_STOCK";
      err.meta = {
        outlet_id: originOutletId,
        product_id,
        quality,
        available,
        required,
      };
      throw err;
    }
  }
}

async function recordProductLedger(
  client,
  productionId,
  productId,
  quantities,
  movementDate
) {
  const { good_qty = 0, damaged_qty = 0, reject_qty = 0 } = quantities;

  const outletRes = await client.query(
    `SELECT id FROM outlet WHERE is_main = TRUE LIMIT 1`
  );
  if (!outletRes.rows.length) throw new Error("No main outlet found");
  const outletId = outletRes.rows[0].id;

  const entries = [];
  if (good_qty > 0) entries.push({ q: good_qty, quality: "GOOD" });
  if (damaged_qty > 0) entries.push({ q: damaged_qty, quality: "DAMAGED" });
  if (reject_qty > 0) entries.push({ q: reject_qty, quality: "REJECT" });

  for (const e of entries) {
    await client.query(
      `INSERT INTO product_ledger 
        (product_id, outlet_id, movement_type, quantity, quality, production_id, movement_date)
       VALUES ($1, $2, 'IN', $3, $4, $5, $6)`,
      [
        productId,
        outletId,
        e.q,
        e.quality,
        productionId,
        movementDate || new Date(),
      ]
    );
  }
}

async function deleteProductLedgerByProduction(client, productionId) {
  await client.query(`DELETE FROM product_ledger WHERE production_id = $1`, [
    productionId,
  ]);
}

// modules/productLedger.js
async function recordTransferLedger(
  client,
  transferId,
  fromOutletId,
  toOutletId,
  items,
  movementDate = new Date()
) {
  const { origin, destination, fromType, toType } =
    await determineOriginDestination(client, fromOutletId, toOutletId);
  const isReturnToMain = toType === "MAIN" && fromType !== "MAIN";

  for (const it of items) {
    const fromQuality = it.from_quality || it.quality || "GOOD";
    const toQuality = it.to_quality || fromQuality;

    let qtyToTransfer = Number(it.quantity);

    // Get available FIFO batches from origin using FROM_QUALITY
    const stockBatches = await client.query(
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
      WHERE outlet_id = $1
        AND product_id = $2
        AND quality = $3
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
      [origin, it.product_id, fromQuality]
    );

    let remaining = qtyToTransfer;
    const movements = [];

    for (const batch of stockBatches.rows) {
      if (remaining <= 0) break;
      const available = Number(batch.available_qty);
      const moveQty = Math.min(available, remaining);
      remaining -= moveQty;
      movements.push({
        product_id: it.product_id,
        production_id: batch.production_id,
        quantity: moveQty,
      });
    }

    if (remaining > 0) {
      throw {
        code: "INSUFFICIENT_STOCK",
        message: `Not enough ${fromQuality} stock for product ${it.product_id}`,
        meta: { product_id: it.product_id, requested: qtyToTransfer },
      };
    }

    // Record per production movement
    for (const m of movements) {
      const isReplacement = isReturnToMain && it.is_replacement;

      // OUT from origin (from_quality)
      await client.query(
        `INSERT INTO product_ledger
           (product_id, outlet_id, movement_type, quantity, quality,
            transfer_id, production_id, movement_date, is_replacement, replacement_note)
         VALUES ($1,$2,'TRANSFER_OUT',$3,$4,$5,$6,$7,$8,$9)`,
        [
          m.product_id,
          origin,
          m.quantity,
          fromQuality,
          transferId,
          m.production_id,
          movementDate,
          isReplacement,
          isReplacement ? it.replacement_note : null,
        ]
      );

      // IN to destination (to_quality)
      await client.query(
        `INSERT INTO product_ledger
           (product_id, outlet_id, movement_type, quantity, quality,
            transfer_id, production_id, movement_date, is_replacement, replacement_note)
         VALUES ($1,$2,'TRANSFER_IN',$3,$4,$5,$6,$7,$8,$9)`,
        [
          m.product_id,
          destination,
          m.quantity,
          toQuality,
          transferId,
          m.production_id,
          movementDate,
          isReplacement,
          isReplacement ? it.replacement_note : null,
        ]
      );
    }
  }
}

async function deleteTransferLedger(client, transferId) {
  await client.query(`DELETE FROM product_ledger WHERE transfer_id = $1`, [
    transferId,
  ]);
}

module.exports = {
  recordProductLedger,
  deleteProductLedgerByProduction,
  getProductAvailableQty,
  recordTransferLedger,
  deleteTransferLedger,
  determineOriginDestination,
  validateTransferAvailability,
};
