// A single bulk sale (many items, no single customer) can have several
// named customers who still owe part of the unpaid balance. Each named
// debt is tracked here, separate from sale_payment (which represents cash
// actually collected at the till, not attributed to any one customer).
const { resolveCustomer } = require("./customer");

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Confirm the named debts on a sale exactly account for whatever wasn't
 * collected as an immediate payment. This is the guard against silently
 * losing track of who owes what: if the numbers don't match, something
 * was mistyped or a debtor was missed.
 */
function reconcileSaleDebts(saleTotal, paidTotal, debts = []) {
  const balance = round2(Math.max(Number(saleTotal) - Number(paidTotal), 0));
  const debtSum = round2(
    debts.reduce((sum, d) => sum + Number(d.amount || 0), 0)
  );

  if (debtSum !== balance) {
    const err = new Error(
      `Customer debts (${debtSum}) do not match the sale's unpaid balance (${balance}). ` +
        `Every unit not paid for immediately must be attributed to a named customer.`
    );
    err.code = "DEBT_MISMATCH";
    err.meta = { balance, debtSum };
    throw err;
  }
}

async function insertSaleDebts(client, saleId, debts = []) {
  for (const d of debts) {
    if (!Number(d.amount) || Number(d.amount) <= 0) {
      const err = new Error("Each customer debt must have an amount > 0");
      err.code = "INVALID_DEBT";
      throw err;
    }

    const customer_id = await resolveCustomer(client, {
      customer_id: d.customer_id,
      customer_name: d.customer_name,
    });

    if (!customer_id) {
      const err = new Error("Each customer debt requires a customer");
      err.code = "INVALID_DEBT";
      throw err;
    }

    await client.query(
      `INSERT INTO sale_customer_debt (sale_id, customer_id, amount, notes)
       VALUES ($1,$2,$3,$4)`,
      [saleId, customer_id, d.amount, d.notes || null]
    );
  }
}

/**
 * Editing a sale replaces its debts wholesale (same pattern as items).
 * Refuse to do that once a customer has already paid something back
 * against one of those debts — restructuring debts after real cash moved
 * would silently disconnect a payment from what it was paying off.
 */
async function deleteSaleDebts(client, saleId) {
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM customer_debt_payment cdp
     JOIN sale_customer_debt scd ON scd.id = cdp.debt_id
     WHERE scd.sale_id = $1`,
    [saleId]
  );

  if (Number(rows[0].count) > 0) {
    const err = new Error(
      "Cannot change this sale's customer debts: one or more debtors have already made repayments against them."
    );
    err.code = "DEBT_HAS_PAYMENTS";
    throw err;
  }

  await client.query(`DELETE FROM sale_customer_debt WHERE sale_id = $1`, [
    saleId,
  ]);
}

async function getSaleDebtsWithBalance(client, saleId) {
  const { rows } = await client.query(
    `
    SELECT
      scd.id, scd.sale_id, scd.customer_id, c.name AS customer_name,
      scd.amount, scd.notes, scd.created_at,
      COALESCE(SUM(cdp.amount), 0) AS repaid,
      scd.amount - COALESCE(SUM(cdp.amount), 0) AS balance
    FROM sale_customer_debt scd
    JOIN customer c ON c.id = scd.customer_id
    LEFT JOIN customer_debt_payment cdp ON cdp.debt_id = scd.id
    WHERE scd.sale_id = $1
    GROUP BY scd.id, c.name
    ORDER BY scd.id
    `,
    [saleId]
  );
  return rows;
}

/**
 * Full statement for one customer: every debt they've ever been named on,
 * which sale it came from, and what they still owe on each.
 */
async function getCustomerDebtStatement(client, customerId) {
  const { rows } = await client.query(
    `
    SELECT
      scd.id, scd.sale_id, s.sale_date, o.name AS outlet_name,
      scd.amount, scd.notes, scd.created_at,
      COALESCE(SUM(cdp.amount), 0) AS repaid,
      scd.amount - COALESCE(SUM(cdp.amount), 0) AS balance
    FROM sale_customer_debt scd
    JOIN sale s ON s.id = scd.sale_id
    LEFT JOIN outlet o ON o.id = s.outlet_id
    LEFT JOIN customer_debt_payment cdp ON cdp.debt_id = scd.id
    WHERE scd.customer_id = $1
    GROUP BY scd.id, s.sale_date, o.name
    ORDER BY s.sale_date DESC, scd.id DESC
    `,
    [customerId]
  );
  return rows;
}

/**
 * Receivables report: every debt across all customers that still has a
 * balance owed, for collecting outstanding debts.
 */
async function getOutstandingDebts(
  client,
  { outlet_id, customer_id, search } = {}
) {
  const where = [];
  const params = [];
  let i = 0;

  if (outlet_id) {
    params.push(outlet_id);
    i++;
    where.push(`s.outlet_id = $${i}`);
  }
  if (customer_id) {
    params.push(customer_id);
    i++;
    where.push(`scd.customer_id = $${i}`);
  }
  if (search) {
    params.push(`%${search.trim().toLowerCase()}%`);
    i++;
    where.push(`LOWER(c.name) LIKE $${i}`);
  }
  const whereSQL = where.length ? `AND ${where.join(" AND ")}` : "";

  const { rows } = await client.query(
    `
    SELECT
      scd.id, scd.sale_id, s.sale_date, o.name AS outlet_name,
      scd.customer_id, c.name AS customer_name,
      scd.amount, scd.notes,
      COALESCE(SUM(cdp.amount), 0) AS repaid,
      scd.amount - COALESCE(SUM(cdp.amount), 0) AS balance
    FROM sale_customer_debt scd
    JOIN customer c ON c.id = scd.customer_id
    JOIN sale s ON s.id = scd.sale_id
    LEFT JOIN outlet o ON o.id = s.outlet_id
    LEFT JOIN customer_debt_payment cdp ON cdp.debt_id = scd.id
    WHERE 1=1 ${whereSQL}
    GROUP BY scd.id, s.sale_date, o.name, c.name
    HAVING scd.amount - COALESCE(SUM(cdp.amount), 0) > 0
    ORDER BY s.sale_date DESC, scd.id DESC
    `,
    params
  );
  return rows;
}

async function addDebtPayment(
  client,
  debtId,
  { amount, payment_date, method, reference, received_by }
) {
  if (!Number(amount) || Number(amount) <= 0) {
    const err = new Error("Payment amount must be > 0");
    err.code = "INVALID_PAYMENT";
    throw err;
  }

  const { rows } = await client.query(
    `
    SELECT scd.amount - COALESCE(SUM(cdp.amount), 0) AS balance
    FROM sale_customer_debt scd
    LEFT JOIN customer_debt_payment cdp ON cdp.debt_id = scd.id
    WHERE scd.id = $1
    GROUP BY scd.id
    `,
    [debtId]
  );

  if (!rows.length) {
    const err = new Error("Debt not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  const balance = Number(rows[0].balance);
  if (round2(Number(amount)) > round2(balance)) {
    const err = new Error(
      `Payment (${amount}) exceeds the remaining balance owed (${balance})`
    );
    err.code = "OVERPAYMENT";
    err.meta = { balance, amount };
    throw err;
  }

  const ins = await client.query(
    `INSERT INTO customer_debt_payment (debt_id, amount, payment_date, method, reference, received_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [
      debtId,
      amount,
      payment_date || new Date(),
      method || null,
      reference || null,
      received_by || null,
    ]
  );

  return ins.rows[0].id;
}

module.exports = {
  reconcileSaleDebts,
  insertSaleDebts,
  deleteSaleDebts,
  getSaleDebtsWithBalance,
  getCustomerDebtStatement,
  getOutstandingDebts,
  addDebtPayment,
};
