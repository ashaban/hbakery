const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask } = require("../middleware/auth");
const { recordAudit } = require("../modules/auditLog");
const { shiftAt } = require("../modules/productionLabour");
const { selfOverlap, crewOverlap } = require("../modules/shiftOverlap");

/** Runs fn inside a transaction and rolls back on any error. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const SHIFT_SELECT = `
  SELECT s.id, s.name, s.leader_staff_id, l.name AS leader_name,
         s.days_of_week,
         TO_CHAR(s.start_time, 'HH24:MI') AS start_time,
         TO_CHAR(s.end_time,   'HH24:MI') AS end_time,
         s.end_day_offset,
         ROUND((s.end_day_offset * 1440
                + EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60)::numeric / 60, 2)
           AS hours,
         s.notes, u.name AS created_by_name,
         COALESCE((
           SELECT json_agg(json_build_object(
             'staff_id', m.staff_id,
             'staff_name', st.name,
             'position', st."position",
             'daily_rate', m.daily_rate
           ) ORDER BY st.name)
           FROM work_shift_member m JOIN staff st ON st.id = m.staff_id
           WHERE m.shift_id = s.id
         ), '[]') AS members,
         COALESCE((
           SELECT SUM(m.daily_rate) FROM work_shift_member m WHERE m.shift_id = s.id
         ), 0) AS daily_cost,
         (SELECT COUNT(*)::int FROM product_production pp WHERE pp.shift_id = s.id)
           AS production_count
  FROM work_shift s
  LEFT JOIN staff l ON l.id = s.leader_staff_id
  LEFT JOIN users u ON u.id = s.created_by`;

/** Replaces a shift's crew, snapshotting each person's rate at assignment. */
async function setMembers(client, shiftId, members, leaderId) {
  await client.query(`DELETE FROM work_shift_member WHERE shift_id = $1`, [shiftId]);

  // The leader is a working member too — folding them in here means callers
  // cannot accidentally leave the leader out of the shift's cost.
  const ids = [...new Set([...(members || []).map(Number), Number(leaderId)].filter(Boolean))];
  for (const staffId of ids) {
    await client.query(
      `INSERT INTO work_shift_member (shift_id, staff_id, daily_rate)
       SELECT $1, $2, daily_salary FROM staff WHERE id = $2`,
      [shiftId, staffId]
    );
  }
}

// ── List ─────────────────────────────────────────────────────────────

router.get("/", requireTask("can_see_production"), async (req, res) => {
  try {
    // No date range: a shift is now a weekly pattern, not a dated block, so
    // "which shifts fall in this window" no longer means anything — every
    // shift applies to every matching weekday, forever. day filters the list
    // to shifts that run on one ISO weekday.
    const { day, limit = 50, page = 1 } = req.query;
    const where = [];
    const params = [];
    if (day) {
      params.push(Number(day));
      where.push(`$${params.length}::smallint = ANY(s.days_of_week)`);
    }
    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM work_shift s ${whereSQL}`,
      params
    );
    const lim = Math.min(200, Math.max(1, parseInt(limit)));
    const off = (Math.max(1, parseInt(page)) - 1) * lim;

    const { rows } = await pool.query(
      `${SHIFT_SELECT} ${whereSQL} ORDER BY s.days_of_week, s.start_time
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, lim, off]
    );
    res.json({ data: rows, total: countRes.rows[0].total });
  } catch (err) {
    console.error("❌ Failed to list shifts:", err);
    res.status(500).json({ error: "Failed to list shifts" });
  }
});

/** Which shift covers a given moment — what the production form asks. */
router.get("/at", requireTask("can_see_production"), async (req, res) => {
  try {
    const found = await shiftAt(pool, req.query.at);
    if (!found) return res.json({ data: null });
    const { rows } = await pool.query(`${SHIFT_SELECT} WHERE s.id = $1`, [found.id]);
    res.json({ data: rows[0] || null });
  } catch (err) {
    console.error("❌ Failed to resolve shift:", err);
    res.status(500).json({ error: "Failed to resolve shift" });
  }
});

router.get("/:id", requireTask("can_see_production"), async (req, res) => {
  try {
    const { rows } = await pool.query(`${SHIFT_SELECT} WHERE s.id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Shift not found" });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error("❌ Failed to fetch shift:", err);
    res.status(500).json({ error: "Failed to fetch shift" });
  }
});

// ── Create / update / delete ─────────────────────────────────────────

function validate({ days_of_week, start_time, end_time, end_day_offset, members, leader_staff_id }) {
  if (!Array.isArray(days_of_week) || days_of_week.length === 0) {
    return "Pick at least one day of the week";
  }
  if (days_of_week.some((d) => !Number.isInteger(Number(d)) || d < 1 || d > 7)) {
    return "Days must be 1 (Monday) to 7 (Sunday)";
  }
  if (!start_time || !end_time) return "Start and end time are required";
  // Equal times would be both a zero-length and a 24-hour shift; the
  // difference matters too much to guess.
  const offset = Number(end_day_offset);
  if (!Number.isInteger(offset) || offset < 0 || offset > 6) {
    return "The end day must be between the start day and six days later";
  }
  // Only a same-day shift constrains the clock: it has to end after it
  // began. Once it ends on a later day any end time is valid, including an
  // earlier or identical one — that is simply a 24-hour shift.
  if (offset === 0 && end_time <= start_time) {
    return "A shift ending on the same day must end after it starts. Choose a later end day instead";
  }
  if (!leader_staff_id) return "A shift leader is required";
  if (!Array.isArray(members) || members.length === 0) {
    return "At least one staff member is required";
  }
  return null;
}


/**
 * Rejects a shift that would put the same person on two shifts at once —
 * either because the pattern collides with itself, or because it runs at
 * the same time as another shift sharing crew. `excludeId` skips the shift
 * being edited so it never conflicts with its own current definition.
 */
async function overlapProblem(client, shift, members, excludeId = null) {
  const own = selfOverlap(shift);
  if (own) return own;

  const { rows } = await client.query(
    `SELECT s.id, s.name, s.days_of_week, s.start_time, s.end_time, s.end_day_offset,
            COALESCE(ARRAY_AGG(m.staff_id) FILTER (WHERE m.staff_id IS NOT NULL), '{}') AS member_ids
       FROM work_shift s
       LEFT JOIN work_shift_member m ON m.shift_id = s.id
      WHERE ($1::int IS NULL OR s.id <> $1)
      GROUP BY s.id`,
    [excludeId]
  );
  const clash = crewOverlap(shift, members, rows);
  return clash ? clash.message : null;
}

router.post("/", requireTask("can_manage_shifts"), async (req, res) => {
  const {
    name, leader_staff_id, days_of_week, start_time, end_time,
    end_day_offset = 0, notes, members = [],
  } = req.body || {};
  const problem = validate({ days_of_week, start_time, end_time, end_day_offset, members, leader_staff_id });
  if (problem) return res.status(400).json({ error: problem });

  try {
    const shift = await withTransaction(async (client) => {
      const clash = await overlapProblem(
        client,
        { days_of_week, start_time, end_time, end_day_offset },
        members
      );
      if (clash) {
        const e = new Error(clash);
        e.status = 400;
        throw e;
      }

      const { rows } = await client.query(
        `INSERT INTO work_shift (name, leader_staff_id, days_of_week, start_time, end_time, end_day_offset, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [name || null, leader_staff_id, days_of_week.map(Number), start_time, end_time,
         Number(end_day_offset), notes || null, req.user?.id || null]
      );
      const id = rows[0].id;
      await setMembers(client, id, members, leader_staff_id);
      await recordAudit(client, {
        user: req.user,
        action: "SHIFT_CREATE",
        entity_type: "work_shift",
        entity_id: id,
        description: `Created shift ${name || id} (${members.length} staff)`,
      });
      const out = await client.query(`${SHIFT_SELECT} WHERE s.id = $1`, [id]);
      return out.rows[0];
    });
    res.status(201).json({ data: shift });
  } catch (err) {
    // A rejected overlap is the user's to fix, and the message names the
    // days and people involved — surfacing "Failed to create shift" instead
    // would throw that away.
    if (err.status && err.status < 500) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("❌ Failed to create shift:", err);
    res.status(500).json({ error: "Failed to create shift" });
  }
});

router.put("/:id", requireTask("can_manage_shifts"), async (req, res) => {
  const {
    name, leader_staff_id, days_of_week, start_time, end_time,
    end_day_offset = 0, notes, members = [],
  } = req.body || {};
  const problem = validate({ days_of_week, start_time, end_time, end_day_offset, members, leader_staff_id });
  if (problem) return res.status(400).json({ error: problem });

  try {
    const shift = await withTransaction(async (client) => {
      const clash = await overlapProblem(
        client,
        { days_of_week, start_time, end_time, end_day_offset },
        members,
        Number(req.params.id)
      );
      if (clash) {
        const e = new Error(clash);
        e.status = 400;
        throw e;
      }

      const { rowCount } = await client.query(
        `UPDATE work_shift SET name=$1, leader_staff_id=$2, days_of_week=$3, start_time=$4,
                end_time=$5, end_day_offset=$6, notes=$7
         WHERE id=$8`,
        [name || null, leader_staff_id, days_of_week.map(Number), start_time, end_time,
         Number(end_day_offset), notes || null, req.params.id]
      );
      if (!rowCount) {
        const e = new Error("Shift not found");
        e.status = 404;
        throw e;
      }
      await setMembers(client, req.params.id, members, leader_staff_id);
      await recordAudit(client, {
        user: req.user,
        action: "SHIFT_EDIT",
        entity_type: "work_shift",
        entity_id: Number(req.params.id),
        description: `Edited shift ${name || req.params.id}`,
      });
      const out = await client.query(`${SHIFT_SELECT} WHERE s.id = $1`, [req.params.id]);
      return out.rows[0];
    });
    res.json({ data: shift });
  } catch (err) {
    if (err.status && err.status < 500) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("❌ Failed to update shift:", err);
    res.status(500).json({ error: "Failed to update shift" });
  }
});

router.delete("/:id", requireTask("can_manage_shifts"), async (req, res) => {
  try {
    // Productions keep their own staff list, so deleting a shift loses the
    // link but not the costing history — still, silently detaching finished
    // productions would be a surprise, so it is refused.
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM product_production WHERE shift_id = $1`,
      [req.params.id]
    );
    if (rows[0].n > 0) {
      return res.status(409).json({
        error: `This shift is used by ${rows[0].n} production(s) and cannot be deleted`,
      });
    }
    const del = await pool.query(`DELETE FROM work_shift WHERE id = $1 RETURNING name`, [
      req.params.id,
    ]);
    if (!del.rowCount) return res.status(404).json({ error: "Shift not found" });
    await recordAudit(pool, {
      user: req.user,
      action: "SHIFT_DELETE",
      entity_type: "work_shift",
      entity_id: Number(req.params.id),
      description: `Deleted shift ${del.rows[0].name || req.params.id}`,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to delete shift:", err);
    res.status(500).json({ error: "Failed to delete shift" });
  }
});

module.exports = router;
