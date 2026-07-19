// routes/loans.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask } = require("../middleware/auth");
const {
  createLoan,
  addLoanRepayment,
  deleteLoan,
  getLoans,
  getLoanDetail,
  searchBorrowers,
} = require("../modules/loan");
const { recordAudit } = require("../modules/auditLog");

/**
 * GET /loans - list loans with balance
 * ?outstanding=false to include fully repaid loans
 * ?type=staff|external, ?search=name, ?staff_id=123
 */
router.get("/", requireTask("can_see_loans"), async (req, res) => {
  try {
    const { outstanding, type, search, staff_id } = req.query;
    const rows = await getLoans(pool, {
      onlyOutstanding: outstanding !== "false",
      type,
      search,
      staff_id,
    });
    res.json({
      data: rows,
      totalOutstanding: rows.reduce((s, r) => s + Number(r.balance), 0),
    });
  } catch (err) {
    console.error("❌ Fetch loans failed:", err);
    res.status(500).json({ error: "Failed to fetch loans" });
  }
});

/**
 * GET /loans/borrowers - search the external borrower directory
 */
router.get("/borrowers", requireTask("can_see_loans"), async (req, res) => {
  try {
    const rows = await searchBorrowers(pool, req.query.search);
    res.json({ data: rows });
  } catch (err) {
    console.error("❌ Fetch borrowers failed:", err);
    res.status(500).json({ error: "Failed to fetch borrowers" });
  }
});

/**
 * GET /loans/:id - loan detail with repayment history
 */
router.get("/:id", requireTask("can_see_loans"), async (req, res) => {
  try {
    const detail = await getLoanDetail(pool, req.params.id);
    if (!detail) return res.status(404).json({ error: "Loan not found" });
    res.json(detail);
  } catch (err) {
    console.error("❌ Fetch loan failed:", err);
    res.status(500).json({ error: "Failed to fetch loan" });
  }
});

/**
 * POST /loans - record a new loan (to staff or an external borrower)
 */
router.post("/", requireTask("can_add_loan"), async (req, res) => {
  const {
    staff_id,
    borrower_id,
    borrower_name,
    borrower_phone,
    amount,
    loan_date,
    reason,
  } = req.body;

  const client = await pool.connect();
  let releaseError;
  try {
    await client.query("BEGIN");

    const loanId = await createLoan(client, {
      staff_id,
      borrower_id,
      borrower_name,
      borrower_phone,
      amount,
      loan_date,
      reason,
      created_by: req.user?.id || null,
    });

    await recordAudit(client, {
      user: req.user,
      action: "LOAN_CREATE",
      entity_type: "loan",
      entity_id: loanId,
      description: `Recorded loan of ${amount} to ${borrower_name || `staff #${staff_id}`}`,
      details: { staff_id, borrower_id, borrower_name, amount, reason },
    });

    await client.query("COMMIT");

    const detail = await getLoanDetail(pool, loanId);
    res.status(201).json({ message: "Loan recorded", ...detail });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("❌ Rollback failed, discarding connection:", rollbackErr);
      releaseError = rollbackErr;
    }
    if (err.code === "INVALID_LOAN" || err.code === "INVALID_LOAN_PARTY") {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    console.error("❌ Loan creation failed:", err);
    res.status(500).json({ error: "Failed to record loan" });
  } finally {
    client.release(releaseError);
  }
});

/**
 * POST /loans/:id/payments - record a repayment against a loan
 */
router.post(
  "/:id/payments",
  requireTask("can_add_loan_payment"),
  async (req, res) => {
    const { id } = req.params;
    const { amount, repayment_date, method, reference } = req.body;

    const client = await pool.connect();
    let releaseError;
    try {
      await client.query("BEGIN");

      const paymentId = await addLoanRepayment(client, id, {
        amount,
        repayment_date,
        method,
        reference,
        received_by: req.user?.id || null,
      });

      await recordAudit(client, {
        user: req.user,
        action: "LOAN_REPAYMENT",
        entity_type: "loan",
        entity_id: Number(id),
        description: `Recorded repayment of ${amount} against loan #${id}`,
        details: { amount, method, reference },
      });

      await client.query("COMMIT");
      res.status(201).json({ id: paymentId, message: "Repayment recorded" });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error("❌ Rollback failed, discarding connection:", rollbackErr);
        releaseError = rollbackErr;
      }
      if (
        err.code === "NOT_FOUND" ||
        err.code === "OVERPAYMENT" ||
        err.code === "INVALID_PAYMENT"
      ) {
        return res.status(400).json({
          error: err.code,
          message: err.message,
          details: err.meta,
        });
      }
      console.error("❌ Loan repayment failed:", err);
      res.status(500).json({ error: "Failed to record repayment" });
    } finally {
      client.release(releaseError);
    }
  }
);

/**
 * DELETE /loans/:id - delete a loan (refused if it already has repayments)
 */
router.delete("/:id", requireTask("can_delete_loan"), async (req, res) => {
  const client = await pool.connect();
  let releaseError;
  try {
    await client.query("BEGIN");

    const deleted = await deleteLoan(client, req.params.id);
    if (!deleted) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    await recordAudit(client, {
      user: req.user,
      action: "LOAN_DELETE",
      entity_type: "loan",
      entity_id: Number(req.params.id),
      description: `Deleted loan #${req.params.id}`,
    });

    await client.query("COMMIT");
    res.json({ id: req.params.id, message: "Loan deleted" });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("❌ Rollback failed, discarding connection:", rollbackErr);
      releaseError = rollbackErr;
    }
    if (err.code === "LOAN_HAS_PAYMENTS") {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    console.error("❌ Loan deletion failed:", err);
    res.status(500).json({ error: "Failed to delete loan" });
  } finally {
    client.release(releaseError);
  }
});

module.exports = router;
