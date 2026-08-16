// Shared formatting/helpers for the boards module, used across
// BoardsList, Board and CardDialog so the three don't drift.
import moment from "moment";

export function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatDate(value) {
  return value ? moment(value).format("DD/MM/YYYY") : "";
}

export function formatDateTime(value) {
  return value ? moment(value).format("DD/MM/YYYY HH:mm") : "";
}

export function isOverdue(card) {
  return card.due_at && !card.due_complete && new Date(card.due_at) < new Date();
}

export const PRIORITY_COLORS = {
  URGENT: "red-darken-2",
  HIGH: "orange-darken-1",
  NORMAL: "blue-grey",
  LOW: "grey",
};

export function minutesToHuman(minutes) {
  const m = Number(minutes || 0);
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h > 0 ? `${h}h ${rest}m` : `${rest}m`;
}
