// modules/saleLedger.js
// Multi-quality FIFO sale ledger engine
// Matches your transfer/quality modules style.

/**
 * Item shape expected:
 * [
 *   { product_id: number, quantity: number, quality: 'GOOD'|'DAMAGED'|'REJECT', unit_price?: number }
 * ]
 *
 * Conventions:
 * - SALE movements are recorded in product_ledger with movement_type='SALE' and quantity > 0 (normal deduction).
 * - For reversal (cancellation), we insert movement_type='SALE' with quantity < 0 to add stock back (mirrors your QUALITY_CHANGE pattern).
 * - Availability uses your existing CASE logic in SUM(...) where SALE is treated as an OUT movement.
 */

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

/**
 * Validate stock per (product_id, quality) aggregated across items.
 * Throws { code: 'INSUFFICIENT_STOCK', meta: {...} } like your other modules.
 */
async function validateSaleAvailability(client, outletId, items) {
  const aggregate = new Map(); // "product_id|quality" -> required qty
  for (const it of items) {
    const key = `${it.product_id}|${it.quality || "GOOD"}`;
    aggregate.set(key, (aggregate.get(key) || 0) + Number(it.quantity));
  }

  for (const [key, required] of aggregate.entries()) {
    const [pidStr, quality] = key.split("|");
    const product_id = Number(pidStr);
    const available = await getProductAvailableQty(
      client,
      outletId,
      product_id,
      quality
    );
    if (required > available) {
      const err = new Error(
        `INSUFFICIENT_STOCK: outlet ${outletId} has ${available} of product ${product_id} (${quality}), required ${required}`
      );
      err.code = "INSUFFICIENT_STOCK";
      err.meta = {
        outlet_id: outletId,
        product_id,
        quality,
        available,
        required,
      };
      throw err;
    }
  }
}

/**
 * Allocate FIFO batches by production_id for a single product/quality.
 * Returns [{ production_id, moveQty }]
 */
async function allocateFifoBatches(
  client,
  outletId,
  productId,
  quality,
  requiredQty
) {
  const { rows } = await client.query(
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
    [outletId, productId, quality]
  );

  let remaining = Number(requiredQty);
  const batches = [];

  for (const r of rows) {
    if (remaining <= 0) break;
    const avail = Number(r.available_qty);
    const moveQty = Math.min(avail, remaining);
    if (moveQty > 0) {
      batches.push({ production_id: r.production_id, moveQty });
      remaining -= moveQty;
    }
  }

  if (remaining > 0) {
    const err = new Error(
      `INSUFFICIENT_STOCK: Not enough ${quality} stock for product ${productId}`
    );
    err.code = "INSUFFICIENT_STOCK";
    err.meta = {
      outlet_id: outletId,
      product_id: productId,
      quality,
      requested: requiredQty,
    };
    throw err;
  }

  return batches;
}

/**
 * Record SALE ledger movements (deduction).
 * - Inserts movement_type='SALE' with quantity > 0 per allocated batch.
 * - unit_price is optional; unit_cost can be set to 0 here or passed per line in future.
 */
async function recordSaleLedger(
  client,
  saleId,
  outletId,
  items,
  saleDate = new Date(),
  remarks = null
) {
  for (const it of items) {
    const productId = it.product_id;
    const quality = it.quality || "GOOD";
    const qty = Number(it.quantity);

    // FIFO batches for this item
    const batches = await allocateFifoBatches(
      client,
      outletId,
      productId,
      quality,
      qty
    );

    // Insert one ledger row per batch
    for (const b of batches) {
      await client.query(
        `INSERT INTO product_ledger
           (product_id, outlet_id, movement_type, quantity, quality,
            sale_id, production_id, movement_date, unit_price, unit_cost, remarks)
         VALUES ($1,$2,'SALE',$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          productId,
          outletId,
          b.moveQty, // positive; availability SUM treats SALE as OUT
          quality,
          saleId,
          b.production_id,
          saleDate,
          it.unit_price ?? null, // optional; you may store header/item price elsewhere
          0, // unit_cost tracked elsewhere or computed later
          remarks || null,
        ]
      );
    }
  }
}

/**
 * Undo SALE ledger by deleting its product_ledger rows.
 * Use this when EDITING a posted sale before re-applying new items.
 * Mirrors your transfer update strategy (deleteTransferLedger).
 */
async function undoSaleLedger(client, saleId) {
  await client.query(`DELETE FROM product_ledger WHERE sale_id = $1`, [saleId]);
}

/**
 * Reverse SALE ledger by inserting compensating rows.
 * - Adds back stock using movement_type='SALE' with NEGATIVE quantity (so CASE .. THEN -quantity -> increases available).
 * - Keeps audit trail intact (no deletions).
 * Use this for CANCELLATION.
 */
async function reverseSaleLedger(
  client,
  saleId,
  saleDate = new Date(),
  remarks = "REVERSED: sale cancellation"
) {
  // Fetch original sale movements grouped by product/quality/production_id
  const { rows } = await client.query(
    `
    SELECT product_id, quality, production_id,
           SUM(quantity) AS total_sold
    FROM product_ledger
    WHERE sale_id = $1 AND movement_type = 'SALE'
    GROUP BY product_id, quality, production_id
    `,
    [saleId]
  );

  if (!rows.length) return;

  for (const r of rows) {
    const qty = Number(r.total_sold);
    if (qty <= 0) continue;

    // Insert negative SALE to add stock back (fits your SUM logic)
    await client.query(
      `INSERT INTO product_ledger
         (product_id, outlet_id, movement_type, quantity, quality,
          sale_id, production_id, movement_date, remarks)
       SELECT $1, pl.outlet_id, 'SALE', $2, $3,
              $4, $5, $6, $7
       FROM product_ledger pl
       WHERE pl.sale_id = $4
         AND pl.product_id = $1
         AND pl.quality = $3
         AND pl.production_id = $5
       LIMIT 1`,
      [
        r.product_id,
        -qty, // negative brings stock back
        r.quality,
        saleId,
        r.production_id,
        saleDate,
        remarks,
      ]
    );
  }
}

module.exports = {
  validateSaleAvailability,
  recordSaleLedger,
  undoSaleLedger,
  reverseSaleLedger,
  // exposed for tests/diagnostics
  allocateFifoBatches,
  getProductAvailableQty,
};
