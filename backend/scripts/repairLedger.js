// One-off repair for product_ledger rows destroyed by the unscoped
// deleteProductLedgerByProduction bug (every ledger row carries the
// production_id of the batch it drew from, so re-saving a batch's actual
// production used to delete the movement history of every transfer /
// sale / give-out / quality adjustment that had touched that batch).
//
// For each damaged document this inserts compensating rows so the ledger
// again matches the document's line items. Repaired rows:
//   * carry production_id NULL (the original batch attribution is not
//     recoverable) — FIFO treats the NULL group as its own batch, so
//     balances and future allocation still work;
//   * are tagged in remarks for auditability;
//   * use the document's own date as movement_date.
//
// Idempotent: each run computes the CURRENT shortfall and only tops up
// the difference, so running it twice (or after partial damage) is safe.
//
// Usage:
//   node scripts/repairLedger.js            # dry run (default): report only
//   node scripts/repairLedger.js --apply    # write the repairs
//
// Run this BEFORE relying on the migration-005 triggers to have clean
// history; the repairs themselves commit under those triggers, which
// independently verify every repaired document ends up whole.

const pool = require("../db");

const APPLY = process.argv.includes("--apply");
const TAG = `LEDGER-REPAIR ${new Date().toISOString().slice(0, 10)}`;

async function repairTransfers(client) {
  // Shortfall per (transfer, product, quality), OUT and IN independently.
  // Quality on ledger rows is the item's to_quality (transfers record
  // movement post quality-adjustment).
  const { rows } = await client.query(`
    SELECT sti.transfer_id, st.transfer_date, st.from_outlet_id, st.to_outlet_id,
           sti.product_id, p.name AS product_name, sti.to_quality AS quality,
           SUM(sti.quantity) AS expected,
           COALESCE((SELECT SUM(pl.quantity) FROM product_ledger pl
                     WHERE pl.transfer_id = sti.transfer_id
                       AND pl.product_id = sti.product_id
                       AND pl.quality = sti.to_quality
                       AND pl.movement_type = 'TRANSFER_OUT'), 0) AS out_qty,
           COALESCE((SELECT SUM(pl.quantity) FROM product_ledger pl
                     WHERE pl.transfer_id = sti.transfer_id
                       AND pl.product_id = sti.product_id
                       AND pl.quality = sti.to_quality
                       AND pl.movement_type = 'TRANSFER_IN'), 0) AS in_qty
    FROM stock_transfer_item sti
    JOIN stock_transfer st ON st.id = sti.transfer_id
    JOIN product p ON p.id = sti.product_id
    GROUP BY sti.transfer_id, st.transfer_date, st.from_outlet_id,
             st.to_outlet_id, sti.product_id, p.name, sti.to_quality
    HAVING SUM(sti.quantity) > COALESCE((SELECT SUM(pl.quantity) FROM product_ledger pl
                     WHERE pl.transfer_id = sti.transfer_id
                       AND pl.product_id = sti.product_id
                       AND pl.quality = sti.to_quality
                       AND pl.movement_type = 'TRANSFER_OUT'), 0)
        OR SUM(sti.quantity) > COALESCE((SELECT SUM(pl.quantity) FROM product_ledger pl
                     WHERE pl.transfer_id = sti.transfer_id
                       AND pl.product_id = sti.product_id
                       AND pl.quality = sti.to_quality
                       AND pl.movement_type = 'TRANSFER_IN'), 0)
    ORDER BY sti.transfer_id
  `);

  const actions = [];
  for (const r of rows) {
    const missingOut = Number(r.expected) - Number(r.out_qty);
    const missingIn = Number(r.expected) - Number(r.in_qty);

    if (missingOut > 0) {
      actions.push({
        kind: "TRANSFER_OUT",
        doc: `transfer #${r.transfer_id}`,
        product: r.product_name,
        qty: missingOut,
        outlet_id: r.from_outlet_id,
      });
      if (APPLY) {
        await client.query(
          `INSERT INTO product_ledger
             (product_id, outlet_id, movement_type, quantity, quality,
              transfer_id, production_id, movement_date, remarks)
           VALUES ($1,$2,'TRANSFER_OUT',$3,$4,$5,NULL,$6,$7)`,
          [
            r.product_id,
            r.from_outlet_id,
            missingOut,
            r.quality,
            r.transfer_id,
            r.transfer_date,
            `${TAG}: restored from stock_transfer_item`,
          ]
        );
      }
    }
    if (missingIn > 0) {
      actions.push({
        kind: "TRANSFER_IN",
        doc: `transfer #${r.transfer_id}`,
        product: r.product_name,
        qty: missingIn,
        outlet_id: r.to_outlet_id,
      });
      if (APPLY) {
        await client.query(
          `INSERT INTO product_ledger
             (product_id, outlet_id, movement_type, quantity, quality,
              transfer_id, production_id, movement_date, remarks)
           VALUES ($1,$2,'TRANSFER_IN',$3,$4,$5,NULL,$6,$7)`,
          [
            r.product_id,
            r.to_outlet_id,
            missingIn,
            r.quality,
            r.transfer_id,
            r.transfer_date,
            `${TAG}: restored from stock_transfer_item`,
          ]
        );
      }
    }
  }
  return actions;
}

async function repairSales(client) {
  const { rows } = await client.query(`
    SELECT si.sale_id, s.sale_date, s.outlet_id,
           si.product_id, p.name AS product_name, si.quality,
           SUM(si.quantity) AS expected,
           AVG(si.unit_price) AS unit_price,
           COALESCE((SELECT SUM(pl.quantity) FROM product_ledger pl
                     WHERE pl.sale_id = si.sale_id
                       AND pl.product_id = si.product_id
                       AND pl.quality = si.quality
                       AND pl.movement_type = 'SALE'), 0) AS ledger_qty
    FROM sale_item si
    JOIN sale s ON s.id = si.sale_id AND s.status = 'POSTED'
    JOIN product p ON p.id = si.product_id
    GROUP BY si.sale_id, s.sale_date, s.outlet_id, si.product_id, p.name, si.quality
    HAVING SUM(si.quantity) > COALESCE((SELECT SUM(pl.quantity) FROM product_ledger pl
                     WHERE pl.sale_id = si.sale_id
                       AND pl.product_id = si.product_id
                       AND pl.quality = si.quality
                       AND pl.movement_type = 'SALE'), 0)
    ORDER BY si.sale_id
  `);

  const actions = [];
  for (const r of rows) {
    const missing = Number(r.expected) - Number(r.ledger_qty);
    actions.push({
      kind: "SALE",
      doc: `sale #${r.sale_id}`,
      product: r.product_name,
      qty: missing,
      outlet_id: r.outlet_id,
    });
    if (APPLY) {
      await client.query(
        `INSERT INTO product_ledger
           (product_id, outlet_id, movement_type, quantity, quality,
            sale_id, production_id, movement_date, unit_price, unit_cost, remarks)
         VALUES ($1,$2,'SALE',$3,$4,$5,NULL,$6,$7,0,$8)`,
        [
          r.product_id,
          r.outlet_id,
          missing,
          r.quality,
          r.sale_id,
          r.sale_date,
          r.unit_price,
          `${TAG}: restored from sale_item`,
        ]
      );
    }
  }
  return actions;
}

async function repairGiveOuts(client) {
  const { rows } = await client.query(`
    SELECT poi.out_id, po.out_date, po.outlet_id,
           poi.product_id, p.name AS product_name, poi.quality,
           SUM(poi.quantity) AS expected,
           COALESCE((SELECT SUM(pl.quantity) FROM product_ledger pl
                     WHERE pl.product_out_id = poi.out_id
                       AND pl.product_id = poi.product_id
                       AND pl.quality = poi.quality
                       AND pl.movement_type = 'OUT'), 0) AS ledger_qty
    FROM product_out_item poi
    JOIN product_out po ON po.id = poi.out_id AND po.status = 'POSTED'
    JOIN product p ON p.id = poi.product_id
    GROUP BY poi.out_id, po.out_date, po.outlet_id, poi.product_id, p.name, poi.quality
    HAVING SUM(poi.quantity) > COALESCE((SELECT SUM(pl.quantity) FROM product_ledger pl
                     WHERE pl.product_out_id = poi.out_id
                       AND pl.product_id = poi.product_id
                       AND pl.quality = poi.quality
                       AND pl.movement_type = 'OUT'), 0)
    ORDER BY poi.out_id
  `);

  const actions = [];
  for (const r of rows) {
    const missing = Number(r.expected) - Number(r.ledger_qty);
    actions.push({
      kind: "OUT (give-out)",
      doc: `give-out #${r.out_id}`,
      product: r.product_name,
      qty: missing,
      outlet_id: r.outlet_id,
    });
    if (APPLY) {
      await client.query(
        `INSERT INTO product_ledger
           (product_id, outlet_id, movement_type, quantity, quality,
            product_out_id, production_id, movement_date, remarks)
         VALUES ($1,$2,'OUT',$3,$4,$5,NULL,$6,$7)`,
        [
          r.product_id,
          r.outlet_id,
          missing,
          r.quality,
          r.out_id,
          r.out_date,
          `${TAG}: restored from product_out_item`,
        ]
      );
    }
  }
  return actions;
}

async function repairAdjustments(client) {
  const { checkAdjustments } = require("./checkTransferIntegrity");
  const problems = await checkAdjustments(client);

  const actions = [];
  for (const p of problems) {
    const d = p.detail;
    // production may have been deleted since (ledger FK is SET NULL)
    const prod = await client.query(
      `SELECT id FROM product_production WHERE id = $1`,
      [d.production_id]
    );
    const productionId = prod.rows.length ? d.production_id : null;

    if (Number(p.out_rows) < 1) {
      actions.push({
        kind: "QUALITY_CHANGE (-)",
        doc: `adjustment #${p.adjustment_id}`,
        product: `product ${p.product_id}`,
        qty: -Number(d.quantity),
        outlet_id: p.outlet_id,
      });
      if (APPLY) {
        await client.query(
          `INSERT INTO product_ledger
             (product_id, outlet_id, movement_type, quantity, quality,
              production_id, movement_date, remarks, adjustment_id)
           VALUES ($1,$2,'QUALITY_CHANGE',$3,$4,$5,$6,$7,$8)`,
          [
            p.product_id,
            p.outlet_id,
            -Number(d.quantity),
            d.from_quality,
            productionId,
            d.movement_date,
            `${TAG}: restored from stock_quality_adjustment`,
            p.adjustment_id,
          ]
        );
      }
    }
    if (Number(p.in_rows) < 1) {
      actions.push({
        kind: "QUALITY_CHANGE (+)",
        doc: `adjustment #${p.adjustment_id}`,
        product: `product ${p.product_id}`,
        qty: Number(d.quantity),
        outlet_id: p.outlet_id,
      });
      if (APPLY) {
        await client.query(
          `INSERT INTO product_ledger
             (product_id, outlet_id, movement_type, quantity, quality,
              production_id, movement_date, remarks, adjustment_id)
           VALUES ($1,$2,'QUALITY_CHANGE',$3,$4,$5,$6,$7,$8)`,
          [
            p.product_id,
            p.outlet_id,
            Number(d.quantity),
            d.to_quality,
            productionId,
            d.movement_date,
            `${TAG}: restored from stock_quality_adjustment`,
            p.adjustment_id,
          ]
        );
      }
    }
  }
  return actions;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const transferActions = await repairTransfers(client);
    const saleActions = await repairSales(client);
    const giveOutActions = await repairGiveOuts(client);
    const adjustmentActions = await repairAdjustments(client);

    const all = [
      ...transferActions,
      ...saleActions,
      ...giveOutActions,
      ...adjustmentActions,
    ];

    if (all.length === 0) {
      console.log("✅ Nothing to repair — ledger already matches all documents.");
      await client.query("ROLLBACK");
      return;
    }

    console.log(
      `${APPLY ? "Applying" : "DRY RUN (use --apply to write)"} — ${all.length} compensating ledger row(s):`
    );
    console.table(all);

    if (APPLY) {
      await client.query("COMMIT");
      console.log("✅ Repairs committed.");
    } else {
      await client.query("ROLLBACK");
      console.log("No changes written.");
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Repair failed, rolled back:", err);
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
