/**
 * Overlap detection for recurring shifts.
 *
 * A shift can now run longer than the gap between its own start days, so a
 * pattern can collide with itself: "Thursday and Friday, 22:00 for 25 hours"
 * has Thursday's occurrence still running when Friday's begins. The same
 * people would be on two shifts at once — impossible on the floor, and it
 * charges their day rate twice while making the costing boundary invisible
 * (a production at 21:00 lands on one night, at 22:30 on the other).
 *
 * Shifts are modelled as intervals on a repeating week: minute 0 is Monday
 * 00:00, minute 10080 wraps back to it. An occurrence that runs past Sunday
 * midnight is split into two segments so a plain interval test still works.
 */

const WEEK = 7 * 24 * 60;
const DAY = 24 * 60;

const DAY_NAME = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday",
  5: "Friday", 6: "Saturday", 7: "Sunday",
};

/** "22:00" or "22:00:00" -> minutes past midnight. */
function toMinutes(time) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** How long a shift runs, in minutes. */
function durationOf({ start_time, end_time, end_day_offset }) {
  const a = toMinutes(start_time);
  const b = toMinutes(end_time);
  if (a === null || b === null) return null;
  return Number(end_day_offset || 0) * DAY + (b - a);
}

/**
 * Every occurrence of a shift as week-segments.
 *
 * Returns [{ day, segments: [[from, to), ...] }]. A shift is always shorter
 * than a week (the end-day offset is capped at 6), so an occurrence splits
 * into at most two segments.
 */
function occurrences(shift) {
  const startMin = toMinutes(shift.start_time);
  const length = durationOf(shift);
  if (startMin === null || length === null || length <= 0) return [];

  return (shift.days_of_week || []).map((day) => {
    const from = ((Number(day) - 1) * DAY + startMin) % WEEK;
    const to = from + length;
    const segments =
      to <= WEEK ? [[from, to]] : [[from, WEEK], [0, to - WEEK]];
    return { day: Number(day), segments };
  });
}

const segmentsIntersect = (a, b) =>
  a.some(([s1, e1]) => b.some(([s2, e2]) => s1 < e2 && s2 < e1));

/**
 * Does this shift's pattern collide with itself?
 *
 * Returns a message naming the two days, or null.
 */
function selfOverlap(shift) {
  const occ = occurrences(shift);
  for (let i = 0; i < occ.length; i++) {
    for (let j = i + 1; j < occ.length; j++) {
      if (segmentsIntersect(occ[i].segments, occ[j].segments)) {
        const hours = (durationOf(shift) / 60).toFixed(1).replace(/\.0$/, "");
        return (
          `This shift runs ${hours} hours, which is longer than the gap between `
          + `${DAY_NAME[occ[i].day]} and ${DAY_NAME[occ[j].day]}, so those two `
          + `occurrences would overlap — the same crew on shift twice at once. `
          + `Shorten it, or put the days on separate shifts.`
        );
      }
    }
  }
  return null;
}

/**
 * Does this shift collide with another one that shares any of its crew?
 *
 * Only shared crew matters: two shifts running at the same time are fine as
 * long as they are different people. `others` is [{ id, name, days_of_week,
 * start_time, end_time, end_day_offset, member_ids }].
 */
function crewOverlap(shift, memberIds, others) {
  const mine = occurrences(shift);
  const crew = new Set((memberIds || []).map(Number));

  for (const other of others) {
    const shared = (other.member_ids || [])
      .map(Number)
      .filter((id) => crew.has(id));
    if (!shared.length) continue;

    const theirs = occurrences(other);
    for (const a of mine) {
      for (const b of theirs) {
        if (segmentsIntersect(a.segments, b.segments)) {
          return {
            shift_id: other.id,
            staff_ids: shared,
            message:
              `Overlaps "${other.name || `shift #${other.id}`}" on `
              + `${DAY_NAME[a.day]}, and ${shared.length} of the crew are on both. `
              + `Someone cannot work two shifts at the same time.`,
          };
        }
      }
    }
  }
  return null;
}

module.exports = { selfOverlap, crewOverlap, occurrences, durationOf, toMinutes };
