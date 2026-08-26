/**
 * Excel and PDF renderings of the Products Stock Report.
 *
 * Both take the rows straight from stockBalanceReport.fetchStockBalance, so a
 * downloaded file always says the same thing the screen does. Nothing here
 * recomputes a figure — it only lays out what it is handed.
 */

const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

const MONEY = "#,##0.00";
const QTY = "#,##0";

/** "1 Aug 2026", or "1 Aug 2026 14:30" when a point in time was asked for. */
function describePeriod(filters) {
  const { start_date, end_date, end_time } = filters;
  const asAt = end_time ? `${end_date} ${end_time}` : end_date;
  return start_date === end_date
    ? `As at ${asAt}`
    : `${start_date} to ${asAt}`;
}

/** The filter line that appears under the title in both formats. */
function describeFilters(filters) {
  const bits = [describePeriod(filters), `Quality: ${filters.quality}`];
  if (filters.point_in_time) {
    bits.push("Point-in-time — untimed movements excluded");
  }
  return bits.join("   ·   ");
}

const COLUMNS = [
  { key: "product_name", header: "Product", width: 26, type: "text" },
  { key: "outlet_name", header: "Outlet", width: 20, type: "text" },
  { key: "unit", header: "Unit", width: 9, type: "text" },
  { key: "opening_balance", header: "Opening", width: 11, type: "qty" },
  { key: "incoming", header: "In", width: 10, type: "qty" },
  { key: "outgoing", header: "Out", width: 10, type: "qty" },
  { key: "closing_balance", header: "Closing", width: 11, type: "qty" },
  { key: "good", header: "Good", width: 10, type: "qty" },
  { key: "damaged", header: "Damaged", width: 10, type: "qty" },
  { key: "reject", header: "Reject", width: 10, type: "qty" },
  { key: "price", header: "Unit Price", width: 13, type: "money" },
  { key: "total_value", header: "Total Value", width: 15, type: "money" },
];

/** Flattens a report row into the shape the columns above expect. */
function flatten(row) {
  const q = row.quality_breakdown || {};
  return {
    ...row,
    good: q.good ?? 0,
    damaged: q.damaged ?? 0,
    reject: q.reject ?? 0,
  };
}

// ── Excel ────────────────────────────────────────────────────────────

async function toWorkbook({ stockData, summary, filters }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hanein Bakery";
  wb.created = new Date();

  const ws = wb.addWorksheet("Stock Balance", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  ws.mergeCells(1, 1, 1, COLUMNS.length);
  const title = ws.getCell(1, 1);
  title.value = "Products Stock Report";
  title.font = { size: 15, bold: true };

  ws.mergeCells(2, 1, 2, COLUMNS.length);
  const sub = ws.getCell(2, 1);
  sub.value = describeFilters(filters);
  sub.font = { size: 10, color: { argb: "FF666666" } };

  ws.getRow(3).height = 6;

  const head = ws.getRow(4);
  COLUMNS.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B5E20" } };
    cell.alignment = { horizontal: c.type === "text" ? "left" : "right" };
    ws.getColumn(i + 1).width = c.width;
  });
  head.height = 20;

  stockData.map(flatten).forEach((row) => {
    const r = ws.addRow(COLUMNS.map((c) => {
      const v = row[c.key];
      return c.type === "text" ? (v ?? "") : Number(v) || 0;
    }));
    COLUMNS.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      if (c.type === "money") cell.numFmt = MONEY;
      if (c.type === "qty") cell.numFmt = QTY;
      cell.alignment = { horizontal: c.type === "text" ? "left" : "right" };
    });
  });

  // Totals, from the same summary object the screen shows.
  const totals = ws.addRow(
    COLUMNS.map((c) => {
      switch (c.key) {
        case "product_name": return "TOTAL";
        case "opening_balance": return Number(summary.totalOpening) || 0;
        case "incoming": return Number(summary.totalIncoming) || 0;
        case "outgoing": return Number(summary.totalOutgoing) || 0;
        case "closing_balance": return Number(summary.totalClosing) || 0;
        case "total_value": return Number(summary.totalValue) || 0;
        default: return "";
      }
    })
  );
  totals.eachCell((cell, i) => {
    cell.font = { bold: true };
    cell.border = { top: { style: "thin" } };
    const c = COLUMNS[i - 1];
    if (c && c.type === "money") cell.numFmt = MONEY;
    if (c && c.type === "qty") cell.numFmt = QTY;
  });

  // The uncertainty band only exists for a point-in-time reading; saying so
  // in the file matters more than on screen, because a spreadsheet outlives
  // the filter bar that produced it.
  if (filters.point_in_time && Number(summary.totalUntimedCount) > 0) {
    ws.addRow([]);
    const note = ws.addRow([
      `${summary.totalUntimedCount} movement(s) on ${filters.end_date} have no recorded time `
      + `(${Number(summary.totalUntimedNet).toLocaleString()} net units) and are NOT included above. `
      + `The true closing balance lies between the figure shown and `
      + `${(Number(summary.totalClosing) + Number(summary.totalUntimedNet)).toLocaleString()}.`,
    ]);
    ws.mergeCells(note.number, 1, note.number, COLUMNS.length);
    note.getCell(1).font = { italic: true, color: { argb: "FF8A5A00" } };
    note.getCell(1).alignment = { wrapText: true };
    note.height = 30;
  }

  return wb.xlsx.writeBuffer();
}

// ── PDF ──────────────────────────────────────────────────────────────

/** Columns are narrower on paper; drop the ones that earn their space least. */
const PDF_COLUMNS = COLUMNS.filter(
  (c) => !["good", "damaged", "reject"].includes(c.key)
);

function toPdf({ stockData, summary, filters }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const usable = doc.page.width - left - doc.page.margins.right;
    const weights = { product_name: 3.2, outlet_name: 2.4, unit: 1 };
    const totalWeight = PDF_COLUMNS.reduce(
      (s, c) => s + (weights[c.key] || 1.35), 0
    );
    const widths = PDF_COLUMNS.map(
      (c) => (usable * (weights[c.key] || 1.35)) / totalWeight
    );

    const num = (v, dp) =>
      (Number(v) || 0).toLocaleString("en-US", {
        minimumFractionDigits: dp, maximumFractionDigits: dp,
      });

    function header() {
      doc.font("Helvetica-Bold").fontSize(15).fillColor("#1B5E20")
        .text("Products Stock Report", left, doc.page.margins.top);
      doc.font("Helvetica").fontSize(9).fillColor("#555")
        .text(describeFilters(filters), { width: usable });
      doc.moveDown(0.6);
      row(PDF_COLUMNS.map((c) => c.header), { head: true });
    }

    function row(cells, { head = false, bold = false } = {}) {
      const y = doc.y;
      const h = head ? 18 : 15;

      if (head) {
        doc.rect(left, y, usable, h).fill("#1B5E20");
      }
      doc.font(head || bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5)
        .fillColor(head ? "#FFFFFF" : "#111111");

      let x = left;
      cells.forEach((text, i) => {
        const c = PDF_COLUMNS[i];
        doc.text(String(text), x + 4, y + (head ? 5 : 4), {
          width: widths[i] - 8,
          align: c.type === "text" ? "left" : "right",
          lineBreak: false,
          ellipsis: true,
        });
        x += widths[i];
      });

      doc.y = y + h;
      if (!head) {
        doc.moveTo(left, doc.y).lineTo(left + usable, doc.y)
          .lineWidth(0.4).strokeColor(bold ? "#111111" : "#DDDDDD").stroke();
      }
      doc.fillColor("#111111");
    }

    header();

    stockData.map(flatten).forEach((r) => {
      // Leave room for the totals line rather than orphaning it on its own page.
      if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        header();
      }
      row(PDF_COLUMNS.map((c) => {
        const v = r[c.key];
        if (c.type === "text") return v ?? "";
        return num(v, c.type === "money" ? 2 : 0);
      }));
    });

    row(
      PDF_COLUMNS.map((c) => {
        switch (c.key) {
          case "product_name": return "TOTAL";
          case "opening_balance": return num(summary.totalOpening, 0);
          case "incoming": return num(summary.totalIncoming, 0);
          case "outgoing": return num(summary.totalOutgoing, 0);
          case "closing_balance": return num(summary.totalClosing, 0);
          case "total_value": return num(summary.totalValue, 2);
          default: return "";
        }
      }),
      { bold: true }
    );

    if (filters.point_in_time && Number(summary.totalUntimedCount) > 0) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#8A5A00")
        .text(
          `${summary.totalUntimedCount} movement(s) on ${filters.end_date} have no recorded time `
          + `(${num(summary.totalUntimedNet, 0)} net units) and are not included above. `
          + `The true closing balance lies between the figure shown and `
          + `${num(Number(summary.totalClosing) + Number(summary.totalUntimedNet), 0)}.`,
          { width: usable }
        );
    }

    doc.font("Helvetica").fontSize(7.5).fillColor("#888")
      .text(
        `Generated ${new Date().toLocaleString()} · Hanein Bakery`,
        left,
        doc.page.height - doc.page.margins.bottom - 10,
        { width: usable, align: "right" }
      );

    doc.end();
  });
}

module.exports = { toWorkbook, toPdf, describePeriod };
