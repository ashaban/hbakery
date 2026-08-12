// routes/payables.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask } = require("../middleware/auth");
const {
  createPayable,
  addPayablePayment,
  deletePayable,
  getPayables,
  getPayableDetail,
  searchCreditors,
} = require("../modules/payable");
const { recordAudit } = require("../modules/auditLog");

/**
 * GET /payables - list payables with balance
 * ?outstanding=false to include fully paid payables
 * ?type=staff|external, ?search=name, ?staff_id=123
 */
router.get("/", requireTask("can_see_payables"), async (req, res) => {
  try {
    const { outstanding, type, search, staff_id } = req.query;
    const rows = await getPayables(pool, {
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
    console.error("❌ Fetch payables failed:", err);
    res.status(500).json({ error: "Failed to fetch payables" });
  }
});

/**
 * GET /payables/creditors - search the external creditor directory
 */
router.get("/creditors", requireTask("can_see_payables"), async (req, res) => {
  try {
    const rows = await searchCreditors(pool, req.query.search);
    res.json({ data: rows });
  } catch (err) {
    console.error("❌ Fetch creditors failed:", err);
    res.status(500).json({ error: "Failed to fetch creditors" });
  }
});

/**
 * GET /payables/:id - payable detail with payment history
 */
router.get("/:id", requireTask("can_see_payables"), async (req, res) => {
  try {
    const detail = await getPayableDetail(pool, req.params.id);
    if (!detail) return res.status(404).json({ error: "Payable not found" });
    res.json(detail);
  } catch (err) {
    console.error("❌ Fetch payable failed:", err);
    res.status(500).json({ error: "Failed to fetch payable" });
  }
});

/**
 * POST /payables - record a new payable (owed to staff or an external creditor)
 */
router.post("/", requireTask("can_add_payable"), async (req, res) => {
  const {
    staff_id,
    creditor_id,
    creditor_name,
    creditor_phone,
    amount,
    payable_date,
    reason,
  } = req.body;

  const client = await pool.connect();
  let releaseError;
  try {
    await client.query("BEGIN");

    const payableId = await createPayable(client, {
      staff_id,
      creditor_id,
      creditor_name,
      creditor_phone,
      amount,
      payable_date,
      reason,
      created_by: req.user?.id || null,
    });

    await recordAudit(client, {
      user: req.user,
      action: "PAYABLE_CREATE",
      entity_type: "payable",
      entity_id: payableId,
      description: `Recorded payable of ${amount} owed to ${creditor_name || `staff #${staff_id}`}`,
      details: { staff_id, creditor_id, creditor_name, amount, reason },
    });

    await client.query("COMMIT");

    const detail = await getPayableDetail(pool, payableId);
    res.status(201).json({ message: "Payable recorded", ...detail });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("❌ Rollback failed, discarding connection:", rollbackErr);
      releaseError = rollbackErr;
    }
    if (err.code === "INVALID_PAYABLE" || err.code === "INVALID_PAYABLE_PARTY") {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    console.error("❌ Payable creation failed:", err);
    res.status(500).json({ error: "Failed to record payable" });
  } finally {
    client.release(releaseError);
  }
});

/**
 * POST /payables/:id/payments - record a payment against a payable
 */
router.post(
  "/:id/payments",
  requireTask("can_add_payable_payment"),
  async (req, res) => {
    const { id } = req.params;
    const { amount, payment_date, method, reference } = req.body;

    const client = await pool.connect();
    let releaseError;
    try {
      await client.query("BEGIN");

      const paymentId = await addPayablePayment(client, id, {
        amount,
        payment_date,
        method,
        reference,
        paid_by: req.user?.id || null,
      });

      await recordAudit(client, {
        user: req.user,
        action: "PAYABLE_PAYMENT",
        entity_type: "payable",
        entity_id: Number(id),
        description: `Recorded payment of ${amount} against payable #${id}`,
        details: { amount, method, reference },
      });

      await client.query("COMMIT");
      res.status(201).json({ id: paymentId, message: "Payment recorded" });
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
      console.error("❌ Payable payment failed:", err);
      res.status(500).json({ error: "Failed to record payment" });
    } finally {
      client.release(releaseError);
    }
  }
);

/**
 * DELETE /payables/:id - delete a payable (refused if it already has payments)
 */
router.delete("/:id", requireTask("can_delete_payable"), async (req, res) => {
  const client = await pool.connect();
  let releaseError;
  try {
    await client.query("BEGIN");

    const deleted = await deletePayable(client, req.params.id);
    if (!deleted) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Payable not found" });
    }

    await recordAudit(client, {
      user: req.user,
      action: "PAYABLE_DELETE",
      entity_type: "payable",
      entity_id: Number(req.params.id),
      description: `Deleted payable #${req.params.id}`,
    });

    await client.query("COMMIT");
    res.json({ id: req.params.id, message: "Payable deleted" });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("❌ Rollback failed, discarding connection:", rollbackErr);
      releaseError = rollbackErr;
    }
    if (err.code === "PAYABLE_HAS_PAYMENTS") {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    console.error("❌ Payable deletion failed:", err);
    res.status(500).json({ error: "Failed to delete payable" });
  } finally {
    client.release(releaseError);
  }
});

module.exports = router;
