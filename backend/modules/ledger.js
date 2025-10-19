const pool = require("../db");

/** Get remaining (available) stock for an item based on the ledger */
async function getAvailableQty(client, itemId) {
  const { rows } = await client.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type='IN'  THEN quantity ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN type='OUT' THEN quantity ELSE 0 END), 0)
       AS available
     FROM item_ledger
     WHERE item_id = $1`,
    [itemId]
  );
  return Number(rows[0]?.available || 0);
}

/** Get purchase lots (with remaining qty per lot) ordered FIFO */
async function getFifoLots(client, itemId) {
  const { rows } = await client.query(
    `WITH used AS (
       SELECT purchase_id, COALESCE(SUM(quantity),0) AS used_qty
       FROM item_ledger
       WHERE item_id = $1 AND type = 'OUT'
       GROUP BY purchase_id
     )
     SELECT ip.id AS purchase_id,
            ip.item_id,
            ip.quantity::numeric AS lot_qty,
            ip.price::numeric   AS lot_price,
            ip.date,
            COALESCE(u.used_qty,0)::numeric AS used_qty,
            (ip.quantity - COALESCE(u.used_qty,0))::numeric AS remaining
     FROM itempurchase ip
     LEFT JOIN used u ON u.purchase_id = ip.id
     WHERE ip.item_id = $1
       AND (ip.quantity - COALESCE(u.used_qty,0)) > 0
     ORDER BY ip.date ASC, ip.id ASC`,
    [itemId]
  );
  return rows;
}

/** Allocate FIFO and write OUT movements. Throws if insufficient. */
async function allocateFifoOut(
  client,
  productionId,
  itemId,
  qtyNeeded,
  movementDate
) {
  let remaining = Number(qtyNeeded);
  const lots = await getFifoLots(client, itemId);

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(Number(lot.remaining), remaining);

    await client.query(
      `INSERT INTO item_ledger (item_id, purchase_id, production_id, type, quantity, unit_price, movement_date)
       VALUES ($1, $2, $3, 'OUT', $4, $5, $6)`,
      [
        itemId,
        lot.purchase_id,
        productionId,
        take,
        lot.lot_price,
        movementDate || null,
      ]
    );

    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error(`INSUFFICIENT_STOCK:item=${itemId}:need=${qtyNeeded}`);
  }
}

/** Remove all OUT movements for a production (used by PUT/DELETE) */
async function revertProductionOuts(client, productionId) {
  await client.query(
    `DELETE FROM item_ledger WHERE production_id = $1 AND type = 'OUT'`,
    [productionId]
  );
}

module.exports = {
  getAvailableQty,
  getFifoLots,
  allocateFifoOut,
  revertProductionOuts,
};
