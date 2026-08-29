/**
 * What the labour on a production cost.
 *
 * Two ways labour is paid, chosen per product (product.labour_basis):
 *
 *   PER_QUANTITY  Piece work. Andazi is paid per pocket of flour: the quantity
 *                 of the nominated ingredient consumed, converted to its
 *                 human-readable unit, times a rate. Independent of who is on
 *                 shift, so these productions take no share of a crew's pay.
 *
 *   SHIFT         A crew is paid for the day. Their combined daily pay is one
 *                 pool, shared across everything that shift produced in
 *                 proportion to flour consumed.
 *
 * The pool is per SHIFT, not per production — the crew is paid once for the
 * day however many batches they get through. Each person counts once even
 * though they appear on several productions' staff lists.
 *
 * Where a figure cannot be worked out honestly it is reported as null with a
 * reason, never as zero: a silent 0 reads as "labour was free".
 */

/** Rows of a production's labour, keyed by production id. */
async function labourForProductions(client, productionIds) {
  const ids = [...new Set(productionIds.map(Number))].filter(Boolean);
  const out = new Map();
  if (!ids.length) return out;

  const { rows: prods } = await client.query(
    `
    SELECT pp.id,
           pp.shift_id,
           pp.shift_date::text AS shift_date,
           p.id  AS product_id,
           p.name AS product_name,
           p.labour_basis,
           p.labour_item_id,
           p.labour_rate_per_unit,
           li.name AS labour_item_name,
           li.human_readable_unit AS labour_unit,
           li.conversion_factor AS labour_conversion,
           -- Flour actually consumed by this production.
           COALESCE((
             SELECT SUM(il.quantity)
             FROM item_ledger il
             JOIN item i ON i.id = il.item_id AND i.is_flour
             WHERE il.production_id = pp.id AND il.type = 'OUT'
           ), 0) AS flour_qty,
           -- Quantity of the piece-work ingredient consumed, when there is one.
           COALESCE((
             SELECT SUM(il.quantity)
             FROM item_ledger il
             WHERE il.production_id = pp.id AND il.type = 'OUT'
               AND il.item_id = p.labour_item_id
           ), 0) AS labour_item_qty
    FROM product_production pp
    JOIN product p ON p.id = pp.product_id
    LEFT JOIN item li ON li.id = p.labour_item_id
    WHERE pp.id = ANY($1::int[])
    `,
    [ids]
  );

  // ── Shift pools ───────────────────────────────────────────────────
  // One pool per shift: each person on any of that shift's SHIFT-basis
  // productions, counted once at their recorded rate.
  // Keyed by "shiftId|date": one pool per NIGHT, not per shift pattern.
  // Grouping on shift_id alone would pour every Monday ever into one pool.
  const occKey = (p) =>
    p.shift_id && p.shift_date ? `${p.shift_id}|${p.shift_date}` : null;
  const occurrences = prods.map(occKey).filter(Boolean);
  const shiftIds = [...new Set(prods.map((p) => p.shift_id).filter(Boolean))];
  const pools = new Map();

  if (shiftIds.length) {
    const { rows } = await client.query(
      `
      SELECT x.shift_id, x.shift_date::text AS shift_date,
             SUM(x.daily_rate) AS pool,
             COUNT(*)::int AS crew,
             COUNT(*) FILTER (WHERE x.daily_rate IS NULL)::int AS unrated
      FROM (
        SELECT DISTINCT ON (pp2.shift_id, pp2.shift_date, pps.staff_id)
               pp2.shift_id, pp2.shift_date, pps.staff_id, pps.daily_rate
        FROM product_production_staff pps
        JOIN product_production pp2 ON pp2.id = pps.production_id
        JOIN product p2 ON p2.id = pp2.product_id
        WHERE pp2.shift_id = ANY($1::int[])
          AND p2.labour_basis = 'SHIFT'
          AND pp2.cancelled_at IS NULL
        ORDER BY pp2.shift_id, pp2.shift_date, pps.staff_id, pps.daily_rate DESC NULLS LAST
      ) x
      GROUP BY x.shift_id, x.shift_date
      `,
      [shiftIds]
    );
    rows.forEach((r) =>
      pools.set(`${r.shift_id}|${r.shift_date}`, {
        pool: Number(r.pool) || 0,
        crew: r.crew,
        unrated: r.unrated,
      })
    );

    // Total flour across each shift's SHIFT-basis productions — the
    // denominator the pool is divided by.
    const { rows: flour } = await client.query(
      `
      SELECT pp.shift_id, pp.shift_date::text AS shift_date,
             COALESCE(SUM((
               SELECT SUM(il.quantity)
               FROM item_ledger il
               JOIN item i ON i.id = il.item_id AND i.is_flour
               WHERE il.production_id = pp.id AND il.type = 'OUT'
             )), 0) AS flour
      FROM product_production pp
      JOIN product p ON p.id = pp.product_id
      WHERE pp.shift_id = ANY($1::int[])
        AND p.labour_basis = 'SHIFT'
        AND pp.cancelled_at IS NULL
      GROUP BY pp.shift_id, pp.shift_date
      `,
      [shiftIds]
    );
    flour.forEach((r) => {
      const p = pools.get(`${r.shift_id}|${r.shift_date}`);
      if (p) p.flour = Number(r.flour) || 0;
    });
  }

  // ── Per production ────────────────────────────────────────────────
  for (const p of prods) {
    if (p.labour_basis === "PER_QUANTITY") {
      const qty = Number(p.labour_item_qty) || 0;
      const factor = Number(p.labour_conversion) || 1;
      const rate = Number(p.labour_rate_per_unit) || 0;
      const units = qty * factor;

      out.set(p.id, {
        basis: "PER_QUANTITY",
        cost: round2(units * rate),
        detail: {
          item_name: p.labour_item_name,
          quantity: qty,
          units: round4(units),
          unit_label: p.labour_unit,
          rate_per_unit: rate,
        },
        unavailable_reason:
          qty > 0 || rate ? null : "No piece-work quantity recorded",
      });
      continue;
    }

    // SHIFT
    const pool = occKey(p) ? pools.get(occKey(p)) : null;
    if (!pool) {
      out.set(p.id, {
        basis: "SHIFT",
        cost: null,
        detail: null,
        unavailable_reason: p.shift_id
          ? "No crew recorded on this shift"
          : "This production is not linked to a shift",
      });
      continue;
    }
    if (pool.unrated > 0 && pool.pool === 0) {
      out.set(p.id, {
        basis: "SHIFT",
        cost: null,
        detail: { crew: pool.crew },
        unavailable_reason: "No daily rate set for the crew on this shift",
      });
      continue;
    }

    const flour = Number(p.flour_qty) || 0;
    const shiftFlour = Number(pool.flour) || 0;
    // No flour anywhere in the shift: nothing to apportion by, so fall back to
    // an equal split rather than charging the whole pool to one product.
    const share = shiftFlour > 0 ? flour / shiftFlour : null;

    out.set(p.id, {
      basis: "SHIFT",
      cost: share === null ? null : round2(pool.pool * share),
      detail: {
        shift_pool: round2(pool.pool),
        crew: pool.crew,
        unrated_crew: pool.unrated,
        flour_qty: round4(flour),
        shift_flour_qty: round4(shiftFlour),
        share: share === null ? null : round4(share),
      },
      unavailable_reason:
        share === null ? "No flour recorded for this shift" : null,
    });
  }

  return out;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const round4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;

/**
 * The shift that was running at a given moment, for auto-linking a production.
 * Returns the most recently started match when shifts overlap.
 */
/**
 * Which shift occurrence covers a given moment.
 *
 * A shift is a weekly pattern: it starts on each of days_of_week at
 * start_time and runs until end_time, end_day_offset days later. The offset
 * is explicit, so length is arithmetic — a 25-hour shift is as expressible
 * as an 8-hour one, and nothing is inferred from the clock.
 *
 * Answers two things at once: which shift, and which occurrence of it. The
 * occurrence is the date the shift STARTED, because a crew is paid for one
 * stretch of work — so a Tuesday-afternoon production on a shift that began
 * Monday night is costed against Monday.
 *
 * Works by walking back over each possible start day (today, yesterday, ...)
 * and asking whether a shift beginning then would still be running.
 *
 * Returns { id, shift_date, ... } or null.
 */
async function shiftAt(client, at) {
  if (!at) return null;
  const { rows } = await client.query(
    `
    WITH moment AS (SELECT $1::timestamp AS t),
    candidate AS (
      SELECT w.*,
             (m.t::date - offs) AS start_date,
             ((m.t::date - offs) + w.start_time) AS starts_at,
             ((m.t::date - offs) + w.start_time
               + make_interval(days => w.end_day_offset)
               + (w.end_time - w.start_time)) AS ends_at
        FROM work_shift w
        CROSS JOIN moment m
        CROSS JOIN generate_series(0, GREATEST(w.end_day_offset, 0) + 1) AS offs
       WHERE EXTRACT(ISODOW FROM (m.t::date - offs))::smallint = ANY(w.days_of_week)
    )
    SELECT c.*, c.start_date::text AS shift_date
      FROM candidate c, moment m
     WHERE m.t >= c.starts_at
       AND m.t <  c.ends_at
     ORDER BY c.starts_at DESC
     LIMIT 1`,
    [at]
  );
  return rows[0] || null;
}

module.exports = { labourForProductions, shiftAt };
