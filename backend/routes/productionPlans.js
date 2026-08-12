// routes/productionPlans.js
//
// Sales-projection-driven production planning: given expected sales per
// delivery route for an upcoming day, work out how much of each product
// needs to be produced the day before, how many mixer batches that is,
// and how much flour each assigned staff member needs to pull. Mirrors
// the client's "PRODUCTION PLAN" spreadsheet.
//
// A "route" here is a (driver, outlet) pair — who's taking goods where —
// picked from the existing staff/outlet lists and scoped to one plan
// (which driver goes to which outlet can change day to day, so this
// isn't a separately-managed reusable list).
//
// Standalone from the Productions module by design — this only tells
// staff what to plan for; the real production batch is still created by
// hand in Productions.
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask } = require("../middleware/auth");

/** ---------------------------
 * Products with the two planning factors — a small, unpaginated list
 * (there are only ever a handful of bakery products), separate from the
 * main paginated /products endpoint so this doesn't disturb its shape.
 * --------------------------- */
router.get("/products", requireTask("can_see_production_plans"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, units_per_batch, flour_kg_per_batch
       FROM product
       ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Failed to fetch products for production plan:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

/** ---------------------------
 * GET /productionPlans — list saved plans in a date range
 * --------------------------- */
router.get("/", requireTask("can_see_production_plans"), async (req, res) => {
  const { start_date, end_date } = req.query;
  const where = [];
  const params = [];
  let i = 0;

  if (start_date) {
    params.push(start_date);
    i++;
    where.push(`sale_date >= $${i}`);
  }
  if (end_date) {
    params.push(end_date);
    i++;
    where.push(`sale_date <= $${i}`);
  }
  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
      SELECT
        pp.id,
        TO_CHAR(pp.sale_date, 'YYYY-MM-DD') AS sale_date,
        TO_CHAR(pp.production_date, 'YYYY-MM-DD') AS production_date,
        pp.notes,
        (SELECT COALESCE(SUM(quantity), 0) FROM production_plan_item WHERE plan_id = pp.id) AS total_units
      FROM production_plan pp
      ${whereSQL}
      ORDER BY pp.sale_date DESC
      `,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Failed to list production plans:", err);
    res.status(500).json({ error: "Failed to list production plans" });
  }
});

/** ---------------------------
 * GET /productionPlans/:saleDate — fetch one day's plan (empty scaffold
 * if it hasn't been saved yet, so the frontend can render the grid either
 * way).
 * --------------------------- */
router.get(
  "/:saleDate",
  requireTask("can_see_production_plans"),
  async (req, res) => {
    const { saleDate } = req.params;
    try {
      const planRes = await pool.query(
        `SELECT id, TO_CHAR(sale_date, 'YYYY-MM-DD') AS sale_date,
                TO_CHAR(production_date, 'YYYY-MM-DD') AS production_date, notes
         FROM production_plan WHERE sale_date = $1`,
        [saleDate]
      );

      if (!planRes.rows.length) {
        const defaultProductionDate = new Date(saleDate);
        defaultProductionDate.setDate(defaultProductionDate.getDate() - 1);
        return res.json({
          plan: {
            id: null,
            sale_date: saleDate,
            production_date: defaultProductionDate.toISOString().split("T")[0],
            notes: "",
          },
          routes: [],
          items: [],
          staffSplits: [],
        });
      }

      const plan = planRes.rows[0];
      const [routesRes, itemsRes, splitsRes] = await Promise.all([
        pool.query(
          `SELECT ppr.id, ppr.staff_id, s.name AS staff_name,
                  ppr.outlet_id, o.name AS outlet_name
           FROM production_plan_route ppr
           LEFT JOIN staff s ON s.id = ppr.staff_id
           LEFT JOIN outlet o ON o.id = ppr.outlet_id
           WHERE ppr.plan_id = $1
           ORDER BY ppr.sort_order, ppr.id`,
          [plan.id]
        ),
        pool.query(
          `SELECT product_id, route_id, quantity
           FROM production_plan_item WHERE plan_id = $1`,
          [plan.id]
        ),
        pool.query(
          `SELECT product_id, staff_id, batches
           FROM production_plan_staff_split WHERE plan_id = $1`,
          [plan.id]
        ),
      ]);

      res.json({
        plan,
        routes: routesRes.rows,
        items: itemsRes.rows,
        staffSplits: splitsRes.rows,
      });
    } catch (err) {
      console.error("❌ Failed to fetch production plan:", err);
      res.status(500).json({ error: "Failed to fetch production plan" });
    }
  }
);

/** ---------------------------
 * PUT /productionPlans/:saleDate — upsert a whole day's plan in one shot
 * (header + items + staff splits), same bulk-replace pattern used by
 * stock transfers: delete and re-insert the child rows rather than diff
 * them, since the whole grid is always submitted together.
 * --------------------------- */
router.put(
  "/:saleDate",
  requireTask("can_manage_production_plans"),
  async (req, res) => {
    const { saleDate } = req.params;
    const {
      production_date,
      notes,
      routes = [],
      items = [],
      staffSplits = [],
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const upsert = await client.query(
        `INSERT INTO production_plan (sale_date, production_date, notes, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sale_date) DO UPDATE
           SET production_date = EXCLUDED.production_date,
               notes = EXCLUDED.notes,
               updated_at = NOW()
         RETURNING id`,
        [saleDate, production_date || saleDate, notes || null, req.user?.id || null]
      );
      const planId = upsert.rows[0].id;

      // Routes and items are always replaced together: deleting the plan's
      // routes cascades to their items, so a single delete here covers both.
      await client.query(`DELETE FROM production_plan_route WHERE plan_id = $1`, [planId]);

      // A route is either a driver (staff_id) or a fixed outlet's own
      // sales staff (outlet_id) — not necessarily both. Map
      // "staffId|outletId" -> new route id, so items (identified the same
      // way by the frontend) can be attached to the right route. The
      // plan's routes were just wiped above, so there's nothing to
      // conflict with here — de-dupe defensively anyway in case the
      // frontend ever sends the same pair twice.
      const routeIdByKey = {};
      let sortOrder = 0;
      for (const r of routes) {
        if (!r.staff_id && !r.outlet_id) continue;
        const key = `${r.staff_id || ""}|${r.outlet_id || ""}`;
        if (routeIdByKey[key]) continue;
        const inserted = await client.query(
          `INSERT INTO production_plan_route (plan_id, staff_id, outlet_id, sort_order)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [planId, r.staff_id || null, r.outlet_id || null, sortOrder++]
        );
        routeIdByKey[key] = inserted.rows[0].id;
      }

      for (const it of items) {
        const routeId = routeIdByKey[`${it.staff_id || ""}|${it.outlet_id || ""}`];
        if (!it.product_id || !routeId || !Number(it.quantity)) continue;
        await client.query(
          `INSERT INTO production_plan_item (plan_id, product_id, route_id, quantity)
           VALUES ($1, $2, $3, $4)`,
          [planId, it.product_id, routeId, it.quantity]
        );
      }

      await client.query(
        `DELETE FROM production_plan_staff_split WHERE plan_id = $1`,
        [planId]
      );
      for (const s of staffSplits) {
        if (!s.product_id || !s.staff_id || !Number(s.batches)) continue;
        await client.query(
          `INSERT INTO production_plan_staff_split (plan_id, product_id, staff_id, batches)
           VALUES ($1, $2, $3, $4)`,
          [planId, s.product_id, s.staff_id, s.batches]
        );
      }

      await client.query("COMMIT");
      res.json({ id: planId, message: "Production plan saved" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Failed to save production plan:", err);
      res.status(500).json({ error: "Failed to save production plan" });
    } finally {
      client.release();
    }
  }
);

/** ---------------------------
 * DELETE /productionPlans/:saleDate
 * --------------------------- */
router.delete(
  "/:saleDate",
  requireTask("can_manage_production_plans"),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `DELETE FROM production_plan WHERE sale_date = $1 RETURNING id`,
        [req.params.saleDate]
      );
      if (!rows.length) return res.status(404).json({ error: "Plan not found" });
      res.json({ message: "Production plan deleted" });
    } catch (err) {
      console.error("❌ Failed to delete production plan:", err);
      res.status(500).json({ error: "Failed to delete production plan" });
    }
  }
);

module.exports = router;
