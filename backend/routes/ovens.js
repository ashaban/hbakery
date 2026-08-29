/**
 * Ovens, fuel prices, and how long each product needs in each oven.
 *
 * These are the definitions. What a particular bake actually cost is
 * snapshotted onto the production — see modules/bakingCost.js.
 */

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask } = require("../middleware/auth");
const { quoteBake, OVEN_SELECT } = require("../modules/bakingCost");

const fail = (res, err, msg) => {
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`❌ ${msg}:`, err);
  res.status(500).json({ error: msg });
};
const bad = (m) => Object.assign(new Error(m), { status: 400 });

// ── Fuel prices ──────────────────────────────────────────────────────

router.get("/fuels", requireTask("can_see_production"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, price_per_litre, is_active, updated_at
         FROM fuel_type ORDER BY name`
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err, "Failed to fetch fuel prices");
  }
});

router.post("/fuels", requireTask("can_manage_ovens"), async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) throw bad("A name is required");
    const { rows } = await pool.query(
      `INSERT INTO fuel_type (name, price_per_litre) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE
         SET price_per_litre = EXCLUDED.price_per_litre, is_active = TRUE,
             updated_at = NOW()
       RETURNING *`,
      [name, Number(req.body?.price_per_litre) || 0]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    fail(res, err, "Failed to save fuel");
  }
});

router.put("/fuels/:id", requireTask("can_manage_ovens"), async (req, res) => {
  try {
    const price = Number(req.body?.price_per_litre);
    if (!(price >= 0)) throw bad("A price per litre is required");
    const { rows } = await pool.query(
      `UPDATE fuel_type
          SET price_per_litre = $1,
              name = COALESCE(NULLIF(TRIM($2), ''), name),
              is_active = COALESCE($3, is_active),
              updated_at = NOW()
        WHERE id = $4 RETURNING *`,
      [price, req.body?.name ?? null, req.body?.is_active ?? null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Fuel not found" });
    res.json({ data: rows[0] });
  } catch (err) {
    fail(res, err, "Failed to update fuel price");
  }
});

// ── Which ovens a product can use ────────────────────────────────────

router.get("/products/:id", requireTask("can_see_production"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT po.oven_id, o.name AS oven_name, o.kind, po.bake_minutes,
              po.units_per_load, po.is_default
         FROM product_oven po JOIN oven o ON o.id = po.oven_id
        WHERE po.product_id = $1
        ORDER BY po.is_default DESC, o.name`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err, "Failed to fetch product ovens");
  }
});

router.put("/products/:id", requireTask("can_manage_ovens"), async (req, res) => {
  const client = await pool.connect();
  try {
    const list = Array.isArray(req.body?.ovens) ? req.body.ovens : [];
    const defaults = list.filter((o) => o.is_default).length;
    // More than one default would make "which oven does this use" ambiguous
    // at exactly the moment the production form needs an answer.
    if (defaults > 1) throw bad("Only one oven can be the default");

    await client.query("BEGIN");
    await client.query(`DELETE FROM product_oven WHERE product_id = $1`, [req.params.id]);
    for (const o of list) {
      if (!o.oven_id || !(Number(o.bake_minutes) > 0) || !(Number(o.units_per_load) > 0)) {
        continue;
      }
      await client.query(
        `INSERT INTO product_oven (product_id, oven_id, bake_minutes, units_per_load, is_default)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, o.oven_id, Number(o.bake_minutes), Number(o.units_per_load), !!o.is_default]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    fail(res, err, "Failed to save product ovens");
  } finally {
    client.release();
  }
});

// ── Ovens ────────────────────────────────────────────────────────────

router.get("/", requireTask("can_see_production"), async (req, res) => {
  try {
    const showAll = String(req.query.include_inactive || "false") === "true";
    const { rows } = await pool.query(
      `${OVEN_SELECT} ${showAll ? "" : "WHERE o.is_active"} ORDER BY o.name`
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err, "Failed to fetch ovens");
  }
});

/** Rejects a rate that does not match the oven's kind, before the database
 *  check constraint does — so the message names the missing field. */
function validateOven(b) {
  if (!String(b?.name || "").trim()) return "A name is required";
  if (!["FUEL", "ELECTRIC"].includes(b?.kind)) return "Pick fuel or electric";
  if (!(Number(b?.burn_minutes) > 0)) return "How many minutes does that burn last?";
  if (b.kind === "FUEL") {
    if (!(Number(b?.litres_per_period) > 0)) return "How many litres burn in that time?";
    if (!b?.fuel_type_id) return "Which fuel does this oven use?";
  } else if (!(Number(b?.cost_per_period) > 0)) {
    return "How many shillings of units burn in that time?";
  }
  return null;
}

router.post("/", requireTask("can_manage_ovens"), async (req, res) => {
  try {
    const problem = validateOven(req.body);
    if (problem) throw bad(problem);
    const b = req.body;
    const isFuel = b.kind === "FUEL";
    const { rows } = await pool.query(
      `INSERT INTO oven (name, kind, burn_minutes, litres_per_period,
                         fuel_type_id, cost_per_period, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        String(b.name).trim(), b.kind, Number(b.burn_minutes),
        isFuel ? Number(b.litres_per_period) : null,
        isFuel ? b.fuel_type_id : null,
        isFuel ? null : Number(b.cost_per_period),
        b.notes || null, req.user?.id || null,
      ]
    );
    const out = await pool.query(`${OVEN_SELECT} WHERE o.id = $1`, [rows[0].id]);
    res.status(201).json({ data: out.rows[0] });
  } catch (err) {
    fail(res, err, "Failed to create oven");
  }
});

router.put("/:id", requireTask("can_manage_ovens"), async (req, res) => {
  try {
    const problem = validateOven(req.body);
    if (problem) throw bad(problem);
    const b = req.body;
    const isFuel = b.kind === "FUEL";
    const { rowCount } = await pool.query(
      `UPDATE oven
          SET name = $1, kind = $2, burn_minutes = $3, litres_per_period = $4,
              fuel_type_id = $5, cost_per_period = $6, notes = $7,
              is_active = COALESCE($8, is_active)
        WHERE id = $9`,
      [
        String(b.name).trim(), b.kind, Number(b.burn_minutes),
        isFuel ? Number(b.litres_per_period) : null,
        isFuel ? b.fuel_type_id : null,
        isFuel ? null : Number(b.cost_per_period),
        b.notes || null, b.is_active ?? null, req.params.id,
      ]
    );
    if (!rowCount) return res.status(404).json({ error: "Oven not found" });
    const out = await pool.query(`${OVEN_SELECT} WHERE o.id = $1`, [req.params.id]);
    res.json({ data: out.rows[0] });
  } catch (err) {
    fail(res, err, "Failed to update oven");
  }
});

router.delete("/:id", requireTask("can_manage_ovens"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM product_production WHERE oven_id = $1`,
      [req.params.id]
    );
    // Deleting would orphan the productions costed with it.
    if (rows[0].n > 0) {
      return res.status(409).json({
        error: `This oven is on ${rows[0].n} production(s). Deactivate it instead so past bakes keep their costs.`,
      });
    }
    await pool.query(`DELETE FROM oven WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    fail(res, err, "Failed to delete oven");
  }
});

// ── What a bake would cost ───────────────────────────────────────────

/** What the production form asks as the user picks product, oven, quantity. */
router.get("/quote", requireTask("can_see_production"), async (req, res) => {
  try {
    res.json({
      data: await quoteBake(pool, {
        product_id: Number(req.query.product_id) || null,
        oven_id: Number(req.query.oven_id) || null,
        quantity: Number(req.query.quantity) || 0,
      }),
    });
  } catch (err) {
    fail(res, err, "Failed to price this bake");
  }
});

module.exports = router;
