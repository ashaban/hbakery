/**
 * The Sales Report as a downloadable document.
 *
 * Describes the report only — columns, headings and totals. Layout is shared
 * with every other report via reportExport.js, so a sales download and a stock
 * download look like they came from the same system.
 */

const { toWorkbook, toPdf } = require("./reportExport");

const PAYMENT_LABELS = {
  PAID: "Fully paid",
  PART: "Part paid",
  PENDING: "Unpaid",
};

function describeFilters(filters) {
  const bits = [];
  bits.push(
    filters.start_date && filters.end_date
      ? filters.start_date === filters.end_date
        ? `On ${filters.start_date}`
        : `${filters.start_date} to ${filters.end_date}`
      : "All dates"
  );
  if (filters.payment_status) {
    bits.push(PAYMENT_LABELS[filters.payment_status] || filters.payment_status);
  }
  if (filters.outlet_names) bits.push(`Outlets: ${filters.outlet_names}`);
  return bits.join("   ·   ");
}

// Notes are carried in the spreadsheet but dropped from the PDF, where a free
// text column would squeeze the figures people are actually reading.
const COLUMNS = [
  { key: "id", header: "Sale #", width: 10, type: "text", weight: 1.1 },
  { key: "sale_date", header: "Date", width: 13, type: "text", weight: 1.5 },
  { key: "outlet", header: "Outlet", width: 20, type: "text", weight: 2.2 },
  { key: "customer_name", header: "Customer", width: 22, type: "text", weight: 2.4 },
  { key: "items_count", header: "Items", width: 9, type: "qty" },
  { key: "total_qty", header: "Qty", width: 10, type: "qty" },
  { key: "total_amount", header: "Total", width: 15, type: "money" },
  { key: "paid_amount", header: "Paid", width: 15, type: "money" },
  { key: "balance", header: "Balance", width: 15, type: "money" },
  { key: "notes", header: "Notes", width: 30, type: "text", pdf: false },
];

const sum = (rows, key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);

function buildSpec({ rows, filters }) {
  return {
    title: "Sales Report",
    subtitle: describeFilters(filters),
    columns: COLUMNS,
    rows: rows.map((r) => ({ ...r, customer_name: r.customer_name || "Walk-in" })),
    totals: {
      items_count: sum(rows, "items_count"),
      total_qty: sum(rows, "total_qty"),
      total_amount: sum(rows, "total_amount"),
      paid_amount: sum(rows, "paid_amount"),
      balance: sum(rows, "balance"),
    },
  };
}

module.exports = {
  toWorkbook: (report) => toWorkbook(buildSpec(report), "Sales"),
  toPdf: (report) => toPdf(buildSpec(report)),
};
