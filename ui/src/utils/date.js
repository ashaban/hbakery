import moment from 'moment'

// These wrap fields backed by Postgres `timestamp without time zone`
// columns (planned_at, produced_at) — plain wall-clock values with no
// timezone meaning ("8:30am on the 23rd", full stop). The backend always
// sends them as 'DD/MM/YYYY HH:mm'-parseable strings (via TO_CHAR)
// specifically so they can't be reinterpreted as a UTC instant and shifted
// when rendered in a browser whose timezone differs from the server's —
// that mismatch previously (and silently) moved planned/produced dates by
// up to a day once resaved. `moment(date, 'DD/MM/YYYY HH:mm')` still
// handles a raw Date object fine (the format is ignored for non-string
// input), so this covers both a string from the API and `new Date()` for
// "now". toISO's *output* format (YYYY-MM-DD HH:mm) is what the backend
// actually stores — unambiguous regardless of locale — only toDisplay's
// format is what the user reads/types, hence the slash.
export const toDisplay = (date) =>
  date ? moment(date, 'DD-MM-YYYY HH:mm').format('DD/MM/YYYY HH:mm') : ''

export const toISO = (date) =>
  date ? moment(date, ['DD/MM/YYYY HH:mm', 'DD-MM-YYYY HH:mm']).format('YYYY-MM-DD HH:mm') : null

// ---------------------------------------------------------------------
// Pure display formatting — for read-only rendering (tables, cards,
// detail views), not round-tripped back to a form/API.
//
// Deliberately string-based, not `new Date(x).toLocaleDateString()`: that
// pattern is what caused the planned_at/sale_date bugs earlier — a
// date-only value has no timezone, but re-parsing it through Date()
// assigns it one (the server's, or the browser's), and a viewer in a
// different timezone than whichever was assumed sees the wrong day. These
// functions instead read the calendar date straight out of the string
// wherever the format is recognised, and only fall back to Date() parsing
// for inputs that don't match a known safe shape.
// ---------------------------------------------------------------------

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function pad2(n) {
  return String(n).padStart(2, '0')
}

// Pulls {y, m, d, hh, mm} out of a string without ever constructing a
// Date from it. Recognises: YYYY-MM-DD(THH:MM...), DD-MM-YYYY(THH:MM),
// DD/MM/YYYY(THH:MM). Returns null if nothing matches.
function parseDateParts(str) {
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(str)
  if (m) return { y: m[1], m: m[2], d: m[3], hh: m[4], mm: m[5] }

  m = /^(\d{2})[-/](\d{2})[-/](\d{4})(?:[T ](\d{2}):(\d{2}))?/.exec(str)
  if (m) return { y: m[3], m: m[2], d: m[1], hh: m[4], mm: m[5] }

  return null
}

/** "DD/MM/YYYY" from any recognised date/timestamp string or Date object. */
export function formatDMY(input) {
  if (!input) return ''
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return ''
    return `${pad2(input.getDate())}/${pad2(input.getMonth() + 1)}/${input.getFullYear()}`
  }
  const parts = parseDateParts(String(input))
  if (parts) return `${parts.d}/${parts.m}/${parts.y}`
  const d = new Date(input)
  if (isNaN(d.getTime())) return String(input)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** "DD/MM/YYYY HH:mm" — same rules as formatDMY, plus time when present. */
export function formatDMYHM(input) {
  if (!input) return ''
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return ''
    return (
      `${pad2(input.getDate())}/${pad2(input.getMonth() + 1)}/${input.getFullYear()} ` +
      `${pad2(input.getHours())}:${pad2(input.getMinutes())}`
    )
  }
  const parts = parseDateParts(String(input))
  if (parts) {
    const time = parts.hh != null ? ` ${parts.hh}:${parts.mm}` : ''
    return `${parts.d}/${parts.m}/${parts.y}${time}`
  }
  const d = new Date(input)
  if (isNaN(d.getTime())) return String(input)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * Local Date object for validation/comparison (e.g. "is this date in the
 * past?"), from a DD/MM/YYYY or DD-MM-YYYY string. Several components had
 * their own copy of this that only recognised dashes — hyphens.split("-")
 * silently mis-parses (or fails to parse) a slash-separated date, so this
 * replaces them all with one implementation that accepts both.
 */
export function parseFlexibleDMY(dateInput) {
  if (!dateInput) return null
  if (dateInput instanceof Date) return dateInput

  if (typeof dateInput === 'string') {
    const parts = parseDateParts(dateInput)
    if (parts) {
      const date = new Date(Number(parts.y), Number(parts.m) - 1, Number(parts.d))
      if (!isNaN(date.getTime())) return date
    }
    const date = new Date(dateInput)
    if (!isNaN(date.getTime())) return date
  }

  return null
}

/**
 * "YYYY-MM-DD" from a DD/MM/YYYY or DD-MM-YYYY string/Date — for sending a
 * date-only value back to the API, which stores/compares it as a plain
 * DATE column (and, under this DB's MDY DateStyle, would misread a raw
 * DD/MM/YYYY string). Built on parseFlexibleDMY, so it shares the same
 * local-construction round-trip (no timezone reinterpretation).
 */
export function toISODateOnly(input) {
  const d = parseFlexibleDMY(input)
  if (!d) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** "DD Mon YYYY" (e.g. "23 Aug 2026") — for spots that want a friendlier
 *  read than pure numerals; same string-first safety as formatDMY. */
export function formatDMonY(input) {
  if (!input) return ''
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return ''
    return `${pad2(input.getDate())} ${MONTHS_SHORT[input.getMonth()]} ${input.getFullYear()}`
  }
  const parts = parseDateParts(String(input))
  if (parts) return `${parts.d} ${MONTHS_SHORT[Number(parts.m) - 1]} ${parts.y}`
  const d = new Date(input)
  if (isNaN(d.getTime())) return String(input)
  return `${pad2(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}
