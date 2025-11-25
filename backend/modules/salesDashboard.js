const pool = require("../db");

const salesController = {
  // Get sales analytics for dashboard
  async getSalesAnalytics(req, res) {
    try {
      const {
        outlet_id,
        start_date,
        end_date,
        payment_status,
        time_range = "30d",
      } = req.query;

      // Build WHERE conditions
      let whereConditions = [];
      let queryParams = [];

      // Handle outlet filter (array of outlet IDs)
      if (outlet_id) {
        const outletIds = Array.isArray(outlet_id) ? outlet_id : [outlet_id];
        whereConditions.push(
          `s.outlet_id IN (${outletIds
            .map((_, i) => `$${whereConditions.length + i + 1}`)
            .join(",")})`
        );
        queryParams.push(...outletIds);
      }

      // Handle date range
      let dateCondition = "";
      if (start_date && end_date) {
        dateCondition = `AND s.sale_date BETWEEN $${
          whereConditions.length + 1
        } AND $${whereConditions.length + 2}`;
        queryParams.push(start_date, end_date);
      } else {
        // Apply time range filter
        const dateRange = getDateRange(time_range);
        dateCondition = `AND s.sale_date BETWEEN $${
          whereConditions.length + 1
        } AND $${whereConditions.length + 2}`;
        queryParams.push(dateRange.start, dateRange.end);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")} ${dateCondition}`
          : `WHERE 1=1 ${dateCondition}`;

      // KPI Queries - CORRECTED VERSION
      const kpiQueries = {
        totalRevenue: `
          SELECT COALESCE(SUM(si.quantity * si.unit_price), 0) as total_revenue
          FROM sale s
          JOIN sale_item si ON s.id = si.sale_id
          ${whereClause}
          AND s.status = 'POSTED'
        `,

        totalSales: `
          SELECT COUNT(*) as total_sales
          FROM sale s
          ${whereClause}
          AND s.status = 'POSTED'
        `,

        outstandingBalance: `
          SELECT COALESCE(SUM(total_sales.total_amount - COALESCE(total_sales.total_paid, 0)), 0) as outstanding_balance
          FROM (
            SELECT 
              s.id,
              SUM(si.quantity * si.unit_price) as total_amount,
              (
                SELECT COALESCE(SUM(amount), 0) 
                FROM sale_payment sp 
                WHERE sp.sale_id = s.id
              ) as total_paid
            FROM sale s
            JOIN sale_item si ON s.id = si.sale_id
            ${whereClause}
            AND s.status = 'POSTED'
            GROUP BY s.id
          ) total_sales
        `,

        averageOrderValue: `
          SELECT COALESCE(AVG(order_totals.total_amount), 0) as avg_order_value
          FROM (
            SELECT s.id, SUM(si.quantity * si.unit_price) as total_amount
            FROM sale s
            JOIN sale_item si ON s.id = si.sale_id
            ${whereClause}
            AND s.status = 'POSTED'
            GROUP BY s.id
          ) order_totals
        `,

        itemsPerSale: `
          SELECT COALESCE(AVG(item_count), 0) as items_per_sale
          FROM (
            SELECT s.id, COUNT(si.id) as item_count
            FROM sale s
            JOIN sale_item si ON s.id = si.sale_id
            ${whereClause}
            AND s.status = 'POSTED'
            GROUP BY s.id
          ) sale_items
        `,

        pendingPayments: `
          SELECT COUNT(*) as pending_payments
          FROM (
            SELECT s.id
            FROM sale s
            JOIN sale_item si ON s.id = si.sale_id
            ${whereClause}
            AND s.status = 'POSTED'
            GROUP BY s.id
            HAVING SUM(si.quantity * si.unit_price) > COALESCE((
              SELECT SUM(amount) 
              FROM sale_payment sp 
              WHERE sp.sale_id = s.id
            ), 0)
          ) pending_sales
        `,
      };

      // Execute KPI queries
      const kpiResults = {};
      for (const [key, query] of Object.entries(kpiQueries)) {
        const result = await pool.query(query, queryParams);
        kpiResults[key] = parseFloat(result.rows[0][key]) || 0;
      }

      // Revenue Trend Data (Last 30 days)
      const revenueTrendQuery = `
        SELECT 
          DATE(s.sale_date) as date,
          COALESCE(SUM(si.quantity * si.unit_price), 0) as revenue,
          COUNT(DISTINCT s.id) as sales_count
        FROM sale s
        JOIN sale_item si ON s.id = si.sale_id
        ${whereClause.replace("1=1", "1=1")}
        AND s.status = 'POSTED'
        GROUP BY DATE(s.sale_date)
        ORDER BY DATE(s.sale_date)
      `;

      const revenueTrendResult = await pool.query(
        revenueTrendQuery,
        queryParams
      );

      // Sales by Outlet
      const outletSalesQuery = `
        SELECT 
          o.name as outlet_name,
          COALESCE(SUM(si.quantity * si.unit_price), 0) as revenue
        FROM outlet o
        LEFT JOIN sale s ON o.id = s.outlet_id AND s.status = 'POSTED'
        LEFT JOIN sale_item si ON s.id = si.sale_id
        ${
          whereConditions.length > 0
            ? `WHERE ${whereConditions.join(" AND ")}`
            : ""
        }
        GROUP BY o.id, o.name
        HAVING COALESCE(SUM(si.quantity * si.unit_price), 0) > 0
        ORDER BY revenue DESC
      `;

      const outletSalesResult = await pool.query(
        outletSalesQuery,
        queryParams.slice(0, whereConditions.length)
      );

      // Payment Status - CORRECTED VERSION
      const paymentStatusQuery = `
        SELECT 
          payment_status as status,
          COUNT(*) as count
        FROM (
          SELECT 
            s.id,
            CASE 
              WHEN COALESCE((
                SELECT SUM(amount) 
                FROM sale_payment sp 
                WHERE sp.sale_id = s.id
              ), 0) = 0 THEN 'PENDING'
              WHEN COALESCE((
                SELECT SUM(amount) 
                FROM sale_payment sp 
                WHERE sp.sale_id = s.id
              ), 0) < SUM(si.quantity * si.unit_price) THEN 'PART'
              ELSE 'PAID'
            END as payment_status
          FROM sale s
          JOIN sale_item si ON s.id = si.sale_id
          ${whereClause}
          AND s.status = 'POSTED'
          GROUP BY s.id
        ) payment_statuses
        GROUP BY payment_status
      `;

      const paymentStatusResult = await pool.query(
        paymentStatusQuery,
        queryParams
      );

      // Top Products
      const topProductsQuery = `
        SELECT 
          p.name as product_name,
          COALESCE(SUM(si.quantity * si.unit_price), 0) as revenue
        FROM product p
        JOIN sale_item si ON p.id = si.product_id
        JOIN sale s ON si.sale_id = s.id
        ${whereClause}
        AND s.status = 'POSTED'
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT 10
      `;

      const topProductsResult = await pool.query(topProductsQuery, queryParams);

      // Calculate growth percentages
      const growthData = await calculateGrowthMetrics(whereClause, queryParams);

      // Format the response to match your frontend expectations
      const response = {
        kpi: {
          totalRevenue: kpiResults.totalRevenue,
          totalSales: kpiResults.totalSales,
          outstandingBalance: kpiResults.outstandingBalance,
          averageOrderValue: kpiResults.averageOrderValue,
          revenueGrowth: growthData.revenueGrowth,
          salesGrowth: growthData.salesGrowth,
          pendingPayments: kpiResults.pendingPayments,
          itemsPerSale: kpiResults.itemsPerSale,
        },
        dashboard: {
          revenueTrend: revenueTrendResult.rows,
          outletSales: outletSalesResult.rows,
          paymentStatus: paymentStatusResult.rows,
          topProducts: topProductsResult.rows,
        },
      };

      res.json(response);
    } catch (error) {
      console.error("Sales analytics error:", error);
      res
        .status(500)
        .json({
          error: "Failed to fetch sales analytics",
          details: error.message,
        });
    }
  },

  // Get sales list with pagination and filters - CORRECTED VERSION
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

      // Build WHERE conditions
      let whereConditions = ["s.status = $1"];
      let queryParams = ["POSTED"];

      // Handle outlet filter
      if (outlet_id) {
        const outletIds = Array.isArray(outlet_id) ? outlet_id : [outlet_id];
        whereConditions.push(
          `s.outlet_id IN (${outletIds
            .map((_, i) => `$${whereConditions.length + i + 1}`)
            .join(",")})`
        );
        queryParams.push(...outletIds);
      }

      // Handle date range
      if (start_date && end_date) {
        whereConditions.push(
          `s.sale_date BETWEEN $${whereConditions.length + 1} AND $${
            whereConditions.length + 2
          }`
        );
        queryParams.push(start_date, end_date);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Count query
      const countQuery = `
        SELECT COUNT(DISTINCT s.id) as total_count
        FROM sale s
        ${whereClause}
      `;

      const countResult = await pool.query(countQuery, queryParams);
      const totalCount = parseInt(countResult.rows[0].total_count);

      // Main data query - CORRECTED VERSION with payment status filtering
      let salesQuery = `
        SELECT 
          s.id,
          s.sale_date,
          o.name as outlet,
          o.type as outlet_type,
          c.name as customer_name,
          COUNT(si.id) as items_count,
          COALESCE(SUM(si.quantity), 0) as total_qty,
          COALESCE(SUM(si.quantity * si.unit_price), 0) as total_amount,
          COALESCE((
            SELECT SUM(amount) 
            FROM sale_payment sp 
            WHERE sp.sale_id = s.id
          ), 0) as paid_amount,
          COALESCE(SUM(si.quantity * si.unit_price), 0) - COALESCE((
            SELECT SUM(amount) 
            FROM sale_payment sp 
            WHERE sp.sale_id = s.id
          ), 0) as balance,
          s.notes
        FROM sale s
        LEFT JOIN outlet o ON s.outlet_id = o.id
        LEFT JOIN customer c ON s.customer_id = c.id
        LEFT JOIN sale_item si ON s.id = si.sale_id
        ${whereClause}
        GROUP BY s.id, o.name, o.type, c.name, s.sale_date, s.notes
      `;

      // Apply payment status filter after the main query
      if (payment_status) {
        if (payment_status === "PAID") {
          salesQuery += ` HAVING COALESCE(SUM(si.quantity * si.unit_price), 0) <= COALESCE((
            SELECT SUM(amount) 
            FROM sale_payment sp 
            WHERE sp.sale_id = s.id
          ), 0)`;
        } else if (payment_status === "PART") {
          salesQuery += ` HAVING COALESCE((
            SELECT SUM(amount) 
            FROM sale_payment sp 
            WHERE sp.sale_id = s.id
          ), 0) > 0 AND COALESCE((
            SELECT SUM(amount) 
            FROM sale_payment sp 
            WHERE sp.sale_id = s.id
          ), 0) < COALESCE(SUM(si.quantity * si.unit_price), 0)`;
        } else if (payment_status === "PENDING") {
          salesQuery += ` HAVING COALESCE((
            SELECT SUM(amount) 
            FROM sale_payment sp 
            WHERE sp.sale_id = s.id
          ), 0) = 0`;
        }
      }

      salesQuery += ` ORDER BY s.sale_date DESC, s.id DESC LIMIT $${
        queryParams.length + 1
      } OFFSET $${queryParams.length + 2}`;

      const salesParams = [...queryParams, limit, offset];
      const salesResult = await pool.query(salesQuery, salesParams);

      res.json({
        data: salesResult.rows,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: parseInt(page),
        totalCount,
      });
    } catch (error) {
      console.error("Get sales error:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch sales", details: error.message });
    }
  },

  // Get sale details by ID
  async getSaleDetails(req, res) {
    try {
      const { id } = req.params;

      // Sale basic info
      const saleQuery = `
        SELECT 
          s.*,
          o.name as outlet_name,
          o.type as outlet_type,
          c.name as customer_name,
          COALESCE(SUM(si.quantity * si.unit_price), 0) as total_amount,
          COALESCE((
            SELECT SUM(amount) 
            FROM sale_payment sp 
            WHERE sp.sale_id = s.id
          ), 0) as total_paid
        FROM sale s
        LEFT JOIN outlet o ON s.outlet_id = o.id
        LEFT JOIN customer c ON s.customer_id = c.id
        LEFT JOIN sale_item si ON s.id = si.sale_id
        WHERE s.id = $1
        GROUP BY s.id, o.name, o.type, c.name
      `;

      const saleResult = await pool.query(saleQuery, [id]);

      if (saleResult.rows.length === 0) {
        return res.status(404).json({ error: "Sale not found" });
      }

      // Sale items
      const itemsQuery = `
        SELECT 
          si.*,
          p.name as product_name
        FROM sale_item si
        JOIN product p ON si.product_id = p.id
        WHERE si.sale_id = $1
        ORDER BY si.id
      `;

      const itemsResult = await pool.query(itemsQuery, [id]);

      // Sale payments
      const paymentsQuery = `
        SELECT *
        FROM sale_payment
        WHERE sale_id = $1
        ORDER BY payment_date, id
      `;

      const paymentsResult = await pool.query(paymentsQuery, [id]);

      res.json({
        sale: saleResult.rows[0],
        items: itemsResult.rows,
        payments: paymentsResult.rows,
      });
    } catch (error) {
      console.error("Get sale details error:", error);
      res
        .status(500)
        .json({
          error: "Failed to fetch sale details",
          details: error.message,
        });
    }
  },
};

// Helper function to calculate date ranges
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
      start.setFullYear(end.getFullYear(), 0, 1);
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

// Helper function to calculate growth metrics
async function calculateGrowthMetrics(whereClause, queryParams) {
  try {
    // Get current period data (last 30 days)
    const currentEnd = new Date();
    const currentStart = new Date();
    currentStart.setDate(currentEnd.getDate() - 30);

    // Get previous period data (30-60 days ago)
    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - 30);

    // Current period revenue
    const currentRevenueQuery = `
      SELECT COALESCE(SUM(si.quantity * si.unit_price), 0) as revenue
      FROM sale s
      JOIN sale_item si ON s.id = si.sale_id
      ${whereClause}
      AND s.sale_date BETWEEN $${queryParams.length + 1} AND $${
      queryParams.length + 2
    }
      AND s.status = 'POSTED'
    `;

    const currentRevenueParams = [
      ...queryParams,
      currentStart.toISOString().split("T")[0],
      currentEnd.toISOString().split("T")[0],
    ];
    const currentRevenueResult = await pool.query(
      currentRevenueQuery,
      currentRevenueParams
    );
    const currentRevenue =
      parseFloat(currentRevenueResult.rows[0].revenue) || 0;

    // Previous period revenue
    const previousRevenueQuery = `
      SELECT COALESCE(SUM(si.quantity * si.unit_price), 0) as revenue
      FROM sale s
      JOIN sale_item si ON s.id = si.sale_id
      ${whereClause}
      AND s.sale_date BETWEEN $${queryParams.length + 1} AND $${
      queryParams.length + 2
    }
      AND s.status = 'POSTED'
    `;

    const previousRevenueParams = [
      ...queryParams,
      previousStart.toISOString().split("T")[0],
      previousEnd.toISOString().split("T")[0],
    ];
    const previousRevenueResult = await pool.query(
      previousRevenueQuery,
      previousRevenueParams
    );
    const previousRevenue =
      parseFloat(previousRevenueResult.rows[0].revenue) || 0;

    // Current period sales count
    const currentSalesQuery = `
      SELECT COUNT(*) as sales_count
      FROM sale s
      ${whereClause}
      AND s.sale_date BETWEEN $${queryParams.length + 1} AND $${
      queryParams.length + 2
    }
      AND s.status = 'POSTED'
    `;

    const currentSalesResult = await pool.query(
      currentSalesQuery,
      currentRevenueParams
    );
    const currentSales = parseInt(currentSalesResult.rows[0].sales_count) || 0;

    // Previous period sales count
    const previousSalesResult = await pool.query(
      currentSalesQuery,
      previousRevenueParams
    );
    const previousSales =
      parseInt(previousSalesResult.rows[0].sales_count) || 0;

    // Calculate growth percentages
    const revenueGrowth =
      previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : 0;
    const salesGrowth =
      previousSales > 0
        ? ((currentSales - previousSales) / previousSales) * 100
        : 0;

    return {
      revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
      salesGrowth: parseFloat(salesGrowth.toFixed(1)),
    };
  } catch (error) {
    console.error("Growth calculation error:", error);
    return { revenueGrowth: 0, salesGrowth: 0 };
  }
}

module.exports = salesController;
