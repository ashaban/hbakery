/**
 * The Products Stock Report, in one place.
 *
 * The on-screen report and its Excel/PDF exports have to agree to the shilling
 * — an export that quietly disagrees with the screen is worse than no export
 * at all. So the parameter handling, the SQL and the row mapping live here and
 * both routes call in, rather than each keeping its own copy to drift apart.
 *
 * Validation throws ReportError instead of writing a response, because the two
 * callers render failures differently (JSON vs a download).
 */

class ReportError extends Error {}

/**
 * Runs the report and returns every matching row — no pagination. Callers
 * paginate (the screen) or write the lot to a file (the exports).
 */
async function fetchStockBalance(client, reqQuery, user) {
  const {
    product_id,
    outlet_id,
    start_date,
    end_date,
    // Optional clock times ("HH:MM" or "HH:MM:SS"). Omit them and the
    // report behaves exactly as it always has — whole days.
    start_time,
    end_time,
    quality = "GOOD",
    page = 1,
    limit = 20,
  } = reqQuery;
  let outletIds = [outlet_id];
  if (!outlet_id && user.outlets) {
    outletIds = user.outlets.map((outlet) => {
      return outlet.outlet_id;
    });
  } else if (!outlet_id && user.outlets.length === 0) {
    outletIds = [-1];
  }

  // Date handling
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);
  const finalStartDate =
    start_date || defaultStartDate.toISOString().split("T")[0];
  const finalEndDate = end_date || new Date().toISOString().split("T")[0];

  if (new Date(finalStartDate) > new Date(finalEndDate)) {
    throw new ReportError("Start date cannot be after end date");
  }

  // A time is only meaningful alongside its date, and must be a real
  // clock time — reject rather than silently ignoring a typo, which
  // would hand back a whole-day figure labelled as a point in time.
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
  for (const [label, value] of [["start_time", start_time], ["end_time", end_time]]) {
    if (value && !TIME_RE.test(value)) {
      throw new ReportError(`${label} must be a 24-hour clock time such as 14:30`);
    }
  }

  const pad = (t) => (t.length === 5 ? `${t}:00` : t);
  const startAt = start_time ? `${finalStartDate} ${pad(start_time)}` : null;
  const endAt = end_time ? `${finalEndDate} ${pad(end_time)}` : null;

  if (startAt && endAt && new Date(startAt) > new Date(endAt)) {
    throw new ReportError("Start time cannot be after end time");
  }

  const validQualities = ["GOOD", "DAMAGED", "REJECT", "ALL"];
  const finalQuality = validQualities.includes(quality) ? quality : "GOOD";

  const stockQuery = `
WITH ledger AS (
  SELECT
pl.product_id,
pl.outlet_id,
pl.quality,
CASE
  WHEN pl.movement_type IN ('IN', 'TRANSFER_IN', 'RETURN') THEN pl.quantity
  WHEN pl.movement_type IN ('OUT', 'TRANSFER_OUT', 'SALE') THEN -pl.quantity
  WHEN pl.movement_type = 'QUALITY_CHANGE' THEN pl.quantity
  ELSE 0
END AS effective_qty,
pl.movement_date,
pl.movement_at,

-- Is this movement inside the window, as at the closing cutoff?
--
-- With no end_time ($6 IS NULL) this is just "on or before end_date",
-- exactly the old behaviour. With an end_time, a movement on the
-- cutoff day counts only if it is KNOWN to have happened by then —
-- an untimed row on that day is not evidence either way, so it is
-- excluded here and surfaced separately as an uncertainty band.
CASE
  WHEN $6::timestamp IS NULL THEN pl.movement_date <= $4::date
  WHEN pl.movement_date < $4::date THEN TRUE
  ELSE pl.movement_at IS NOT NULL AND pl.movement_at <= $6::timestamp
END AS within_close,

-- Same question at the opening cutoff (strictly before the window).
CASE
  WHEN $7::timestamp IS NULL THEN pl.movement_date < $3::date
  WHEN pl.movement_date < $3::date THEN TRUE
  ELSE pl.movement_at IS NOT NULL AND pl.movement_at < $7::timestamp
END AS before_open,

-- Rows on the closing day whose time was never recorded. They might
-- have happened before the cutoff or after it; nothing in the data
-- says which. Counted as a range, never folded into the balance.
(
  $6::timestamp IS NOT NULL
  AND pl.movement_date = $4::date
  AND pl.movement_at IS NULL
) AS untimed_at_close
  FROM product_ledger pl
  WHERE
($1::int IS NULL OR pl.product_id = $1)
AND (pl.outlet_id = ANY($2))
AND pl.movement_date <= $4::date
),

opening AS (
  SELECT
product_id,
outlet_id,
quality,
SUM(effective_qty) AS opening_balance
  FROM ledger
  WHERE before_open
  GROUP BY product_id, outlet_id, quality
),

period_movements AS (
  SELECT
product_id,
outlet_id,
quality,
SUM(CASE WHEN effective_qty > 0 THEN effective_qty ELSE 0 END) AS incoming,
SUM(CASE WHEN effective_qty < 0 THEN ABS(effective_qty) ELSE 0 END) AS outgoing
  FROM ledger
  WHERE within_close AND NOT before_open
  GROUP BY product_id, outlet_id, quality
),

closing AS (
  SELECT
product_id,
outlet_id,
quality,
SUM(effective_qty) AS closing_balance
  FROM ledger
  WHERE within_close
  GROUP BY product_id, outlet_id, quality
),

-- The uncertainty band: how much stock moved on the closing day with no
-- recorded time. The true balance lies between closing_balance and
-- closing_balance + untimed_net.
untimed AS (
  SELECT
product_id,
outlet_id,
quality,
COUNT(*) AS untimed_count,
SUM(effective_qty) AS untimed_net
  FROM ledger
  WHERE untimed_at_close
  GROUP BY product_id, outlet_id, quality
)

SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.unit,
  p.price,
  o.id AS outlet_id,
  o.name AS outlet_name,
  o.type AS outlet_type,

  COALESCE(op.opening_balance, 0) AS opening_balance,
  COALESCE(pm.incoming, 0) AS incoming,
  COALESCE(pm.outgoing, 0) AS outgoing,
  COALESCE(cl.closing_balance, 0) AS closing_balance,

  -- Quality breakdowns for the same outlet/product
  COALESCE((
SELECT SUM(cl2.closing_balance)
FROM closing cl2
WHERE cl2.product_id = p.id AND cl2.outlet_id = o.id AND cl2.quality = 'GOOD'
  ), 0) AS current_good,
  COALESCE((
SELECT SUM(cl2.closing_balance)
FROM closing cl2
WHERE cl2.product_id = p.id AND cl2.outlet_id = o.id AND cl2.quality = 'DAMAGED'
  ), 0) AS current_damaged,
  COALESCE((
SELECT SUM(cl2.closing_balance)
FROM closing cl2
WHERE cl2.product_id = p.id AND cl2.outlet_id = o.id AND cl2.quality = 'REJECT'
  ), 0) AS current_reject,

  COALESCE(ut.untimed_count, 0) AS untimed_count,
  COALESCE(ut.untimed_net, 0) AS untimed_net

FROM product p
JOIN outlet o ON o.is_active = true
LEFT JOIN opening op ON op.product_id = p.id AND op.outlet_id = o.id AND ($5 = 'ALL' OR op.quality = $5)
LEFT JOIN period_movements pm ON pm.product_id = p.id AND pm.outlet_id = o.id AND ($5 = 'ALL' OR pm.quality = $5)
LEFT JOIN closing cl ON cl.product_id = p.id AND cl.outlet_id = o.id AND ($5 = 'ALL' OR cl.quality = $5)
LEFT JOIN untimed ut ON ut.product_id = p.id AND ut.outlet_id = o.id AND ($5 = 'ALL' OR ut.quality = $5)
WHERE
  ($1::int IS NULL OR p.id = $1)
  AND (o.id = ANY($2))
-- o.name + p.name alone is not a total order: with quality = 'ALL' the
-- quality joins below match every quality, so one product/outlet yields
-- several rows and ties were previously broken by whatever the planner
-- happened to do. Sorting on the joined quality columns too makes the
-- output reproducible, which also keeps pagination stable between calls.
ORDER BY o.name, p.name, cl.quality, op.quality, pm.quality;
`;

  const result = await client.query(stockQuery, [
    product_id,
    outletIds,
    finalStartDate,
    finalEndDate,
    finalQuality,
    endAt,
    startAt,
  ]);

  const stockData = result.rows.map((row) => {
    const opening_balance = Number(row.opening_balance) || 0;
    const incoming = Number(row.incoming) || 0;
    const outgoing = Number(row.outgoing) || 0;
    const closing_balance = opening_balance + incoming - outgoing;

    return {
      product_id: row.product_id,
      product_name: row.product_name,
      unit: row.unit,
      price: Number(row.price) || 0,
      outlet_id: row.outlet_id,
      outlet_name: row.outlet_name,
      outlet_type: row.outlet_type,
      quality_breakdown: {
        good: Math.max(0, Number(row.current_good) || 0),
        damaged: Math.max(0, Number(row.current_damaged) || 0),
        reject: Math.max(0, Number(row.current_reject) || 0),
        total: Math.max(
          0,
          Number(row.current_good) +
            Number(row.current_damaged) +
            Number(row.current_reject)
        ),
      },
      opening_balance: opening_balance,
      incoming: incoming,
      outgoing: outgoing,
      closing_balance: closing_balance,
      total_value: closing_balance * (Number(row.price) || 0),

      // Movements on the closing day with no recorded time. Zero
      // whenever no end_time was asked for, and zero once the day's
      // entries all carry times. While non-zero, the real balance is
      // somewhere in [closing_balance, closing_balance + untimed_net].
      untimed_count: Number(row.untimed_count) || 0,
      untimed_net: Number(row.untimed_net) || 0,
    };
  });

  // Generate summary
  const summary = {
    totalProducts: new Set(stockData.map((item) => item.product_id)).size,
    totalOutlets: new Set(stockData.map((item) => item.outlet_id)).size,
    totalOpening: stockData.reduce(
      (sum, item) => sum + item.opening_balance,
      0
    ),
    totalIncoming: stockData.reduce((sum, item) => sum + item.incoming, 0),
    totalOutgoing: stockData.reduce((sum, item) => sum + item.outgoing, 0),
    totalClosing: stockData.reduce(
      (sum, item) => sum + item.closing_balance,
      0
    ),
    totalValue: stockData.reduce((sum, item) => sum + item.total_value, 0),
    totalUntimedCount: stockData.reduce(
      (sum, item) => sum + item.untimed_count,
      0
    ),
    totalUntimedNet: stockData.reduce(
      (sum, item) => sum + item.untimed_net,
      0
    ),
  };

  const appliedFilters = {
    product_id: product_id || null,
    outlet_id: outlet_id || null,
    quality: finalQuality,
    start_date: finalStartDate,
    end_date: finalEndDate,
    start_time: start_time || null,
    end_time: end_time || null,
    point_in_time: Boolean(endAt),
  };

  return { stockData, summary, filters: appliedFilters };
}

module.exports = { fetchStockBalance, ReportError };
