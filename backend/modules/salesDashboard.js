const pool = require("../db");

// ---------------------------------------------------------
//  Helper: Build Date Range
// ---------------------------------------------------------
function getDateRange(timeRange) {
  const end = new Date();
  let start = new Date();

  switch (timeRange) {
    case "7d":
      start.setDate(end.getDate() - 7);
      break;
    case "90d":
      start.setDate(end.getDate() - 90);
      break;
    case "year":
      start = new Date(end.getFullYear(), 0, 1);
      break;
    case "30d":
    default:
      start.setDate(end.getDate() - 30);
      break;
  }

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

// ---------------------------------------------------------
//  Helper: Calculate Previous Period Growth
// ---------------------------------------------------------
async function calculateGrowthMetrics(conditions, params, startIdx, endIdx) {
  try {
    const currentStart = params[startIdx - 1];
    const currentEnd = params[endIdx - 1];

    const curStartDate = new Date(currentStart);
    const curEndDate = new Date(currentEnd);

    const periodMs = curEndDate - curStartDate;

    const prevEnd = new Date(curStartDate);
    prevEnd.setDate(prevEnd.getDate() - 1);

    const prevStart = new Date(prevEnd);
    prevStart.setTime(prevStart - periodMs);

    const prevStartStr = prevStart.toISOString().split("T")[0];
    const prevEndStr = prevEnd.toISOString().split("T")[0];

    const prevParams = [...params];
    prevParams[startIdx - 1] = prevStartStr;
    prevParams[endIdx - 1] = prevEndStr;

    const prevWhere = conditions.join(" AND ");

    const prevRevenueQuery = `
      SELECT COALESCE(SUM(si.quantity * si.unit_price),0) AS revenue
      FROM sale s
      JOIN sale_item si ON si.sale_id = s.id
      WHERE ${prevWhere}
    `;

    const prevSalesQuery = `
      SELECT COUNT(*) AS sales_count
      FROM sale s
      WHERE ${prevWhere}
    `;

    const prevRevenueRes = await pool.query(prevRevenueQuery, prevParams);
    const prevSalesRes = await pool.query(prevSalesQuery, prevParams);

    const prevRevenue = Number(prevRevenueRes.rows[0].revenue) || 0;
    const prevSales = Number(prevSalesRes.rows[0].sales_count) || 0;

    const curWhere = conditions.join(" AND ");

    const curRevenueQry = `
      SELECT COALESCE(SUM(si.quantity * si.unit_price),0) AS revenue
      FROM sale s
      JOIN sale_item si ON si.sale_id=s.id
      WHERE ${curWhere}
    `;
    const curSalesQry = `
      SELECT COUNT(*) AS sales_count
      FROM sale s
      WHERE ${curWhere}
    `;

    const curRevenueRes = await pool.query(curRevenueQry, params);
    const curSalesRes = await pool.query(curSalesQry, params);

    const curRevenue = Number(curRevenueRes.rows[0].revenue) || 0;
    const curSales = Number(curSalesRes.rows[0].sales_count) || 0;

    const revenueGrowth =
      prevRevenue > 0
        ? ((curRevenue - prevRevenue) / prevRevenue) * 100
        : curRevenue > 0
        ? 100
        : 0;

    const salesGrowth =
      prevSales > 0
        ? ((curSales - prevSales) / prevSales) * 100
        : curSales > 0
        ? 100
        : 0;

    return {
      revenueGrowth: Number(revenueGrowth.toFixed(1)),
      salesGrowth: Number(salesGrowth.toFixed(1)),
    };
  } catch (err) {
    console.error("Growth calculation error:", err);
    return { revenueGrowth: 0, salesGrowth: 0 };
  }
}

// ---------------------------------------------------------
//  SALES CONTROLLER
// ---------------------------------------------------------
const salesController = {
  // -------------------------------------------------------
  //  DASHBOARD ANALYTICS
  // -------------------------------------------------------
  async getSalesAnalytics(req, res) {
    try {
      const {
        payment_status,
        start_date,
        end_date,
        time_range = "30d",
      } = req.query;

      const conditions = ["s.status = 'POSTED'"];
      const params = [];
      let p = 0;

      // ---------------------------
      // OUTLET FILTER
      // ---------------------------
      if (req.query["outlet_id[]"] || req.query.outlet_id) {
        let outletIds = req.query["outlet_id[]"] || req.query.outlet_id;
        if (!Array.isArray(outletIds)) {
          outletIds = outletIds.toString().split(",").map(Number);
        } else {
          outletIds = outletIds.map(Number);
        }

        if (!(outletIds.length === 1 && outletIds[0] === -1)) {
          p++;
          params.push(outletIds);
          conditions.push(`s.outlet_id = ANY($${p})`);
        }
      }

      // ---------------------------
      // DATE RANGE
      // ---------------------------
      let dateStart, dateEnd;
      if (start_date && end_date) {
        dateStart = start_date;
        dateEnd = end_date;
      } else {
        const dr = getDateRange(time_range);
        dateStart = dr.start;
        dateEnd = dr.end;
      }

      p++;
      const startIdx = p;
      params.push(dateStart);

      p++;
      const endIdx = p;
      params.push(dateEnd);

      conditions.push(`s.sale_date BETWEEN $${startIdx} AND $${endIdx}`);

      // ---------------------------
      // PAYMENT STATUS FILTER
      // ---------------------------
      if (payment_status === "PAID") {
        conditions.push(`
          (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id)
          >=
          (SELECT SUM(quantity*unit_price) FROM sale_item si WHERE si.sale_id=s.id)
        `);
      } else if (payment_status === "PART") {
        conditions.push(`
          (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id) > 0
          AND
          (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id)
          <
          (SELECT SUM(quantity*unit_price) FROM sale_item si WHERE si.sale_id=s.id)
        `);
      } else if (payment_status === "PENDING") {
        conditions.push(`
          NOT EXISTS (SELECT 1 FROM sale_payment sp WHERE sp.sale_id=s.id)
        `);
      }

      const whereSQL = "WHERE " + conditions.join(" AND ");

      // ---------------------------
      // BASE QUERY
      // ---------------------------
      const baseSalesQuery = `
        SELECT
          s.id,
          SUM(si.quantity * si.unit_price) AS sale_amount,
          COUNT(si.id) AS item_count,
          SUM(si.quantity) AS total_quantity,
          (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id) AS paid_amount
        FROM sale s
        JOIN sale_item si ON si.sale_id=s.id
        ${whereSQL}
        GROUP BY s.id
      `;

      // ---------------------------
      // KPI RUNNER
      // ---------------------------
      async function runKPI(sql) {
        const useParams = sql.includes("$") ? params : [];
        const r = await pool.query(sql, useParams);
        return Number(r.rows[0].value) || 0;
      }

      const totalRevenue = await runKPI(`
        SELECT COALESCE(SUM(sale_amount),0) AS value
        FROM (${baseSalesQuery}) q
      `);

      const totalSales = await runKPI(`
        SELECT COUNT(*) AS value
        FROM (${baseSalesQuery}) q
      `);

      const outstandingBalance = await runKPI(`
        SELECT COALESCE(SUM(sale_amount - paid_amount),0) AS value
        FROM (${baseSalesQuery}) q
        WHERE sale_amount > paid_amount
      `);

      const avgOrder = await runKPI(`
        SELECT COALESCE(AVG(sale_amount),0) AS value
        FROM (${baseSalesQuery}) q
      `);

      const itemsPerSale = await runKPI(`
        SELECT COALESCE(AVG(item_count),0) AS value
        FROM (${baseSalesQuery}) q
      `);

      const pendingPayments = await runKPI(`
        SELECT COUNT(*) AS value
        FROM (${baseSalesQuery}) q
        WHERE sale_amount > paid_amount
      `);

      // ---------------------------
      // TREND
      // ---------------------------
      const revenueTrend = await pool.query(
        `
        SELECT
          DATE(s.sale_date) AS date,
          SUM(si.quantity*si.unit_price) AS revenue,
          COUNT(DISTINCT s.id) AS sales_count
        FROM sale s
        JOIN sale_item si ON si.sale_id=s.id
        ${whereSQL}
        GROUP BY DATE(s.sale_date)
        ORDER BY DATE(s.sale_date)
      `,
        params
      );

      // ---------------------------
      // OUTLET SALES
      // ---------------------------
      const outletSales = await pool.query(
        `
        SELECT
          o.name AS outlet_name,
          COALESCE(SUM(si.quantity*si.unit_price),0) AS revenue
        FROM outlet o
        LEFT JOIN sale s ON s.outlet_id=o.id
        LEFT JOIN sale_item si ON si.sale_id=s.id
        ${whereSQL}
        GROUP BY o.id
        HAVING SUM(si.quantity*si.unit_price) > 0
        ORDER BY revenue DESC
      `,
        params
      );

      // ---------------------------
      // PAYMENT STATUS SUMMARY
      // ---------------------------
      const paymentStatusResult = await pool.query(
        `
        SELECT status, COUNT(*) AS count
        FROM (
          SELECT 
            s.id,
            SUM(si.quantity*si.unit_price) AS sale_amount,
            (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id) AS paid_amount,
            CASE 
              WHEN (SELECT SUM(amount) FROM sale_payment sp WHERE sp.sale_id=s.id) IS NULL 
                THEN 'PENDING'
              WHEN (SELECT SUM(amount) FROM sale_payment sp WHERE sp.sale_id=s.id) = 0 
                THEN 'PENDING'
              WHEN (SELECT SUM(amount) FROM sale_payment sp WHERE sp.sale_id=s.id) < SUM(si.quantity*si.unit_price)
                THEN 'PART'
              ELSE 'PAID'
            END AS status
          FROM sale s
          JOIN sale_item si ON si.sale_id=s.id
          ${whereSQL}
          GROUP BY s.id
        ) x
        GROUP BY status
      `,
        params
      );

      // ---------------------------
      // TOP PRODUCTS
      // ---------------------------
      const topProducts = await pool.query(
        `
        SELECT 
          p.name AS product_name,
          SUM(si.quantity*si.unit_price) AS revenue,
          SUM(si.quantity) AS qty
        FROM product p
        JOIN sale_item si ON si.product_id=p.id
        JOIN sale s ON s.id=si.sale_id
        ${whereSQL}
        GROUP BY p.id
        ORDER BY revenue DESC
        LIMIT 10
      `,
        params
      );

      // ---------------------------
      // GROWTH METRICS
      // ---------------------------
      const growth = await calculateGrowthMetrics(
        conditions,
        params,
        startIdx,
        endIdx
      );

      // ---------------------------
      // SEND RESPONSE
      // ---------------------------
      res.json({
        kpi: {
          totalRevenue,
          totalSales,
          outstandingBalance,
          averageOrderValue: avgOrder,
          itemsPerSale,
          pendingPayments,
          revenueGrowth: growth.revenueGrowth,
          salesGrowth: growth.salesGrowth,
        },
        dashboard: {
          revenueTrend: revenueTrend.rows,
          outletSales: outletSales.rows,
          paymentStatus: paymentStatusResult.rows,
          topProducts: topProducts.rows,
        },
      });
    } catch (err) {
      console.error("Sales analytics error:", err);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  },

  // -------------------------------------------------------
  //  SALES LIST
  // -------------------------------------------------------
  async getSales(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        outlet_id,
        start_date,
        end_date,
        payment_status,
      } = req.query;

      const offset = (page - 1) * limit;

      const conditions = ["s.status='POSTED'"];
      const params = [];
      let p = 0;

      if (outlet_id) {
        let ids = Array.isArray(outlet_id) ? outlet_id : [outlet_id];
        ids = ids.map(Number);
        p++;
        params.push(ids);
        conditions.push(`s.outlet_id = ANY($${p})`);
      }

      if (start_date && end_date) {
        p++;
        const sIdx = p;
        params.push(start_date);

        p++;
        const eIdx = p;
        params.push(end_date);

        conditions.push(`s.sale_date BETWEEN $${sIdx} AND $${eIdx}`);
      }

      if (payment_status === "PAID") {
        conditions.push(`
          (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id) 
          >=
          (SELECT SUM(quantity*unit_price) FROM sale_item si WHERE si.sale_id=s.id)
        `);
      } else if (payment_status === "PART") {
        conditions.push(`
          (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id) > 0
          AND
          (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id)
          <
          (SELECT SUM(quantity*unit_price) FROM sale_item si WHERE si.sale_id=s.id)
        `);
      } else if (payment_status === "PENDING") {
        conditions.push(`
          NOT EXISTS (SELECT 1 FROM sale_payment sp WHERE sp.sale_id=s.id)
        `);
      }

      const whereSQL = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const countRes = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM sale s
        ${whereSQL}
      `,
        params
      );

      const total = Number(countRes.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      params.push(limit, offset);

      const salesRes = await pool.query(
        `
        SELECT
          s.id,
          s.sale_date,
          o.name AS outlet,
          o.type AS outlet_type,
          c.name AS customer_name,
          COUNT(si.id) AS items_count,
          COALESCE(SUM(si.quantity),0) AS total_qty,
          COALESCE(SUM(si.quantity*si.unit_price),0) AS total_amount,
          (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id) AS paid_amount,
          COALESCE(SUM(si.quantity*si.unit_price),0) -
          (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id) AS balance,
          s.notes
        FROM sale s
        LEFT JOIN outlet o ON o.id=s.outlet_id
        LEFT JOIN customer c ON c.id=s.customer_id
        LEFT JOIN sale_item si ON si.sale_id=s.id
        ${whereSQL}
        GROUP BY s.id, o.name, o.type, c.name
        ORDER BY s.sale_date DESC, s.id DESC
        LIMIT $${p + 1} OFFSET $${p + 2}
      `,
        params
      );

      res.json({
        data: salesRes.rows,
        totalPages,
        currentPage: Number(page),
        totalCount: total,
      });
    } catch (err) {
      console.error("Get sales error:", err);
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  },

  // -------------------------------------------------------
  //  SALE DETAILS
  // -------------------------------------------------------
  async getSaleDetails(req, res) {
    try {
      const { id } = req.params;

      const sale = await pool.query(
        `
        SELECT
          s.*,
          o.name AS outlet_name,
          o.type AS outlet_type,
          c.name AS customer_name,
          COALESCE(SUM(si.quantity*si.unit_price),0) AS total_amount,
          (SELECT COALESCE(SUM(amount),0) FROM sale_payment sp WHERE sp.sale_id=s.id) AS total_paid
        FROM sale s
        LEFT JOIN outlet o ON o.id=s.outlet_id
        LEFT JOIN customer c ON c.id=s.customer_id
        LEFT JOIN sale_item si ON si.sale_id=s.id
        WHERE s.id=$1
        GROUP BY s.id, o.name, o.type, c.name
      `,
        [id]
      );

      if (!sale.rows.length) {
        return res.status(404).json({ error: "Sale not found" });
      }

      const items = await pool.query(
        `
        SELECT si.*, p.name AS product_name
        FROM sale_item si
        JOIN product p ON p.id=si.product_id
        WHERE si.sale_id=$1
        ORDER BY si.id
      `,
        [id]
      );

      const payments = await pool.query(
        `
        SELECT *
        FROM sale_payment
        WHERE sale_id=$1
        ORDER BY payment_date, id
      `,
        [id]
      );

      res.json({
        sale: sale.rows[0],
        items: items.rows,
        payments: payments.rows,
      });
    } catch (err) {
      console.error("Sale detail error:", err);
      res.status(500).json({ error: "Failed to fetch sale details" });
    }
  },
};

module.exports = salesController;
