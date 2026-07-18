// Standing data-integrity check: verifies that every stock document
// (transfer, POSTED sale, POSTED give-out, active quality adjustment) is
// fully backed by matching product_ledger movements. This is the outer
// safety net — DB constraint triggers (migration 005) enforce the same
// invariants at commit time; this script exists to detect anything that
// predates them or slips around them.
//
// Checks are AGGREGATE, per (document, product): summed document quantity
// vs summed ledger quantity. This catches both total loss (no rows) and
// partial loss (FIFO-split rows where only some batches were wiped).
//
// Usage: node scripts/checkTransferIntegrity.js
// Exit code 0 = clean, 1 = mismatches found, 2 = script error.

const pool = require("../db");

async function checkTransfers(db) {
  const { rows } = await db.query(`
    SELECT
      sti.transfer_id,
      st.transfer_date,
      fo.name AS from_outlet_name,
      too.name AS to_outlet_name,
      sti.product_id,
      p.name AS product_name,
      SUM(sti.quantity) AS expected_qty,
      COALESCE((
        SELECT SUM(pl.quantity) FROM product_ledger pl
        WHERE pl.transfer_id = sti.transfer_id
          AND pl.product_id = sti.product_id
          AND pl.movement_type = 'TRANSFER_OUT'
      ), 0) AS out_qty,
      COALESCE((
        SELECT SUM(pl.quantity) FROM product_ledger pl
        WHERE pl.transfer_id = sti.transfer_id
          AND pl.product_id = sti.product_id
          AND pl.movement_type = 'TRANSFER_IN'
      ), 0) AS in_qty
    FROM stock_transfer_item sti
    JOIN stock_transfer st ON st.id = sti.transfer_id
    JOIN outlet fo ON fo.id = st.from_outlet_id
    JOIN outlet too ON too.id = st.to_outlet_id
    JOIN product p ON p.id = sti.product_id
    GROUP BY sti.transfer_id, st.transfer_date, fo.name, too.name,
             sti.product_id, p.name
    HAVING SUM(sti.quantity) <> COALESCE((
        SELECT SUM(pl.quantity) FROM product_ledger pl
        WHERE pl.transfer_id = sti.transfer_id
          AND pl.product_id = sti.product_id
          AND pl.movement_type = 'TRANSFER_OUT'), 0)
        OR SUM(sti.quantity) <> COALESCE((
        SELECT SUM(pl.quantity) FROM product_ledger pl
        WHERE pl.transfer_id = sti.transfer_id
          AND pl.product_id = sti.product_id
          AND pl.movement_type = 'TRANSFER_IN'), 0)
    ORDER BY sti.transfer_id DESC
  `);
  return rows;
}

async function checkSales(db) {
  const { rows } = await db.query(`
    SELECT
      si.sale_id,
      s.sale_date,
      o.name AS outlet_name,
      si.product_id,
      p.name AS product_name,
      SUM(si.quantity) AS expected_qty,
      COALESCE((
        SELECT SUM(pl.quantity) FROM product_ledger pl
        WHERE pl.sale_id = si.sale_id
          AND pl.product_id = si.product_id
          AND pl.movement_type = 'SALE'
      ), 0) AS ledger_qty
    FROM sale_item si
    JOIN sale s ON s.id = si.sale_id AND s.status = 'POSTED'
    JOIN outlet o ON o.id = s.outlet_id
    JOIN product p ON p.id = si.product_id
    GROUP BY si.sale_id, s.sale_date, o.name, si.product_id, p.name
    HAVING SUM(si.quantity) <> COALESCE((
        SELECT SUM(pl.quantity) FROM product_ledger pl
        WHERE pl.sale_id = si.sale_id
          AND pl.product_id = si.product_id
          AND pl.movement_type = 'SALE'), 0)
    ORDER BY si.sale_id DESC
  `);
  return rows;
}

async function checkGiveOuts(db) {
  const { rows } = await db.query(`
    SELECT
      poi.out_id,
      po.out_date,
      o.name AS outlet_name,
      poi.product_id,
      p.name AS product_name,
      SUM(poi.quantity) AS expected_qty,
      COALESCE((
        SELECT SUM(pl.quantity) FROM product_ledger pl
        WHERE pl.product_out_id = poi.out_id
          AND pl.product_id = poi.product_id
          AND pl.movement_type = 'OUT'
      ), 0) AS ledger_qty
    FROM product_out_item poi
    JOIN product_out po ON po.id = poi.out_id AND po.status = 'POSTED'
    JOIN outlet o ON o.id = po.outlet_id
    JOIN product p ON p.id = poi.product_id
    GROUP BY poi.out_id, po.out_date, o.name, poi.product_id, p.name
    HAVING SUM(poi.quantity) <> COALESCE((
        SELECT SUM(pl.quantity) FROM product_ledger pl
        WHERE pl.product_out_id = poi.out_id
          AND pl.product_id = poi.product_id
          AND pl.movement_type = 'OUT'), 0)
    ORDER BY poi.out_id DESC
  `);
  return rows;
}

// Active (non-reversed) quality adjustments should each be backed by a
// -qty row (from_quality) and a +qty row (to_quality) per batch detail.
// Ledger rows created after migration 005 carry adjustment_id and are
// matched exactly; older rows are matched heuristically on
// (outlet, product, production, date, quantity, quality).
async function checkAdjustments(db) {
  const { rows: adjustments } = await db.query(`
    SELECT id, outlet_id, product_id, from_quality, to_quality,
           quantity, movement_date, adjustment_details
    FROM stock_quality_adjustment
    WHERE is_reversed = false
    ORDER BY id
  `);

  const problems = [];
  for (const adj of adjustments) {
    const details =
      typeof adj.adjustment_details === "string"
        ? JSON.parse(adj.adjustment_details || "[]")
        : adj.adjustment_details || [];

    for (const d of details) {
      const { rows } = await db.query(
        `SELECT
           COUNT(*) FILTER (WHERE quantity = -$5::numeric AND quality = $6) AS out_rows,
           COUNT(*) FILTER (WHERE quantity =  $5::numeric AND quality = $7) AS in_rows
         FROM product_ledger
         WHERE movement_type = 'QUALITY_CHANGE'
           AND outlet_id = $1 AND product_id = $2
           AND (production_id = $3 OR production_id IS NULL)
           AND movement_date = $4
           AND (adjustment_id = $8 OR adjustment_id IS NULL)`,
        [
          adj.outlet_id,
          adj.product_id,
          d.production_id,
          d.movement_date,
          d.quantity,
          d.from_quality,
          d.to_quality,
          adj.id,
        ]
      );
      if (Number(rows[0].out_rows) < 1 || Number(rows[0].in_rows) < 1) {
        problems.push({
          adjustment_id: adj.id,
          outlet_id: adj.outlet_id,
          product_id: adj.product_id,
          detail: d,
          out_rows: rows[0].out_rows,
          in_rows: rows[0].in_rows,
        });
      }
    }
  }
  return problems;
}

async function runAllChecks(db) {
  const [transfers, sales, giveOuts, adjustments] = [
    await checkTransfers(db),
    await checkSales(db),
    await checkGiveOuts(db),
    await checkAdjustments(db),
  ];
  return { transfers, sales, giveOuts, adjustments };
}

// Back-compat: the transfer-integrity UI endpoint uses this
async function checkTransferIntegrity(db = pool) {
  return checkTransfers(db);
}

async function main() {
  try {
    const { transfers, sales, giveOuts, adjustments } = await runAllChecks(
      pool
    );
    const total =
      transfers.length + sales.length + giveOuts.length + adjustments.length;

    if (total === 0) {
      console.log(
        "✅ Ledger integrity check passed: transfers, sales, give-outs and adjustments all fully backed by stock movements."
      );
      process.exit(0);
    }

    if (transfers.length) {
      console.error(
        `❌ ${transfers.length} transfer item group(s) with missing/short ledger movements:`
      );
      console.table(
        transfers.map((r) => ({
          transfer_id: r.transfer_id,
          date: r.transfer_date,
          product: r.product_name,
          expected: r.expected_qty,
          out_qty: r.out_qty,
          in_qty: r.in_qty,
          route: `${r.from_outlet_name} -> ${r.to_outlet_name}`,
        }))
      );
    }
    if (sales.length) {
      console.error(
        `❌ ${sales.length} sale item group(s) with missing/short ledger deductions:`
      );
      console.table(
        sales.map((r) => ({
          sale_id: r.sale_id,
          date: r.sale_date,
          outlet: r.outlet_name,
          product: r.product_name,
          sold: r.expected_qty,
          ledger: r.ledger_qty,
        }))
      );
    }
    if (giveOuts.length) {
      console.error(
        `❌ ${giveOuts.length} give-out item group(s) with missing/short ledger deductions:`
      );
      console.table(giveOuts);
    }
    if (adjustments.length) {
      console.error(
        `❌ ${adjustments.length} quality-adjustment detail(s) with missing ledger rows:`
      );
      console.table(
        adjustments.map((r) => ({
          adjustment_id: r.adjustment_id,
          outlet_id: r.outlet_id,
          product_id: r.product_id,
          qty: r.detail.quantity,
          from: r.detail.from_quality,
          to: r.detail.to_quality,
          out_rows: r.out_rows,
          in_rows: r.in_rows,
        }))
      );
    }
    process.exit(1);
  } catch (err) {
    console.error("Ledger integrity check failed to run:", err);
    process.exit(2);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkTransferIntegrity,
  checkTransfers,
  checkSales,
  checkGiveOuts,
  checkAdjustments,
  runAllChecks,
};
