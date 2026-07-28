import moment from 'moment'

// These wrap fields backed by Postgres `timestamp without time zone`
// columns (planned_at, produced_at) — plain wall-clock values with no
// timezone meaning ("8:30am on the 23rd", full stop). The backend always
// sends them as 'DD-MM-YYYY HH:mm' strings (via TO_CHAR) specifically so
// they can't be reinterpreted as a UTC instant and shifted when rendered
// in a browser whose timezone differs from the server's — that mismatch
// previously (and silently) moved planned/produced dates by up to a day
// once resaved. `moment(date, 'DD-MM-YYYY HH:mm')` still handles a raw
// Date object fine (the format is ignored for non-string input), so this
// covers both a string from the API and `new Date()` for "now".
export const toDisplay = (date) =>
  date ? moment(date, 'DD-MM-YYYY HH:mm').format('DD-MM-YYYY HH:mm') : ''

export const toISO = (date) =>
  date ? moment(date, 'DD-MM-YYYY HH:mm').format("YYYY-MM-DD HH:mm") : null
