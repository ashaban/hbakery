/**
 * Excel and PDF rendering, shared by every report that offers a download.
 *
 * Reports differ in their columns and totals, not in how a document should
 * look — so the layout lives here once and each report hands over a spec.
 * A second hand-rolled renderer is how two reports start disagreeing about
 * what a header, a total or a money column means.
 *
 * A spec is:
 *   {
 *     title:    "Products Stock Report",
 *     subtitle: "2026-08-01 to 2026-08-20 · Quality: GOOD",
 *     columns:  [{ key, header, width, type: "text"|"qty"|"money", pdf?: false }],
 *     rows:     [ ...plain objects keyed by column key... ],
 *     totals:   { <column key>: value }        // optional; renders a TOTAL row
 *     note:     "…"                            // optional; italic caveat below
 *   }
 */

const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

/** Masthead on every exported document. */
const ORG = "Hanein Bakery - Bakery Information System";

const GREEN = "1B5E20";
const MONEY = "#,##0.00";
const QTY = "#,##0";

const isNum = (c) => c.type === "qty" || c.type === "money";

// ── Excel ────────────────────────────────────────────────────────────

async function toWorkbook({ title, subtitle, columns, rows, totals, note }, sheetName = "Report") {
  const wb = new ExcelJS.Workbook();
  wb.creator = ORG;
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName, {
    // Freeze through the header row so the masthead stays put while scrolling.
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      printTitlesRow: "1:5",
    },
  });

  const span = columns.length;

  ws.mergeCells(1, 1, 1, span);
  Object.assign(ws.getCell(1, 1), {
    value: ORG,
    font: { size: 11, bold: true, color: { argb: `FF${GREEN}` } },
  });

  ws.mergeCells(2, 1, 2, span);
  Object.assign(ws.getCell(2, 1), {
    value: title,
    font: { size: 15, bold: true },
  });

  ws.mergeCells(3, 1, 3, span);
  Object.assign(ws.getCell(3, 1), {
    value: subtitle,
    font: { size: 10, color: { argb: "FF666666" } },
  });

  ws.getRow(4).height = 6;

  const head = ws.getRow(5);
  columns.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${GREEN}` } };
    cell.alignment = { horizontal: isNum(c) ? "right" : "left" };
    ws.getColumn(i + 1).width = c.width || 14;
  });
  head.height = 20;

  const styleCells = (row) =>
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      if (c.type === "money") cell.numFmt = MONEY;
      if (c.type === "qty") cell.numFmt = QTY;
      cell.alignment = { horizontal: isNum(c) ? "right" : "left" };
    });

  rows.forEach((r) => {
    styleCells(
      ws.addRow(
        columns.map((c) => (isNum(c) ? Number(r[c.key]) || 0 : r[c.key] ?? ""))
      )
    );
  });

  if (totals) {
    const t = ws.addRow(
      columns.map((c, i) =>
        i === 0 ? "TOTAL" : (c.key in totals ? Number(totals[c.key]) || 0 : "")
      )
    );
    styleCells(t);
    t.eachCell((cell) => {
      cell.font = { bold: true };
      cell.border = { top: { style: "thin" } };
    });
  }

  if (note) {
    ws.addRow([]);
    const n = ws.addRow([note]);
    ws.mergeCells(n.number, 1, n.number, span);
    n.getCell(1).font = { italic: true, color: { argb: "FF8A5A00" } };
    n.getCell(1).alignment = { wrapText: true };
    n.height = 30;
  }

  return wb.xlsx.writeBuffer();
}

// ── PDF ──────────────────────────────────────────────────────────────

function toPdf({ title, subtitle, columns, rows, totals, note }) {
  // Columns can opt out of the PDF, which is narrower than a spreadsheet.
  const cols = columns.filter((c) => c.pdf !== false);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const usable = doc.page.width - left - doc.page.margins.right;
    const weight = (c) => c.weight || (isNum(c) ? 1.35 : 2.4);
    const totalWeight = cols.reduce((s, c) => s + weight(c), 0);
    const widths = cols.map((c) => (usable * weight(c)) / totalWeight);

    const num = (v, dp) =>
      (Number(v) || 0).toLocaleString("en-US", {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      });

    const cellText = (c, v) =>
      isNum(c) ? num(v, c.type === "money" ? 2 : 0) : String(v ?? "");

    function drawRow(cells, { head = false, bold = false } = {}) {
      const y = doc.y;
      const h = head ? 18 : 15;

      if (head) doc.rect(left, y, usable, h).fill(`#${GREEN}`);

      doc.font(head || bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5)
        .fillColor(head ? "#FFFFFF" : "#111111");

      let x = left;
      cells.forEach((text, i) => {
        doc.text(String(text), x + 4, y + (head ? 5 : 4), {
          width: widths[i] - 8,
          align: isNum(cols[i]) ? "right" : "left",
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

    function header() {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(`#${GREEN}`)
        .text(ORG, left, doc.page.margins.top);
      doc.font("Helvetica-Bold").fontSize(15).fillColor("#111111")
        .text(title, { width: usable });
      doc.font("Helvetica").fontSize(9).fillColor("#555")
        .text(subtitle, { width: usable });
      doc.moveDown(0.6);
      drawRow(cols.map((c) => c.header), { head: true });
    }

    header();

    rows.forEach((r) => {
      // Leave room for the totals line rather than orphaning it on its own page.
      if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        header();
      }
      drawRow(cols.map((c) => cellText(c, r[c.key])));
    });

    if (totals) {
      drawRow(
        cols.map((c, i) =>
          i === 0 ? "TOTAL" : (c.key in totals ? cellText(c, totals[c.key]) : "")
        ),
        { bold: true }
      );
    }

    if (note) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#8A5A00")
        .text(note, { width: usable });
    }

    doc.font("Helvetica").fontSize(7.5).fillColor("#888")
      .text(
        `Generated ${new Date().toLocaleString()} · ${ORG}`,
        left,
        doc.page.height - doc.page.margins.bottom - 10,
        { width: usable, align: "right" }
      );

    doc.end();
  });
}

/** Sets Content-Type/Disposition and sends the buffer. */
function sendExport(res, { format, filename, body }) {
  res.setHeader(
    "Content-Type",
    format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(Buffer.from(body));
}

module.exports = { toWorkbook, toPdf, sendExport, ORG };
