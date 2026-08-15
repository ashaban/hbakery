// Money is Tanzanian shillings, which has no subunit in practice — no
// one prices bread in cents — so totals read as whole numbers.
export function money (value) {
  return `TZS ${Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

// Quantities come back as NUMERIC(14,3) strings like "50.000". Bread is
// counted whole, so drop the noise but keep a genuine fraction.
export function qty (value) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : String(n);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * "17 Aug 2026" from a "YYYY-MM-DD" string.
 *
 * Read straight out of the string rather than via `new Date(...)`: a
 * date-only value has no timezone, and re-parsing it through Date
 * assigns one, which shifts the day for anyone whose device clock sits
 * on the other side of midnight UTC. A customer being told the wrong
 * delivery day is exactly the bug that causes.
 */
export function formatDate (value) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return String(value);
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

const STATUS_META = {
  PENDING: { label: "Awaiting confirmation", color: "orange" },
  PARTIALLY_SCHEDULED: { label: "Partly scheduled", color: "amber-darken-2" },
  SCHEDULED: { label: "Delivery scheduled", color: "primary" },
  PARTIALLY_DELIVERED: { label: "Partly delivered", color: "teal" },
  DELIVERED: { label: "Delivered", color: "success" },
  CANCELLED: { label: "Cancelled", color: "grey" },
};

export function statusLabel (status) {
  return STATUS_META[status]?.label || status;
}

export function statusColor (status) {
  return STATUS_META[status]?.color || "grey";
}
