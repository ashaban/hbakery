/**
 * What it costs to bake a quantity in a given oven.
 *
 * The chain is short and deliberately arithmetic — no inference anywhere:
 *
 *   loads   = ceil(quantity / units_per_load)     rounded UP, because a
 *                                                 half-full oven still runs
 *                                                 a full bake cycle
 *   minutes = loads * bake_minutes
 *
 *   FUEL      litres = minutes / burn_minutes * litres_per_period
 *             cost   = litres * price_per_litre
 *
 *   ELECTRIC  cost   = minutes / burn_minutes * cost_per_period
 *
 * Electricity carries no litres: it is bought as prepaid units and stated
 * directly in shillings, so there is no volume to report.
 *
 * A figure that cannot be worked out comes back null with a reason — never
 * zero, which would read as "this bake was free".
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
const num = (v) => Number(v) || 0;

const OVEN_SELECT = `
  SELECT o.id, o.name, o.kind, o.burn_minutes, o.litres_per_period,
         o.cost_per_period, o.is_active, o.notes,
         o.fuel_type_id, f.name AS fuel_name, f.price_per_litre
    FROM oven o
    LEFT JOIN fuel_type f ON f.id = o.fuel_type_id`;

/**
 * Costs one bake.
 *
 * Pass the oven row and the product/oven pairing; returns the loads,
 * minutes, litres and money, or a reason it could not be worked out.
 */
function bakeCost({ oven, pairing, quantity }) {
  const qty = num(quantity);

  if (!oven) {
    return blank("No oven chosen for this product");
  }
  if (!pairing) {
    return blank(`${oven.name} has no baking time set for this product`);
  }
  if (qty <= 0) {
    return blank("No quantity to bake");
  }

  const perLoad = num(pairing.units_per_load);
  const bakeMinutes = num(pairing.bake_minutes);
  if (perLoad <= 0 || bakeMinutes <= 0) {
    return blank(`${oven.name} has no usable baking time for this product`);
  }

  const loads = Math.ceil(qty / perLoad);
  const minutes = round2(loads * bakeMinutes);
  const periods = minutes / num(oven.burn_minutes);

  if (oven.kind === "FUEL") {
    const price = oven.price_per_litre === null ? null : num(oven.price_per_litre);
    const litres = round3(periods * num(oven.litres_per_period));
    if (price === null || price <= 0) {
      return {
        ...shape(oven, loads, minutes, litres, null),
        // The volume is still worth reporting even without a price — it
        // tells the baker how much fuel to draw.
        unavailable_reason: `No price set per litre for ${oven.fuel_name || "this fuel"}`,
      };
    }
    return shape(oven, loads, minutes, litres, round2(litres * price), price);
  }

  return shape(oven, loads, minutes, null, round2(periods * num(oven.cost_per_period)));
}

const shape = (oven, loads, minutes, litres, cost, rate = null) => ({
  oven_id: oven.id,
  oven_name: oven.name,
  oven_kind: oven.kind,
  loads,
  minutes,
  litres,
  fuel_name: oven.fuel_name || null,
  price_per_litre: rate,
  cost,
  unavailable_reason: null,
});

const blank = (reason) => ({
  oven_id: null, oven_name: null, oven_kind: null,
  loads: null, minutes: null, litres: null,
  fuel_name: null, price_per_litre: null, cost: null,
  unavailable_reason: reason,
});

/**
 * Prices a bake from ids alone — what the production form asks as the user
 * picks a product, an oven and a quantity.
 */
async function quoteBake(client, { product_id, oven_id, quantity }) {
  if (!product_id) return blank("No product chosen");

  // With no oven named, fall back to the product's default.
  const { rows: pairings } = await client.query(
    `SELECT po.*, o.name AS oven_name
       FROM product_oven po JOIN oven o ON o.id = po.oven_id
      WHERE po.product_id = $1 AND o.is_active
      ORDER BY po.is_default DESC, o.name`,
    [product_id]
  );
  if (!pairings.length) {
    return blank("This product has no oven set up. Add one on the product.");
  }

  const pairing = oven_id
    ? pairings.find((p) => p.oven_id === Number(oven_id))
    : pairings[0];
  if (!pairing) {
    return blank("That oven has no baking time set for this product");
  }

  const { rows: ovens } = await client.query(
    `${OVEN_SELECT} WHERE o.id = $1`,
    [pairing.oven_id]
  );
  return bakeCost({ oven: ovens[0], pairing, quantity });
}

/**
 * Records what a production burned.
 *
 * Snapshotted onto the production, so a later fuel price change or a
 * corrected burn rate cannot rewrite what a past bake cost.
 */
async function saveBakeForProduction(client, productionId, { product_id, oven_id, quantity }) {
  const quote = await quoteBake(client, { product_id, oven_id, quantity });
  await client.query(
    `UPDATE product_production
        SET oven_id = $2, bake_loads = $3, bake_minutes = $4,
            bake_litres = $5, bake_cost = $6
      WHERE id = $1`,
    [productionId, quote.oven_id, quote.loads, quote.minutes, quote.litres, quote.cost]
  );
  return quote;
}

module.exports = { bakeCost, quoteBake, saveBakeForProduction, OVEN_SELECT };
