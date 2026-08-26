/**
 * The Products Stock Report as a downloadable document.
 *
 * Only describes the report — columns, headings, totals and caveats. The
 * actual Excel/PDF layout lives in reportExport.js and is shared with every
 * other report, so downloads look and behave the same wherever they come from.
 *
 * Rows arrive from stockBalanceReport.fetchStockBalance, so a file always says
 * the same thing the screen does. Nothing here recomputes a figure.
 */

const { toWorkbook, toPdf } = require("./reportExport");

/** "As at 2026-08-20 14:30", or a plain range when no time was asked for. */
function describePeriod(filters) {
  const { start_date, end_date, end_time } = filters;
  const asAt = end_time ? `${end_date} ${end_time}` : end_date;
  return start_date === end_date ? `As at ${asAt}` : `${start_date} to ${asAt}`;
}

function describeFilters(filters) {
  const bits = [describePeriod(filters), `Quality: ${filters.quality}`];
  if (filters.point_in_time) {
    bits.push("Point-in-time — untimed movements excluded");
  }
  return bits.join("   ·   ");
}

// pdf:false on the quality columns — they matter in a spreadsheet you can
// filter, but on paper they crowd out the figures people actually read.
const COLUMNS = [
  { key: "product_name", header: "Product", width: 26, type: "text", weight: 3.2 },
  { key: "outlet_name", header: "Outlet", width: 20, type: "text", weight: 2.4 },
  { key: "unit", header: "Unit", width: 9, type: "text", weight: 1 },
  { key: "opening_balance", header: "Opening", width: 11, type: "qty" },
  { key: "incoming", header: "In", width: 10, type: "qty" },
  { key: "outgoing", header: "Out", width: 10, type: "qty" },
  { key: "closing_balance", header: "Closing", width: 11, type: "qty" },
  { key: "good", header: "Good", width: 10, type: "qty", pdf: false },
  { key: "damaged", header: "Damaged", width: 10, type: "qty", pdf: false },
  { key: "reject", header: "Reject", width: 10, type: "qty", pdf: false },
  { key: "price", header: "Unit Price", width: 13, type: "money" },
  { key: "total_value", header: "Total Value", width: 15, type: "money" },
];

/** Lifts the nested quality breakdown up to flat columns. */
function flatten(row) {
  const q = row.quality_breakdown || {};
  return { ...row, good: q.good ?? 0, damaged: q.damaged ?? 0, reject: q.reject ?? 0 };
}

function buildSpec({ stockData, summary, filters }) {
  // The uncertainty band only exists for a point-in-time reading. Saying so in
  // the file matters more than on screen, because a spreadsheet outlives the
  // filter bar that produced it.
  const untimed = Number(summary.totalUntimedCount) || 0;
  const note =
    filters.point_in_time && untimed > 0
      ? `${untimed} movement(s) on ${filters.end_date} have no recorded time `
        + `(${Number(summary.totalUntimedNet).toLocaleString()} net units) and are NOT `
        + `included above. The true closing balance lies between the figure shown and `
        + `${(Number(summary.totalClosing) + Number(summary.totalUntimedNet)).toLocaleString()}.`
      : null;

  return {
    title: "Products Stock Report",
    subtitle: describeFilters(filters),
    columns: COLUMNS,
    rows: stockData.map(flatten),
    totals: {
      opening_balance: summary.totalOpening,
      incoming: summary.totalIncoming,
      outgoing: summary.totalOutgoing,
      closing_balance: summary.totalClosing,
      total_value: summary.totalValue,
    },
    note,
  };
}

const toStockWorkbook = (report) => toWorkbook(buildSpec(report), "Stock Balance");
const toStockPdf = (report) => toPdf(buildSpec(report));

module.exports = {
  toWorkbook: toStockWorkbook,
  toPdf: toStockPdf,
  describePeriod,
};
