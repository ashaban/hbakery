const moment = require("moment");
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { decodeToken, requireTask } = require("../middleware/auth");

const {
  getAvailableQty,
  allocateFifoOut,
  revertProductionOuts,
} = require("../modules/ledger");

const {
  recordProductLedger,
  deleteProductLedgerByProduction,
} = require("../modules/productledger");
const { recordAudit } = require("../modules/auditLog");
const {
  labourForProductions,
  shiftAt,
} = require("../modules/productionLabour");
const { saveBakeForProduction } = require("../modules/bakingCost");
const {
  cancelProduction,
  assertProductionRemovable,
} = require("../modules/productionCancel");

router.get("/discrepancyReasons", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, description FROM discrepancy_reason ORDER BY name"
    );
    res.json({ data: rows });
  } catch (err) {
    console.error("Failed to fetch discrepancy reasons:", err);
    res.status(500).json({ error: "Failed to fetch discrepancy reasons" });
  }
});

router.post("/", requireTask("can_schedule_production"), async (req, res) => {
  const user = await decodeToken(req);
  const client = await pool.connect();
  try {
    const { notes, ingredients, staffs, products, planned_at, produced_at, shift_id } =
      req.body;

    // backward compatibility — if single product fields exist
    if (!Array.isArray(products)) {
      req.body.products = [req.body];
    }
    const productList = req.body.products;

    if (!Array.isArray(productList) || productList.length === 0) {
      return res.status(400).json({ error: "No products provided" });
    }

    await client.query("BEGIN");

    // 1️⃣ Create a production batch
    const batchCode = `BATCH-${moment().format("YYYYMMDD-HHmmss")}`;
    const batchRes = await client.query(
      `INSERT INTO production_batch (batch_code, created_by)
       VALUES ($1, $2) RETURNING id`,
      [batchCode, user?.id]
    );
    const batchId = batchRes.rows[0].id;

    // 2️⃣ Process each product as an independent production
    for (const prod of productList) {
      const {
        product_id,
        mode,
        qty_product,
        base_ingredient_id,
        base_ingredient_qty,
        notes,
        ingredients,
        discrepancies,
        group_choices,
        actual_qty,
        good_qty,
        damaged_qty,
        reject_qty,
        oven_id,
      } = prod;

      if (
        !product_id ||
        !qty_product ||
        !Array.isArray(ingredients) ||
        ingredients.length === 0
      ) {
        throw new Error(`Invalid data for product ${product_id}`);
      }

      // 🧮 Stock check before allocation
      for (const ing of ingredients) {
        const available = await getAvailableQty(client, ing.item_id);
        if (Number(ing.qty_required) > available) {
          throw new Error(
            `INSUFFICIENT_STOCK:item=${ing.item_id}:available=${available}:required=${ing.qty_required}`
          );
        }
      }

      // Which crew was on when this was made. Resolved from the production's
      // own time so the link is a fact about the schedule, not something the
      // person entering it has to remember — but shift_id in the request wins,
      // because the form lets it be overridden.
      const resolvedShift =
        shift_id !== undefined && shift_id !== null
          ? { id: shift_id }
          : await shiftAt(client, produced_at || planned_at);

      // 3️⃣ Create header
      const hdr = await client.query(
        `INSERT INTO product_production
          (batch_id, product_id, mode, qty_product,
           base_ingredient_id, base_ingredient_qty,
           notes, planned_at, produced_at,
           actual_qty, good_qty, damaged_qty, reject_qty,
           produced_by, shift_id, shift_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [
          batchId,
          product_id,
          mode,
          qty_product,
          base_ingredient_id || null,
          base_ingredient_qty || null,
          notes || null,
          planned_at || null,
          produced_at || null,
          actual_qty || null,
          good_qty || null,
          damaged_qty || null,
          reject_qty || null,
          user?.id,
          resolvedShift?.id || null,
          resolvedShift?.shift_date || null,
        ]
      );
      const productionId = hdr.rows[0].id;

      // What the oven burned. Snapshotted here so a later fuel price change
      // cannot rewrite what this bake cost. Uses actual output when it is
      // already known, otherwise the planned quantity.
      await saveBakeForProduction(client, productionId, {
        product_id,
        oven_id: oven_id || null,
        quantity: actual_qty || qty_product,
      });

      // 4️⃣ Record ingredient groups and combinations
      if (Array.isArray(group_choices) && group_choices.length > 0) {
        for (const gc of group_choices) {
          await client.query(
            `INSERT INTO product_production_group_choice (production_id, group_id, combination_id)
             VALUES ($1, $2, $3)`,
            [productionId, gc.group_id, gc.combination_id]
          );
        }
      }

      // 5️⃣ Record ingredient items
      for (const ing of ingredients) {
        await client.query(
          `INSERT INTO product_production_item (production_id, item_id, qty_required, group_id, combination_id)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            productionId,
            ing.item_id,
            ing.qty_required,
            ing.group_id || null,
            ing.combination_id || null,
          ]
        );
      }

      // 6️⃣ Who worked on this.
      //
      // Normally copied from the shift that was running, so nobody re-keys the
      // crew for every product in a batch. An explicit `staffs` list still
      // wins: the form lets a production's crew be corrected without editing
      // the shift itself, which would rewrite every other production on it.
      //
      // Each row snapshots the rate in force now — a later pay rise must not
      // silently change what today's bread cost to make.
      if (Array.isArray(staffs) && staffs.length > 0) {
        for (const s of staffs) {
          if (!s.staff_id) continue;
          await client.query(
            `INSERT INTO product_production_staff (production_id, staff_id, role, notes, daily_rate)
             SELECT $1,$2,$3,$4, daily_salary FROM staff WHERE id = $2`,
            [productionId, s.staff_id, s.role || null, s.notes || null]
          );
        }
      } else if (resolvedShift?.id) {
        await client.query(
          `INSERT INTO product_production_staff (production_id, staff_id, role, daily_rate)
           SELECT $1, m.staff_id,
                  CASE WHEN m.staff_id = ws.leader_staff_id THEN 'Team Leader' ELSE 'Assistant' END,
                  m.daily_rate
           FROM work_shift_member m
           JOIN work_shift ws ON ws.id = m.shift_id
           WHERE m.shift_id = $2`,
          [productionId, resolvedShift.id]
        );
      }

      // 7️⃣ Discrepancy reasons (if any)
      if (Array.isArray(discrepancies) && discrepancies.length > 0) {
        for (const descrepancy of discrepancies) {
          if (!descrepancy.id) {
            continue;
          }
          await client.query(
            `INSERT INTO product_production_discrepancy (production_id, reason_id, notes)
             VALUES ($1,$2,$3)`,
            [productionId, descrepancy.id, descrepancy.notes || null]
          );
        }
      }

      // 8️⃣ FIFO OUT allocations for ingredients
      for (const ing of ingredients) {
        await allocateFifoOut(
          client,
          productionId,
          ing.item_id,
          ing.qty_required,
          planned_at
        );
      }

      // 9️⃣ Ledger IN entries for produced goods
      if (actual_qty && produced_at) {
        await recordProductLedger(
          client,
          productionId,
          product_id,
          { good_qty, damaged_qty, reject_qty },
          produced_at,
          // Same value, kept whole: movement_date truncates it to a day,
          // movement_at preserves the time the batch came off the line.
          produced_at
        );
      }
    }

    await recordAudit(client, {
      user,
      action: "PRODUCTION_CREATE",
      entity_type: "production_batch",
      entity_id: batchId,
      description: `Scheduled production batch ${batchCode} (${productList.length} product(s))`,
      details: { batch_code: batchCode, products: productList.map((p) => p.product_id) },
    });

    await client.query("COMMIT");
    res.json({
      batch_id: batchId,
      batch_code: batchCode,
      message: "Batch production created successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Batch production failed:", err);
    if (String(err.message).startsWith("INSUFFICIENT_STOCK")) {
      return res
        .status(400)
        .json({ error: "INSUFFICIENT_STOCK", message: err.message });
    }
    res.status(500).json({ error: "Failed to create production batch" });
  } finally {
    client.release();
  }
});

router.put(
  "/:batchId",
  requireTask("can_edit_production"),
  async (req, res) => {
    const user = await decodeToken(req);
    const client = await pool.connect();
    try {
      const { batchId } = req.params;
      const {
        notes,
        ingredients,
        staffs,
        products,
        planned_at,
        produced_at,
        shift_id,
        removed_production_ids,
      } = req.body;

      // Which crew was on when this batch ran. An explicit shift_id from the
      // form wins; otherwise it is resolved from the batch's own time, the
      // same rule the create path uses. Resolved once here rather than per
      // product — every product in a batch shares one time, so they share
      // one shift.
      let resolvedShiftId = null;
      let resolvedShiftDate = null;

      if (!batchId) {
        return res.status(400).json({ error: "Missing production ID" });
      }
      // backward compatibility — if single product fields exist
      let productList = products;
      if (!Array.isArray(productList)) {
        productList = [req.body];
      }

      if (!Array.isArray(productList) || productList.length === 0) {
        return res.status(400).json({ error: "No products provided" });
      }

      await client.query("BEGIN");

      // Resolved inside the transaction so it sees the same state the
      // rest of the edit does.
      const resolvedOccurrence = await shiftAt(client, produced_at || planned_at);
      resolvedShiftId =
        shift_id !== undefined && shift_id !== null
          ? Number(shift_id)
          : resolvedOccurrence?.id ?? null;
      resolvedShiftDate = resolvedOccurrence?.shift_date ?? null;

      // 1️⃣ Products the user removed from the plan during this edit.
      //
      // Only ids listed explicitly here are removed — a product merely being
      // absent from `products` is NOT treated as a removal, so a partial
      // payload can never silently cancel productions.
      //
      // These are cancelled (not deleted) through the same guarded path as
      // the Cancel button: ingredients go back to stock, the record stays
      // for history, and an already-produced item is refused. Done before
      // the updates below so the freed ingredients are available to the
      // remaining products in this same save.
      if (Array.isArray(removed_production_ids) && removed_production_ids.length) {
        for (const removedId of removed_production_ids) {
          const owns = await client.query(
            `SELECT 1 FROM product_production WHERE id = $1 AND batch_id = $2`,
            [removedId, batchId]
          );
          if (owns.rowCount === 0) {
            const err = new Error(
              `Production ${removedId} is not part of batch ${batchId}.`
            );
            err.code = "PRODUCTION_NOT_IN_BATCH";
            throw err;
          }
          await cancelProduction(client, Number(removedId), {
            userId: user?.id,
            reason: "Removed from the plan while editing the batch",
          });
        }
      }

      // 2️⃣ Handle each product update (single product per PUT)
      for (const prod of productList) {
        const {
          production_id,
          product_id,
          mode,
          qty_product,
          base_ingredient_id,
          base_ingredient_qty,
          notes,
          ingredients,
          discrepancies,
          group_choices,
          actual_qty,
          good_qty,
          damaged_qty,
          reject_qty,
        } = prod;

        if (
          !product_id ||
          !qty_product ||
          !Array.isArray(ingredients) ||
          ingredients.length === 0
        ) {
          throw new Error(`Invalid data for product ${product_id}`);
        }

        let productionId = production_id;

        if (!productionId) {
          // ➕ A product added to the batch during this edit has no
          // production_id yet — create its row instead of updating one
          // that doesn't exist. This previously fell through to the
          // UPDATE/DELETE-by-production_id calls below with a null id,
          // which violated product_production_item's NOT NULL constraint.
          //
          // Stock validation happens after this branch (once we know
          // whether there's a prior reservation to revert first) — see
          // below.
          // produced_at is intentionally NOT set here (always NULL for a
          // product newly added to the plan) — it must only ever be set
          // through the dedicated "record actual" endpoint, never inherited
          // from the batch-level value the edit form happens to be showing
          // for a *different*, already-produced product in this batch.
          const hdr = await client.query(
            `INSERT INTO product_production
              (batch_id, product_id, mode, qty_product,
               base_ingredient_id, base_ingredient_qty,
               notes, planned_at, produced_at,
               actual_qty, good_qty, damaged_qty, reject_qty,
               produced_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11,$12,$13)
             RETURNING id`,
            [
              batchId,
              product_id,
              mode,
              qty_product,
              base_ingredient_id || null,
              base_ingredient_qty || null,
              notes || null,
              planned_at || null,
              actual_qty || null,
              good_qty || null,
              damaged_qty || null,
              reject_qty || null,
              user.id,
            ]
          );
          productionId = hdr.rows[0].id;
        } else {
          // A cancelled product holds no ingredient reservation and is no
          // longer part of the plan. Editing it would silently re-reserve
          // stock against a row still marked cancelled, so refuse instead
          // of ending up in that inconsistent state.
          const stateRes = await client.query(
            `SELECT pp.cancelled_at, p.name
               FROM product_production pp
               JOIN product p ON p.id = pp.product_id
              WHERE pp.id = $1`,
            [productionId]
          );
          if (stateRes.rows[0]?.cancelled_at) {
            const err = new Error(
              `${stateRes.rows[0].name} was cancelled in this batch and can no longer be edited.`
            );
            err.code = "PRODUCTION_CANCELLED";
            throw err;
          }

          // 3️⃣ Remove existing OUT and ledger records *before* validating
          // stock — this production's own prior consumption must be given
          // back first, otherwise re-saving the same (or a slightly
          // higher) quantity would spuriously fail as "insufficient
          // stock" against ingredients this same edit is about to free up.
          await revertProductionOuts(client, productionId);
          await deleteProductLedgerByProduction(client, productionId);

          // 5️⃣ Update header
          //
          // produced_at is deliberately left untouched here. It used to be
          // overwritten with the *batch-level* produced_at (the outer
          // req.body value, sourced from MAX(produced_at) across every
          // product in the batch) on every save — so editing a batch that
          // had even one already-produced item flipped every other, still
          // pending, product in it to "completed" too. Actual production
          // must only ever be recorded through the dedicated
          // /batches/:batch_id/actual endpoint.
          await client.query(
            `UPDATE product_production
           SET product_id = $1,
               mode = $2,
               qty_product = $3,
               base_ingredient_id = $4,
               base_ingredient_qty = $5,
               notes = $6,
               planned_at = $7,
               actual_qty = $8,
               good_qty = $9,
               damaged_qty = $10,
               reject_qty = $11,
               updated_by = $12,
               updated_at = NOW(),
               -- Re-resolved on every edit, not just on create: changing a
               -- batch's date/time moves it to a different crew, and leaving
               -- the old shift attached would charge the wrong people's wages.
               shift_id = $14,
               shift_date = $15
           WHERE id = $13`,
            [
              product_id,
              mode,
              qty_product,
              base_ingredient_id || null,
              base_ingredient_qty || null,
              notes || null,
              planned_at || null,
              actual_qty || null,
              good_qty || null,
              damaged_qty || null,
              reject_qty || null,
              user.id,
              productionId,
              resolvedShiftId,
              resolvedShiftDate,
            ]
          );
        }

        // Re-price the bake: quantity or oven may have changed on this edit.
        await saveBakeForProduction(client, productionId, {
          product_id,
          oven_id: prod.oven_id || null,
          quantity: actual_qty || qty_product,
        });

        // 4️⃣ Stock validation — after any prior reservation for this
        // production has been reverted (existing product) or with nothing
        // reserved yet (new product), so this always checks against
        // truly-available stock.
        for (const ing of ingredients) {
          const available = await getAvailableQty(client, ing.item_id);
          if (Number(ing.qty_required) > available) {
            throw new Error(
              `INSUFFICIENT_STOCK:item=${ing.item_id}:available=${available}:required=${ing.qty_required}`
            );
          }
        }

        // 6️⃣ Rebuild group choices
        await client.query(
          `DELETE FROM product_production_group_choice WHERE production_id = $1`,
          [productionId]
        );
        if (Array.isArray(group_choices) && group_choices.length > 0) {
          for (const gc of group_choices) {
            await client.query(
              `INSERT INTO product_production_group_choice (production_id, group_id, combination_id)
             VALUES ($1, $2, $3)`,
              [productionId, gc.group_id, gc.combination_id]
            );
          }
        }

        // 7️⃣ Rebuild ingredients
        await client.query(
          `DELETE FROM product_production_item WHERE production_id = $1`,
          [productionId]
        );
        for (const ing of ingredients) {
          await client.query(
            `INSERT INTO product_production_item (production_id, item_id, qty_required, group_id, combination_id)
           VALUES ($1, $2, $3, $4, $5)`,
            [
              productionId,
              ing.item_id,
              ing.qty_required,
              ing.group_id || null,
              ing.combination_id || null,
            ]
          );
        }

        // 8️⃣ Rebuild staff
        await client.query(
          `DELETE FROM product_production_staff WHERE production_id = $1`,
          [productionId]
        );
        if (Array.isArray(staffs) && staffs.length > 0) {
          for (const s of staffs) {
            await client.query(
              // daily_rate is snapshotted here exactly as it is on create.
              // Leaving it out — as this path used to — silently wiped the
              // rate on every edit, and the production's labour became
              // uncostable without anything looking wrong.
              `INSERT INTO product_production_staff (production_id, staff_id, role, notes, daily_rate)
             SELECT $1,$2,$3,$4, daily_salary FROM staff WHERE id = $2`,
              [productionId, s.staff_id, s.role || null, s.notes || null]
            );
          }
        }

        // 9️⃣ Rebuild discrepancies
        await client.query(
          `DELETE FROM product_production_discrepancy WHERE production_id = $1`,
          [productionId]
        );
        if (Array.isArray(discrepancies) && discrepancies.length > 0) {
          for (const descrepancy of discrepancies) {
            if (!descrepancy.reason_id) {
              continue;
            }
            await client.query(
              `INSERT INTO product_production_discrepancy (production_id, reason_id, notes)
             VALUES ($1, $2, $3)`,
              [productionId, descrepancy.reason_id, descrepancy.notes || null]
            );
          }
        }

        // 🔟 FIFO OUT for ingredients
        for (const ing of ingredients) {
          await allocateFifoOut(
            client,
            productionId,
            ing.item_id,
            ing.qty_required,
            planned_at
          );
        }

        // 11️⃣ Ledger IN entries
        if (actual_qty && produced_at) {
          await recordProductLedger(
            client,
            productionId,
            product_id,
            { good_qty, damaged_qty, reject_qty },
            produced_at,
            produced_at
          );
        }
      }

      await client.query("COMMIT");
      res.json({
        batch_id: batchId,
        message: "Production updated successfully",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Failed to update production:", err);
      if (String(err.message).startsWith("INSUFFICIENT_STOCK")) {
        return res
          .status(400)
          .json({ error: "INSUFFICIENT_STOCK", message: err.message });
      }
      if (
        err.code === "PRODUCTION_CANCELLED" ||
        err.code === "PRODUCTION_NOT_IN_BATCH" ||
        err.code === "ALREADY_PRODUCED" ||
        err.code === "ALREADY_CANCELLED" ||
        err.code === "OUTPUT_ALREADY_USED" ||
        err.code === "NOT_FOUND"
      ) {
        return res
          .status(400)
          .json({ error: err.code, message: err.message, details: err.meta });
      }
      res.status(500).json({ error: "Failed to update production" });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/batches/:batch_id/actual",
  requireTask("can_add_actual_production", "can_edit_actual_production"),
  async (req, res) => {
    const { batch_id } = req.params;
    const { produced_at, notes, products, shift_id } = req.body;

    if (!batch_id || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "Invalid or missing payload" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // One shift for the whole batch — every product in it shares the same
      // produced_at, so they share the same crew.
      const occurrence = await shiftAt(client, produced_at);
      const resolvedShiftId =
        shift_id !== undefined && shift_id !== null
          ? Number(shift_id)
          : occurrence?.id ?? null;
      const resolvedShiftDate = occurrence?.shift_date ?? null;

      // 🧾 Fetch all productions in this batch. Cancelled ones are excluded:
      // they hold no ingredients and were never made, so recording actual
      // output against them would resurrect them by the back door.
      const batchRes = await client.query(
        `SELECT id, product_id, oven_id FROM product_production
          WHERE batch_id = $1 AND cancelled_at IS NULL`,
        [batch_id]
      );
      const existingProductions = batchRes.rows;
      if (existingProductions.length === 0) {
        throw new Error(`No productions found for batch_id=${batch_id}`);
      }

      const cancelledRes = await client.query(
        `SELECT pp.id, p.name
           FROM product_production pp
           JOIN product p ON p.id = pp.product_id
          WHERE pp.batch_id = $1 AND pp.cancelled_at IS NOT NULL`,
        [batch_id]
      );
      const cancelledIds = new Map(
        cancelledRes.rows.map((r) => [r.id, r.name])
      );
      for (const prod of products) {
        if (cancelledIds.has(prod.production_id)) {
          const err = new Error(
            `${cancelledIds.get(prod.production_id)} was cancelled in this batch — actual production can't be recorded against it.`
          );
          err.code = "PRODUCTION_CANCELLED";
          throw err;
        }
      }

      // 🕓 Update production header(s)
      for (const prod of products) {
        const {
          production_id,
          good_qty = 0,
          damaged_qty = 0,
          reject_qty = 0,
          actual_qty = 0,
          discrepancies = [],
        } = prod;

        // Ensure this production belongs to batch
        const existing = existingProductions.find((x) => x.id === production_id);
        if (!existing) {
          throw new Error(
            `Production ${production_id} not part of batch ${batch_id}`
          );
        }

        // 🧮 Update production quantities and timestamps
        //
        // This is where produced_at is actually recorded, so it is also where
        // the shift has to be resolved: this endpoint — not the batch edit —
        // is what moves a production onto a different crew. Explicit
        // shift_id from the form wins; otherwise it follows produced_at.
        await client.query(
          `UPDATE product_production
         SET good_qty=$1, damaged_qty=$2, reject_qty=$3,
             actual_qty=$4, produced_at=$5, notes=COALESCE($6, notes),
             shift_id=$8, shift_date=$9
         WHERE id=$7`,
          [
            good_qty,
            damaged_qty,
            reject_qty,
            actual_qty,
            produced_at,
            notes,
            production_id,
            resolvedShiftId,
            resolvedShiftDate,
          ]
        );

        // Actual output is what really went through the oven, so the bake
        // is re-priced here against the quantity just recorded.
        await saveBakeForProduction(client, production_id, {
          product_id: existing.product_id,
          // The oven named on this recording wins; otherwise keep whichever
          // was already on the production.
          oven_id: prod.oven_id || existing.oven_id || null,
          quantity: actual_qty,
        });

        // 🔁 Remove old product ledger entries for this production
        await deleteProductLedgerByProduction(client, production_id);

        // ✅ Record new product ledger entries
        await recordProductLedger(
          client,
          production_id,
          existingProductions.find((p) => p.id === production_id).product_id,
          { good_qty, damaged_qty, reject_qty },
          produced_at,
          // Same value, kept whole: movement_date truncates it to a day,
          // movement_at preserves the time the batch came off the line.
          produced_at
        );

        // 🛡️ Transfers/sales drawn from this batch survive a re-save now,
        // so correcting actuals downward below what has already been moved
        // out of the batch would leave a negative balance. Reject instead.
        const balCheck = await client.query(
          `SELECT outlet_id, quality, SUM(
             CASE
               WHEN movement_type IN ('IN','TRANSFER_IN') THEN quantity
               WHEN movement_type IN ('OUT','TRANSFER_OUT','SALE') THEN -quantity
               WHEN movement_type = 'QUALITY_CHANGE' THEN quantity
               ELSE 0
             END
           ) AS balance
           FROM product_ledger
           WHERE production_id = $1
           GROUP BY outlet_id, quality
           HAVING SUM(
             CASE
               WHEN movement_type IN ('IN','TRANSFER_IN') THEN quantity
               WHEN movement_type IN ('OUT','TRANSFER_OUT','SALE') THEN -quantity
               WHEN movement_type = 'QUALITY_CHANGE' THEN quantity
               ELSE 0
             END
           ) < 0`,
          [production_id]
        );
        if (balCheck.rows.length > 0) {
          const err = new Error(
            `Actual quantities for production ${production_id} are lower than the stock already transferred or sold from this batch. Increase the actuals or correct the transfers/sales first.`
          );
          err.code = "ACTUALS_BELOW_CONSUMED";
          err.meta = { production_id, negative: balCheck.rows };
          throw err;
        }

        // ⚙️ Update discrepancies (replace existing ones)
        await client.query(
          `DELETE FROM product_production_discrepancy WHERE production_id=$1`,
          [production_id]
        );
        for (const d of discrepancies) {
          if (!d.reason_id) continue;
          await client.query(
            `INSERT INTO product_production_discrepancy (production_id, reason_id, notes)
           VALUES ($1, $2, $3)`,
            [production_id, d.reason_id, d.notes || null]
          );
        }
      }

      await recordAudit(client, {
        user: req.user,
        action: "PRODUCTION_ACTUAL_RECORD",
        entity_type: "production_batch",
        entity_id: Number(batch_id),
        description: `Recorded actual production for batch #${batch_id} (${products.length} product(s))`,
        details: { products },
      });

      await client.query("COMMIT");
      res.json({
        batch_id,
        message: "Actual production quantities saved successfully",
      });
    } catch (err) {
      let releaseError;
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error("❌ Rollback failed, discarding connection:", rollbackErr);
        releaseError = rollbackErr;
      }
      if (
        err.code === "ACTUALS_BELOW_CONSUMED" ||
        err.code === "PRODUCTION_CANCELLED"
      ) {
        res.status(400).json({
          error: err.code,
          message: err.message,
          details: err.meta,
        });
      } else {
        console.error("❌ Failed to record actual production:", err);
        res.status(500).json({ error: "Failed to save actual production" });
      }
      client.release(releaseError);
      return;
    }
    client.release();
  }
);

/**
 * POST /productions/:id/cancel — cancel one planned product in a batch,
 * releasing its reserved ingredients back to stock.
 */
router.post(
  "/:id/cancel",
  requireTask("can_cancel_production"),
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    const client = await pool.connect();
    let releaseError;
    try {
      await client.query("BEGIN");

      const result = await cancelProduction(client, Number(id), {
        userId: req.user?.id,
        reason,
      });

      await recordAudit(client, {
        user: req.user,
        action: "PRODUCTION_ITEM_CANCEL",
        entity_type: "product_production",
        entity_id: Number(id),
        description: `Cancelled ${result.product_name} in batch #${result.batch_id}, releasing its ingredients${reason ? ` (${reason})` : ""}`,
        details: { batch_id: result.batch_id, reason: reason || null },
      });

      await client.query("COMMIT");
      res.json({ ...result, message: "Production cancelled and ingredients released" });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error("❌ Rollback failed, discarding connection:", rollbackErr);
        releaseError = rollbackErr;
      }
      if (
        err.code === "NOT_FOUND" ||
        err.code === "ALREADY_CANCELLED" ||
        err.code === "ALREADY_PRODUCED" ||
        err.code === "OUTPUT_ALREADY_USED"
      ) {
        return res
          .status(err.code === "NOT_FOUND" ? 404 : 400)
          .json({ error: err.code, message: err.message, details: err.meta });
      }
      console.error("❌ Failed to cancel production:", err);
      res.status(500).json({ error: "Failed to cancel production" });
    } finally {
      client.release(releaseError);
    }
  }
);

/**
 * POST /productions/batches/:id/cancel — cancel every still-active product
 * in a batch. All-or-nothing: if any one of them can't be cancelled (its
 * output already moved), nothing is cancelled, so the batch can't be left
 * half-done.
 */
router.post(
  "/batches/:id/cancel",
  requireTask("can_cancel_production"),
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    const client = await pool.connect();
    let releaseError;
    try {
      await client.query("BEGIN");

      const batchRes = await client.query(
        `SELECT id FROM production_batch WHERE id = $1`,
        [id]
      );
      if (batchRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Batch not found" });
      }

      const activeRes = await client.query(
        `SELECT id FROM product_production
          WHERE batch_id = $1 AND cancelled_at IS NULL
          ORDER BY id`,
        [id]
      );

      if (activeRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "NOTHING_TO_CANCEL",
          message: "Every product in this batch is already cancelled.",
        });
      }

      const cancelled = [];
      for (const row of activeRes.rows) {
        cancelled.push(
          await cancelProduction(client, row.id, {
            userId: req.user?.id,
            reason,
          })
        );
      }

      await recordAudit(client, {
        user: req.user,
        action: "PRODUCTION_BATCH_CANCEL",
        entity_type: "production_batch",
        entity_id: Number(id),
        description: `Cancelled batch #${id} (${cancelled.length} product(s)), releasing their ingredients${reason ? ` (${reason})` : ""}`,
        details: {
          reason: reason || null,
          products: cancelled.map((c) => c.product_name),
        },
      });

      await client.query("COMMIT");
      res.json({
        batch_id: Number(id),
        cancelled_count: cancelled.length,
        message: "Batch cancelled and ingredients released",
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error("❌ Rollback failed, discarding connection:", rollbackErr);
        releaseError = rollbackErr;
      }
      if (
        err.code === "NOT_FOUND" ||
        err.code === "ALREADY_CANCELLED" ||
        err.code === "ALREADY_PRODUCED" ||
        err.code === "OUTPUT_ALREADY_USED"
      ) {
        return res
          .status(400)
          .json({ error: err.code, message: err.message, details: err.meta });
      }
      console.error("❌ Failed to cancel batch:", err);
      res.status(500).json({ error: "Failed to cancel batch" });
    } finally {
      client.release(releaseError);
    }
  }
);

router.get("/batches", requireTask("can_see_production"), async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const offset = (page - 1) * limit;

    const {
      search,
      product_id,
      team_leader,
      status,
      planned_start,
      planned_end,
      include_products,
    } = req.query;

    const where = [];
    const params = [];

    // 🔍 Search
    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        pb.batch_code ILIKE $${params.length}
        OR EXISTS (
          SELECT 1 FROM product_production pp
          JOIN product p ON p.id = pp.product_id
          WHERE pp.batch_id = pb.id AND p.name ILIKE $${params.length}
        )
      )`);
    }

    // 🎯 Product filter
    if (product_id) {
      params.push(product_id);
      where.push(`EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id AND pp.product_id = $${params.length}
      )`);
    }

    // 👷 Team leader filter
    if (team_leader) {
      params.push(`%${team_leader}%`);
      where.push(`EXISTS (
        SELECT 1
        FROM product_production pp
        JOIN product_production_staff ps ON ps.production_id = pp.id
        JOIN staff s ON s.id = ps.staff_id
        WHERE pp.batch_id = pb.id
          AND (ps.role = 'Team Leader' OR ps.role IS NULL)
          AND (s.name ILIKE $${params.length} OR s.id::text = $${params.length})
      )`);
    }

    // 🗓 Planned date range
    if (planned_start && planned_end) {
      params.push(planned_start, planned_end);
      where.push(`EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id
          AND pp.planned_at BETWEEN $${params.length - 1} AND $${params.length}
      )`);
    } else if (planned_start) {
      params.push(planned_start);
      where.push(`EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id AND pp.planned_at >= $${params.length}
      )`);
    } else if (planned_end) {
      params.push(planned_end);
      where.push(`EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id AND pp.planned_at <= $${params.length}
      )`);
    }

    // ⚙️ Status filter (cancelled products don't count towards a batch
    // being pending or completed — they're no longer part of the plan)
    if (status?.toLowerCase() === "pending") {
      where.push(`EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id AND pp.produced_at IS NULL
          AND pp.cancelled_at IS NULL
      )`);
    } else if (status?.toLowerCase() === "completed") {
      where.push(`NOT EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id AND pp.produced_at IS NULL
          AND pp.cancelled_at IS NULL
      )`);
    } else if (status?.toLowerCase() === "cancelled") {
      where.push(`NOT EXISTS (
        SELECT 1 FROM product_production pp
        WHERE pp.batch_id = pb.id AND pp.cancelled_at IS NULL
      ) AND EXISTS (
        SELECT 1 FROM product_production pp WHERE pp.batch_id = pb.id
      )`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // 1️⃣ Count total
    const countSql = `
      SELECT COUNT(DISTINCT pb.id)::int AS total
      FROM production_batch pb
      ${whereSQL}
    `;
    const countRes = await pool.query(countSql, params);
    const totalRecords = countRes.rows[0]?.total || 0;
    const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

    // 2️⃣ Fetch batches
    const listSql = `
      SELECT 
        pb.id,
        pb.batch_code,
        TO_CHAR(pb.created_at, 'DD-MM-YYYY HH24:MI') AS created_at,
        u.name AS created_by_name,
        COUNT(pp.id) AS total_products,
        SUM(pp.good_qty) AS total_good_qty,
        SUM(pp.damaged_qty) AS total_damaged_qty,
        SUM(pp.reject_qty) AS total_reject_qty,
        TO_CHAR(MIN(pp.planned_at), 'DD-MM-YYYY HH24:MI') AS planned_at,
        TO_CHAR(MAX(pp.produced_at), 'DD-MM-YYYY HH24:MI') AS produced_at,
        COUNT(pp.id) FILTER (WHERE pp.produced_at IS NULL) AS unproduced_count,
        COUNT(pp.id) FILTER (WHERE pp.produced_at IS NOT NULL) AS produced_count,
        (
          SELECT COUNT(*) FROM product_production ppc
          WHERE ppc.batch_id = pb.id AND ppc.cancelled_at IS NOT NULL
        ) AS cancelled_count,
        -- Total actual ingredient cost for the batch. A scalar subquery
        -- rather than another join: pp is already joined and grouped here,
        -- so joining the ledger too would multiply the good/damaged/reject
        -- sums above by the number of ingredient rows.
        COALESCE((
          SELECT SUM(il.quantity * il.unit_price)
          FROM item_ledger il
          JOIN product_production ppi2 ON ppi2.id = il.production_id
          WHERE ppi2.batch_id = pb.id AND il.type = 'OUT'
        ), 0) AS ingredient_cost,
        COALESCE(
          (
            SELECT s.name
            FROM product_production_staff ps
            JOIN staff s ON s.id = ps.staff_id
            JOIN product_production ppx ON ppx.id = ps.production_id
            WHERE ppx.batch_id = pb.id
              AND ps.role = 'Team Leader'
            ORDER BY ps.id
            LIMIT 1
          ),
          (
            SELECT s.name
            FROM product_production_staff ps
            JOIN staff s ON s.id = ps.staff_id
            JOIN product_production ppx ON ppx.id = ps.production_id
            WHERE ppx.batch_id = pb.id
            ORDER BY ps.id
            LIMIT 1
          ),
          'N/A'
        ) AS team_leader_name
      FROM production_batch pb
      -- Cancelled products are excluded from every aggregate here (counts,
      -- quantities, planned/produced dates) so a cancelled item can't skew
      -- a batch's totals or keep it looking permanently "pending".
      LEFT JOIN product_production pp
        ON pb.id = pp.batch_id AND pp.cancelled_at IS NULL
      LEFT JOIN users u ON u.id = pb.created_by
      ${whereSQL}
      GROUP BY pb.id, pb.batch_code, pb.created_at, u.name
      ORDER BY COALESCE(MAX(pp.produced_at), MAX(pp.planned_at), pb.created_at) DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const listRes = await pool.query(listSql, [...params, limit, offset]);
    let batches = listRes.rows;

    // 3️⃣ Compute status field
    // "Completed" means every product in the batch has an actual recorded,
    // not just the earliest one — MAX(produced_at) is truthy as soon as a
    // single item is done, which previously marked the whole batch
    // "completed" after only partial entry.
    batches = batches.map((b) => {
      const totalProducts = Number(b.total_products) || 0;
      const unproducedCount = Number(b.unproduced_count) || 0;
      const cancelledCount = Number(b.cancelled_count) || 0;
      // total_products counts only non-cancelled products, so zero of them
      // alongside at least one cancellation means the whole batch was
      // called off — otherwise it'd read as a permanently "pending" batch
      // with nothing left in it.
      const status =
        totalProducts === 0 && cancelledCount > 0
          ? "cancelled"
          : totalProducts > 0 && unproducedCount === 0
            ? "completed"
            : "pending";
      return { ...b, status };
    });

    // 4️⃣ Optionally include summarized products
    if (include_products === "true" && batches.length) {
      const batchIds = batches.map((b) => b.id);
      const prodRes = await pool.query(
        `
        SELECT 
          pp.batch_id,
          pp.id AS production_id,
          pp.product_id,
          p.name AS product_name,
          pp.qty_product,
          pp.actual_qty,
          pp.good_qty,
          pp.damaged_qty,
          pp.reject_qty,
          pp.produced_at
        FROM product_production pp
        JOIN product p ON p.id = pp.product_id
        WHERE pp.batch_id = ANY($1::int[])
          AND pp.cancelled_at IS NULL
        ORDER BY p.name
      `,
        [batchIds]
      );

      const productMap = {};
      for (const p of prodRes.rows) {
        if (!productMap[p.batch_id]) productMap[p.batch_id] = [];
        productMap[p.batch_id].push({
          production_id: p.production_id,
          product_id: p.product_id,
          product_name: p.product_name,
          qty_product: p.qty_product,
          actual_qty: p.actual_qty,
          good_qty: p.good_qty,
          damaged_qty: p.damaged_qty,
          reject_qty: p.reject_qty,
          produced: !!p.produced_at,
        });
      }

      batches = batches.map((b) => ({
        ...b,
        products: productMap[b.id] || [],
      }));
    }
    res.json({
      data: batches,
      totalRecords,
      totalPages,
      currentPage: page,
    });
  } catch (err) {
    console.error("❌ Failed to fetch batches:", err);
    res.status(500).json({ error: "Failed to fetch production batches" });
  }
});

router.get(
  "/batches/:id",
  requireTask("can_see_production"),
  async (req, res) => {
    const { id } = req.params;

    try {
      // 1️⃣ Batch header summary
      const batchHdrRes = await pool.query(
        `
      SELECT 
        pb.id,
        pb.batch_code,
        pb.created_at,
        u.name AS created_by_name,
        COUNT(pp.id) AS total_products,
        SUM(pp.good_qty) AS total_good_qty,
        SUM(pp.damaged_qty) AS total_damaged_qty,
        SUM(pp.reject_qty) AS total_reject_qty,
        COUNT(pp.id) FILTER (WHERE pp.produced_at IS NULL) AS unproduced_count,
        COUNT(pp.id) FILTER (WHERE pp.produced_at IS NOT NULL) AS produced_count,
        (
          SELECT COUNT(*) FROM product_production ppc
          WHERE ppc.batch_id = pb.id AND ppc.cancelled_at IS NOT NULL
        ) AS cancelled_count,
        TO_CHAR(MIN(pp.planned_at), 'DD-MM-YYYY HH24:MI') AS planned_at,
        TO_CHAR(MAX(pp.produced_at), 'DD-MM-YYYY HH24:MI') AS produced_at,
        COALESCE(
          (
            SELECT s.name
            FROM product_production_staff ps
            JOIN staff s ON s.id = ps.staff_id
            JOIN product_production ppx ON ppx.id = ps.production_id
            WHERE ppx.batch_id = pb.id
              AND ps.role = 'Team Leader'
            ORDER BY ps.id
            LIMIT 1
          ),
          (
            SELECT s.name
            FROM product_production_staff ps
            JOIN staff s ON s.id = ps.staff_id
            JOIN product_production ppx ON ppx.id = ps.production_id
            WHERE ppx.batch_id = pb.id
            ORDER BY ps.id
            LIMIT 1
          ),
          'N/A'
        ) AS team_leader_name
      FROM production_batch pb
      -- Cancelled products excluded from the header aggregates, same as
      -- the /batches list, so they can't skew totals or status.
      LEFT JOIN product_production pp
        ON pp.batch_id = pb.id AND pp.cancelled_at IS NULL
      LEFT JOIN users u ON u.id = pb.created_by
      WHERE pb.id = $1
      GROUP BY pb.id, pb.batch_code, pb.created_at, u.name
      `,
        [id]
      );

      if (batchHdrRes.rows.length === 0)
        return res.status(404).json({ error: "Batch not found" });

      const batch = batchHdrRes.rows[0];

      // 🧮 Compute status — completed only once every product in the batch
      // has an actual recorded (see /batches list for why MAX(produced_at)
      // alone is wrong: it's truthy after just the first item is done).
      const totalProducts = Number(batch.total_products) || 0;
      const unproducedCount = Number(batch.unproduced_count) || 0;
      const cancelledCount = Number(batch.cancelled_count) || 0;
      const status =
        totalProducts === 0 && cancelledCount > 0
          ? "cancelled"
          : totalProducts > 0 && unproducedCount === 0
            ? "completed"
            : "pending";
      // 2️⃣ Fetch all product productions in this batch
      const productsRes = await pool.query(
        `
      SELECT 
        pp.id AS production_id,
        pp.product_id,
        p.name AS product_name,
        pp.qty_product,
        pp.actual_qty,
        pp.good_qty,
        pp.damaged_qty,
        pp.reject_qty,
        TO_CHAR(pp.planned_at, 'DD-MM-YYYY HH24:MI') AS planned_at,
        TO_CHAR(pp.produced_at, 'DD-MM-YYYY HH24:MI') AS produced_at,
        COALESCE(pp.notes, '') AS notes,
        -- Cancelled products are still listed here (deliberately: the plan's
        -- history stays visible and auditable) but carry these flags so the
        -- UI can label them and keep them out of edits/actuals.
        TO_CHAR(pp.cancelled_at, 'DD-MM-YYYY HH24:MI') AS cancelled_at,
        pp.cancel_reason,
        cu.name AS cancelled_by_name,
        -- The oven this was baked in, plus what that bake cost at the rates
        -- in force when it was saved. Returned so an edit reopens on the
        -- same oven instead of silently falling back to the default.
        pp.oven_id,
        pp.bake_loads,
        pp.bake_minutes,
        pp.bake_litres,
        pp.bake_cost
      FROM product_production pp
      JOIN product p ON p.id = pp.product_id
      LEFT JOIN users cu ON cu.id = pp.cancelled_by
      WHERE pp.batch_id = $1
      ORDER BY p.name
      `,
        [id]
      );

      const products = [];

      // One pass for the whole batch: labour is pooled per shift, so it has to
      // be worked out across productions rather than one at a time.
      const labourByProduction = await labourForProductions(
        pool,
        productsRes.rows.map((r) => r.production_id)
      );

      // 3️⃣ Attach each product’s ingredients, staff, and discrepancies
      for (const prod of productsRes.rows) {
        const [ingredientsRes, staffRes, discRes] = await Promise.all([
          pool.query(
            `
          SELECT 
            ppi.id,
            ppi.item_id,
            i.name AS item_name,
            ppi.qty_required,
            iu.shortname AS unit,
            ppi.group_id,
            pig.name AS group_name,
            pig.is_active AS group_active,
            ppi.combination_id,
            pigc.name AS combination_name,

            -- What this ingredient actually cost, from the FIFO lots the
            -- production drew down (item_ledger already records the lot
            -- price on every OUT row). Not a re-priced estimate: it is the
            -- money that actually left the store.
            COALESCE(c.cost, 0) AS cost,
            -- Weighted average, because one ingredient can be filled from
            -- several lots at different prices — showing any single lot's
            -- price would misstate it.
            c.avg_unit_cost,
            COALESCE(c.lot_count, 0) AS lot_count
          FROM product_production_item ppi
          JOIN item i ON i.id = ppi.item_id
          LEFT JOIN itemunit iu ON iu.id = i.unit_id
          LEFT JOIN product_item_group pig ON pig.id = ppi.group_id
          LEFT JOIN product_item_group_combination pigc ON pigc.id = ppi.combination_id
          LEFT JOIN (
            SELECT item_id,
                   SUM(quantity * unit_price) AS cost,
                   SUM(quantity * unit_price) / NULLIF(SUM(quantity), 0) AS avg_unit_cost,
                   COUNT(DISTINCT unit_price) AS lot_count
            FROM item_ledger
            WHERE production_id = $1 AND type = 'OUT'
            GROUP BY item_id
          ) c ON c.item_id = ppi.item_id
          WHERE ppi.production_id = $1
          ORDER BY pig.name NULLS LAST, i.name
        `,
            [prod.production_id]
          ),
          pool.query(
            `
          SELECT 
            s.id AS staff_id, 
            s.name AS staff_name, 
            ps.role, 
            ps.notes
          FROM product_production_staff ps
          JOIN staff s ON s.id = ps.staff_id
          WHERE ps.production_id = $1
          ORDER BY s.name
        `,
            [prod.production_id]
          ),
          pool.query(
            `
          SELECT 
            d.id, 
            dr.name AS reason_name, 
            d.reason_id, 
            d.notes
          FROM product_production_discrepancy d
          JOIN discrepancy_reason dr ON dr.id = d.reason_id
          WHERE d.production_id = $1
          ORDER BY dr.name
        `,
            [prod.production_id]
          ),
        ]);

        const ingredients = ingredientsRes.rows;
        const labour = labourByProduction.get(prod.production_id) || null;

        // Roll the per-ingredient costs up to the product. Derived from the
        // same rows the UI lists, so the breakdown always sums to the total
        // sitting next to it.
        const ingredientCost = ingredients.reduce(
          (sum, ing) => sum + (Number(ing.cost) || 0),
          0
        );
        // Unit cost spreads over EVERYTHING produced — good, damaged and
        // reject alike. Damaged and reject units still get sold here (at
        // their own prices), so they carry their share of the ingredients;
        // the margin calculation is where the different selling prices are
        // reconciled. Dividing by good output alone would overstate what a
        // unit cost to make.
        const totalOutput =
          (Number(prod.good_qty) || 0) +
          (Number(prod.damaged_qty) || 0) +
          (Number(prod.reject_qty) || 0);

        const labourCost = labour && labour.cost !== null ? Number(labour.cost) : null;
        // Labour is only added in when it is actually known — adding null as
        // zero would quietly report an incomplete cost as a complete one.
        const knownCost = ingredientCost + (labourCost || 0);

        products.push({
          ...prod,
          ingredients,
          ingredient_cost: ingredientCost,
          ingredient_cost_per_unit: totalOutput > 0 ? ingredientCost / totalOutput : null,
          labour,
          labour_cost: labourCost,
          labour_cost_per_unit:
            labourCost !== null && totalOutput > 0 ? labourCost / totalOutput : null,
          total_cost: knownCost,
          total_cost_per_unit: totalOutput > 0 ? knownCost / totalOutput : null,
          cost_complete: labourCost !== null,
          staff: staffRes.rows,
          discrepancies: discRes.rows,
        });
      }

      // Batch total: sum of the products above. Cancelled products
      // contribute nothing on their own — cancelling deletes their ledger
      // OUT rows to put the ingredients back on the shelf — so no separate
      // exclusion is needed here.
      const batchIngredientCost = products.reduce(
        (sum, prod) => sum + (Number(prod.ingredient_cost) || 0),
        0
      );
      const batchLabourCost = products.reduce(
        (sum, prod) => sum + (Number(prod.labour_cost) || 0),
        0
      );
      // False as soon as any product's labour is unknown, so the UI can say
      // the batch total is partial rather than presenting it as final.
      const batchCostComplete = products.every((prod) => prod.cost_complete);

      // ✅ Response
      res.json({
        batch: {
          ...batch,
          status,
          ingredient_cost: batchIngredientCost,
          labour_cost: batchLabourCost,
          total_cost: batchIngredientCost + batchLabourCost,
          cost_complete: batchCostComplete,
        },
        products,
      });
    } catch (err) {
      console.error("❌ Failed to fetch batch details:", err);
      res.status(500).json({ error: "Failed to fetch batch details" });
    }
  }
);

router.delete(
  "/batches/:id",
  requireTask("can_delete_production"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;

      await client.query("BEGIN");

      // 1️⃣ Get all productions under this batch
      const { rows: productions } = await client.query(
        `SELECT id FROM product_production WHERE batch_id = $1`,
        [id]
      );

      if (!productions.length) {
        // No productions → safe to delete batch directly
        const delBatch = await client.query(
          `DELETE FROM production_batch WHERE id = $1`,
          [id]
        );
        if (delBatch.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Batch not found" });
        }
        await recordAudit(client, {
          user: req.user,
          action: "PRODUCTION_DELETE",
          entity_type: "production_batch",
          entity_id: Number(id),
          description: `Deleted empty production batch #${id}`,
        });
        await client.query("COMMIT");
        return res.json({ id, message: "Batch deleted successfully" });
      }

      // 1️⃣b Safety check before destroying anything.
      //
      // Deleting a batch whose output has already been produced and moved
      // leaves the transfers/sales that drew on it pointing at stock-in
      // rows that no longer exist — the source outlet's balance goes
      // negative and the destination holds stock from nowhere. Apply the
      // same rules as cancelling, and refuse the whole delete up front so
      // nothing is half-removed. Already-cancelled productions are fine to
      // delete: they hold no ingredients and produced nothing.
      for (const prod of productions) {
        await assertProductionRemovable(client, prod.id, {
          verb: "deleted",
          allowCancelled: true,
        });
      }

      // 2️⃣ Loop through each production to revert its movements and delete its data
      for (const prod of productions) {
        const productionId = prod.id;

        // 2.1 Revert ingredient OUTs from item_ledger
        await revertProductionOuts(client, productionId);

        // 2.2 Revert product_ledger INs for this production
        await deleteProductLedgerByProduction(client, productionId);

        // 2.3 Delete subrecords
        await client.query(
          `DELETE FROM product_production_item WHERE production_id = $1`,
          [productionId]
        );
        await client.query(
          `DELETE FROM product_production_staff WHERE production_id = $1`,
          [productionId]
        );
        await client.query(
          `DELETE FROM product_production_group_choice WHERE production_id = $1`,
          [productionId]
        );
        await client.query(
          `DELETE FROM product_production_discrepancy WHERE production_id = $1`,
          [productionId]
        );

        // 2.4 Delete the production header
        await client.query(`DELETE FROM product_production WHERE id = $1`, [
          productionId,
        ]);
      }

      // 3️⃣ Finally delete the batch header itself
      const delBatch = await client.query(
        `DELETE FROM production_batch WHERE id = $1`,
        [id]
      );

      await recordAudit(client, {
        user: req.user,
        action: "PRODUCTION_DELETE",
        entity_type: "production_batch",
        entity_id: Number(id),
        description: `Deleted production batch #${id} (${productions.length} production(s))`,
      });

      await client.query("COMMIT");

      if (delBatch.rowCount === 0)
        return res.status(404).json({ error: "Batch not found" });

      res.json({
        id,
        message: "Batch and related productions deleted successfully",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (
        err.code === "ALREADY_PRODUCED" ||
        err.code === "OUTPUT_ALREADY_USED" ||
        err.code === "NOT_FOUND"
      ) {
        return res
          .status(400)
          .json({ error: err.code, message: err.message, details: err.meta });
      }
      console.error("❌ Failed to delete batch:", err);
      res.status(500).json({ error: "Failed to delete batch" });
    } finally {
      client.release();
    }
  }
);

router.get("/", requireTask("can_see_production"), async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();

    let {
      planned_at,
      planned_end,
      planned_at_op,
      produced_at,
      produced_end,
      produced_at_op,
      team_leader,
      discrepancy_reason,
      status,
    } = req.query;

    const where = [];
    const params = [];

    // Cancelled productions are no longer part of the plan, so they're kept
    // out of this list (and its counts) entirely. The batch detail view is
    // where they stay visible, flagged, for history.
    where.push(`pp.cancelled_at IS NULL`);

    // 🔎 Product name search
    if (search) {
      params.push(`%${search}%`);
      where.push(`p.name ILIKE $${params.length}`);
    }

    if (req.query.product_id) {
      params.push(req.query.product_id);
      where.push(`pp.product_id = $${params.length}`);
    }

    // 🗓 Planned date filter
    if (planned_at) {
      if (planned_at.split(" ").length == 1 && !planned_at_op) {
        planned_at_op = "in";
        planned_end = planned_at + " 23:59";
      } else if (planned_end) {
        planned_end += " 23:59";
      }
      planned_at = moment(planned_at, ["DD/MM/YYYY HH:mm", "DD-MM-YYYY HH:mm"]).format(
        "YYYY-MM-DD HH:mm"
      );
      if (planned_at_op === "in" && planned_end) {
        planned_end = moment(planned_end, ["DD/MM/YYYY HH:mm", "DD-MM-YYYY HH:mm"]).format(
          "YYYY-MM-DD HH:mm"
        );
        params.push(planned_at, planned_end);
        where.push(
          `pp.planned_at BETWEEN $${params.length - 1} AND $${params.length}`
        );
      } else if (["=", ">", "<", ">=", "<="].includes(planned_at_op)) {
        params.push(planned_at);
        where.push(`pp.planned_at ${planned_at_op} $${params.length}`);
      }
    }

    // 🕒 Produced date filter
    if (produced_at) {
      if (produced_at.split(" ").length == 1 && !produced_at_op) {
        produced_at_op = "in";
        produced_end = produced_at + " 23:59";
      } else if (produced_end) {
        produced_end += " 23:59";
      }
      produced_at = moment(produced_at, ["DD/MM/YYYY HH:mm", "DD-MM-YYYY HH:mm"]).format(
        "YYYY-MM-DD HH:mm"
      );
      if (produced_at_op === "in" && produced_end) {
        produced_end = moment(produced_end, ["DD/MM/YYYY HH:mm", "DD-MM-YYYY HH:mm"]).format(
          "YYYY-MM-DD HH:mm"
        );
        params.push(produced_at, produced_end);
        where.push(
          `pp.produced_at BETWEEN $${params.length - 1} AND $${params.length}`
        );
      } else if (["=", ">", "<", ">=", "<="].includes(produced_at_op)) {
        params.push(produced_at);
        where.push(`pp.produced_at ${produced_at_op} $${params.length}`);
      }
    }

    // 🆕 Production Status Filter
    if (status) {
      if (status.toLowerCase() === "pending") {
        where.push(`pp.produced_at IS NULL`);
      } else if (status.toLowerCase() === "completed") {
        where.push(`pp.produced_at IS NOT NULL`);
      }
    }

    // 👷 Team leader (by name or id)
    if (team_leader) {
      params.push(team_leader);
      where.push(`EXISTS (
        SELECT 1
          FROM product_production_staff ps
          JOIN staff s ON s.id = ps.staff_id
         WHERE ps.production_id = pp.id
           AND ps.role = 'Team Leader'
           AND (s.name ILIKE $${params.length} OR s.id::text = $${params.length})
      )`);
    }

    // ⚠️ Discrepancy reason(s) (IDs and/or names; supports multiple)
    if (discrepancy_reason) {
      // Normalize to array (handles repeated or comma-separated)
      const raw = Array.isArray(discrepancy_reason)
        ? discrepancy_reason.flatMap((v) =>
            String(v)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          )
        : String(discrepancy_reason)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

      const reasonIds = [];
      const reasonNames = [];
      for (const r of raw) {
        if (/^\d+$/.test(r)) reasonIds.push(Number(r));
        else reasonNames.push(r);
      }

      const conds = [];
      if (reasonIds.length) {
        params.push(reasonIds);
        conds.push(`dr.id = ANY($${params.length}::int[])`);
      }
      if (reasonNames.length) {
        params.push(reasonNames);
        conds.push(`dr.name = ANY($${params.length}::text[])`);
      }

      if (conds.length) {
        where.push(`EXISTS (
          SELECT 1
            FROM product_production_discrepancy pd
            JOIN discrepancy_reason dr ON dr.id = pd.reason_id
           WHERE pd.production_id = pp.id
             AND (${conds.join(" OR ")})
        )`);
      }
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // 🧮 Total count (DISTINCT to avoid duplication from joins/exists)
    const totalSql = `
      SELECT COUNT(DISTINCT pp.id)::int AS total
        FROM product_production pp
        JOIN product p ON p.id = pp.product_id
        ${whereSQL}
    `;
    const totalRes = await pool.query(totalSql, params);
    const totalRecords = totalRes.rows[0]?.total || 0;
    const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

    // 🧾 Rows
    const rowsSql = `
      SELECT
        pp.id,
        TO_CHAR(pp.planned_at, 'DD-MM-YYYY HH24:MI') AS planned_at,
        TO_CHAR(pp.produced_at, 'DD-MM-YYYY HH24:MI') AS produced_at,
        pp.mode,
        pp.qty_product,
        pp.actual_qty,
        pp.good_qty,
        pp.damaged_qty,
        pp.reject_qty,
        pp.batch_id,
        -- Aggregate discrepancy reasons as names
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT dr2.name)
            FROM product_production_discrepancy pd2
            JOIN discrepancy_reason dr2 ON dr2.id = pd2.reason_id
           WHERE pd2.production_id = pp.id
        ), '{}') AS discrepancy_reasons,
        p.id AS product_id,
        p.name AS product_name,
        p.unit AS product_unit,
        p.price AS product_price,
        -- Actual ingredient cost of this production, from the FIFO lots it
        -- drew down. Scalar subquery so it cannot disturb the row set.
        COALESCE((
          SELECT SUM(il.quantity * il.unit_price)
          FROM item_ledger il
          WHERE il.production_id = pp.id AND il.type = 'OUT'
        ), 0) AS ingredient_cost,
        -- Prefer Team Leader, else first staff name, else 'N/A'
        COALESCE(
          (
            SELECT s.name
              FROM product_production_staff ps
              JOIN staff s ON s.id = ps.staff_id
             WHERE ps.production_id = pp.id
               AND ps.role = 'Team Leader'
             ORDER BY ps.id
             LIMIT 1
          ),
          (
            SELECT s.name
              FROM product_production_staff ps
              JOIN staff s ON s.id = ps.staff_id
             WHERE ps.production_id = pp.id
             ORDER BY ps.id
             LIMIT 1
          ),
          'N/A'
        ) AS team_leader_name,
        COALESCE((
          SELECT COUNT(*) FROM product_production_staff ps
           WHERE ps.production_id = pp.id
        ), 0) AS staff_count,
        u.name AS produced_by_name
      FROM product_production pp
      JOIN product p ON p.id = pp.product_id
      LEFT JOIN users u ON u.id = pp.produced_by
      ${whereSQL}
      ORDER BY COALESCE(pp.produced_at, pp.planned_at) DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const rowsRes = await pool.query(rowsSql, [...params, limit, offset]);

    res.json({
      data: rowsRes.rows,
      totalPages,
      totalRecords,
    });
  } catch (err) {
    console.error("❌ Failed to fetch productions:", err);
    res.status(500).json({ error: "Failed to fetch productions" });
  }
});

router.get("/:id", requireTask("can_see_production"), async (req, res) => {
  const { id } = req.params;

  try {
    // 1️⃣ HEADER
    const hdrRes = await pool.query(
      `
      SELECT 
        pp.*, 
        p.name AS product_name, 
        u.name AS produced_by_name
      FROM product_production pp
      JOIN product p ON p.id = pp.product_id
      LEFT JOIN users u ON u.id = pp.produced_by
      WHERE pp.id = $1
    `,
      [id]
    );

    if (hdrRes.rows.length === 0) {
      return res.status(404).json({ error: "Production not found" });
    }

    // 2️⃣ INGREDIENTS
    const linesRes = await pool.query(
      `
      SELECT 
        ppi.id,
        ppi.item_id, 
        i.name AS item_name,
        ppi.qty_required,
        iu.shortname AS unit,
        ppi.group_id,
        pig.name AS group_name,
        ppi.combination_id,
        pigc.name AS combination_name,

        -- Actual FIFO cost of this ingredient for this production; see the
        -- batch-detail endpoint above for the reasoning.
        COALESCE(c.cost, 0) AS cost,
        c.avg_unit_cost,
        COALESCE(c.lot_count, 0) AS lot_count
      FROM product_production_item ppi
      JOIN item i ON i.id = ppi.item_id
      LEFT JOIN itemunit iu ON iu.id = i.unit_id
      LEFT JOIN product_item_group pig ON pig.id = ppi.group_id
      LEFT JOIN product_item_group_combination pigc ON pigc.id = ppi.combination_id
      LEFT JOIN (
        SELECT item_id,
               SUM(quantity * unit_price) AS cost,
               SUM(quantity * unit_price) / NULLIF(SUM(quantity), 0) AS avg_unit_cost,
               COUNT(DISTINCT unit_price) AS lot_count
        FROM item_ledger
        WHERE production_id = $1 AND type = 'OUT'
        GROUP BY item_id
      ) c ON c.item_id = ppi.item_id
      WHERE ppi.production_id = $1
      ORDER BY pig.name NULLS LAST, i.name
    `,
      [id]
    );

    // 3️⃣ GROUP CHOICES
    const groupChoicesRes = await pool.query(
      `
      SELECT 
        gc.id,
        gc.group_id,
        pig.name AS group_name,
        gc.combination_id,
        pigc.name AS combination_name,
        gc.chosen_by,
        s.name AS chosen_by_name,
        gc.notes,
        gc.created_at
      FROM product_production_group_choice gc
      JOIN product_item_group pig ON pig.id = gc.group_id
      JOIN product_item_group_combination pigc ON pigc.id = gc.combination_id
      LEFT JOIN staff s ON s.id = gc.chosen_by
      WHERE gc.production_id = $1
      ORDER BY pig.name
    `,
      [id]
    );

    // 4️⃣ STAFF
    const staffRes = await pool.query(
      `
      SELECT 
        s.id AS staff_id, 
        s.name AS staff_name, 
        ps.role, 
        ps.notes
      FROM product_production_staff ps
      JOIN staff s ON s.id = ps.staff_id
      WHERE ps.production_id = $1
      ORDER BY s.name
    `,
      [id]
    );

    // 5️⃣ DISCREPANCIES
    const discRes = await pool.query(
      `
      SELECT 
        d.id, 
        dr.name AS reason_name, 
        d.reason_id, 
        d.notes
      FROM product_production_discrepancy d
      JOIN discrepancy_reason dr ON dr.id = d.reason_id
      WHERE d.production_id = $1
      ORDER BY dr.name
    `,
      [id]
    );

    // Same roll-up as the batch endpoint, so the two agree for the same
    // production rather than each computing its own idea of the cost.
    const production = hdrRes.rows[0];
    const labour = (await labourForProductions(pool, [production.id])).get(production.id) || null;
    const labourCost = labour && labour.cost !== null ? Number(labour.cost) : null;
    const ingredientCost = linesRes.rows.reduce(
      (sum, line) => sum + (Number(line.cost) || 0),
      0
    );
    // Same basis as the batch endpoint: all output, not just good.
    const totalOutput =
      (Number(production.good_qty) || 0) +
      (Number(production.damaged_qty) || 0) +
      (Number(production.reject_qty) || 0);

    // ✅ RESPONSE
    res.json({
      production: {
        ...production,
        ingredient_cost: ingredientCost,
        ingredient_cost_per_unit: totalOutput > 0 ? ingredientCost / totalOutput : null,
        labour,
        labour_cost: labourCost,
        labour_cost_per_unit:
          labourCost !== null && totalOutput > 0 ? labourCost / totalOutput : null,
        total_cost: ingredientCost + (labourCost || 0),
        total_cost_per_unit:
          totalOutput > 0 ? (ingredientCost + (labourCost || 0)) / totalOutput : null,
        cost_complete: labourCost !== null,
      },
      items: linesRes.rows,
      group_choices: groupChoicesRes.rows,
      staff: staffRes.rows,
      discrepancies: discRes.rows,
    });
  } catch (err) {
    console.error("❌ Error fetching production:", err);
    res.status(500).json({ error: "Failed to fetch production details" });
  }
});

/** DELETE production */
router.delete(
  "/:id",
  requireTask("can_delete_production"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      await client.query("BEGIN");

      // Same safety rules as cancelling — see the batch delete above for why
      // removing a produced/consumed production corrupts the stock ledger.
      await assertProductionRemovable(client, Number(id), {
        verb: "deleted",
        allowCancelled: true,
      });

      // Remove ledger OUT movements for this production first
      await revertProductionOuts(client, id);

      await deleteProductLedgerByProduction(client, id);

      // Then remove detail tables and header (ON DELETE CASCADE may already handle some)
      await client.query(
        `DELETE FROM product_production_discrepancy WHERE production_id = $1`,
        [id]
      );
      await client.query(
        `DELETE FROM product_production_staff WHERE production_id = $1`,
        [id]
      );
      await client.query(
        `DELETE FROM product_production_group_choice WHERE production_id=$1`,
        [id]
      );
      await client.query(
        `DELETE FROM product_production_item WHERE production_id = $1`,
        [id]
      );

      const del = await client.query(
        `DELETE FROM product_production WHERE id = $1`,
        [id]
      );

      await client.query("COMMIT");
      if (del.rowCount === 0)
        return res.status(404).json({ error: "Not found" });
      res.json({ id, message: "Production deleted" });
    } catch (err) {
      await client.query("ROLLBACK");
      if (
        err.code === "ALREADY_PRODUCED" ||
        err.code === "OUTPUT_ALREADY_USED" ||
        err.code === "NOT_FOUND"
      ) {
        return res
          .status(400)
          .json({ error: err.code, message: err.message, details: err.meta });
      }
      console.error("Delete production failed", err);
      res.status(500).json({ error: "Failed to delete production" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
