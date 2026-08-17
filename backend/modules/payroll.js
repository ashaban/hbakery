// modules/payroll.js
//
// Payroll engine: generates a monthly period from standing pay, applies
// statutory deductions, and pays it. Adapted from ITSF-IMS's payroll
// service — see migrations/017_payroll.sql for what was simplified and
// why (no approval workflow, basic pay from staff.salary directly,
// loan recovery instead of a parallel debt system).
//
// Every figure is snapshotted onto the payslip at generation time, so a
// later change to a staff member's salary, allowances or a statutory
// rate never rewrites a period that has already been generated — only
// regenerating (deliberately, while still a DRAFT) picks up new values.

const { getLoanBalance, addLoanRepayment } = require("./loan");

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

class PayrollError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code || "PAYROLL_ERROR";
  }
}

// ── Statutory calculation ──────────────────────────────────────────

/** Statutory rules in force on a given date, with their bands attached. */
async function activeStatutory(client, onDate) {
  const { rows } = await client.query(
    `SELECT * FROM statutory_deduction
     WHERE is_active
       AND effective_from <= $1
       AND (effective_to IS NULL OR effective_to >= $1)
     ORDER BY sort_order`,
    [onDate]
  );
  if (!rows.length) return [];

  const { rows: brackets } = await client.query(
    `SELECT * FROM statutory_bracket
     WHERE statutory_id = ANY($1::int[])
     ORDER BY statutory_id, sort_order`,
    [rows.map((r) => r.id)]
  );

  return rows.map((rule) => ({
    ...rule,
    brackets: brackets.filter((b) => b.statutory_id === rule.id),
  }));
}

/**
 * Amount due for one statutory rule against one payslip's bases.
 * Exported so the calculation can be checked directly, independent of
 * any database round-trip.
 */
function computeStatutory(rule, bases) {
  const base = { GROSS: bases.gross, TAXABLE: bases.taxable, PENSIONABLE: bases.pensionable }[
    rule.base
  ] ?? 0;
  if (base <= 0) return 0;

  if (rule.calc_type === "FIXED") return round2(rule.rate);
  if (rule.calc_type === "PERCENTAGE") return round2((base * Number(rule.rate)) / 100);

  if (rule.calc_type === "BANDED") {
    // Progressive: find the band the base falls in, charge that band's
    // fixed amount plus its rate on the excess over the band's floor.
    const band = rule.brackets.find(
      (b) =>
        base > Number(b.lower_bound) &&
        (b.upper_bound === null || base <= Number(b.upper_bound))
    );
    if (!band) return 0;
    const excess = base - Number(band.lower_bound);
    return round2(Number(band.fixed_amount) + (excess * Number(band.rate)) / 100);
  }

  return 0;
}

// ── Generation ──────────────────────────────────────────────────────

/** Active staff, for the basic-pay line. */
async function activeStaff(client) {
  const { rows } = await client.query(
    `SELECT id AS staff_id, name AS staff_name, "position" AS staff_position, salary
     FROM staff WHERE status = 'Active'`
  );
  return rows;
}

/** Standing allowances in force on a given date, for every active staff member. */
async function standingAllowances(client, onDate) {
  const { rows } = await client.query(
    `SELECT sc.staff_id, sc.amount, sc.component_id,
            c.display AS component_display, c.is_taxable, c.is_pensionable, c.sort_order
     FROM staff_pay_component sc
     JOIN pay_component c ON c.id = sc.component_id AND c.is_active
     JOIN staff s ON s.id = sc.staff_id AND s.status = 'Active'
     WHERE sc.effective_from <= $1 AND (sc.effective_to IS NULL OR sc.effective_to >= $1)
     ORDER BY sc.staff_id, c.sort_order`,
    [onDate]
  );
  return rows;
}

/**
 * Builds (or rebuilds) every payslip for a draft period from standing
 * pay. Any manual edits made to a previous generation are discarded —
 * this is explicitly "regenerate", and the UI says so.
 */
async function generatePeriod(client, periodId, actorId) {
  const { rows } = await client.query(
    `SELECT * FROM payroll_period WHERE id = $1 FOR UPDATE`,
    [periodId]
  );
  const period = rows[0];
  if (!period) throw new PayrollError("Payroll period not found", "NOT_FOUND");
  if (period.status !== "DRAFT") {
    throw new PayrollError("Only a draft payroll can be generated", "NOT_DRAFT");
  }

  // Last day of the month: standing pay in force at month end is what
  // applies, matching how a real monthly run is decided.
  const onDate = new Date(Date.UTC(period.year, period.month, 0))
    .toISOString()
    .slice(0, 10);

  const [staffRows, allowanceRows] = await Promise.all([
    activeStaff(client),
    standingAllowances(client, onDate),
  ]);
  if (!staffRows.length) {
    throw new PayrollError("There is no active staff to run payroll for", "NO_STAFF");
  }

  await client.query(`DELETE FROM payroll_slip WHERE period_id = $1`, [periodId]);

  const rules = await activeStatutory(client, onDate);
  const allowancesByStaff = new Map();
  for (const a of allowanceRows) {
    if (!allowancesByStaff.has(a.staff_id)) allowancesByStaff.set(a.staff_id, []);
    allowancesByStaff.get(a.staff_id).push(a);
  }

  let staffCount = 0;

  for (const staff of staffRows) {
    const items = [
      {
        component_id: null,
        kind: "BASIC",
        description: "Basic salary",
        amount: Number(staff.salary) || 0,
        is_taxable: true,
        is_pensionable: true,
        sort_order: 0,
      },
      ...(allowancesByStaff.get(staff.staff_id) || []).map((a) => ({
        component_id: a.component_id,
        kind: "ALLOWANCE",
        description: a.component_display,
        amount: Number(a.amount),
        is_taxable: a.is_taxable,
        is_pensionable: a.is_pensionable,
        sort_order: a.sort_order,
      })),
    ].filter((item) => item.kind === "BASIC" || item.amount > 0);

    const gross = round2(items.reduce((sum, i) => sum + i.amount, 0));
    if (gross <= 0) continue; // No basic salary and no allowances: nothing to pay.

    const taxable = round2(
      items.filter((i) => i.is_taxable).reduce((sum, i) => sum + i.amount, 0)
    );
    const pensionable = round2(
      items.filter((i) => i.is_pensionable).reduce((sum, i) => sum + i.amount, 0)
    );

    const slipRes = await client.query(
      `INSERT INTO payroll_slip
         (period_id, staff_id, staff_name, staff_position, gross, taxable_gross, pensionable_gross)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [periodId, staff.staff_id, staff.staff_name, staff.staff_position, gross, taxable, pensionable]
    );
    const slipId = slipRes.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO payroll_slip_earning
           (slip_id, component_id, kind, description, amount, is_taxable, is_pensionable, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [slipId, item.component_id, item.kind, item.description, item.amount, item.is_taxable, item.is_pensionable, item.sort_order]
      );
    }

    let employeeStatutory = 0;
    for (const rule of rules) {
      const amount = computeStatutory(rule, { gross, taxable, pensionable });
      if (amount <= 0) continue;
      await client.query(
        `INSERT INTO payroll_slip_deduction
           (slip_id, kind, statutory_id, side, description, amount, sort_order)
         VALUES ($1,'STATUTORY',$2,$3,$4,$5,$6)`,
        [slipId, rule.id, rule.side, rule.display, amount, rule.sort_order]
      );
      if (rule.side === "EMPLOYEE") employeeStatutory += amount;
    }

    // Loan recovery is deliberately NOT applied here — set separately
    // via setLoanRecovery, same as ITSF-IMS's debt recovery: the system
    // proposes nothing, the person running payroll decides.
    const net = round2(gross - employeeStatutory);
    await client.query(
      `UPDATE payroll_slip SET employee_statutory = $2, net_pay = $3 WHERE id = $1`,
      [slipId, round2(employeeStatutory), net]
    );

    staffCount += 1;
  }

  await refreshTotals(client, periodId);
  return { staff_count: staffCount };
}

/**
 * Active staff who ended up with no payslip in this period, and why.
 *
 * Two quite different situations put someone on this list, and telling
 * them apart is the whole point: a person deliberately taken off this
 * run, versus a person who was never eligible because they have no pay
 * configured at all. Regenerating brings the first group back and still
 * skips the second, so the reason tells you whether regenerating would
 * undo what you just did.
 */
async function excludedStaff(client, periodId) {
  const { rows: periodRows } = await client.query(
    `SELECT * FROM payroll_period WHERE id = $1`,
    [periodId]
  );
  const period = periodRows[0];
  if (!period) throw new PayrollError("Payroll period not found", "NOT_FOUND");

  // Same month-end date generatePeriod uses, so "has pay configured"
  // here means exactly what it means there.
  const onDate = new Date(Date.UTC(period.year, period.month, 0))
    .toISOString()
    .slice(0, 10);

  const { rows } = await client.query(
    `SELECT s.id AS staff_id, s.name AS staff_name, s."position" AS staff_position,
            (COALESCE(s.salary, 0) > 0 OR EXISTS (
               SELECT 1 FROM staff_pay_component sc
                 JOIN pay_component c ON c.id = sc.component_id AND c.is_active
                WHERE sc.staff_id = s.id AND sc.amount > 0
                  AND sc.effective_from <= $2
                  AND (sc.effective_to IS NULL OR sc.effective_to >= $2)
             )) AS has_current_pay
       FROM staff s
      WHERE s.status = 'Active'
        AND NOT EXISTS (
          SELECT 1 FROM payroll_slip ps
           WHERE ps.period_id = $1 AND ps.staff_id = s.id
        )
      ORDER BY s.name`,
    [periodId, onDate]
  );

  return rows.map((r) => ({
    ...r,
    reason: r.has_current_pay
      ? "Removed from this payroll after it was generated"
      : "No salary or allowance set for this period",
  }));
}

/** Recomputes one slip's totals from its current earning/deduction lines. */
async function refreshSlip(client, slipId) {
  const { rows: earningRows } = await client.query(
    `SELECT
       COALESCE(SUM(amount), 0) AS gross,
       COALESCE(SUM(amount) FILTER (WHERE is_taxable), 0) AS taxable,
       COALESCE(SUM(amount) FILTER (WHERE is_pensionable), 0) AS pensionable
     FROM payroll_slip_earning WHERE slip_id = $1`,
    [slipId]
  );
  const e = earningRows[0];

  const { rows: deductionRows } = await client.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE kind = 'STATUTORY' AND side = 'EMPLOYEE'), 0) AS emp_statutory,
       COALESCE(SUM(amount) FILTER (WHERE kind = 'STATUTORY' AND side = 'EMPLOYER'), 0) AS empr_statutory,
       COALESCE(SUM(amount) FILTER (WHERE kind <> 'STATUTORY'), 0) AS other
     FROM payroll_slip_deduction WHERE slip_id = $1`,
    [slipId]
  );
  const d = deductionRows[0];

  const net = round2(Number(e.gross) - Number(d.emp_statutory) - Number(d.other));
  await client.query(
    `UPDATE payroll_slip
     SET gross = $2, taxable_gross = $3, pensionable_gross = $4,
         employee_statutory = $5, employer_statutory = $6,
         other_deductions = $7, net_pay = $8
     WHERE id = $1`,
    [slipId, e.gross, e.taxable, e.pensionable, d.emp_statutory, d.empr_statutory, d.other, net]
  );
}

/** Recomputes a period's totals from its current slips. */
async function refreshTotals(client, periodId) {
  await client.query(
    `UPDATE payroll_period p SET
       total_gross = t.gross, total_employee_statutory = t.emp,
       total_employer_statutory = t.empr, total_other_deductions = t.other,
       total_net = t.net, staff_count = t.n
     FROM (
       SELECT COALESCE(SUM(gross), 0) AS gross,
              COALESCE(SUM(employee_statutory), 0) AS emp,
              COALESCE(SUM(employer_statutory), 0) AS empr,
              COALESCE(SUM(other_deductions), 0) AS other,
              COALESCE(SUM(net_pay), 0) AS net,
              COUNT(*)::int AS n
       FROM payroll_slip WHERE period_id = $1
     ) t
     WHERE p.id = $1`,
    [periodId]
  );
}

// ── Loan recovery ───────────────────────────────────────────────────

/**
 * Staff loans still outstanding, with whatever this period has already
 * been set to recover against them. This is what the payroll screen
 * shows before anything is committed — the system proposes nothing
 * (unlike allowances/statutory, which auto-generate), the person
 * running payroll decides.
 */
async function outstandingLoansForPeriod(client, periodId) {
  const { rows } = await client.query(
    `SELECT l.id AS loan_id, l.staff_id, s.name AS staff_name,
            l.amount AS principal,
            l.amount - COALESCE(SUM(lr.amount), 0) AS outstanding,
            sl.id AS slip_id,
            COALESCE(pd.amount, 0) AS recovering_this_period
     FROM loan l
     JOIN staff s ON s.id = l.staff_id
     LEFT JOIN loan_repayment lr ON lr.loan_id = l.id
     LEFT JOIN payroll_slip sl ON sl.staff_id = l.staff_id AND sl.period_id = $1
     LEFT JOIN payroll_slip_deduction pd ON pd.slip_id = sl.id AND pd.loan_id = l.id
     WHERE l.staff_id IS NOT NULL
     GROUP BY l.id, s.name, sl.id, pd.amount
     HAVING l.amount - COALESCE(SUM(lr.amount), 0) > 0
     ORDER BY s.name`,
    [periodId]
  );
  return rows;
}

/**
 * Sets (or clears, at amount 0) the planned recovery for one loan
 * against one period. Nothing on the loan itself changes yet — only
 * paying the period actually recovers it (see payPeriod).
 */
async function setLoanRecovery(client, periodId, loanId, amount) {
  const { rows: periodRows } = await client.query(
    `SELECT * FROM payroll_period WHERE id = $1`,
    [periodId]
  );
  const period = periodRows[0];
  if (!period) throw new PayrollError("Payroll period not found", "NOT_FOUND");
  if (period.status !== "DRAFT") {
    throw new PayrollError("Recoveries can only be changed while the payroll is a draft", "NOT_DRAFT");
  }

  const { rows: loanRows } = await client.query(`SELECT * FROM loan WHERE id = $1`, [loanId]);
  const loan = loanRows[0];
  if (!loan || !loan.staff_id) throw new PayrollError("Staff loan not found", "NOT_FOUND");

  const { rows: slipRows } = await client.query(
    `SELECT id FROM payroll_slip WHERE period_id = $1 AND staff_id = $2`,
    [periodId, loan.staff_id]
  );
  const slip = slipRows[0];
  if (!slip) throw new PayrollError("That staff member is not on this payroll", "NOT_ON_PAYROLL");

  await client.query(
    `DELETE FROM payroll_slip_deduction WHERE slip_id = $1 AND loan_id = $2`,
    [slip.id, loanId]
  );

  const value = round2(amount);
  if (value > 0) {
    const balance = await getLoanBalance(client, loanId);
    if (value > round2(balance)) {
      throw new PayrollError(
        `Cannot recover more than the outstanding balance of ${balance}`,
        "OVER_BALANCE"
      );
    }
    await client.query(
      `INSERT INTO payroll_slip_deduction (slip_id, kind, loan_id, side, description, amount)
       VALUES ($1,'LOAN',$2,'EMPLOYEE',$3,$4)`,
      [slip.id, loanId, "Loan recovery", value]
    );
  }

  await refreshSlip(client, slip.id);
  await refreshTotals(client, periodId);
}

// ── Lifecycle ───────────────────────────────────────────────────────

async function createPeriod(client, { year, month, notes }, actorId) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m || m < 1 || m > 12) {
    throw new PayrollError("A valid year and month are required", "INVALID_PERIOD");
  }

  const title = `${MONTHS[m - 1]} ${y}`;
  const reference = `PAY/${y}/${String(m).padStart(2, "0")}`;

  try {
    const { rows } = await client.query(
      `INSERT INTO payroll_period (reference_no, year, month, title, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [reference, y, m, title, notes || null, actorId || null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === "23505") {
      throw new PayrollError(`A payroll for ${title} already exists`, "DUPLICATE_PERIOD");
    }
    throw err;
  }
}

async function deletePeriod(client, periodId) {
  const { rows } = await client.query(`SELECT * FROM payroll_period WHERE id = $1`, [periodId]);
  const period = rows[0];
  if (!period) return null;
  if (period.status !== "DRAFT") {
    throw new PayrollError("Only a draft payroll can be deleted", "NOT_DRAFT");
  }
  await client.query(`DELETE FROM payroll_period WHERE id = $1`, [periodId]);
  return period;
}

/**
 * Pays every slip in the period in one action — matching how the rest
 * of hbakery works (one admin action, no separate approval gate). This
 * is the point at which any planned loan recovery actually moves: the
 * money genuinely left, so a real loan_repayment is recorded via the
 * same validated path Loans already uses (overpayment protection
 * included, though it can never trigger here since setLoanRecovery
 * already checked the balance at the time it was set).
 */
async function payPeriod(client, periodId, { payment_method, payment_reference }, actorId) {
  const { rows: periodRows } = await client.query(
    `SELECT * FROM payroll_period WHERE id = $1 FOR UPDATE`,
    [periodId]
  );
  const period = periodRows[0];
  if (!period) throw new PayrollError("Payroll period not found", "NOT_FOUND");
  if (period.status !== "DRAFT") {
    throw new PayrollError("This payroll has already been paid or cancelled", "NOT_DRAFT");
  }
  if (!period.staff_count) {
    throw new PayrollError("Generate the payroll before paying it", "NOT_GENERATED");
  }

  const { rows: recoveries } = await client.query(
    `SELECT pd.loan_id, pd.amount, sl.staff_id
     FROM payroll_slip_deduction pd
     JOIN payroll_slip sl ON sl.id = pd.slip_id
     WHERE sl.period_id = $1 AND pd.kind = 'LOAN'`,
    [periodId]
  );

  const payDate = new Date().toISOString().slice(0, 10);
  for (const rec of recoveries) {
    await addLoanRepayment(client, rec.loan_id, {
      amount: rec.amount,
      repayment_date: payDate,
      method: "SALARY_DEDUCTION",
      reference: period.reference_no,
      received_by: actorId || null,
    });
  }

  // Returned so the caller (the route, which audits and hands the
  // response straight to the UI) reflects what was actually just
  // written — `period` above was fetched before this UPDATE, so its
  // paid_at/paid_by/payment_method are still the pre-payment nulls.
  const { rows: paidRows } = await client.query(
    `UPDATE payroll_period
     SET status = 'PAID', paid_by = $2, paid_at = NOW(),
         payment_method = $3, payment_reference = $4
     WHERE id = $1
     RETURNING *`,
    [periodId, actorId || null, payment_method || null, payment_reference || null]
  );

  return { ...paidRows[0], loans_recovered: recoveries.length };
}

async function cancelPeriod(client, periodId, actorId) {
  const { rows } = await client.query(`SELECT * FROM payroll_period WHERE id = $1`, [periodId]);
  const period = rows[0];
  if (!period) throw new PayrollError("Payroll period not found", "NOT_FOUND");
  if (period.status !== "DRAFT") {
    throw new PayrollError("Only a draft payroll can be cancelled", "NOT_DRAFT");
  }
  await client.query(
    `UPDATE payroll_period SET status = 'CANCELLED', cancelled_by = $2, cancelled_at = NOW() WHERE id = $1`,
    [periodId, actorId || null]
  );
  return period;
}

// ── Reading ─────────────────────────────────────────────────────────

async function listPeriods(client) {
  const { rows } = await client.query(
    `SELECT id, reference_no, year, month, title, status, notes,
            total_gross, total_employee_statutory, total_employer_statutory,
            total_other_deductions, total_net, staff_count,
            created_at, paid_at
     FROM payroll_period ORDER BY year DESC, month DESC`
  );
  return rows;
}

/** Full period with slips, each carrying its earnings and deductions. */
async function getPeriod(client, periodId) {
  const { rows } = await client.query(`SELECT * FROM payroll_period WHERE id = $1`, [periodId]);
  const period = rows[0];
  if (!period) throw new PayrollError("Payroll period not found", "NOT_FOUND");

  const { rows: slips } = await client.query(
    `SELECT * FROM payroll_slip WHERE period_id = $1 ORDER BY staff_name`,
    [periodId]
  );

  if (slips.length) {
    const ids = slips.map((s) => s.id);
    const [{ rows: earnings }, { rows: deductions }] = await Promise.all([
      client.query(
        `SELECT * FROM payroll_slip_earning WHERE slip_id = ANY($1::int[]) ORDER BY sort_order`,
        [ids]
      ),
      client.query(
        `SELECT pd.*, l.reason AS loan_reason
         FROM payroll_slip_deduction pd
         LEFT JOIN loan l ON l.id = pd.loan_id
         WHERE pd.slip_id = ANY($1::int[]) ORDER BY pd.sort_order`,
        [ids]
      ),
    ]);
    for (const slip of slips) {
      slip.earnings = earnings.filter((e) => e.slip_id === slip.id);
      slip.deductions = deductions.filter((d) => d.slip_id === slip.id);
    }
  }

  return { ...period, slips };
}

async function getSlip(client, slipId) {
  const { rows } = await client.query(
    `SELECT sl.*, p.title AS period_title, p.status AS period_status,
            p.reference_no AS period_reference, p.paid_at AS period_paid_at
     FROM payroll_slip sl JOIN payroll_period p ON p.id = sl.period_id
     WHERE sl.id = $1`,
    [slipId]
  );
  const slip = rows[0];
  if (!slip) throw new PayrollError("Payslip not found", "NOT_FOUND");

  const [{ rows: earnings }, { rows: deductions }] = await Promise.all([
    client.query(`SELECT * FROM payroll_slip_earning WHERE slip_id = $1 ORDER BY sort_order`, [slipId]),
    client.query(
      `SELECT pd.*, l.reason AS loan_reason
       FROM payroll_slip_deduction pd LEFT JOIN loan l ON l.id = pd.loan_id
       WHERE pd.slip_id = $1 ORDER BY pd.sort_order`,
      [slipId]
    ),
  ]);
  return { ...slip, earnings, deductions };
}

module.exports = {
  PayrollError,
  MONTHS,
  computeStatutory,
  generatePeriod,
  excludedStaff,
  refreshSlip,
  refreshTotals,
  outstandingLoansForPeriod,
  setLoanRecovery,
  createPeriod,
  deletePeriod,
  payPeriod,
  cancelPeriod,
  listPeriods,
  getPeriod,
  getSlip,
};
