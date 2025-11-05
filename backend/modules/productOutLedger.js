// modules/productOutLedger.js
// FIFO-aware "OUT" movements: charity, reject, other non-sale releases.

function normalizeQuality(q) {
  return (q || "GOOD").toUpperCase();
}

/**
 * Compute available quantity for a product/quality at an outlet (as of now).
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
    [outletId, productId, normalizeQuality(quality)]
  );
  return Number(rows[0].available) || 0;
}

/**
 * Validate stock availability for a set of items at outlet (aggregated).
 * Throws { code: 'INSUFFICIENT_STOCK', meta: {...} }
 */
async function validateOutAvailability(client, outletId, items) {
  const agg = new Map(); // key: "product|quality" -> sum qty
  for (const it of items) {
    const key = `${it.product_id}|${normalizeQuality(it.quality)}`;
    agg.set(key, (agg.get(key) || 0) + Number(it.quantity || 0));
  }

  for (const [key, required] of agg.entries()) {
    const [pid, q] = key.split("|");
    const available = await getProductAvailableQty(
      client,
      outletId,
      Number(pid),
      q
    );
    if (required > available) {
      const err = new Error(
        `INSUFFICIENT_STOCK: outlet ${outletId} has ${available} of product ${pid} (${q}), required ${required}`
      );
      err.code = "INSUFFICIENT_STOCK";
      err.meta = {
        outlet_id: outletId,
        product_id: Number(pid),
        quality: q,
        available,
        required,
      };
      throw err;
    }
  }
}

/**
 * FIFO lot allocator by production_id for a product/quality/outlet.
 * Orders by earliest lot (using first IN/TRANSFER_IN/QUALITY_CHANGE date then id).
 * Returns: [{ production_id, available_qty, moveQty, lot_cost }]
 */
async function allocateFifoBatches(
  client,
  outletId,
  productId,
  quality,
  requiredQty
) {
  // Build per-lot balance with FIFO ordering
  const { rows } = await client.query(
    `
    WITH lot_in AS (
      -- define lot start (first positive entry for that production lot)
      SELECT
        production_id,
        MIN(movement_date) AS first_date,
        MIN(id) AS first_id
      FROM product_ledger
      WHERE outlet_id=$1 AND product_id=$2 AND quality=$3
        AND movement_type IN ('IN','TRANSFER_IN','QUALITY_CHANGE')
        AND quantity > 0
      GROUP BY production_id
    ),
    lot_bal AS (
      SELECT
        pl.production_id,
        SUM(
          CASE
            WHEN pl.movement_type IN ('IN','TRANSFER_IN','QUALITY_CHANGE') THEN pl.quantity
            WHEN pl.movement_type IN ('OUT','TRANSFER_OUT','SALE') THEN -pl.quantity
            ELSE 0
          END
        ) AS available_qty
      FROM product_ledger pl
      WHERE pl.outlet_id=$1 AND pl.product_id=$2 AND pl.quality=$3
      GROUP BY pl.production_id
    ),
    lot_cost AS (
      -- weighted avg cost for positive movements in the lot
      SELECT
        pl.production_id,
        CASE
          WHEN SUM(CASE WHEN pl.movement_type IN ('IN','TRANSFER_IN','QUALITY_CHANGE') AND pl.quantity>0
                        THEN pl.quantity ELSE 0 END) = 0
          THEN 0
          ELSE
            SUM(
              CASE
                WHEN pl.movement_type IN ('IN','TRANSFER_IN','QUALITY_CHANGE') AND pl.quantity>0
                THEN pl.quantity * COALESCE(pl.unit_cost,0)
                ELSE 0
              END
            ) / SUM(
              CASE
                WHEN pl.movement_type IN ('IN','TRANSFER_IN','QUALITY_CHANGE') AND pl.quantity>0
                THEN pl.quantity ELSE 0
              END
            )
        END AS avg_cost
      FROM product_ledger pl
      WHERE pl.outlet_id=$1 AND pl.product_id=$2 AND pl.quality=$3
      GROUP BY pl.production_id
    )
    SELECT
      li.production_id,
      COALESCE(lb.available_qty,0) AS available_qty,
      COALESCE(lc.avg_cost,0) AS lot_cost,
      li.first_date, li.first_id
    FROM lot_in li
    LEFT JOIN lot_bal lb ON lb.production_id = li.production_id
    LEFT JOIN lot_cost lc ON lc.production_id = li.production_id
    WHERE COALESCE(lb.available_qty,0) > 0
    ORDER BY li.first_date ASC NULLS LAST, li.first_id ASC
    `,
    [outletId, productId, normalizeQuality(quality)]
  );

  let remaining = Number(requiredQty);
  const batches = [];
  for (const r of rows) {
    if (remaining <= 0) break;
    const take = Math.min(Number(r.available_qty), remaining);
    if (take > 0) {
      batches.push({
        production_id: r.production_id,
        available_qty: Number(r.available_qty),
        moveQty: take,
        lot_cost: Number(r.lot_cost) || 0,
      });
      remaining -= take;
    }
  }

  if (remaining > 0) {
    const err = new Error(
      `INSUFFICIENT_STOCK: insufficient FIFO lots for product ${productId} (${normalizeQuality(
        quality
      )})`
    );
    err.code = "INSUFFICIENT_STOCK";
    err.meta = {
      outlet_id: outletId,
      product_id: productId,
      quality: normalizeQuality(quality),
      requested: requiredQty,
    };
    throw err;
  }

  return batches;
}

/**
 * Record FIFO OUT ledger rows per batch.
 * Persists production_id & lot_cost per row.
 */
async function recordOutLedger(
  client,
  outId,
  outletId,
  items,
  outDate = new Date(),
  remarks = null
) {
  for (const it of items) {
    const productId = Number(it.product_id);
    const quality = normalizeQuality(it.quality);
    const qty = Number(it.quantity);

    const batches = await allocateFifoBatches(
      client,
      outletId,
      productId,
      quality,
      qty
    );
    for (const b of batches) {
      await client.query(
        `
        INSERT INTO product_ledger
          (product_id, outlet_id, movement_type, quantity, quality,
           production_id, movement_date, unit_cost, product_out_id, remarks)
        VALUES ($1,$2,'OUT',$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          productId,
          outletId,
          b.moveQty,
          quality,
          b.production_id,
          outDate,
          b.lot_cost, // valued at the lot’s weighted avg cost
          outId,
          remarks || null,
        ]
      );
    }
  }
}

/**
 * Undo OUT ledger completely (for editing before reapply).
 */
async function undoOutLedger(client, outId) {
  await client.query(`DELETE FROM product_ledger WHERE product_out_id=$1`, [
    outId,
  ]);
}

/**
 * Reverse OUT by inserting compensating (negative) rows per lot.
 * Keeps FIFO batches intact (restore exact lots).
 */
async function reverseOutLedger(
  client,
  outId,
  outDate = new Date(),
  remarks = "Reversal: OUT Cancelled"
) {
  const { rows } = await client.query(
    `
    SELECT product_id, outlet_id, quality, production_id,
           SUM(quantity) AS total_out, -- positive sums for OUT rows
           MAX(unit_cost) AS unit_cost -- unit_cost is constant per row, we can carry any (or compute weighted if you prefer)
    FROM product_ledger
    WHERE product_out_id=$1 AND movement_type='OUT'
    GROUP BY product_id, outlet_id, quality, production_id
    `,
    [outId]
  );

  if (!rows.length) return;

  for (const r of rows) {
    const qty = Number(r.total_out);
    if (qty <= 0) continue;
    await client.query(
      `
      INSERT INTO product_ledger
        (product_id, outlet_id, movement_type, quantity, quality,
         production_id, movement_date, unit_cost, product_out_id, remarks)
      VALUES ($1,$2,'OUT',$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        r.product_id,
        r.outlet_id,
        -qty, // negative OUT = stock comes back
        r.quality,
        r.production_id,
        outDate,
        Number(r.unit_cost) || 0,
        outId,
        remarks,
      ]
    );
  }
}

module.exports = {
  getProductAvailableQty,
  validateOutAvailability,
  allocateFifoBatches,
  recordOutLedger,
  undoOutLedger,
  reverseOutLedger,
};
