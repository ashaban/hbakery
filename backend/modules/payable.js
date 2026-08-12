// Tracks money the business OWES — to staff (e.g. unpaid wages/
// reimbursement) or to people outside the company (e.g. a supplier,
// landlord, anyone). Mirrors the loan module's shape exactly, just the
// opposite direction: a payable + full payment history, with overpayment
// protection.

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Resolve who a payable is owed to. Exactly one of staff_id or
 * (creditor_id | creditor_name) must be provided; a new external creditor
 * is created on the fly from a typed name, same pattern as resolveLoanParty.
 */
async function resolvePayableParty(
  client,
  { staff_id, creditor_id, creditor_name, creditor_phone }
) {
  if (staff_id) {
    return { staff_id, creditor_id: null };
  }

  if (creditor_id) {
    return { staff_id: null, creditor_id };
  }

  if (creditor_name && creditor_name.trim()) {
    const res = await client.query(
      `INSERT INTO creditor (name, phone, is_active)
       VALUES ($1, $2, true)
       RETURNING id`,
      [creditor_name.trim(), creditor_phone || null]
    );
    return { staff_id: null, creditor_id: res.rows[0].id };
  }

  const err = new Error(
    "A payable requires either a staff member or a creditor"
  );
  err.code = "INVALID_PAYABLE_PARTY";
  throw err;
}

async function createPayable(
  client,
  {
    staff_id,
    creditor_id,
    creditor_name,
    creditor_phone,
    amount,
    payable_date,
    reason,
    created_by,
  }
) {
  if (!Number(amount) || Number(amount) <= 0) {
    const err = new Error("Payable amount must be > 0");
    err.code = "INVALID_PAYABLE";
    throw err;
  }

  const party = await resolvePayableParty(client, {
    staff_id,
    creditor_id,
    creditor_name,
    creditor_phone,
  });

  const ins = await client.query(
    `INSERT INTO payable (staff_id, creditor_id, amount, payable_date, reason, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [
      party.staff_id,
      party.creditor_id,
      amount,
      payable_date || new Date(),
      reason || null,
      created_by || null,
    ]
  );

  return ins.rows[0].id;
}

async function getPayableBalance(client, payableId) {
  const { rows } = await client.query(
    `
    SELECT p.amount - COALESCE(SUM(pp.amount), 0) AS balance
    FROM payable p
    LEFT JOIN payable_payment pp ON pp.payable_id = p.id
    WHERE p.id = $1
    GROUP BY p.id
    `,
    [payableId]
  );
  return rows.length ? Number(rows[0].balance) : null;
}

async function addPayablePayment(
  client,
  payableId,
  { amount, payment_date, method, reference, paid_by }
) {
  if (!Number(amount) || Number(amount) <= 0) {
    const err = new Error("Payment amount must be > 0");
    err.code = "INVALID_PAYMENT";
    throw err;
  }

  const balance = await getPayableBalance(client, payableId);
  if (balance === null) {
    const err = new Error("Payable not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (round2(Number(amount)) > round2(balance)) {
    const err = new Error(
      `Payment (${amount}) exceeds the remaining balance owed (${balance})`
    );
    err.code = "OVERPAYMENT";
    err.meta = { balance, amount };
    throw err;
  }

  const ins = await client.query(
    `INSERT INTO payable_payment (payable_id, amount, payment_date, method, reference, paid_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [
      payableId,
      amount,
      payment_date || new Date(),
      method || null,
      reference || null,
      paid_by || null,
    ]
  );

  return ins.rows[0].id;
}

/**
 * Delete a payable outright. Refuses if any payment has already been made
 * against it — deleting would silently erase that payment history.
 */
async function deletePayable(client, payableId) {
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM payable_payment WHERE payable_id = $1`,
    [payableId]
  );

  if (Number(rows[0].count) > 0) {
    const err = new Error(
      "Cannot delete this payable: payments have already been recorded against it."
    );
    err.code = "PAYABLE_HAS_PAYMENTS";
    throw err;
  }

  const del = await client.query(`DELETE FROM payable WHERE id = $1`, [
    payableId,
  ]);
  return del.rowCount > 0;
}

const CREDITOR_NAME_SQL = `COALESCE(s.name, c.name)`;

/**
 * List payables with balance, optionally filtered to only outstanding
 * ones, by party type (staff/external), or by a name search.
 */
async function getPayables(
  client,
  { onlyOutstanding = true, type, search, staff_id, payable_id } = {}
) {
  const where = [];
  const params = [];
  let i = 0;

  if (type === "staff") {
    where.push("p.staff_id IS NOT NULL");
  } else if (type === "external") {
    where.push("p.creditor_id IS NOT NULL");
  }

  if (staff_id) {
    params.push(staff_id);
    i++;
    where.push(`p.staff_id = $${i}`);
  }

  if (payable_id) {
    params.push(payable_id);
    i++;
    where.push(`p.id = $${i}`);
  }

  if (search) {
    params.push(`%${search.trim().toLowerCase()}%`);
    i++;
    where.push(`LOWER(${CREDITOR_NAME_SQL}) LIKE $${i}`);
  }

  const whereSQL = where.length ? `AND ${where.join(" AND ")}` : "";
  const havingSQL = onlyOutstanding
    ? "HAVING p.amount - COALESCE(SUM(pp.amount), 0) > 0"
    : "";

  const { rows } = await client.query(
    `
    SELECT
      p.id, p.staff_id, s.name AS staff_name,
      p.creditor_id, c.name AS creditor_name, c.phone AS creditor_phone,
      ${CREDITOR_NAME_SQL} AS party_name,
      CASE WHEN p.staff_id IS NOT NULL THEN 'staff' ELSE 'external' END AS type,
      p.amount, TO_CHAR(p.payable_date, 'YYYY-MM-DD') AS payable_date, p.reason, p.created_at,
      COALESCE(SUM(pp.amount), 0) AS paid,
      p.amount - COALESCE(SUM(pp.amount), 0) AS balance
    FROM payable p
    LEFT JOIN staff s ON s.id = p.staff_id
    LEFT JOIN creditor c ON c.id = p.creditor_id
    LEFT JOIN payable_payment pp ON pp.payable_id = p.id
    WHERE 1=1 ${whereSQL}
    GROUP BY p.id, s.name, c.name, c.phone
    ${havingSQL}
    ORDER BY p.payable_date DESC, p.id DESC
    `,
    params
  );
  return rows;
}

async function getPayableDetail(client, payableId) {
  const payables = await getPayables(client, {
    onlyOutstanding: false,
    payable_id: payableId,
  });
  const payable = payables[0];
  if (!payable) return null;

  const payments = await client.query(
    `SELECT pp.*, TO_CHAR(pp.payment_date, 'YYYY-MM-DD') AS payment_date
     FROM payable_payment pp WHERE pp.payable_id = $1 ORDER BY pp.payment_date DESC, pp.id DESC`,
    [payableId]
  );

  return { payable, payments: payments.rows };
}

async function searchCreditors(client, search) {
  const params = [];
  let whereSQL = "WHERE is_active = true";
  if (search) {
    params.push(`%${search.trim().toLowerCase()}%`);
    whereSQL += ` AND LOWER(name) LIKE $1`;
  }
  const { rows } = await client.query(
    `SELECT id, name, phone FROM creditor ${whereSQL} ORDER BY name ASC LIMIT 50`,
    params
  );
  return rows;
}

module.exports = {
  createPayable,
  getPayableBalance,
  addPayablePayment,
  deletePayable,
  getPayables,
  getPayableDetail,
  searchCreditors,
};
