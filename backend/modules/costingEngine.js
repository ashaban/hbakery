/**
 * What a sold unit cost.
 *
 * One entry point, so the sales report, a per-product view and a per-outlet
 * view all give the same answer. Three screens each computing their own
 * costs disagree within a month, and the one that disagrees quietly is the
 * one people keep using.
 *
 * ── What is counted ──────────────────────────────────────────────────
 *
 *   INGREDIENTS   the FIFO lot prices the production actually drew down
 *   PRODUCTION    the shift crew's day, or the per-quantity piece rate
 *   BAKING        the oven's fuel or electricity for the loads it ran
 *   DELIVERY      the transfer's costs, split across the units it carried
 *   SELLING       the driver's or shopkeeper's day at that outlet
 *
 * Water and general electricity are NOT here — they remain one undistributed
 * pool, so every figure this returns is a margin BEFORE overheads and callers
 * must say so. Oven fuel and oven electricity ARE here: they are measured per
 * bake rather than pooled, so they belong to the product that burned them.
 *
 * ── Give-outs ────────────────────────────────────────────────────────
 *
 * A give-out is a sale at a price of zero. It consumed ingredients, labour
 * and a delivery like anything else, so it carries the same costs and shows
 * as a total loss. Nothing about it is special-cased beyond the price.
 *
 * ── How a sold unit finds its delivery ───────────────────────────────
 *
 * Stock is already allocated FIFO — that is how every sale row got its
 * production batch. Delivery follows the same rule one level deeper: within
 * a batch, the earliest arrival at that outlet is consumed first, so a unit
 * carries the cost of the delivery that actually brought it. Reconstructed
 * at query time rather than stored, so history and new sales use one code
 * path and no backfill is needed.
 *
 * ── The standing rule ────────────────────────────────────────────────
 *
 * A figure that cannot be worked out honestly comes back as null with a
 * reason. Never zero: a zero reads as "this was free", which is how a margin
 * ends up overstated and believed.
 */

const { labourForProductions } = require("./productionLabour");

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => Number(v) || 0;

// ── Production cost per unit of a batch ──────────────────────────────

/**
 * Ingredients + labour per unit produced, for each production.
 *
 * Divided by ALL output — good, damaged and reject alike — because damaged
 * and reject units are still sold here, so they carry their share.
 */
async function productionUnitCosts(client, productionIds) {
  const ids = [...new Set(productionIds.map(Number))].filter(Boolean);
  const out = new Map();
  if (!ids.length) return out;

  const { rows } = await client.query(
    `SELECT pp.id,
            (COALESCE(pp.good_qty,0) + COALESCE(pp.damaged_qty,0)
             + COALESCE(pp.reject_qty,0)) AS output_units,
            COALESCE((
              SELECT SUM(il.quantity * il.unit_price)
                FROM item_ledger il
               WHERE il.production_id = pp.id AND il.type = 'OUT'
            ), 0) AS ingredient_cost,
            pp.bake_cost,
            pp.oven_id
       FROM product_production pp
      WHERE pp.id = ANY($1::int[])`,
    [ids]
  );

  const labour = await labourForProductions(client, ids);

  for (const r of rows) {
    const units = num(r.output_units);
    const ingredients = num(r.ingredient_cost);
    const lab = labour.get(r.id) || null;

    out.set(r.id, {
      output_units: units,
      ingredient_total: round2(ingredients),
      labour_total: lab && lab.cost !== null ? round2(lab.cost) : null,
      labour_basis: lab ? lab.basis : null,
      bake_total: r.bake_cost === null ? null : round2(num(r.bake_cost)),
      ingredient_per_unit: units > 0 ? ingredients / units : null,
      labour_per_unit:
        units > 0 && lab && lab.cost !== null ? lab.cost / units : null,
      bake_per_unit:
        units > 0 && r.bake_cost !== null ? num(r.bake_cost) / units : null,
      // Kept apart so a caller can tell "no output" from "no crew".
      ingredient_reason: units > 0 ? null : "This production recorded no output",
      labour_reason:
        units === 0
          ? "This production recorded no output"
          : lab && lab.cost === null
            ? lab.unavailable_reason
            : null,
      bake_reason:
        units === 0
          ? "This production recorded no output"
          : r.bake_cost === null
            ? r.oven_id
              ? "The oven's running cost could not be worked out for this bake"
              : "No oven recorded for this production"
            : null,
    });
  }
  return out;
}

// ── Delivery, matched FIFO to the transfer that carried it ───────────

/**
 * Per-unit delivery cost for each consumption row.
 *
 * Builds, for every (outlet, product, quality, batch), the timeline of
 * arrivals and the timeline of what left, then walks them together oldest
 * first. Whatever a consumption row draws from an arrival takes that
 * transfer's per-unit rate.
 *
 * Returns Map ledgerRowId -> { per_unit, transfer_id, reason }.
 */
async function deliveryPerUnit(client, consumptionRows) {
  const out = new Map();
  if (!consumptionRows.length) return out;

  const keyOf = (r) =>
    `${r.outlet_id}|${r.product_id}|${r.quality}|${r.production_id}`;
  const keys = [...new Set(consumptionRows.map(keyOf))];

  // Arrivals for exactly the lots we need.
  const { rows: arrivals } = await client.query(
    `SELECT pl.id, pl.outlet_id, pl.product_id, pl.quality, pl.production_id,
            pl.transfer_id, pl.quantity, pl.movement_date, pl.movement_at,
            tc.total AS transfer_cost,
            COALESCE(tc.lines, 0) AS transfer_cost_lines,
            COALESCE(ti.units, 0) AS transfer_units
       FROM product_ledger pl
       LEFT JOIN (
         SELECT transfer_id, SUM(amount) AS total, COUNT(*)::int AS lines
           FROM stock_transfer_cost GROUP BY transfer_id
       ) tc ON tc.transfer_id = pl.transfer_id
       LEFT JOIN (
         SELECT transfer_id, SUM(quantity) AS units
           FROM stock_transfer_item GROUP BY transfer_id
       ) ti ON ti.transfer_id = pl.transfer_id
      WHERE pl.movement_type = 'TRANSFER_IN'
      ORDER BY pl.movement_date, pl.movement_at NULLS FIRST, pl.id`
  );

  // Bucket arrivals by lot, keeping FIFO order.
  const byLot = new Map();
  for (const a of arrivals) {
    const k = `${a.outlet_id}|${a.product_id}|${a.quality}|${a.production_id}`;
    if (!keys.includes(k)) continue;
    if (!byLot.has(k)) byLot.set(k, []);
    byLot.get(k).push({
      remaining: num(a.quantity),
      transfer_id: a.transfer_id,
      // No cost lines means the delivery's costs were never recorded, not
      // that it was free. Only a transfer that HAS lines can report a rate.
      per_unit:
        num(a.transfer_cost_lines) > 0 && num(a.transfer_units) > 0
          ? num(a.transfer_cost) / num(a.transfer_units)
          : null,
    });
  }

  // Every consumption from these lots, in the same FIFO order — including
  // rows outside the reporting window, because stock sold last week already
  // used up the earliest arrivals.
  const { rows: draws } = await client.query(
    `SELECT id, outlet_id, product_id, quality, production_id, quantity
       FROM product_ledger
      WHERE movement_type IN ('SALE', 'OUT')
      ORDER BY movement_date, movement_at NULLS FIRST, id`
  );

  const wanted = new Set(consumptionRows.map((r) => r.id));

  // Where each batch was made, so stock sold at its own outlet is not
  // reported as having an unknown delivery cost.
  const { rows: origins } = await client.query(
    `SELECT DISTINCT production_id, outlet_id
       FROM product_ledger
      WHERE movement_type = 'IN' AND production_id = ANY($1::int[])`,
    [[...new Set(consumptionRows.map((r) => r.production_id))].filter(Boolean)]
  );
  const producedAt = new Map(origins.map((o) => [o.production_id, o.outlet_id]));

  for (const d of draws) {
    const k = `${d.outlet_id}|${d.product_id}|${d.quality}|${d.production_id}`;
    const lots = byLot.get(k);
    if (!lots) {
      if (wanted.has(d.id)) {
        // Produced and sold at the same outlet: it never travelled, so the
        // delivery cost really is nil rather than unknown.
        const madeHere = producedAt.get(d.production_id) === d.outlet_id;
        out.set(d.id, {
          per_unit: madeHere ? 0 : null,
          transfer_id: null,
          reason: madeHere
            ? null
            : "No delivery of this stock could be matched",
        });
      }
      continue;
    }

    // A negative quantity is a reversal (a cancelled sale putting stock
    // back); hand it to the front of the queue rather than consuming more.
    let need = num(d.quantity);
    if (need <= 0) continue;

    let cost = 0;
    let taken = 0;
    let firstTransfer = null;
    let sawUnpriced = false;

    for (const lot of lots) {
      if (need <= 0) break;
      if (lot.remaining <= 0) continue;
      const take = Math.min(lot.remaining, need);
      lot.remaining -= take;
      need -= take;
      taken += take;
      if (firstTransfer === null) firstTransfer = lot.transfer_id;
      if (lot.per_unit === null) sawUnpriced = true;
      else cost += take * lot.per_unit;
    }

    if (!wanted.has(d.id)) continue;

    out.set(d.id, {
      per_unit: taken > 0 && !sawUnpriced ? cost / taken : null,
      transfer_id: firstTransfer,
      reason:
        taken === 0
          ? "No delivery of this stock could be matched"
          : sawUnpriced
            ? "The delivery that brought this stock has no costs recorded"
            : null,
    });
  }

  // Anything the walk never reached at all.
  for (const r of consumptionRows) {
    if (!out.has(r.id)) {
      const madeHere = producedAt.get(r.production_id) === r.outlet_id;
      out.set(r.id, {
        per_unit: madeHere ? 0 : null,
        transfer_id: null,
        reason: madeHere ? null : "No delivery of this stock could be matched",
      });
    }
  }
  return out;
}

// ── Selling labour, per outlet-day ───────────────────────────────────

async function sellingPerUnit(client, outletDays) {
  const out = new Map();
  if (!outletDays.length) return out;

  const { rows } = await client.query(
    `WITH wanted AS (
       SELECT * FROM unnest($1::int[], $2::date[]) AS t(outlet_id, day)
     ),
     crew AS (
       SELECT w.outlet_id, w.day,
              SUM(s.daily_salary) AS pool,
              COUNT(*)::int AS people,
              COUNT(*) FILTER (WHERE s.daily_salary IS NULL)::int AS unrated
         FROM wanted w
         JOIN outlet o ON o.id = w.outlet_id
         LEFT JOIN LATERAL (
           SELECT st.staff_id FROM outlet_staff_assignment st
            WHERE st.outlet_id = w.outlet_id AND st.is_active AND o.type <> 'CAR'
           UNION
           SELECT t.driver_staff_id FROM stock_transfer t
            WHERE t.to_outlet_id = w.outlet_id AND t.transfer_date = w.day
              AND t.driver_staff_id IS NOT NULL AND o.type = 'CAR'
         ) m ON TRUE
         JOIN staff s ON s.id = m.staff_id AND s.status = 'Active'
        GROUP BY w.outlet_id, w.day
     ),
     sold AS (
       SELECT w.outlet_id, w.day, COALESCE(SUM(pl.quantity), 0) AS units
         FROM wanted w
         LEFT JOIN product_ledger pl
           ON pl.outlet_id = w.outlet_id
          AND pl.movement_date = w.day
          AND pl.movement_type IN ('SALE', 'OUT')
        GROUP BY w.outlet_id, w.day
     )
     SELECT w.outlet_id, w.day::text AS day, o.type AS outlet_type,
            COALESCE(c.pool, 0) AS pool, COALESCE(c.people, 0) AS people,
            COALESCE(c.unrated, 0) AS unrated, COALESCE(sd.units, 0) AS units
       FROM wanted w
       JOIN outlet o ON o.id = w.outlet_id
       LEFT JOIN crew c ON c.outlet_id = w.outlet_id AND c.day = w.day
       LEFT JOIN sold sd ON sd.outlet_id = w.outlet_id AND sd.day = w.day`,
    [outletDays.map((x) => x.outlet_id), outletDays.map((x) => x.day)]
  );

  for (const r of rows) {
    const people = num(r.people);
    const units = num(r.units);
    const reason = !people
      ? r.outlet_type === "CAR"
        ? "No driver recorded on this day's deliveries to this vehicle"
        : "No staff assigned to this outlet"
      : num(r.unrated) === people
        ? "No daily rate set for the staff selling here"
        : units === 0
          ? "Nothing was sold here on this day"
          : null;

    out.set(`${r.outlet_id}|${r.day}`, {
      per_unit: reason ? null : num(r.pool) / units,
      pool: round2(num(r.pool)),
      reason,
    });
  }
  return out;
}

// ── The engine ───────────────────────────────────────────────────────

/**
 * Cost and margin for everything sold (or given out) in a period.
 *
 * One row per ledger movement, because that is the level at which a unit
 * knows its batch. Layers are returned separately and never pre-summed: a
 * caller wanting a total adds them, but a caller explaining a thin margin
 * needs the parts.
 */
async function costOfSoldUnits(client, { from, to, outlet_id, product_id } = {}) {
  if (!from || !to) throw new Error("A from and to date are required");

  const { rows: moves } = await client.query(
    `SELECT pl.id, pl.movement_type, pl.movement_date::text AS date,
            pl.outlet_id, o.name AS outlet_name, o.type AS outlet_type,
            pl.product_id, p.name AS product_name, p.unit AS product_unit,
            pl.quality, pl.quantity, pl.production_id, pl.sale_id,
            pl.product_out_id,
            -- Give-outs have no price; a sale falls back to its own line
            -- when the ledger row did not capture one.
            COALESCE(pl.unit_price, si.unit_price, 0) AS unit_price
       FROM product_ledger pl
       JOIN product p ON p.id = pl.product_id
       JOIN outlet o ON o.id = pl.outlet_id
       LEFT JOIN LATERAL (
         SELECT si.unit_price FROM sale_item si
          WHERE si.sale_id = pl.sale_id AND si.product_id = pl.product_id
          LIMIT 1
       ) si ON pl.movement_type = 'SALE'
      WHERE pl.movement_type IN ('SALE', 'OUT')
        AND pl.movement_date BETWEEN $1::date AND $2::date
        AND pl.quantity > 0
        AND ($3::int IS NULL OR pl.outlet_id = $3)
        AND ($4::int IS NULL OR pl.product_id = $4)
      ORDER BY pl.movement_date, pl.id`,
    [from, to, outlet_id || null, product_id || null]
  );

  if (!moves.length) {
    return { from, to, rows: [], totals: emptyTotals(), gaps: [] };
  }

  const [prod, delivery, selling] = await Promise.all([
    productionUnitCosts(client, moves.map((m) => m.production_id)),
    deliveryPerUnit(client, moves),
    sellingPerUnit(
      client,
      [...new Set(moves.map((m) => `${m.outlet_id}|${m.date}`))].map((k) => {
        const [o, d] = k.split("|");
        return { outlet_id: Number(o), day: d };
      })
    ),
  ]);

  const rows = moves.map((m) => {
    const qty = num(m.quantity);
    const pc = prod.get(m.production_id) || null;
    const dl = delivery.get(m.id) || null;
    const sl = selling.get(`${m.outlet_id}|${m.date}`) || null;

    const ingredients = pc?.ingredient_per_unit != null ? round2(pc.ingredient_per_unit * qty) : null;
    const labour = pc?.labour_per_unit != null ? round2(pc.labour_per_unit * qty) : null;
    const baking = pc?.bake_per_unit != null ? round2(pc.bake_per_unit * qty) : null;
    const deliver = dl?.per_unit != null ? round2(dl.per_unit * qty) : null;
    const sell = sl?.per_unit != null ? round2(sl.per_unit * qty) : null;

    const parts = [ingredients, labour, baking, deliver, sell];
    const known = parts.filter((x) => x !== null);
    const total = known.length ? round2(known.reduce((a, b) => a + b, 0)) : null;
    const revenue = round2(qty * num(m.unit_price));

    const reasons = [
      pc?.ingredient_reason && `Ingredients: ${pc.ingredient_reason}`,
      pc?.labour_reason && `Production labour: ${pc.labour_reason}`,
      pc?.bake_reason && `Baking: ${pc.bake_reason}`,
      dl?.reason && `Delivery: ${dl.reason}`,
      sl?.reason && `Selling: ${sl.reason}`,
    ].filter(Boolean);

    return {
      ledger_id: m.id,
      kind: m.movement_type === "OUT" ? "GIVE_OUT" : "SALE",
      date: m.date,
      outlet_id: m.outlet_id,
      outlet_name: m.outlet_name,
      product_id: m.product_id,
      product_name: m.product_name,
      quality: m.quality,
      quantity: qty,
      unit_price: num(m.unit_price),
      revenue,
      cost_ingredients: ingredients,
      cost_production_labour: labour,
      cost_baking: baking,
      cost_delivery: deliver,
      cost_selling: sell,
      cost_total: total,
      // Only a margin with every layer known is a real margin; a partial one
      // would flatter whatever happens to be missing.
      margin: total !== null && reasons.length === 0 ? round2(revenue - total) : null,
      complete: reasons.length === 0,
      production_id: m.production_id,
      transfer_id: dl?.transfer_id ?? null,
      sale_id: m.sale_id,
      product_out_id: m.product_out_id,
      unavailable_reasons: reasons,
    };
  });

  return {
    from,
    to,
    rows,
    totals: summarise(rows),
    // Grouped so a screen can say "23 lines have no delivery cost because…"
    // rather than repeating the same sentence on every row.
    gaps: groupGaps(rows),
    // Stated on every response so no caller can present this as a full
    // margin by omission.
    excludes: "Water and general electricity are not allocated. Oven fuel and oven electricity are included. These are margins before overheads.",
  };
}

const emptyTotals = () => ({
  units: 0, revenue: 0, ingredients: 0, production_labour: 0, baking: 0,
  delivery: 0, selling: 0, cost: 0, margin: 0,
  complete_lines: 0, incomplete_lines: 0,
});

function summarise(rows) {
  const t = emptyTotals();
  for (const r of rows) {
    t.units += r.quantity;
    t.revenue += r.revenue;
    t.ingredients += num(r.cost_ingredients);
    t.production_labour += num(r.cost_production_labour);
    t.baking += num(r.cost_baking);
    t.delivery += num(r.cost_delivery);
    t.selling += num(r.cost_selling);
    t.cost += num(r.cost_total);
    if (r.complete) { t.complete_lines += 1; t.margin += num(r.margin); }
    else t.incomplete_lines += 1;
  }
  for (const k of ["revenue", "ingredients", "production_labour", "baking", "delivery", "selling", "cost", "margin"]) {
    t[k] = round2(t[k]);
  }
  return t;
}

function groupGaps(rows) {
  const counts = new Map();
  for (const r of rows) {
    for (const reason of r.unavailable_reasons) {
      counts.set(reason, (counts.get(reason) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, lines]) => ({ reason, lines }))
    .sort((a, b) => b.lines - a.lines);
}

module.exports = { costOfSoldUnits, productionUnitCosts };
