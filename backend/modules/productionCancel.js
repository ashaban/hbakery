const { revertProductionOuts } = require("./ledger");
const { deleteProductLedgerByProduction } = require("./productledger");

/**
 * Shared safety check for removing a planned production — used by both
 * cancelling and deleting, so the two can never drift apart on what counts
 * as safe. Locks the row and returns it.
 *
 * @param {object} opts
 * @param {"cancelled"|"deleted"} opts.verb  wording for the error messages
 * @param {boolean} opts.allowCancelled      deleting an already-cancelled
 *   production is fine (it holds nothing); cancelling one again is not.
 */
async function assertProductionRemovable(
  client,
  productionId,
  { verb = "cancelled", allowCancelled = false } = {}
) {
  // Lock the row so two concurrent operations can't both pass the checks
  // and double-release the same ingredients.
  const prodRes = await client.query(
    `SELECT pp.id, pp.batch_id, pp.cancelled_at, pp.produced_at, pp.actual_qty,
            p.name AS product_name
     FROM product_production pp
     JOIN product p ON p.id = pp.product_id
     WHERE pp.id = $1
     FOR UPDATE OF pp`,
    [productionId]
  );

  if (prodRes.rows.length === 0) {
    const err = new Error(`Production ${productionId} not found`);
    err.code = "NOT_FOUND";
    throw err;
  }

  const production = prodRes.rows[0];

  if (production.cancelled_at && !allowCancelled) {
    const err = new Error(
      `${production.product_name} is already cancelled.`
    );
    err.code = "ALREADY_CANCELLED";
    err.meta = { production_id: productionId };
    throw err;
  }

  // Already produced? Actual quantities mean the goods physically exist,
  // so this is no longer a plan that can be called off. Checked on both
  // produced_at and actual_qty because a zero-output actual (a batch that
  // was attempted and yielded nothing) still counts as produced.
  if (production.produced_at !== null || production.actual_qty !== null) {
    const err = new Error(
      `${production.product_name} cannot be ${verb}: actual production has already been recorded for it. Edit the actual quantities instead.`
    );
    err.code = "ALREADY_PRODUCED";
    err.meta = {
      production_id: productionId,
      actual_qty: production.actual_qty,
      produced_at: production.produced_at,
    };
    throw err;
  }

  // Defence in depth: even without recorded actuals, refuse if anything
  // downstream already draws on this production's stock. Removing its
  // stock-in rows underneath a transfer/sale would leave those documents
  // pointing at stock that no longer exists.
  const consumedRes = await client.query(
    `SELECT pl.movement_type,
            pl.transfer_id,
            pl.sale_id,
            pl.product_out_id,
            SUM(pl.quantity) AS quantity
     FROM product_ledger pl
     WHERE pl.production_id = $1
       AND NOT (
         pl.movement_type = 'IN'
         AND pl.transfer_id IS NULL
         AND pl.sale_id IS NULL
         AND pl.product_out_id IS NULL
       )
     GROUP BY pl.movement_type, pl.transfer_id, pl.sale_id, pl.product_out_id`,
    [productionId]
  );

  if (consumedRes.rows.length > 0) {
    const refs = consumedRes.rows.map((r) => {
      if (r.transfer_id) return `transfer #${r.transfer_id}`;
      if (r.sale_id) return `sale #${r.sale_id}`;
      if (r.product_out_id) return `give-out #${r.product_out_id}`;
      return r.movement_type;
    });
    const err = new Error(
      `${production.product_name} cannot be ${verb}: its output has already been used by ${[
        ...new Set(refs),
      ].join(", ")}. Reverse those first.`
    );
    err.code = "OUTPUT_ALREADY_USED";
    err.meta = { production_id: productionId, references: [...new Set(refs)] };
    throw err;
  }

  return production;
}

/**
 * Cancel a single planned production, releasing its reserved ingredients.
 *
 * Ingredient availability is derived entirely from item_ledger (see
 * modules/ledger.js getAvailableQty/getFifoLots), so deleting this
 * production's OUT rows is what actually puts the ingredients back on the
 * shelf — there is no separate stock counter to keep in step.
 *
 * Caller owns the transaction; every write here uses the passed client so
 * a failure anywhere rolls the whole cancellation back.
 */
async function cancelProduction(client, productionId, { userId, reason }) {
  const production = await assertProductionRemovable(client, productionId, {
    verb: "cancelled",
  });

  // 1️⃣ Release the reserved ingredients back to stock.
  await revertProductionOuts(client, productionId);

  // 2️⃣ Drop any stock-in this production recorded. Scoped to its own IN
  //     rows (see deleteProductLedgerByProduction) — safe here anyway
  //     because the guard above proved nothing else references it.
  await deleteProductLedgerByProduction(client, productionId);

  // 3️⃣ Mark cancelled. Guarded on cancelled_at IS NULL as a second line of
  //     defence behind the row lock above.
  const upd = await client.query(
    `UPDATE product_production
        SET cancelled_at = NOW(),
            cancelled_by = $1,
            cancel_reason = $2
      WHERE id = $3 AND cancelled_at IS NULL
      RETURNING id`,
    [userId || null, reason || null, productionId]
  );

  if (upd.rowCount === 0) {
    const err = new Error(
      `${production.product_name} is already cancelled.`
    );
    err.code = "ALREADY_CANCELLED";
    throw err;
  }

  return {
    production_id: productionId,
    product_name: production.product_name,
    batch_id: production.batch_id,
  };
}

module.exports = { cancelProduction, assertProductionRemovable };
