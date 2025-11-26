const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask, decodeToken } = require("../middleware/auth");

router.get(
  "/stock-balance",
  requireTask("can_see_product_stock_balances"),
  async (req, res) => {
    const user = await decodeToken(req);
    const client = await pool.connect();
    try {
      const {
        product_id,
        outlet_id,
        start_date,
        end_date,
        quality = "GOOD",
        page = 1,
        limit = 20,
      } = req.query;
      let outletIds = [outlet_id];
      if (!outlet_id && user.outlets) {
        outletIds = user.outlets.map((outlet) => {
          return outlet.outlet_id;
        });
      } else if (!outlet_id && user.outlets.length === 0) {
        outletIds = [-1];
      }

      // Date handling
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - 30);
      const finalStartDate =
        start_date || defaultStartDate.toISOString().split("T")[0];
      const finalEndDate = end_date || new Date().toISOString().split("T")[0];

      if (new Date(finalStartDate) > new Date(finalEndDate)) {
        return res
          .status(400)
          .json({ error: "Start date cannot be after end date" });
      }

      const validQualities = ["GOOD", "DAMAGED", "REJECT", "ALL"];
      const finalQuality = validQualities.includes(quality) ? quality : "GOOD";

      // SIMPLE DIRECT QUERY - NO COMPLEX CTEs
      const stockQuery = `
WITH ledger AS (
  SELECT
    pl.product_id,
    pl.outlet_id,
    pl.quality,
    CASE
      WHEN pl.movement_type IN ('IN', 'TRANSFER_IN', 'RETURN') THEN pl.quantity
      WHEN pl.movement_type IN ('OUT', 'TRANSFER_OUT', 'SALE') THEN -pl.quantity
      WHEN pl.movement_type = 'QUALITY_CHANGE' THEN pl.quantity
      ELSE 0
    END AS effective_qty,
    pl.movement_date
  FROM product_ledger pl
  WHERE
    ($1::int IS NULL OR pl.product_id = $1)
    AND (pl.outlet_id = ANY($2))
    AND pl.movement_date <= $4::date
),

opening AS (
  SELECT
    product_id,
    outlet_id,
    quality,
    SUM(effective_qty) AS opening_balance
  FROM ledger
  WHERE movement_date < $3::date
  GROUP BY product_id, outlet_id, quality
),

period_movements AS (
  SELECT
    product_id,
    outlet_id,
    quality,
    SUM(CASE WHEN effective_qty > 0 THEN effective_qty ELSE 0 END) AS incoming,
    SUM(CASE WHEN effective_qty < 0 THEN ABS(effective_qty) ELSE 0 END) AS outgoing
  FROM ledger
  WHERE movement_date BETWEEN $3::date AND $4::date
  GROUP BY product_id, outlet_id, quality
),

closing AS (
  SELECT
    product_id,
    outlet_id,
    quality,
    SUM(effective_qty) AS closing_balance
  FROM ledger
  GROUP BY product_id, outlet_id, quality
)

SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.unit,
  p.price,
  o.id AS outlet_id,
  o.name AS outlet_name,
  o.type AS outlet_type,

  COALESCE(op.opening_balance, 0) AS opening_balance,
  COALESCE(pm.incoming, 0) AS incoming,
  COALESCE(pm.outgoing, 0) AS outgoing,
  COALESCE(cl.closing_balance, 0) AS closing_balance,

  -- Quality breakdowns for the same outlet/product
  COALESCE((
    SELECT SUM(cl2.closing_balance)
    FROM closing cl2
    WHERE cl2.product_id = p.id AND cl2.outlet_id = o.id AND cl2.quality = 'GOOD'
  ), 0) AS current_good,
  COALESCE((
    SELECT SUM(cl2.closing_balance)
    FROM closing cl2
    WHERE cl2.product_id = p.id AND cl2.outlet_id = o.id AND cl2.quality = 'DAMAGED'
  ), 0) AS current_damaged,
  COALESCE((
    SELECT SUM(cl2.closing_balance)
    FROM closing cl2
    WHERE cl2.product_id = p.id AND cl2.outlet_id = o.id AND cl2.quality = 'REJECT'
  ), 0) AS current_reject

FROM product p
JOIN outlet o ON o.is_active = true
LEFT JOIN opening op ON op.product_id = p.id AND op.outlet_id = o.id AND ($5 = 'ALL' OR op.quality = $5)
LEFT JOIN period_movements pm ON pm.product_id = p.id AND pm.outlet_id = o.id AND ($5 = 'ALL' OR pm.quality = $5)
LEFT JOIN closing cl ON cl.product_id = p.id AND cl.outlet_id = o.id AND ($5 = 'ALL' OR cl.quality = $5)
WHERE
  ($1::int IS NULL OR p.id = $1)
  AND (o.id = ANY($2))
ORDER BY o.name, p.name;
`;

      const result = await client.query(stockQuery, [
        product_id,
        outletIds,
        finalStartDate,
        finalEndDate,
        finalQuality,
      ]);

      const stockData = result.rows.map((row) => {
        const opening_balance = Number(row.opening_balance) || 0;
        const incoming = Number(row.incoming) || 0;
        const outgoing = Number(row.outgoing) || 0;
        const closing_balance = opening_balance + incoming - outgoing;

        return {
          product_id: row.product_id,
          product_name: row.product_name,
          unit: row.unit,
          price: Number(row.price) || 0,
          outlet_id: row.outlet_id,
          outlet_name: row.outlet_name,
          outlet_type: row.outlet_type,
          quality_breakdown: {
            good: Math.max(0, Number(row.current_good) || 0),
            damaged: Math.max(0, Number(row.current_damaged) || 0),
            reject: Math.max(0, Number(row.current_reject) || 0),
            total: Math.max(
              0,
              Number(row.current_good) +
                Number(row.current_damaged) +
                Number(row.current_reject)
            ),
          },
          opening_balance: opening_balance,
          incoming: incoming,
          outgoing: outgoing,
          closing_balance: closing_balance,
          total_value: closing_balance * (Number(row.price) || 0),
        };
      });

      // Simple pagination
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;
      const totalRecords = stockData.length;
      const totalPages = Math.ceil(totalRecords / limitNum);
      const paginatedData = stockData.slice(offset, offset + limitNum);

      // Generate summary
      const summary = {
        totalProducts: new Set(stockData.map((item) => item.product_id)).size,
        totalOutlets: new Set(stockData.map((item) => item.outlet_id)).size,
        totalOpening: stockData.reduce(
          (sum, item) => sum + item.opening_balance,
          0
        ),
        totalIncoming: stockData.reduce((sum, item) => sum + item.incoming, 0),
        totalOutgoing: stockData.reduce((sum, item) => sum + item.outgoing, 0),
        totalClosing: stockData.reduce(
          (sum, item) => sum + item.closing_balance,
          0
        ),
        totalValue: stockData.reduce((sum, item) => sum + item.total_value, 0),
      };

      // Generate chart data
      const chartData = generateChartData(stockData);

      res.json({
        filters: {
          product_id: product_id || null,
          outlet_id: outlet_id || null,
          quality: finalQuality,
          start_date: finalStartDate,
          end_date: finalEndDate,
        },
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalRecords,
          limit: limitNum,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
        summary,
        chartData,
        data: paginatedData,
      });
    } catch (err) {
      console.error("❌ Error generating stock balance report:", err);
      res.status(500).json({
        error: "Failed to generate stock balance report",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    } finally {
      client.release();
    }

    function generateChartData(stockData) {
      if (!stockData.length)
        return { products: [], outlets: [], qualityDistribution: [] };

      const productAggregation = {};
      const outletAggregation = {};
      const qualityDistribution = {};

      stockData.forEach((item) => {
        // Product aggregation (existing)
        if (!productAggregation[item.product_name]) {
          productAggregation[item.product_name] = {
            opening: 0,
            incoming: 0,
            outgoing: 0,
            closing: 0,
            value: 0,
          };
        }
        productAggregation[item.product_name].opening += item.opening_balance;
        productAggregation[item.product_name].incoming += item.incoming;
        productAggregation[item.product_name].outgoing += item.outgoing;
        productAggregation[item.product_name].closing += item.closing_balance;
        productAggregation[item.product_name].value += item.total_value;

        // Outlet aggregation (existing)
        if (!outletAggregation[item.outlet_name]) {
          outletAggregation[item.outlet_name] = {
            opening: 0,
            incoming: 0,
            outgoing: 0,
            closing: 0,
            value: 0,
          };
        }
        outletAggregation[item.outlet_name].opening += item.opening_balance;
        outletAggregation[item.outlet_name].incoming += item.incoming;
        outletAggregation[item.outlet_name].outgoing += item.outgoing;
        outletAggregation[item.outlet_name].closing += item.closing_balance;
        outletAggregation[item.outlet_name].value += item.total_value;

        // Quality Distribution by Product (NEW)
        if (!qualityDistribution[item.product_name]) {
          qualityDistribution[item.product_name] = {
            GOOD: 0,
            DAMAGED: 0,
            REJECT: 0,
            total: 0,
          };
        }
        qualityDistribution[item.product_name].GOOD +=
          item.quality_breakdown.good;
        qualityDistribution[item.product_name].DAMAGED +=
          item.quality_breakdown.damaged;
        qualityDistribution[item.product_name].REJECT +=
          item.quality_breakdown.reject;
        qualityDistribution[item.product_name].total +=
          item.quality_breakdown.total;
      });

      return {
        products: Object.entries(productAggregation).map(([name, data]) => ({
          name,
          ...data,
        })),
        outlets: Object.entries(outletAggregation).map(([name, data]) => ({
          name,
          ...data,
        })),
        // NEW: Quality distribution data
        qualityDistribution: Object.entries(qualityDistribution)
          .map(([productName, qualities]) => ({
            product: productName,
            good: qualities.GOOD,
            damaged: qualities.DAMAGED,
            reject: qualities.REJECT,
            total: qualities.total,
            goodPercentage:
              qualities.total > 0
                ? ((qualities.GOOD / qualities.total) * 100).toFixed(1)
                : 0,
            damagedPercentage:
              qualities.total > 0
                ? ((qualities.DAMAGED / qualities.total) * 100).toFixed(1)
                : 0,
            rejectPercentage:
              qualities.total > 0
                ? ((qualities.REJECT / qualities.total) * 100).toFixed(1)
                : 0,
          }))
          .sort((a, b) => b.total - a.total), // Sort by total stock descending
      };
    }

    function generateStockSummary(stockData) {
      const summary = {
        totalProducts: new Set(stockData.map((item) => item.product_id)).size,
        totalOutlets: new Set(stockData.map((item) => item.outlet_id)).size,
        totalOpening: stockData.reduce(
          (sum, item) => sum + item.opening_balance,
          0
        ),
        totalIncoming: stockData.reduce((sum, item) => sum + item.incoming, 0),
        totalOutgoing: stockData.reduce((sum, item) => sum + item.outgoing, 0),
        totalClosing: stockData.reduce(
          (sum, item) => sum + item.closing_balance,
          0
        ),
        totalValue: stockData.reduce((sum, item) => sum + item.total_value, 0),
      };

      return summary;
    }
  }
);

router.get(
  "/quality-adjustments",
  requireTask("can_see_quality_adjustment_report"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const {
        product_id,
        outlet_id,
        start_date,
        end_date,
        from_quality,
        to_quality,
        is_replacement,
        page = 1,
        limit = 20,
      } = req.query;

      // Date handling
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - 30);
      const finalStartDate =
        start_date || defaultStartDate.toISOString().split("T")[0];
      const finalEndDate = end_date || new Date().toISOString().split("T")[0];

      if (new Date(finalStartDate) > new Date(finalEndDate)) {
        return res
          .status(400)
          .json({ error: "Start date cannot be after end date" });
      }

      // Simple query - just get all QUALITY_CHANGE movements and process in JavaScript
      const simpleQuery = `
      SELECT 
        pl.id,
        pl.product_id,
        p.name as product_name,
        p.unit,
        p.price,
        pl.outlet_id,
        o.name as outlet_name,
        o.type as outlet_type,
        pl.quality,
        pl.quantity,
        pl.is_replacement,
        pl.replacement_note,
        pl.movement_date,
        pl.created_at,
        pl.remarks,
        pl.created_by,
        u.name as created_by_name,
        pl.production_id,
        pl.transfer_id,
        pl.sale_id,
        (ABS(pl.quantity) * p.price) as adjustment_value
      FROM product_ledger pl
      JOIN product p ON pl.product_id = p.id
      JOIN outlet o ON pl.outlet_id = o.id
      LEFT JOIN users u ON pl.created_by = u.id
      WHERE pl.movement_type = 'QUALITY_CHANGE'
        AND pl.movement_date BETWEEN $1 AND $2
        AND ($3::int IS NULL OR pl.product_id = $3)
        AND ($4::int IS NULL OR pl.outlet_id = $4)
        AND ($5::boolean IS NULL OR pl.is_replacement = $5)
      ORDER BY pl.movement_date DESC, pl.created_at DESC
      LIMIT $6 OFFSET $7
    `;

      const countQuery = `
      SELECT COUNT(*) as total
      FROM product_ledger pl
      WHERE pl.movement_type = 'QUALITY_CHANGE'
        AND pl.movement_date BETWEEN $1 AND $2
        AND ($3::int IS NULL OR pl.product_id = $3)
        AND ($4::int IS NULL OR pl.outlet_id = $4)
        AND ($5::boolean IS NULL OR pl.is_replacement = $5)
    `;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // Prepare parameters
      const queryParams = [
        finalStartDate,
        finalEndDate,
        product_id || null,
        outlet_id || null,
        is_replacement && is_replacement !== "ALL"
          ? is_replacement === "true"
          : null,
        limitNum,
        offset,
      ];

      const countParams = queryParams.slice(0, -2); // Remove LIMIT/OFFSET

      const [result, countResult] = await Promise.all([
        client.query(simpleQuery, queryParams),
        client.query(countQuery, countParams),
      ]);

      const totalRecords = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalRecords / limitNum);

      // Process the data in JavaScript to match quality change pairs
      const adjustmentsData = processQualityChanges(
        result.rows,
        from_quality,
        to_quality
      );

      // Generate chart data and summary
      const chartData = generateQualityChartData(adjustmentsData);
      const summary = generateQualitySummary(adjustmentsData);

      res.json({
        filters: {
          product_id: product_id || null,
          outlet_id: outlet_id || null,
          from_quality: from_quality || null,
          to_quality: to_quality || null,
          is_replacement: is_replacement || null,
          start_date: finalStartDate,
          end_date: finalEndDate,
        },
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalRecords,
          limit: limitNum,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
        summary,
        chartData,
        data: adjustmentsData,
      });
    } catch (err) {
      console.error("❌ Error generating quality adjustments report:", err);
      res.status(500).json({
        error: "Failed to generate quality adjustments report",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    } finally {
      client.release();
    }

    function processQualityChanges(rows, from_quality, to_quality) {
      // Group rows by their matching criteria
      const groups = {};

      rows.forEach((row) => {
        const key = `${row.product_id}-${row.outlet_id}-${row.movement_date}-${row.production_id}-${row.transfer_id}-${row.sale_id}`;

        if (!groups[key]) {
          groups[key] = { negative: null, positive: null };
        }

        if (row.quantity < 0) {
          groups[key].negative = row;
        } else if (row.quantity > 0) {
          groups[key].positive = row;
        }
      });

      // Create matched pairs
      const adjustments = [];

      Object.values(groups).forEach((group) => {
        if (
          group.negative &&
          group.positive &&
          Math.abs(group.negative.quantity) === group.positive.quantity
        ) {
          // Apply quality filters in JavaScript
          if (
            from_quality &&
            from_quality !== "ALL" &&
            group.negative.quality !== from_quality
          ) {
            return;
          }
          if (
            to_quality &&
            to_quality !== "ALL" &&
            group.positive.quality !== to_quality
          ) {
            return;
          }

          adjustments.push({
            id: group.negative.id,
            product_id: group.negative.product_id,
            product_name: group.negative.product_name,
            unit: group.negative.unit,
            outlet_id: group.negative.outlet_id,
            outlet_name: group.negative.outlet_name,
            outlet_type: group.negative.outlet_type,
            from_quality: group.negative.quality,
            to_quality: group.positive.quality,
            quantity: Math.abs(group.negative.quantity),
            is_replacement: group.negative.is_replacement,
            replacement_note: group.negative.replacement_note,
            movement_date: group.negative.movement_date,
            created_at: group.negative.created_at,
            remarks: group.negative.remarks,
            created_by: group.negative.created_by,
            created_by_name: group.negative.created_by_name || "System",
            adjustment_value: group.negative.adjustment_value,
            production_id: group.negative.production_id,
            transfer_id: group.negative.transfer_id,
            sale_id: group.negative.sale_id,
            reference_type: group.negative.production_id
              ? "PRODUCTION"
              : group.negative.transfer_id
              ? "TRANSFER"
              : group.negative.sale_id
              ? "SALE"
              : "DIRECT",
          });
        }
      });

      return adjustments;
    }

    function generateQualityChartData(adjustmentsData) {
      if (!adjustmentsData.length)
        return {
          qualityFlow: [],
          replacementAnalysis: [],
          monthlyTrend: [],
          productBreakdown: [],
          referenceTypeBreakdown: [],
          userBreakdown: [],
        };

      const qualityFlow = {};
      const replacementAnalysis = {
        total: 0,
        replacement: 0,
        nonReplacement: 0,
      };
      const monthlyTrend = {};
      const productBreakdown = {};
      const referenceTypeBreakdown = {};
      const userBreakdown = {};

      adjustmentsData.forEach((item) => {
        // Quality Flow Analysis
        const flowKey = `${item.from_quality} → ${item.to_quality}`;
        if (!qualityFlow[flowKey]) {
          qualityFlow[flowKey] = { count: 0, quantity: 0, value: 0 };
        }
        qualityFlow[flowKey].count += 1;
        qualityFlow[flowKey].quantity += item.quantity;
        qualityFlow[flowKey].value += item.adjustment_value;

        // Replacement Analysis
        replacementAnalysis.total += item.quantity;
        if (item.is_replacement) {
          replacementAnalysis.replacement += item.quantity;
        } else {
          replacementAnalysis.nonReplacement += item.quantity;
        }

        // Monthly Trend
        const monthKey = item.movement_date.toISOString().substring(0, 7); // YYYY-MM
        if (!monthlyTrend[monthKey]) {
          monthlyTrend[monthKey] = { adjustments: 0, quantity: 0, value: 0 };
        }
        monthlyTrend[monthKey].adjustments += 1;
        monthlyTrend[monthKey].quantity += item.quantity;
        monthlyTrend[monthKey].value += item.adjustment_value;

        // Product Breakdown
        if (!productBreakdown[item.product_name]) {
          productBreakdown[item.product_name] = {
            adjustments: 0,
            quantity: 0,
            value: 0,
          };
        }
        productBreakdown[item.product_name].adjustments += 1;
        productBreakdown[item.product_name].quantity += item.quantity;
        productBreakdown[item.product_name].value += item.adjustment_value;

        // Reference Type Breakdown
        if (!referenceTypeBreakdown[item.reference_type]) {
          referenceTypeBreakdown[item.reference_type] = {
            count: 0,
            quantity: 0,
            value: 0,
          };
        }
        referenceTypeBreakdown[item.reference_type].count += 1;
        referenceTypeBreakdown[item.reference_type].quantity += item.quantity;
        referenceTypeBreakdown[item.reference_type].value +=
          item.adjustment_value;

        // User Breakdown
        const userName = item.created_by_name || "Unknown";
        if (!userBreakdown[userName]) {
          userBreakdown[userName] = { count: 0, quantity: 0, value: 0 };
        }
        userBreakdown[userName].count += 1;
        userBreakdown[userName].quantity += item.quantity;
        userBreakdown[userName].value += item.adjustment_value;
      });

      return {
        qualityFlow: Object.entries(qualityFlow)
          .map(([flow, data]) => ({
            flow,
            ...data,
          }))
          .sort((a, b) => b.quantity - a.quantity),

        replacementAnalysis: {
          total: replacementAnalysis.total,
          replacement: replacementAnalysis.replacement,
          nonReplacement: replacementAnalysis.nonReplacement,
          replacementPercentage:
            replacementAnalysis.total > 0
              ? (
                  (replacementAnalysis.replacement /
                    replacementAnalysis.total) *
                  100
                ).toFixed(1)
              : 0,
          nonReplacementPercentage:
            replacementAnalysis.total > 0
              ? (
                  (replacementAnalysis.nonReplacement /
                    replacementAnalysis.total) *
                  100
                ).toFixed(1)
              : 0,
        },

        monthlyTrend: Object.entries(monthlyTrend)
          .map(([month, data]) => ({
            month,
            ...data,
          }))
          .sort((a, b) => a.month.localeCompare(b.month)),

        productBreakdown: Object.entries(productBreakdown)
          .map(([product, data]) => ({
            product,
            ...data,
          }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 10),

        referenceTypeBreakdown: Object.entries(referenceTypeBreakdown)
          .map(([type, data]) => ({
            type,
            ...data,
          }))
          .sort((a, b) => b.quantity - a.quantity),

        userBreakdown: Object.entries(userBreakdown)
          .map(([user, data]) => ({
            user,
            ...data,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      };
    }

    function generateQualitySummary(adjustmentsData) {
      const uniqueUsers = new Set(
        adjustmentsData.map((item) => item.created_by).filter(Boolean)
      );

      const summary = {
        totalAdjustments: adjustmentsData.length,
        totalQuantity: adjustmentsData.reduce(
          (sum, item) => sum + item.quantity,
          0
        ),
        totalValue: adjustmentsData.reduce(
          (sum, item) => sum + item.adjustment_value,
          0
        ),
        uniqueProducts: new Set(adjustmentsData.map((item) => item.product_id))
          .size,
        uniqueOutlets: new Set(adjustmentsData.map((item) => item.outlet_id))
          .size,
        uniqueUsers: uniqueUsers.size,
        replacementCount: adjustmentsData.filter((item) => item.is_replacement)
          .length,
        nonReplacementCount: adjustmentsData.filter(
          (item) => !item.is_replacement
        ).length,
        averageQuantity:
          adjustmentsData.length > 0
            ? adjustmentsData.reduce((sum, item) => sum + item.quantity, 0) /
              adjustmentsData.length
            : 0,
        // Quality direction metrics
        qualityDowngrades: adjustmentsData.filter(
          (item) =>
            (item.from_quality === "GOOD" && item.to_quality !== "GOOD") ||
            (item.from_quality === "DAMAGED" && item.to_quality === "REJECT")
        ).length,
        qualityUpgrades: adjustmentsData.filter(
          (item) =>
            (item.from_quality !== "GOOD" && item.to_quality === "GOOD") ||
            (item.from_quality === "REJECT" && item.to_quality === "DAMAGED")
        ).length,
      };

      return summary;
    }
  }
);

router.get(
  "/productionProfitability",
  requireTask("can_see_profit_projection_report"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { start_date, end_date, ingredients, products, team_leader } =
        req.query;

      const where = ["pp.produced_at IS NOT NULL"];
      const params = [];

      // 🗓️ Date range (produced_at)
      if (start_date && end_date) {
        params.push(start_date, end_date);
        where.push(
          `pp.produced_at::date BETWEEN $${params.length - 1}::date AND $${
            params.length
          }::date`
        );
      } else if (start_date) {
        params.push(start_date);
        where.push(`pp.produced_at::date >= $${params.length}::date`);
      } else if (end_date) {
        params.push(end_date);
        where.push(`pp.produced_at::date <= $${params.length}::date`);
      }

      // 🧂 Ingredients filter
      if (ingredients) {
        const arr = Array.isArray(ingredients) ? ingredients : [ingredients];
        const placeholders = arr
          .map((_, i) => `$${params.length + i + 1}`)
          .join(",");
        params.push(...arr);
        where.push(`ppi.item_id IN (${placeholders})`);
      }

      // 📦 Product filter
      if (products) {
        const arr = Array.isArray(products) ? products : [products];
        const placeholders = arr
          .map((_, i) => `$${params.length + i + 1}`)
          .join(",");
        params.push(...arr);
        where.push(`pp.product_id IN (${placeholders})`);
      }

      // 👷 Team leader filter
      if (team_leader) {
        params.push(`%${team_leader}%`);
        where.push(`
        EXISTS (
          SELECT 1
          FROM product_production_staff ps
          JOIN staff s ON s.id = ps.staff_id
          WHERE ps.production_id = pp.id
            AND ps.role = 'Team Leader'
            AND s.name ILIKE $${params.length}
        )
      `);
      }

      const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

      // 🧾 Ingredient consumption and cost (from item_ledger)
      const ingredientsSQL = `
      SELECT 
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        SUM(ABS(il.quantity)) AS total_consumed,
        AVG(il.unit_price) AS avg_price,
        SUM(ABS(il.quantity) * il.unit_price) AS total_cost
      FROM item_ledger il
      JOIN item i ON i.id = il.item_id
      JOIN product_production pp ON pp.id = il.production_id
      ${whereSQL ? `${whereSQL} AND il.type = 'OUT'` : `WHERE il.type = 'OUT'`}
      GROUP BY i.id, i.name
      ORDER BY i.name;
    `;
      const ingredientsRes = await client.query(ingredientsSQL, params);
      const ingredientData = ingredientsRes.rows;

      // 💰 Labour cost
      const labourSQL = `
      SELECT 
        COALESCE(SUM(s.salary / 30.0), 0) AS total_labour_cost
      FROM product_production pp
      JOIN product_production_staff ps ON ps.production_id = pp.id
      JOIN staff s ON s.id = ps.staff_id
      ${
        whereSQL
          ? `${whereSQL} AND pp.produced_at IS NOT NULL`
          : `WHERE pp.produced_at IS NOT NULL`
      };
    `;
      const labourRes = await client.query(labourSQL, params);
      const totalLabourCost = labourRes.rows[0]?.total_labour_cost || 0;

      // 📦 Produced products (revenue)
      const productsSQL = `
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        SUM(pp.actual_qty) AS total_produced,
        p.price AS selling_price,
        SUM(pp.actual_qty * p.price) AS total_value
      FROM product_production pp
      JOIN product p ON p.id = pp.product_id
      ${whereSQL}
      GROUP BY p.id, p.name, p.price
      ORDER BY p.name;
    `;
      const productsRes = await client.query(productsSQL, params);
      const productData = productsRes.rows;

      // 💵 Production Expenditures
      const expenditureParams = [];
      const expenditureWhere = [
        "ct.category = 'Production Cost'",
        "ct.name != 'Labour'",
      ];

      if (start_date && end_date) {
        expenditureParams.push(start_date, end_date);
        expenditureWhere.push(
          `e.start_date::date >= $1::date AND e.end_date::date <= $2::date`
        );
      } else if (start_date) {
        expenditureParams.push(start_date);
        expenditureWhere.push(
          `e.start_date::date >= $1::date AND e.end_date::date <= $1::date`
        );
      } else if (end_date) {
        expenditureParams.push(end_date);
        expenditureWhere.push(
          `e.end_date::date <= $1::date AND e.start_date::date >= $1::date`
        );
      }

      const expenditureSQL = `
      SELECT 
        e.id,
        e.description,
        e.amount,
        ct.name AS cost_type
      FROM expenditure e
      JOIN cost_type ct ON ct.id = e.type_id
      ${
        expenditureWhere.length ? `WHERE ${expenditureWhere.join(" AND ")}` : ""
      }
      ORDER BY e.start_date DESC;
    `;
      const expenditureRes = await client.query(
        expenditureSQL,
        expenditureParams
      );
      const expenditures = expenditureRes.rows;
      const totalExpenditure = expenditures.reduce(
        (sum, e) => sum + Number(e.amount || 0),
        0
      );

      // 📊 Totals
      const totalIngredientCost = ingredientData.reduce(
        (sum, i) => sum + Number(i.total_cost || 0),
        0
      );
      const totalRevenue = productData.reduce(
        (sum, p) => sum + Number(p.total_value || 0),
        0
      );
      const totalCost =
        totalIngredientCost + Number(totalLabourCost) + totalExpenditure;
      const margin = totalRevenue - totalCost;

      res.json({
        filters: { start_date, end_date, ingredients, products, team_leader },
        totals: {
          totalRevenue,
          totalIngredientCost,
          totalLabourCost,
          totalExpenditure,
          totalCost,
          margin,
        },
        ingredients: ingredientData,
        products: productData,
        expenditures,
      });
    } catch (err) {
      console.error("❌ Error generating profitability report:", err);
      res
        .status(500)
        .json({ error: "Failed to generate profitability report" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/stockStatus",
  requireTask("can_see_ingredients_stock_balances"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { start_date, end_date, items } = req.query;

      const where = [];
      const params = [];

      // Filter by selected items
      if (items) {
        const arr = Array.isArray(items) ? items : [items];
        const placeholders = arr
          .map((_, i) => `$${params.length + i + 1}`)
          .join(",");
        params.push(...arr);
        where.push(`i.id IN (${placeholders})`);
      }

      const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

      // 🧾 Opening balance
      const openingSQL = `
      SELECT 
        i.id AS item_id,
        i.name AS item_name,
        iu.name AS base_unit,
        i.human_readable_unit,
        i.conversion_factor,
        COALESCE(SUM(il.quantity), 0) AS opening_balance,
        COALESCE(SUM(il.quantity * il.unit_price), 0) AS total_price
      FROM item i
      JOIN itemunit iu ON iu.id = i.unit_id
      LEFT JOIN item_ledger il 
        ON il.item_id = i.id
        AND il.movement_date < $1::date
      ${whereSQL}
      GROUP BY i.id, i.name, iu.name, i.human_readable_unit, i.conversion_factor
    `;

      // 📥 Inwards
      const inwardSQL = `
      SELECT 
        i.id AS item_id,
        iu.name AS base_unit,
        i.human_readable_unit,
        i.conversion_factor,
        COALESCE(SUM(il.quantity), 0) AS inwards,
        COALESCE(SUM(il.quantity * il.unit_price), 0) AS total_price
      FROM item i
      JOIN itemunit iu ON iu.id = i.unit_id
      LEFT JOIN item_ledger il 
        ON il.item_id = i.id
        AND il.type = 'IN'
        AND il.movement_date BETWEEN $1::date AND $2::date
      ${whereSQL}
      GROUP BY i.id, iu.name, i.human_readable_unit, i.conversion_factor
    `;

      // 📤 Outwards
      const outwardSQL = `
      SELECT 
        i.id AS item_id,
        iu.name AS base_unit,
        i.human_readable_unit,
        i.conversion_factor,
        COALESCE(SUM(ABS(il.quantity)), 0) AS outwards,
        COALESCE(SUM(ABS(il.quantity) * il.unit_price), 0) AS total_price
      FROM item i
      JOIN itemunit iu ON iu.id = i.unit_id
      LEFT JOIN item_ledger il 
        ON il.item_id = i.id
        AND il.type = 'OUT'
        AND il.movement_date BETWEEN $1::date AND $2::date
      ${whereSQL}
      GROUP BY i.id, iu.name, i.human_readable_unit, i.conversion_factor
    `;

      const openingRes = await client.query(openingSQL, [
        start_date || "1900-01-01",
        ...(params.length ? params : []),
      ]);
      const inwardRes = await client.query(inwardSQL, [
        start_date || "1900-01-01",
        end_date || "2999-12-31",
        ...(params.length ? params : []),
      ]);
      const outwardRes = await client.query(outwardSQL, [
        start_date || "1900-01-01",
        end_date || "2999-12-31",
        ...(params.length ? params : []),
      ]);

      // 🧮 Combine results
      const result = new Map();

      function ensureItem(row) {
        if (!result.has(row.item_id)) {
          result.set(row.item_id, {
            item_id: row.item_id,
            item_name: row.item_name || "",
            base_unit: row.base_unit || "",
            human_readable_unit: row.human_readable_unit || "",
            conversion_factor: Number(row.conversion_factor || 1),
            opening_balance: 0,
            inwards: 0,
            outwards: 0,
            closing_balance: 0,
            total_price_opening: 0,
            total_price_inwards: 0,
            total_price_outwards: 0,
            total_price_closing: 0,
          });
        }
        return result.get(row.item_id);
      }

      // Merge all sets
      for (const r of openingRes.rows) {
        const it = ensureItem(r);
        it.opening_balance = Number(r.opening_balance);
        it.total_price_opening = Number(r.total_price);
      }
      for (const r of inwardRes.rows) {
        const it = ensureItem(r);
        it.inwards = Number(r.inwards);
        it.total_price_inwards = Number(r.total_price);
      }
      for (const r of outwardRes.rows) {
        const it = ensureItem(r);
        it.outwards = Number(r.outwards);
        it.total_price_outwards = Number(r.total_price);
      }

      // Compute derived metrics
      for (const it of result.values()) {
        it.closing_balance = it.opening_balance + it.inwards - it.outwards;
        it.total_price_closing =
          it.total_price_opening +
          it.total_price_inwards -
          it.total_price_outwards;

        // Human-readable quantities
        const cf = it.conversion_factor || 1;
        it.opening_balance_human = it.opening_balance * cf;
        it.inwards_human = it.inwards * cf;
        it.outwards_human = it.outwards * cf;
        it.closing_balance_human = it.closing_balance * cf;

        // Human-readable unit labels for display
        it.unit_label = it.human_readable_unit || it.base_unit;
      }

      res.json({
        filters: { start_date, end_date, items },
        data: Array.from(result.values()).sort((a, b) =>
          a.item_name.localeCompare(b.item_name)
        ),
      });
    } catch (err) {
      console.error("❌ Error generating stock status report:", err);
      res.status(500).json({ error: "Failed to generate stock status report" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/expenditureByType",
  requireTask("can_see_expenditures"),
  async (req, res) => {
    const start = req.query.start_date || null;
    const end = req.query.end_date || null;
    const typeId = req.query.type_id ? parseInt(req.query.type_id) : null;
    const affectsMargin = req.query.affects_margin || null;
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const offset = (page - 1) * limit;

    if (!start || !end) {
      return res
        .status(400)
        .json({ error: "start and end are required (YYYY-MM-DD)" });
    }

    const filters = [];
    const params = [start, end];

    if (typeId) {
      params.push(typeId);
      filters.push(`e.type_id = $${params.length}`);
    }
    if (affectsMargin) {
      params.push(affectsMargin);
      filters.push(`c.affects_margin = $${params.length}`);
    }

    const where = [`e.start_date <= $2`, `e.end_date >= $1`];
    if (filters.length) where.push(filters.join(" AND "));

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    try {
      const dataSql = `
      SELECT c.id AS type_id, c.name AS type_name, c.affects_margin,
      COALESCE(SUM(e.amount),0)::numeric(18,2) AS total_amount
      FROM expenditure e
      JOIN cost_type c ON c.id = e.type_id
      ${whereClause}
      GROUP BY c.id, c.name, c.affects_margin
      ORDER BY c.name
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

      const totalSql = `
      SELECT COALESCE(SUM(e.amount),0)::numeric(18,2) AS total_expenditure
      FROM expenditure e
      JOIN cost_type c ON c.id = e.type_id
      ${whereClause}`;

      const countSql = `
      SELECT COUNT(DISTINCT c.id) AS total_types
      FROM expenditure e
      JOIN cost_type c ON c.id = e.type_id
      ${whereClause}`;

      const dataParams = [...params, limit, offset];

      const [dataRes, totalRes, countRes] = await Promise.all([
        pool.query(dataSql, dataParams),
        pool.query(totalSql, params),
        pool.query(countSql, params),
      ]);

      const totalRecords = parseInt(countRes.rows[0].total_types || 0, 10);
      const totalPages = Math.ceil(totalRecords / limit);
      const totalExpenditure = Number(totalRes.rows[0].total_expenditure || 0);

      res.json({
        filters: { start, end, type_id: typeId, affects_margin: affectsMargin },
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        totalExpenditure,
        data: dataRes.rows,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load expenditures summary" });
    }
  }
);

router.get(
  "/productionIngredientsCost",
  requireTask("can_see_production"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { start_date, end_date, ingredients, products, team_leader } =
        req.query;

      const where = ["pp.produced_at IS NOT NULL"];
      const params = [];

      // 🗓️ Date range (produced_at)
      if (start_date && end_date) {
        params.push(start_date, end_date);
        where.push(
          `pp.produced_at::date BETWEEN $${params.length - 1}::date AND $${
            params.length
          }::date`
        );
      } else if (start_date) {
        params.push(start_date);
        where.push(`pp.produced_at::date >= $${params.length}::date`);
      } else if (end_date) {
        params.push(end_date);
        where.push(`pp.produced_at::date <= $${params.length}::date`);
      }

      // 🧂 Ingredients filter
      if (ingredients) {
        const arr = Array.isArray(ingredients) ? ingredients : [ingredients];
        const placeholders = arr
          .map((_, i) => `$${params.length + i + 1}`)
          .join(",");
        params.push(...arr);
        where.push(`ppi.item_id IN (${placeholders})`);
      }

      // 📦 Product filter
      if (products) {
        const arr = Array.isArray(products) ? products : [products];
        const placeholders = arr
          .map((_, i) => `$${params.length + i + 1}`)
          .join(",");
        params.push(...arr);
        where.push(`pp.product_id IN (${placeholders})`);
      }

      // 👷 Team leader filter
      if (team_leader) {
        params.push(`%${team_leader}%`);
        where.push(`
        EXISTS (
          SELECT 1
          FROM product_production_staff ps
          JOIN staff s ON s.id = ps.staff_id
          WHERE ps.production_id = pp.id
            AND ps.role = 'Team Leader'
            AND s.name ILIKE $${params.length}
        )
      `);
      }

      const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";
      // 🧾 Ingredient consumption and cost (from item_ledger)
      const ingredientsSQL = `
      SELECT 
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        SUM(ABS(il.quantity)) AS total_consumed,
        AVG(il.unit_price) AS avg_price,
        SUM(ABS(il.quantity) * il.unit_price) AS total_cost
      FROM item_ledger il
      JOIN item i ON i.id = il.item_id
      JOIN product_production pp ON pp.id = il.production_id
      ${whereSQL ? `${whereSQL} AND il.type = 'OUT'` : `WHERE il.type = 'OUT'`}
      GROUP BY i.id, i.name
      ORDER BY i.name;
    `;
      const ingredientsRes = await client.query(ingredientsSQL, params);
      const ingredientData = ingredientsRes.rows;

      // 📊 Totals
      const totalIngredientCost = ingredientData.reduce(
        (sum, i) => sum + Number(i.total_cost || 0),
        0
      );

      res.json({
        filters: { start_date, end_date, ingredients, products, team_leader },
        totalIngredientCost,
        data: ingredientData,
      });
    } catch (err) {
      console.error("❌ Error generating profitability report:", err);
      res
        .status(500)
        .json({ error: "Failed to generate profitability report" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/salesByProduct",
  requireTask("can_see_sales"),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      let where = ["s.status != 'CANCELLED'"];
      let params = [];
      let i = 0;

      if (req.query["outlet_id[]"] || req.query.outlet_id) {
        let outletIds = req.query["outlet_id[]"] || req.query.outlet_id;

        // Normalize into an array
        if (!Array.isArray(outletIds)) {
          outletIds = outletIds.toString().split(",").map(Number);
        } else {
          outletIds = outletIds.map(Number);
        }

        i++;
        params.push(outletIds);
        where.push(`s.outlet_id = ANY($${i})`);
      } else {
        i++;
        params.push([-1]);
        where.push(`s.outlet_id = ANY($${i})`);
      }

      if (req.query.start_date) {
        params.push(req.query.start_date);
        i++;
        where.push(`s.sale_date >= $${i}`);
      }

      if (req.query.end_date) {
        params.push(req.query.end_date);
        i++;
        where.push(`s.sale_date <= $${i}`);
      }

      const whereSQL = where.join(" AND ");

      // 1️⃣ Get grouped results per product
      const dataQuery = `
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        SUM(si.quantity) AS total_qty,
        SUM(si.quantity * si.unit_price) AS total_sales,
        SUM(COALESCE(sp.amount, 0)) AS total_paid
      FROM sale s
      JOIN sale_item si ON si.sale_id = s.id
      JOIN product p ON si.product_id = p.id
      LEFT JOIN sale_payment sp ON sp.sale_id = s.id
      WHERE ${whereSQL}
      GROUP BY p.id, p.name
      ORDER BY p.name ASC
      LIMIT $${i + 1} OFFSET $${i + 2}
    `;

      const paramsWithPagination = [...params, limit, offset];
      const result = await pool.query(dataQuery, paramsWithPagination);

      // 2️⃣ Get overall totals (ignores pagination)
      const totalsQuery = `
      SELECT 
        SUM(si.quantity * si.unit_price) AS grand_total_sales,
        SUM(COALESCE(sp.amount, 0)) AS grand_total_paid
      FROM sale s
      JOIN sale_item si ON si.sale_id = s.id
      LEFT JOIN sale_payment sp ON sp.sale_id = s.id
      WHERE ${whereSQL}
    `;
      const totalsRes = await pool.query(totalsQuery, params);

      // 3️⃣ Pagination info
      const countRes = await pool.query(
        `SELECT COUNT(DISTINCT p.id)
       FROM sale s
       JOIN sale_item si ON si.sale_id = s.id
       JOIN product p ON si.product_id = p.id
       WHERE ${whereSQL}`,
        params
      );
      const totalRecords = Number(countRes.rows[0].count);
      const totalPages = Math.ceil(totalRecords / limit);

      // 4️⃣ Respond with data
      res.json({
        data: result.rows,
        totalRecords,
        totalPages,
        currentPage: page,
        total_sales_amount: parseFloat(
          totalsRes.rows[0].grand_total_sales || 0
        ),
        total_paid_amount: parseFloat(totalsRes.rows[0].grand_total_paid || 0),
      });
    } catch (err) {
      console.error("Error fetching grouped sales:", err);
      res.status(500).json({ error: "Failed to fetch grouped sales data" });
    }
  }
);

router.get(
  "/giveOutByProduct",
  requireTask("can_see_free_releases"),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      let where = ["pl.movement_type = 'OUT'"];
      let params = [];
      let i = 0;

      if (req.query["outlet_id[]"] || req.query.outlet_id) {
        let outletIds = req.query["outlet_id[]"] || req.query.outlet_id;

        // Normalize into an array
        if (!Array.isArray(outletIds)) {
          outletIds = outletIds.toString().split(",").map(Number);
        } else {
          outletIds = outletIds.map(Number);
        }

        i++;
        params.push(outletIds);
        where.push(`pl.outlet_id = ANY($${i})`);
      } else {
        i++;
        params.push([-1]);
        where.push(`pl.outlet_id = ANY($${i})`);
      }

      if (req.query.start_date) {
        params.push(req.query.start_date);
        i++;
        where.push(`pl.movement_date >= $${i}`);
      }

      if (req.query.end_date) {
        params.push(req.query.end_date);
        i++;
        where.push(`pl.movement_date <= $${i}`);
      }

      if (req.query.quality) {
        params.push(req.query.quality.toUpperCase());
        i++;
        where.push(`pl.quality = $${i}`);
      }

      const whereSQL = where.join(" AND ");

      // 1️⃣ Get grouped results per product
      const dataQuery = `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        SUM(pl.quantity) AS total_qty,
        SUM(pl.quantity * pl.unit_cost) AS total_cost_value,
        COUNT(DISTINCT pl.product_out_id) AS out_events_count
      FROM product_ledger pl
      JOIN product p ON p.id = pl.product_id
      WHERE ${whereSQL}
      GROUP BY p.id, p.name
      ORDER BY p.name ASC
      LIMIT $${i + 1} OFFSET $${i + 2}
    `;
      const dataRes = await pool.query(dataQuery, [...params, limit, offset]);

      // 2️⃣ Grand totals ignoring pagination
      const totalQuery = `
      SELECT
        SUM(pl.quantity * pl.unit_cost) AS grand_total_cost,
        SUM(pl.quantity) AS grand_total_qty
      FROM product_ledger pl
      WHERE ${whereSQL}
    `;
      const totalsRes = await pool.query(totalQuery, params);

      // 3️⃣ Count distinct products for pagination
      const countQuery = `
      SELECT COUNT(DISTINCT p.id)
      FROM product_ledger pl
      JOIN product p ON p.id = pl.product_id
      WHERE ${whereSQL}
    `;
      const countRes = await pool.query(countQuery, params);
      const totalRecords = Number(countRes.rows[0].count) || 0;
      const totalPages = Math.ceil(totalRecords / limit);

      // 4️⃣ Respond
      res.json({
        data: dataRes.rows,
        totalRecords,
        totalPages,
        currentPage: page,
        totals: {
          total_out_qty: parseFloat(totalsRes.rows[0].grand_total_qty || 0),
          total_out_value: parseFloat(totalsRes.rows[0].grand_total_cost || 0),
        },
      });
    } catch (err) {
      console.error("❌ Error fetching giveOutByProduct:", err);
      res.status(500).json({ error: "Failed to fetch Give-Out grouped data" });
    }
  }
);

module.exports = router;
