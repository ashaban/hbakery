// Helpers for capturing WHEN a stock movement happened, as opposed to which
// business day it belongs to.
//
// Background: the ledger's business date and its event time are separate
// fields on purpose (migration 020). Roughly two thirds of entries in this
// system are made days after the fact, so a time must never be invented —
// a blank time is recorded honestly as "not known", and the stock report
// reports it as an uncertainty band rather than folding it into a balance.
//
// Hence the rule these helpers encode: offer "now" only when the entry is
// for today, and clear the time the moment the user backdates the form.

import { toISODateOnly } from "@/utils/date";

/** "14:30" for right now, in the browser's local time. */
export function nowHHMM () {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Is this display-format date (DD/MM/YYYY) today? */
export function isToday (displayDate) {
  if (!displayDate) return false;
  const iso = toISODateOnly(displayDate);
  const t = new Date();
  const todayIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  return iso === todayIso;
}

/**
 * What the time field should become when the date changes.
 *
 * Returns "now" for a fresh same-day entry so live capture costs nobody a
 * keystroke, and "" as soon as the date moves off today — guessing a time
 * for a backdated entry is exactly the error this whole feature exists to
 * avoid. A time the user typed themselves is always left alone.
 */
export function timeForDate (displayDate, currentTime, userEdited) {
  if (userEdited) return currentTime;
  return isToday(displayDate) ? nowHHMM() : "";
}

/**
 * Combines a display date and an "HH:mm" into the timestamp the API takes,
 * or null when no time was given ("not recorded").
 */
export function toEventTimestamp (displayDate, time) {
  if (!time) return null;
  const iso = toISODateOnly(displayDate);
  if (!iso) return null;
  return `${iso} ${time.length === 5 ? `${time}:00` : time}`;
}
