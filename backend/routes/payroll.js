// routes/payroll.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask } = require("../middleware/auth");
const payroll = require("../modules/payroll");
const { recordAudit } = require("../modules/auditLog");

function handleError(res, err, fallback) {
  if (err instanceof payroll.PayrollError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "DUPLICATE_PERIOD" || err.code === "NOT_DRAFT" || err.code === "NOT_ON_PAYROLL"
        ? 409
        : 400;
    return res.status(status).json({ error: err.message });
  }
  console.error(`❌ ${fallback}:`, err);
  return res.status(500).json({ error: fallback });
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ── Pay structure (groups, components, statutory) ──────────────────

router.get("/pay-groups", requireTask("can_see_payroll"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT g.*, (SELECT COUNT(*) FROM pay_component c WHERE c.pay_group_id = g.id) AS component_count
       FROM pay_group g ORDER BY g.sort_order, g.display`
    );
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "Failed to fetch pay groups");
  }
});

router.post("/pay-groups", requireTask("can_manage_pay_structure"), async (req, res) => {
  const { code, display, description, sort_order } = req.body || {};
  if (!code?.trim() || !display?.trim()) {
    return res.status(400).json({ error: "Code and display name are required" });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO pay_group (code, display, description, sort_order)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [code.trim(), display.trim(), description || null, sort_order || 100]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: `A pay group with code "${code}" already exists` });
    }
    handleError(res, err, "Failed to create pay group");
  }
});

router.get("/pay-components", requireTask("can_see_payroll"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, g.display AS group_display
       FROM pay_component c JOIN pay_group g ON g.id = c.pay_group_id
       ORDER BY g.sort_order, c.sort_order, c.display`
    );
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "Failed to fetch pay components");
  }
});

router.post("/pay-components", requireTask("can_manage_pay_structure"), async (req, res) => {
  const { code, display, description, pay_group_id, default_amount, is_taxable, is_pensionable, sort_order } =
    req.body || {};
  if (!code?.trim() || !display?.trim() || !pay_group_id) {
    return res.status(400).json({ error: "Code, display name and pay group are required" });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO pay_component
         (code, display, description, pay_group_id, default_amount, is_taxable, is_pensionable, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        code.trim(),
        display.trim(),
        description || null,
        pay_group_id,
        default_amount || 0,
        is_taxable !== false,
        is_pensionable !== false,
        sort_order || 100,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: `A pay component with code "${code}" already exists` });
    }
    handleError(res, err, "Failed to create pay component");
  }
});

router.put("/pay-components/:id", requireTask("can_manage_pay_structure"), async (req, res) => {
  const { display, description, default_amount, is_taxable, is_pensionable, sort_order, is_active } =
    req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE pay_component
       SET display = COALESCE($2, display), description = COALESCE($3, description),
           default_amount = COALESCE($4, default_amount),
           is_taxable = COALESCE($5, is_taxable), is_pensionable = COALESCE($6, is_pensionable),
           sort_order = COALESCE($7, sort_order), is_active = COALESCE($8, is_active)
       WHERE id = $1 RETURNING *`,
      [req.params.id, display, description, default_amount, is_taxable, is_pensionable, sort_order, is_active]
    );
    if (!rows[0]) return res.status(404).json({ error: "Pay component not found" });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err, "Failed to update pay component");
  }
});

router.get("/statutory-deductions", requireTask("can_see_payroll"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM statutory_deduction ORDER BY sort_order`
    );
    const { rows: brackets } = await pool.query(
      `SELECT * FROM statutory_bracket ORDER BY statutory_id, sort_order`
    );
    res.json({
      data: rows.map((r) => ({ ...r, brackets: brackets.filter((b) => b.statutory_id === r.id) })),
    });
  } catch (err) {
    handleError(res, err, "Failed to fetch statutory deductions");
  }
});

router.put("/statutory-deductions/:id", requireTask("can_manage_pay_structure"), async (req, res) => {
  const { rate, is_active } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE statutory_deduction
       SET rate = COALESCE($2, rate), is_active = COALESCE($3, is_active)
       WHERE id = $1 RETURNING *`,
      [req.params.id, rate, is_active]
    );
    if (!rows[0]) return res.status(404).json({ error: "Statutory deduction not found" });

    await recordAudit(pool, {
      user: req.user,
      action: "UPDATE",
      entity_type: "statutory_deduction",
      entity_id: Number(req.params.id),
      description: `Updated statutory deduction "${rows[0].display}" (rate=${rows[0].rate}, active=${rows[0].is_active})`,
    });

    res.json(rows[0]);
  } catch (err) {
    handleError(res, err, "Failed to update statutory deduction");
  }
});

// ── Staff standing allowances ───────────────────────────────────────

router.get("/staff/:staffId/pay-components", requireTask("can_see_payroll"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sc.*, c.display AS component_display, c.pay_group_id
       FROM staff_pay_component sc JOIN pay_component c ON c.id = sc.component_id
       WHERE sc.staff_id = $1 AND sc.effective_to IS NULL
       ORDER BY c.sort_order`,
      [req.params.staffId]
    );
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "Failed to fetch staff pay components");
  }
});

/** Sets (or clears, at amount 0) a staff member's standing allowance. */
router.put(
  "/staff/:staffId/pay-components/:componentId",
  requireTask("can_manage_pay_structure"),
  async (req, res) => {
    const { amount, note } = req.body || {};
    try {
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE staff_pay_component
           SET effective_to = CURRENT_DATE
           WHERE staff_id = $1 AND component_id = $2 AND effective_to IS NULL`,
          [req.params.staffId, req.params.componentId]
        );
        if (Number(amount) > 0) {
          await client.query(
            `INSERT INTO staff_pay_component (staff_id, component_id, amount, note, created_by)
             VALUES ($1,$2,$3,$4,$5)`,
            [req.params.staffId, req.params.componentId, amount, note || null, req.user?.id || null]
          );
        }
      });
      res.json({ success: true });
    } catch (err) {
      handleError(res, err, "Failed to set staff pay component");
    }
  }
);

// ── Payroll periods ──────────────────────────────────────────────────

router.get("/periods", requireTask("can_see_payroll"), async (req, res) => {
  try {
    res.json({ data: await payroll.listPeriods(pool) });
  } catch (err) {
    handleError(res, err, "Failed to fetch payroll periods");
  }
});

router.post("/periods", requireTask("can_manage_payroll"), async (req, res) => {
  try {
    const period = await payroll.createPeriod(pool, req.body || {}, req.user?.id);

    await recordAudit(pool, {
      user: req.user,
      action: "CREATE",
      entity_type: "payroll_period",
      entity_id: period.id,
      description: `Created payroll period ${period.title}`,
    });

    res.status(201).json(period);
  } catch (err) {
    handleError(res, err, "Failed to create payroll period");
  }
});

router.get("/periods/:id", requireTask("can_see_payroll"), async (req, res) => {
  try {
    res.json(await payroll.getPeriod(pool, req.params.id));
  } catch (err) {
    handleError(res, err, "Failed to fetch payroll period");
  }
});

router.post("/periods/:id/generate", requireTask("can_manage_payroll"), async (req, res) => {
  try {
    const result = await withTransaction((client) =>
      payroll.generatePeriod(client, req.params.id, req.user?.id)
    );

    await recordAudit(pool, {
      user: req.user,
      action: "PAYROLL_GENERATED",
      entity_type: "payroll_period",
      entity_id: Number(req.params.id),
      description: `Generated payroll for ${result.staff_count} staff`,
    });

    res.json(result);
  } catch (err) {
    handleError(res, err, "Failed to generate payroll");
  }
});

/** Active staff who ended up with no payslip in this period, and why. */
router.get("/periods/:id/excluded-staff", requireTask("can_see_payroll"), async (req, res) => {
  try {
    res.json({ data: await payroll.excludedStaff(pool, req.params.id) });
  } catch (err) {
    handleError(res, err, "Failed to fetch excluded staff");
  }
});

router.delete("/periods/:id", requireTask("can_manage_payroll"), async (req, res) => {
  try {
    const period = await withTransaction((client) => payroll.deletePeriod(client, req.params.id));
    if (!period) return res.status(404).json({ error: "Payroll period not found" });

    await recordAudit(pool, {
      user: req.user,
      action: "DELETE",
      entity_type: "payroll_period",
      entity_id: Number(req.params.id),
      description: `Deleted draft payroll ${period.title}`,
    });

    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to delete payroll period");
  }
});

router.post("/periods/:id/pay", requireTask("can_manage_payroll"), async (req, res) => {
  try {
    const result = await withTransaction((client) =>
      payroll.payPeriod(client, req.params.id, req.body || {}, req.user?.id)
    );

    await recordAudit(pool, {
      user: req.user,
      action: "PAYROLL_PAID",
      entity_type: "payroll_period",
      entity_id: Number(req.params.id),
      description: `Paid payroll ${result.title} — TZS ${Number(result.total_net).toLocaleString()} (${result.loans_recovered} loan recoveries)`,
    });

    res.json(result);
  } catch (err) {
    handleError(res, err, "Failed to pay payroll");
  }
});

router.post("/periods/:id/cancel", requireTask("can_manage_payroll"), async (req, res) => {
  try {
    const period = await withTransaction((client) => payroll.cancelPeriod(client, req.params.id));

    await recordAudit(pool, {
      user: req.user,
      action: "PAYROLL_CANCELLED",
      entity_type: "payroll_period",
      entity_id: Number(req.params.id),
      description: `Cancelled draft payroll ${period.title}`,
    });

    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to cancel payroll period");
  }
});

// ── Loan recovery ────────────────────────────────────────────────────

router.get("/periods/:id/loans", requireTask("can_see_payroll"), async (req, res) => {
  try {
    res.json({ data: await payroll.outstandingLoansForPeriod(pool, req.params.id) });
  } catch (err) {
    handleError(res, err, "Failed to fetch outstanding loans");
  }
});

router.put("/periods/:id/loans/:loanId", requireTask("can_manage_payroll"), async (req, res) => {
  try {
    await withTransaction((client) =>
      payroll.setLoanRecovery(client, req.params.id, req.params.loanId, Number(req.body?.amount || 0))
    );
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to set loan recovery");
  }
});

// ── Slip adjustments (draft only) ────────────────────────────────────

async function assertDraft(client, periodId) {
  const { rows } = await client.query(`SELECT status FROM payroll_period WHERE id = $1`, [periodId]);
  if (!rows[0]) throw new payroll.PayrollError("Payroll period not found", "NOT_FOUND");
  if (rows[0].status !== "DRAFT") {
    throw new payroll.PayrollError("This payroll is no longer a draft and cannot be changed", "NOT_DRAFT");
  }
}

router.get("/slips/:slipId", requireTask("can_see_payroll"), async (req, res) => {
  try {
    res.json(await payroll.getSlip(pool, req.params.slipId));
  } catch (err) {
    handleError(res, err, "Failed to fetch payslip");
  }
});

router.post("/slips/:slipId/earnings", requireTask("can_manage_payroll"), async (req, res) => {
  const { description, amount } = req.body || {};
  if (!description?.trim()) return res.status(400).json({ error: "A description is required" });
  if (!(Number(amount) > 0)) return res.status(400).json({ error: "Amount must be greater than zero" });

  try {
    await withTransaction(async (client) => {
      const { rows: slip } = await client.query(`SELECT period_id FROM payroll_slip WHERE id = $1`, [
        req.params.slipId,
      ]);
      if (!slip[0]) throw new payroll.PayrollError("Payslip not found", "NOT_FOUND");
      await assertDraft(client, slip[0].period_id);

      await client.query(
        `INSERT INTO payroll_slip_earning (slip_id, kind, description, amount)
         VALUES ($1,'ADHOC',$2,$3)`,
        [req.params.slipId, description.trim(), amount]
      );
      await payroll.refreshSlip(client, req.params.slipId);
      await payroll.refreshTotals(client, slip[0].period_id);
    });
    res.status(201).json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to add earning");
  }
});

router.post("/slips/:slipId/deductions", requireTask("can_manage_payroll"), async (req, res) => {
  const { description, amount, note } = req.body || {};
  if (!description?.trim()) return res.status(400).json({ error: "A description is required" });
  if (!(Number(amount) > 0)) return res.status(400).json({ error: "Amount must be greater than zero" });

  try {
    await withTransaction(async (client) => {
      const { rows: slip } = await client.query(`SELECT period_id FROM payroll_slip WHERE id = $1`, [
        req.params.slipId,
      ]);
      if (!slip[0]) throw new payroll.PayrollError("Payslip not found", "NOT_FOUND");
      await assertDraft(client, slip[0].period_id);

      await client.query(
        `INSERT INTO payroll_slip_deduction (slip_id, kind, side, description, amount, note)
         VALUES ($1,'ADHOC','EMPLOYEE',$2,$3,$4)`,
        [req.params.slipId, description.trim(), amount, note || null]
      );
      await payroll.refreshSlip(client, req.params.slipId);
      await payroll.refreshTotals(client, slip[0].period_id);
    });
    res.status(201).json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to add deduction");
  }
});

/**
 * Takes one staff member off a draft payroll entirely.
 *
 * Their loan recoveries go with the slip (the deduction rows cascade),
 * so an amount set aside for recovery is released rather than silently
 * still counted. Regenerating brings them back if they still have pay
 * configured — which is what the confirmation warns about.
 */
router.delete("/slips/:slipId", requireTask("can_manage_payroll"), async (req, res) => {
  try {
    const staffName = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, period_id, staff_name FROM payroll_slip WHERE id = $1`,
        [req.params.slipId]
      );
      const slip = rows[0];
      if (!slip) throw new payroll.PayrollError("Payslip not found", "NOT_FOUND");
      await assertDraft(client, slip.period_id);

      await client.query(`DELETE FROM payroll_slip WHERE id = $1`, [slip.id]);
      await payroll.refreshTotals(client, slip.period_id);

      await recordAudit(client, {
        user: req.user,
        action: "PAYROLL_SLIP_REMOVED",
        entity_type: "payroll_period",
        entity_id: slip.period_id,
        description: `Removed ${slip.staff_name} from this payroll`,
      });
      return slip.staff_name;
    });
    res.json({ success: true, staff_name: staffName });
  } catch (err) {
    handleError(res, err, "Failed to remove that staff member from this payroll");
  }
});

router.delete("/earnings/:id", requireTask("can_manage_payroll"), async (req, res) => {
  try {
    await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT e.*, s.period_id FROM payroll_slip_earning e
         JOIN payroll_slip s ON s.id = e.slip_id WHERE e.id = $1`,
        [req.params.id]
      );
      const earning = rows[0];
      if (!earning) throw new payroll.PayrollError("Earning not found", "NOT_FOUND");
      await assertDraft(client, earning.period_id);
      if (earning.kind === "BASIC") {
        throw new payroll.PayrollError(
          "Basic salary comes from the staff record and can't be removed here — edit the staff member's salary instead",
          "BASIC_LOCKED"
        );
      }
      await client.query(`DELETE FROM payroll_slip_earning WHERE id = $1`, [req.params.id]);
      await payroll.refreshSlip(client, earning.slip_id);
      await payroll.refreshTotals(client, earning.period_id);
    });
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to remove earning");
  }
});

router.delete("/deductions/:id", requireTask("can_manage_payroll"), async (req, res) => {
  try {
    await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT d.*, s.period_id FROM payroll_slip_deduction d
         JOIN payroll_slip s ON s.id = d.slip_id WHERE d.id = $1`,
        [req.params.id]
      );
      const deduction = rows[0];
      if (!deduction) throw new payroll.PayrollError("Deduction not found", "NOT_FOUND");
      await assertDraft(client, deduction.period_id);
      if (deduction.kind === "STATUTORY") {
        throw new payroll.PayrollError(
          "Statutory deductions are calculated, not removed here — change the rate in the pay structure screen instead",
          "STATUTORY_LOCKED"
        );
      }
      await client.query(`DELETE FROM payroll_slip_deduction WHERE id = $1`, [req.params.id]);
      await payroll.refreshSlip(client, deduction.slip_id);
      await payroll.refreshTotals(client, deduction.period_id);
    });
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to remove deduction");
  }
});

module.exports = router;
