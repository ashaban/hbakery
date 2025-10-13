import moment from 'moment'

export const toDisplay = (date) =>
  date ? moment(date).format('DD-MM-YYYY HH:mm') : ''

export const toISO = (date) =>
  date ? moment(date, 'DD-MM-YYYY HH:mm').format("YYYY-MM-DD HH:mm") : null
