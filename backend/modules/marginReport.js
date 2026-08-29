/**
 * Rollups over the costing engine.
 *
 * The engine answers "what did this sold unit cost" one ledger row at a
 * time. A screen needs that same answer grouped — by product, by outlet, by
 * day — and grouping is where a margin report usually starts lying, so it is
 * done once here rather than in each caller.
 *
 * ── The rule that matters ────────────────────────────────────────────
 *
 * A group's margin sums ONLY its complete lines, and every group carries the
 * count of lines it had to leave out. Summing an incomplete line's revenue
 * against its partial cost would report a margin that is too good by exactly
 * the amount nobody could work out — which is the one error a costing report
 * must not make, because it is invisible and flattering.
 *
 * Revenue and the cost layers are summed across ALL lines, complete or not,
 * because those figures are real as far as they go. Only the margin waits
 * for a complete picture.
 */

const { costOfSoldUnits } = require("./costingEngine");

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => Number(v) || 0;

const LAYERS = [
  ["ingredients", "cost_ingredients"],
  ["production_labour", "cost_production_labour"],
  ["baking", "cost_baking"],
  ["delivery", "cost_delivery"],
  ["selling", "cost_selling"],
];

const blankGroup = (key, label, extra = {}) => ({
  key,
  label,
  ...extra,
  units: 0,
  revenue: 0,
  ingredients: 0,
  production_labour: 0,
  baking: 0,
  delivery: 0,
  selling: 0,
  cost: 0,
  // How many lines actually carried a figure for each layer. A layer nobody
  // could work out must report null, not the 0 that summing nulls produces —
  // a zero there reads as "this was free" and understates cost invisibly.
  _known: { ingredients: 0, production_labour: 0, baking: 0, delivery: 0, selling: 0 },
  _lines: 0,
  // Margin and its inputs are tracked over complete lines only.
  complete_units: 0,
  complete_revenue: 0,
  complete_cost: 0,
  margin: 0,
  complete_lines: 0,
  incomplete_lines: 0,
});

function accumulate(g, r) {
  g.units += num(r.quantity);
  g.revenue += num(r.revenue);
  g._lines += 1;
  for (const [out, src] of LAYERS) {
    if (r[src] === null || r[src] === undefined) continue;
    g[out] += num(r[src]);
    g._known[out] += 1;
  }
  g.cost += num(r.cost_total);
  if (r.complete) {
    g.complete_lines += 1;
    g.complete_units += num(r.quantity);
    g.complete_revenue += num(r.revenue);
    g.complete_cost += num(r.cost_total);
    g.margin += num(r.margin);
  } else {
    g.incomplete_lines += 1;
  }
}

/**
 * Rounds, and derives the per-unit and percentage figures a screen shows.
 *
 * Both derived figures come from the complete lines only, and are null when
 * there are none — there is no honest per-unit margin to state when nothing
 * in the group could be fully costed.
 */
function finalise(g) {
  for (const k of [
    "revenue", "ingredients", "production_labour", "baking",
    "delivery", "selling", "cost", "margin",
    "complete_revenue", "complete_cost",
  ]) {
    g[k] = round2(g[k]);
  }

  g.margin_per_unit = g.complete_units > 0
    ? round2(g.margin / g.complete_units)
    : null;

  g.margin_pct = g.complete_revenue > 0
    ? round2((g.margin / g.complete_revenue) * 100)
    : null;

  // Cost per unit spans every line, so it is stated against all units and
  // labelled as partial when some layers were missing.
  g.cost_per_unit = g.units > 0 ? round2(g.cost / g.units) : null;

  // A give-out earns nothing, so a group that is entirely give-outs has a
  // margin of exactly minus its cost. That is a real number, not a gap, and
  // margin_pct stays null because there is no revenue to divide by.
  // A layer no line could price comes back null with nothing to add up.
  // A layer only some lines could price keeps its total but is named in
  // partial_layers, so a screen can mark the figure as a floor rather than
  // letting it pass for the whole thing.
  g.partial_layers = [];
  for (const [out] of LAYERS) {
    const known = g._known[out];
    if (known === 0) g[out] = null;
    else if (known < g._lines) g.partial_layers.push(out);
  }
  g.layer_lines_known = { ...g._known };
  g.total_lines = g._lines;
  delete g._known;
  delete g._lines;

  // Likewise the cost itself: a total built from no priced layer at all is
  // not "zero cost", it is unknown.
  if (g.cost === 0 && Object.values(g.layer_lines_known).every((n) => n === 0)) {
    g.cost = null;
    g.cost_per_unit = null;
  }

  g.fully_costed = g.incomplete_lines === 0 && g.complete_lines > 0;
  return g;
}

function groupBy(rows, keyOf, labelOf, extraOf = () => ({})) {
  const map = new Map();
  for (const r of rows) {
    const key = keyOf(r);
    if (!map.has(key)) map.set(key, blankGroup(key, labelOf(r), extraOf(r)));
    accumulate(map.get(key), r);
  }
  return [...map.values()].map(finalise);
}

/**
 * The whole report: totals, the rollups, and the gaps that stopped lines
 * being costed.
 *
 * `rows` is returned only when the caller asks, because a month of sales is
 * tens of thousands of ledger movements and no screen renders them all.
 */
async function marginReport(client, filters = {}) {
  const base = await costOfSoldUnits(client, filters);
  const rows = base.rows;

  const byProduct = groupBy(
    rows,
    (r) => r.product_id,
    (r) => r.product_name,
    (r) => ({ product_id: r.product_id })
  ).sort((a, b) => b.revenue - a.revenue);

  const byOutlet = groupBy(
    rows,
    (r) => r.outlet_id,
    (r) => r.outlet_name,
    (r) => ({ outlet_id: r.outlet_id })
  ).sort((a, b) => b.revenue - a.revenue);

  // Chronological, not by size — this one is read as a trend.
  const byDay = groupBy(rows, (r) => r.date, (r) => r.date)
    .sort((a, b) => String(a.key).localeCompare(String(b.key)));

  // Sales and give-outs, split apart. A give-out is a sale at zero, so left
  // together it silently drags the average margin down and nobody can see by
  // how much.
  const byKind = groupBy(
    rows,
    (r) => r.kind,
    (r) => (r.kind === "GIVE_OUT" ? "Give-outs" : "Sales")
  );

  const totals = finalise(
    rows.reduce((g, r) => (accumulate(g, r), g), blankGroup("all", "All"))
  );

  return {
    from: base.from,
    to: base.to,
    totals,
    by_product: byProduct,
    by_outlet: byOutlet,
    by_day: byDay,
    by_kind: byKind,
    gaps: base.gaps,
    excludes: base.excludes,
    ...(filters.detail ? { rows } : {}),
  };
}

module.exports = { marginReport };
