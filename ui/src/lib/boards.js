/** Shared vocabulary for boards, so every screen labels things identically. */

export const PRIORITIES = [
  { value: "URGENT", label: "Urgent", color: "#C62828", icon: "mdi-flag" },
  { value: "HIGH", label: "High", color: "#EF6C00", icon: "mdi-flag" },
  { value: "NORMAL", label: "Normal", color: "#0277BD", icon: "mdi-flag-outline" },
  { value: "LOW", label: "Low", color: "#78909C", icon: "mdi-flag-outline" },
];

export const priorityMeta = (value) => PRIORITIES.find((p) => p.value === value) || null;

/** Ordering for "most important first" — cards with no priority sort last. */
export const priorityRank = (value) => {
  const i = PRIORITIES.findIndex((p) => p.value === value);
  return i === -1 ? PRIORITIES.length : i;
};

export const STATUS_CATEGORIES = [
  { value: "TODO", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Complete" },
];

export const LABEL_COLORS = [
  "#2E7D32", "#0277BD", "#C62828", "#EF6C00",
  "#6A1B9A", "#00838F", "#558B2F", "#4E342E",
];

export const LIST_COLORS = [null, "#2E7D32", "#0277BD", "#C62828", "#EF6C00", "#6A1B9A", "#00838F"];

/**
 * How a due date should read on a card: overdue is the only genuinely
 * alarming state, so it is the only one coloured red.
 */
export function dueMeta(dueAt, complete) {
  if (!dueAt) return null;
  const at = new Date(dueAt);
  const hours = (at - new Date()) / 36e5;
  return {
    at,
    overdue: !complete && hours < 0,
    soon: !complete && hours >= 0 && hours < 24,
    color: complete ? "success" : hours < 0 ? "error" : hours < 24 ? "warning" : undefined,
  };
}

/** The empty filter, shared by the store and the filter bar. */
export function blankFilter() {
  return {
    labels: [], members: [], statuses: [], priorities: [],
    due: null, watching: false, text: "",
  };
}

const pad = (n) => String(n).padStart(2, "0");

/** A value <input type="datetime-local"> understands. */
export function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function relativeTime(value) {
  if (!value) return "";
  const secs = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

/** Minutes as "2h 30m" — the form effort is actually discussed in. */
export function hhmm(mins) {
  const m = Number(mins || 0);
  if (!m) return "0m";
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h ? `${h}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}
