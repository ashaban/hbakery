/**
 * Delivery cost setup: the cost types, the delivery routes, the standing
 * costs of a shop, and who sells at each outlet.
 *
 * A route is not owned by a vehicle — whichever car is free runs it, and
 * which car actually did is recorded on the transfer.
 *
 * These are the definitions. What a particular delivery actually cost is
 * snapshotted onto the transfer itself — see modules/deliveryCost.js.
 */

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask } = require("../middleware/auth");
const { recordAudit } = require("../modules/auditLog");
const { sellingLabourForOutletDay } = require("../modules/deliveryCost");

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const fail = (res, err, msg) => {
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`❌ ${msg}:`, err);
  res.status(500).json({ error: msg });
};

const bad = (message) => Object.assign(new Error(message), { status: 400 });

// ── Cost types ───────────────────────────────────────────────────────

router.get("/cost-types", requireTask("can_see_stock_transfers"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, is_active FROM delivery_cost_type
        WHERE ($1 = 'true' OR is_active) ORDER BY name`,
      [String(req.query.include_inactive || "false")]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err, "Failed to fetch cost types");
  }
});

router.post("/cost-types", requireTask("can_manage_delivery_costs"), async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) throw bad("A name is required");
    const { rows } = await pool.query(
      // A type the user retired then re-adds should come back rather than
      // collide with the unique name.
      `INSERT INTO delivery_cost_type (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id, name, is_active`,
      [name]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    fail(res, err, "Failed to create cost type");
  }
});

router.put("/cost-types/:id", requireTask("can_manage_delivery_costs"), async (req, res) => {
  try {
    const { name, is_active } = req.body || {};
    const { rows } = await pool.query(
      `UPDATE delivery_cost_type
          SET name = COALESCE(NULLIF(TRIM($1), ''), name),
              is_active = COALESCE($2, is_active)
        WHERE id = $3 RETURNING id, name, is_active`,
      [name ?? null, is_active ?? null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Cost type not found" });
    res.json({ data: rows[0] });
  } catch (err) {
    fail(res, err, "Failed to update cost type");
  }
});

// ── Delivery routes ──────────────────────────────────────────────────

const ROUTE_SELECT = `
  SELECT r.id, r.name, r.notes, r.is_active,
         COALESCE((
           SELECT json_agg(json_build_object(
             'cost_type_id', rc.cost_type_id, 'name', t.name, 'amount', rc.amount)
             ORDER BY t.name)
             FROM delivery_route_cost rc
             JOIN delivery_cost_type t ON t.id = rc.cost_type_id
            WHERE rc.route_id = r.id
         ), '[]') AS costs,
         COALESCE((
           SELECT SUM(rc.amount) FROM delivery_route_cost rc WHERE rc.route_id = r.id
         ), 0) AS total_cost,
         (SELECT COUNT(*) FROM stock_transfer st WHERE st.route_id = r.id) AS transfer_count
    FROM delivery_route r`;

router.get("/routes", requireTask("can_see_stock_transfers"), async (req, res) => {
  try {
    const where = [];
    if (String(req.query.include_inactive || "false") !== "true") {
      where.push("r.is_active");
    }
    const { rows } = await pool.query(
      `${ROUTE_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY r.name`
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err, "Failed to fetch routes");
  }
});

/** Replaces a route's cost lines wholesale — simpler than diffing, and the
 *  set is small. Zero and blank amounts are dropped rather than stored. */
async function setRouteCosts(client, routeId, costs) {
  await client.query(`DELETE FROM delivery_route_cost WHERE route_id = $1`, [routeId]);
  for (const c of costs || []) {
    const amount = Number(c.amount);
    if (!c.cost_type_id || !(amount > 0)) continue;
    await client.query(
      `INSERT INTO delivery_route_cost (route_id, cost_type_id, amount)
       VALUES ($1,$2,$3)
       ON CONFLICT (route_id, cost_type_id) DO UPDATE SET amount = EXCLUDED.amount`,
      [routeId, c.cost_type_id, amount]
    );
  }
}

router.post("/routes", requireTask("can_manage_delivery_costs"), async (req, res) => {
  try {
    const { name, notes, costs = [] } = req.body || {};
    if (!String(name || "").trim()) throw bad("A route name is required");
    const route = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO delivery_route (name, notes, created_by)
         VALUES ($1,$2,$3) RETURNING id`,
        [String(name).trim(), notes || null, req.user?.id || null]
      );
      await setRouteCosts(client, rows[0].id, costs);
      await recordAudit(client, {
        user: req.user,
        action: "ROUTE_CREATE",
        entity_type: "delivery_route",
        entity_id: rows[0].id,
        description: `Created route ${name}`,
      });
      const out = await client.query(`${ROUTE_SELECT} WHERE r.id = $1`, [rows[0].id]);
      return out.rows[0];
    });
    res.status(201).json({ data: route });
  } catch (err) {
    fail(res, err, "Failed to create route");
  }
});

router.put("/routes/:id", requireTask("can_manage_delivery_costs"), async (req, res) => {
  try {
    const { name, notes, is_active, costs } = req.body || {};
    const route = await withTransaction(async (client) => {
      const { rowCount } = await client.query(
        `UPDATE delivery_route
            SET name = COALESCE(NULLIF(TRIM($1), ''), name),
                notes = $2,
                is_active = COALESCE($3, is_active)
          WHERE id = $4`,
        [name ?? null, notes ?? null, is_active ?? null, req.params.id]
      );
      if (!rowCount) throw Object.assign(new Error("Route not found"), { status: 404 });
      if (Array.isArray(costs)) await setRouteCosts(client, req.params.id, costs);
      const out = await client.query(`${ROUTE_SELECT} WHERE r.id = $1`, [req.params.id]);
      return out.rows[0];
    });
    res.json({ data: route });
  } catch (err) {
    fail(res, err, "Failed to update route");
  }
});

router.delete("/routes/:id", requireTask("can_manage_delivery_costs"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM stock_transfer WHERE route_id = $1`,
      [req.params.id]
    );
    // Deleting would orphan the deliveries that were costed with it.
    if (rows[0].n > 0) {
      return res.status(409).json({
        error: `This route is on ${rows[0].n} transfer(s). Deactivate it instead so past deliveries keep their costs.`,
      });
    }
    await pool.query(`DELETE FROM delivery_route WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    fail(res, err, "Failed to delete route");
  }
});

// ── Standing costs on a shop ─────────────────────────────────────────

router.get("/outlets/:id/costs", requireTask("can_see_stock_transfers"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT oc.cost_type_id, t.name, oc.amount
         FROM outlet_cost oc JOIN delivery_cost_type t ON t.id = oc.cost_type_id
        WHERE oc.outlet_id = $1 ORDER BY t.name`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err, "Failed to fetch outlet costs");
  }
});

router.put("/outlets/:id/costs", requireTask("can_manage_delivery_costs"), async (req, res) => {
  try {
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM outlet_cost WHERE outlet_id = $1`, [req.params.id]);
      for (const c of req.body?.costs || []) {
        const amount = Number(c.amount);
        if (!c.cost_type_id || !(amount > 0)) continue;
        await client.query(
          `INSERT INTO outlet_cost (outlet_id, cost_type_id, amount) VALUES ($1,$2,$3)
           ON CONFLICT (outlet_id, cost_type_id) DO UPDATE SET amount = EXCLUDED.amount`,
          [req.params.id, c.cost_type_id, amount]
        );
      }
    });
    res.json({ success: true });
  } catch (err) {
    fail(res, err, "Failed to save outlet costs");
  }
});

// ── Who sells at an outlet ───────────────────────────────────────────

router.get("/outlets/:id/staff", requireTask("can_see_stock_transfers"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.staff_id, s.name, s.position, s.daily_salary, a.role, a.is_active
         FROM outlet_staff_assignment a JOIN staff s ON s.id = a.staff_id
        WHERE a.outlet_id = $1 ORDER BY s.name`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err, "Failed to fetch outlet staff");
  }
});

router.put("/outlets/:id/staff", requireTask("can_manage_delivery_costs"), async (req, res) => {
  try {
    await withTransaction(async (client) => {
      await client.query(
        `DELETE FROM outlet_staff_assignment WHERE outlet_id = $1`,
        [req.params.id]
      );
      for (const s of req.body?.staff || []) {
        if (!s.staff_id) continue;
        await client.query(
          `INSERT INTO outlet_staff_assignment (outlet_id, staff_id, role)
           VALUES ($1,$2,$3)
           ON CONFLICT (outlet_id, staff_id) DO UPDATE SET role = EXCLUDED.role, is_active = TRUE`,
          [req.params.id, s.staff_id, s.role || null]
        );
      }
    });
    res.json({ success: true });
  } catch (err) {
    fail(res, err, "Failed to save outlet staff");
  }
});

// ── What selling cost, per outlet per day ────────────────────────────

/**
 * Selling labour for a day across every outlet.
 *
 * Reported per outlet-day rather than per sale: a seller is paid for the
 * day whatever they shift, so the day is the unit the cost belongs to.
 */
router.get("/selling-labour", requireTask("can_see_sales_report"), async (req, res) => {
  try {
    const date = req.query.date;
    if (!date) throw bad("A date is required");

    const { rows: outlets } = await pool.query(
      `SELECT id FROM outlet WHERE is_active
        AND ($1::int IS NULL OR id = $1)
        ORDER BY name`,
      [req.query.outlet_id ? Number(req.query.outlet_id) : null]
    );

    const data = [];
    for (const o of outlets) {
      const row = await sellingLabourForOutletDay(pool, o.id, date);
      // Outlets that neither sold nor cost anything that day are noise on a
      // daily view; leave them out rather than pad the table.
      if (row && (row.units_sold > 0 || row.pool > 0)) data.push(row);
    }

    res.json({
      date,
      data,
      totals: {
        pool: data.reduce((s, r) => s + Number(r.pool || 0), 0),
        units_sold: data.reduce((s, r) => s + Number(r.units_sold || 0), 0),
      },
    });
  } catch (err) {
    fail(res, err, "Failed to fetch selling labour");
  }
});

module.exports = router;
