// Tracks money the business has lent out — to staff (recoverable via
// salary deduction) or to people outside the company (recoverable via
// manual repayment). Mirrors the customer-debt module's shape: a loan +
// full repayment history, with overpayment protection.

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Resolve who a loan is for. Exactly one of staff_id or
 * (borrower_id | borrower_name) must be provided; a new external borrower
 * is created on the fly from a typed name, same pattern as resolveCustomer.
 */
async function resolveLoanParty(
  client,
  { staff_id, borrower_id, borrower_name, borrower_phone }
) {
  if (staff_id) {
    return { staff_id, borrower_id: null };
  }

  if (borrower_id) {
    return { staff_id: null, borrower_id };
  }

  if (borrower_name && borrower_name.trim()) {
    const res = await client.query(
      `INSERT INTO borrower (name, phone, is_active)
       VALUES ($1, $2, true)
       RETURNING id`,
      [borrower_name.trim(), borrower_phone || null]
    );
    return { staff_id: null, borrower_id: res.rows[0].id };
  }

  const err = new Error("A loan requires either a staff member or a borrower");
  err.code = "INVALID_LOAN_PARTY";
  throw err;
}

async function createLoan(
  client,
  { staff_id, borrower_id, borrower_name, borrower_phone, amount, loan_date, reason, created_by }
) {
  if (!Number(amount) || Number(amount) <= 0) {
    const err = new Error("Loan amount must be > 0");
    err.code = "INVALID_LOAN";
    throw err;
  }

  const party = await resolveLoanParty(client, {
    staff_id,
    borrower_id,
    borrower_name,
    borrower_phone,
  });

  const ins = await client.query(
    `INSERT INTO loan (staff_id, borrower_id, amount, loan_date, reason, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [
      party.staff_id,
      party.borrower_id,
      amount,
      loan_date || new Date(),
      reason || null,
      created_by || null,
    ]
  );

  return ins.rows[0].id;
}

async function getLoanBalance(client, loanId) {
  const { rows } = await client.query(
    `
    SELECT l.amount - COALESCE(SUM(lr.amount), 0) AS balance
    FROM loan l
    LEFT JOIN loan_repayment lr ON lr.loan_id = l.id
    WHERE l.id = $1
    GROUP BY l.id
    `,
    [loanId]
  );
  return rows.length ? Number(rows[0].balance) : null;
}

async function addLoanRepayment(
  client,
  loanId,
  { amount, repayment_date, method, reference, received_by }
) {
  if (!Number(amount) || Number(amount) <= 0) {
    const err = new Error("Repayment amount must be > 0");
    err.code = "INVALID_PAYMENT";
    throw err;
  }

  const balance = await getLoanBalance(client, loanId);
  if (balance === null) {
    const err = new Error("Loan not found");
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
    `INSERT INTO loan_repayment (loan_id, amount, repayment_date, method, reference, received_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [
      loanId,
      amount,
      repayment_date || new Date(),
      method || null,
      reference || null,
      received_by || null,
    ]
  );

  return ins.rows[0].id;
}

/**
 * Delete a loan outright. Refuses if any repayment has already been made
 * against it — deleting would silently erase that repayment history.
 */
async function deleteLoan(client, loanId) {
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM loan_repayment WHERE loan_id = $1`,
    [loanId]
  );

  if (Number(rows[0].count) > 0) {
    const err = new Error(
      "Cannot delete this loan: repayments have already been recorded against it."
    );
    err.code = "LOAN_HAS_PAYMENTS";
    throw err;
  }

  const del = await client.query(`DELETE FROM loan WHERE id = $1`, [loanId]);
  return del.rowCount > 0;
}

const BORROWER_NAME_SQL = `COALESCE(s.name, b.name)`;

/**
 * List loans with balance, optionally filtered to only outstanding ones,
 * by borrower type (staff/external), or by a name search.
 */
async function getLoans(
  client,
  { onlyOutstanding = true, type, search, staff_id, loan_id } = {}
) {
  const where = [];
  const params = [];
  let i = 0;

  if (type === "staff") {
    where.push("l.staff_id IS NOT NULL");
  } else if (type === "external") {
    where.push("l.borrower_id IS NOT NULL");
  }

  if (staff_id) {
    params.push(staff_id);
    i++;
    where.push(`l.staff_id = $${i}`);
  }

  if (loan_id) {
    params.push(loan_id);
    i++;
    where.push(`l.id = $${i}`);
  }

  if (search) {
    params.push(`%${search.trim().toLowerCase()}%`);
    i++;
    where.push(`LOWER(${BORROWER_NAME_SQL}) LIKE $${i}`);
  }

  const whereSQL = where.length ? `AND ${where.join(" AND ")}` : "";
  const havingSQL = onlyOutstanding
    ? "HAVING l.amount - COALESCE(SUM(lr.amount), 0) > 0"
    : "";

  const { rows } = await client.query(
    `
    SELECT
      l.id, l.staff_id, s.name AS staff_name,
      l.borrower_id, b.name AS borrower_name, b.phone AS borrower_phone,
      ${BORROWER_NAME_SQL} AS party_name,
      CASE WHEN l.staff_id IS NOT NULL THEN 'staff' ELSE 'external' END AS type,
      l.amount, l.loan_date, l.reason, l.created_at,
      COALESCE(SUM(lr.amount), 0) AS repaid,
      l.amount - COALESCE(SUM(lr.amount), 0) AS balance
    FROM loan l
    LEFT JOIN staff s ON s.id = l.staff_id
    LEFT JOIN borrower b ON b.id = l.borrower_id
    LEFT JOIN loan_repayment lr ON lr.loan_id = l.id
    WHERE 1=1 ${whereSQL}
    GROUP BY l.id, s.name, b.name, b.phone
    ${havingSQL}
    ORDER BY l.loan_date DESC, l.id DESC
    `,
    params
  );
  return rows;
}

async function getLoanDetail(client, loanId) {
  const loans = await getLoans(client, {
    onlyOutstanding: false,
    loan_id: loanId,
  });
  const loan = loans[0];
  if (!loan) return null;

  const repayments = await client.query(
    `SELECT * FROM loan_repayment WHERE loan_id = $1 ORDER BY repayment_date DESC, id DESC`,
    [loanId]
  );

  return { loan, repayments: repayments.rows };
}

async function searchBorrowers(client, search) {
  const params = [];
  let whereSQL = "WHERE is_active = true";
  if (search) {
    params.push(`%${search.trim().toLowerCase()}%`);
    whereSQL += ` AND LOWER(name) LIKE $1`;
  }
  const { rows } = await client.query(
    `SELECT id, name, phone FROM borrower ${whereSQL} ORDER BY name ASC LIMIT 50`,
    params
  );
  return rows;
}

module.exports = {
  createLoan,
  getLoanBalance,
  addLoanRepayment,
  deleteLoan,
  getLoans,
  getLoanDetail,
  searchBorrowers,
};
