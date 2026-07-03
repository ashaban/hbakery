// Standing data-integrity check: finds stock transfers whose items were
// recorded (stock_transfer_item) but never actually moved stock
// (product_ledger). This should never happen if a transfer's DB
// transaction fully commits or fully rolls back, but is the shape of
// corruption a leaked/reused connection can leave behind. Run this
// periodically (cron) rather than per-request, so it also catches drift
// from causes other than the request path itself (manual SQL, migrations,
// future bugs).
//
// Usage: node scripts/checkTransferIntegrity.js
// Exit code 0 = clean, 1 = orphans found, 2 = script error.

const pool = require("../db");

async function checkTransferIntegrity(db = pool) {
  const { rows } = await db.query(`
    SELECT
      sti.transfer_id,
      st.transfer_date,
      st.from_outlet_id,
      fo.name AS from_outlet_name,
      st.to_outlet_id,
      too.name AS to_outlet_name,
      sti.id AS item_id,
      sti.product_id,
      p.name AS product_name,
      sti.quantity,
      sti.from_quality,
      sti.to_quality,
      COALESCE(SUM(CASE WHEN pl.movement_type = 'TRANSFER_OUT' THEN pl.quantity END), 0) AS out_qty,
      COALESCE(SUM(CASE WHEN pl.movement_type = 'TRANSFER_IN' THEN pl.quantity END), 0) AS in_qty
    FROM stock_transfer_item sti
    JOIN stock_transfer st ON st.id = sti.transfer_id
    JOIN outlet fo ON fo.id = st.from_outlet_id
    JOIN outlet too ON too.id = st.to_outlet_id
    JOIN product p ON p.id = sti.product_id
    LEFT JOIN product_ledger pl
      ON pl.transfer_id = sti.transfer_id AND pl.product_id = sti.product_id
    GROUP BY sti.transfer_id, st.transfer_date, st.from_outlet_id, fo.name,
             st.to_outlet_id, too.name, sti.id, sti.product_id, p.name,
             sti.quantity, sti.from_quality, sti.to_quality
    HAVING COALESCE(SUM(CASE WHEN pl.movement_type = 'TRANSFER_OUT' THEN pl.quantity END), 0) = 0
        OR COALESCE(SUM(CASE WHEN pl.movement_type = 'TRANSFER_IN' THEN pl.quantity END), 0) = 0
    ORDER BY sti.transfer_id DESC, sti.id
  `);

  return rows;
}

async function main() {
  try {
    const orphans = await checkTransferIntegrity();

    if (orphans.length === 0) {
      console.log("✅ Transfer integrity check passed: no orphaned transfer items found.");
      process.exit(0);
    }

    console.error(
      `❌ Found ${orphans.length} transfer item(s) with no matching ledger movement:`
    );
    console.table(
      orphans.map((r) => ({
        transfer_id: r.transfer_id,
        transfer_date: r.transfer_date,
        product: r.product_name,
        quantity: r.quantity,
        from: r.from_outlet_name,
        to: r.to_outlet_name,
        out_qty: r.out_qty,
        in_qty: r.in_qty,
      }))
    );
    process.exit(1);
  } catch (err) {
    console.error("Transfer integrity check failed to run:", err);
    process.exit(2);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkTransferIntegrity };
