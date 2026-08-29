/**
 * What it costs to get product to an outlet, and to sell it once there.
 *
 * Two costs, with different shapes:
 *
 *   DELIVERY  Attaches to one transfer. A vehicle run picks up the costs of
 *             the route it took; a shop picks up its own standing costs; and
 *             either can carry one-off lines added on the day (a fine, an
 *             unplanned ferry). Split across the units on that transfer.
 *
 *   SELLING   Attaches to an outlet-day, not to a transfer. A driver or a
 *             shopkeeper is paid for the day whatever they shift, so their
 *             pay is one pool split across everything that outlet sold that
 *             day.
 *
 * Both split by QUANTITY: every unit carries an equal share. A vehicle
 * carries units rather than shillings, and a seller hands over units.
 *
 * Everything is snapshotted onto the transfer when it is saved. Route and
 * shop costs get edited — fuel rises, a fare changes — and a transfer that
 * merely pointed at them would have its history quietly rewritten.
 *
 * Where a figure cannot be worked out honestly it comes back as null with a
 * reason, never as zero: a silent 0 reads as "delivery was free".
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Copies the costs that apply to a transfer onto it.
 *
 * Called on save, after the header exists. Replaces any previous lines so an
 * edit cannot leave two generations of costs stacked on one transfer.
 */
async function snapshotTransferCosts(client, transferId, { toOutletId, routeId, adhoc = [] }) {
  await client.query(`DELETE FROM stock_transfer_cost WHERE transfer_id = $1`, [transferId]);

  // A vehicle run: whatever the chosen route costs.
  if (routeId) {
    await client.query(
      `INSERT INTO stock_transfer_cost (transfer_id, cost_type_id, description, amount, source)
       SELECT $1, rc.cost_type_id, t.name, rc.amount, 'ROUTE'
         FROM delivery_route_cost rc
         JOIN delivery_cost_type t ON t.id = rc.cost_type_id
        WHERE rc.route_id = $2 AND rc.amount > 0`,
      [transferId, routeId]
    );
  }

  // A shop: its own standing costs. Only for shops — a vehicle's costs come
  // from the route, and charging both would double it.
  if (toOutletId && !routeId) {
    await client.query(
      `INSERT INTO stock_transfer_cost (transfer_id, cost_type_id, description, amount, source)
       SELECT $1, oc.cost_type_id, t.name, oc.amount, 'OUTLET'
         FROM outlet_cost oc
         JOIN delivery_cost_type t ON t.id = oc.cost_type_id
         JOIN outlet o ON o.id = oc.outlet_id AND o.type = 'SHOP'
        WHERE oc.outlet_id = $2 AND oc.amount > 0`,
      [transferId, toOutletId]
    );
  }

  // One-offs typed on the day.
  for (const line of adhoc) {
    const amount = Number(line.amount);
    if (!(amount > 0)) continue;
    if (!line.cost_type_id && !String(line.description || "").trim()) continue;
    await client.query(
      `INSERT INTO stock_transfer_cost (transfer_id, cost_type_id, description, amount, source)
       VALUES ($1,$2,$3,$4,'ADHOC')`,
      [transferId, line.cost_type_id || null, line.description || null, amount]
    );
  }
}

/**
 * Delivery cost per transfer, and per unit on it.
 *
 * Returns Map transferId -> { total, units, per_unit, lines, unavailable_reason }.
 */
async function deliveryCostForTransfers(client, transferIds) {
  const ids = [...new Set((transferIds || []).map(Number))].filter(Boolean);
  const out = new Map();
  if (!ids.length) return out;

  const { rows: costs } = await client.query(
    `SELECT c.transfer_id, c.amount, c.source,
            COALESCE(t.name, c.description) AS label
       FROM stock_transfer_cost c
       LEFT JOIN delivery_cost_type t ON t.id = c.cost_type_id
      WHERE c.transfer_id = ANY($1::int[])
      ORDER BY c.source, label`,
    [ids]
  );

  const { rows: qty } = await client.query(
    `SELECT transfer_id, COALESCE(SUM(quantity), 0) AS units
       FROM stock_transfer_item
      WHERE transfer_id = ANY($1::int[])
      GROUP BY transfer_id`,
    [ids]
  );
  const unitsBy = new Map(qty.map((r) => [r.transfer_id, Number(r.units) || 0]));

  for (const id of ids) {
    const lines = costs.filter((c) => c.transfer_id === id);
    const total = round2(lines.reduce((s, c) => s + Number(c.amount), 0));
    const units = unitsBy.get(id) || 0;
    out.set(id, {
      total,
      units,
      // Nothing moved means there is nothing to carry the cost. Reporting 0
      // would hide a delivery that cost money and delivered nothing.
      per_unit: units > 0 ? round2(total / units) : null,
      lines: lines.map((c) => ({ label: c.label, amount: Number(c.amount), source: c.source })),
      unavailable_reason:
        units > 0 ? null : total > 0 ? "Nothing was transferred to carry this cost" : null,
    });
  }
  return out;
}

/**
 * Selling labour for one outlet on one day, and what each unit sold carries.
 *
 * A vehicle's seller is the driver named on that day's transfers to it; a
 * shop's are the staff assigned to it. Either way the pool is a day's pay,
 * split across the units sold.
 */
async function sellingLabourForOutletDay(client, outletId, date) {
  const { rows: outletRows } = await client.query(
    `SELECT id, name, type FROM outlet WHERE id = $1`,
    [outletId]
  );
  const outlet = outletRows[0];
  if (!outlet) return null;

  let pool = 0;
  let crew = [];

  if (outlet.type === "CAR") {
    // The driver's rate as recorded on the transfer, not their rate today.
    const { rows } = await client.query(
      `SELECT DISTINCT ON (t.driver_staff_id)
              t.driver_staff_id AS staff_id, s.name, t.driver_daily_rate AS daily_rate
         FROM stock_transfer t
         JOIN staff s ON s.id = t.driver_staff_id
        WHERE t.to_outlet_id = $1 AND t.transfer_date = $2::date
          AND t.driver_staff_id IS NOT NULL
        ORDER BY t.driver_staff_id, t.driver_daily_rate DESC NULLS LAST`,
      [outletId, date]
    );
    crew = rows;
  } else {
    const { rows } = await client.query(
      `SELECT a.staff_id, s.name, s.daily_salary AS daily_rate
         FROM outlet_staff_assignment a
         JOIN staff s ON s.id = a.staff_id
        WHERE a.outlet_id = $1 AND a.is_active AND s.status = 'Active'
        ORDER BY s.name`,
      [outletId]
    );
    crew = rows;
  }

  const unrated = crew.filter((c) => c.daily_rate === null).length;
  pool = round2(crew.reduce((s, c) => s + (Number(c.daily_rate) || 0), 0));

  const { rows: sold } = await client.query(
    `SELECT COALESCE(SUM(si.quantity), 0) AS units
       FROM sale s
       JOIN sale_item si ON si.sale_id = s.id
      WHERE s.outlet_id = $1 AND s.sale_date = $2::date AND s.status = 'POSTED'`,
    [outletId, date]
  );
  const units = Number(sold[0]?.units) || 0;

  let reason = null;
  if (!crew.length) {
    reason =
      outlet.type === "CAR"
        ? "No driver recorded on this day's deliveries to this vehicle"
        : "No staff assigned to this shop";
  } else if (unrated === crew.length) {
    reason = "No daily rate set for the staff selling here";
  } else if (units === 0) {
    reason = "Nothing was sold here on this day";
  }

  return {
    outlet_id: outlet.id,
    outlet_name: outlet.name,
    outlet_type: outlet.type,
    date,
    pool,
    crew,
    unrated_crew: unrated,
    units_sold: units,
    per_unit: reason ? null : round2(pool / units),
    unavailable_reason: reason,
  };
}

module.exports = {
  snapshotTransferCosts,
  deliveryCostForTransfers,
  sellingLabourForOutletDay,
};
