const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/productionProfitability", async (req, res) => {
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
    res.status(500).json({ error: "Failed to generate profitability report" });
  } finally {
    client.release();
  }
});

router.get("/stockStatus", async (req, res) => {
  const client = await pool.connect();
  try {
    const { start_date, end_date, items } = req.query;

    const where = [];
    const params = [];

    // Filter by ingredients (multiple)
    if (items) {
      const arr = Array.isArray(items) ? items : [items];
      const placeholders = arr
        .map((_, i) => `$${params.length + i + 1}`)
        .join(",");
      params.push(...arr);
      where.push(`i.id IN (${placeholders})`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // 🧾 Opening balance (before start date)
    const openingSQL = `
      SELECT 
        i.id AS item_id,
        i.name AS item_name,
        COALESCE(SUM(il.quantity), 0) AS opening_balance
      FROM item i
      LEFT JOIN item_ledger il ON il.item_id = i.id
        AND il.movement_date < $1::date
      ${whereSQL ? `${whereSQL.replace("i.id", "i.id")}` : ""}
      GROUP BY i.id, i.name
    `;

    // 📥 Inward movements within the range
    const inwardSQL = `
      SELECT 
        i.id AS item_id,
        COALESCE(SUM(il.quantity), 0) AS inwards
      FROM item i
      LEFT JOIN item_ledger il ON il.item_id = i.id
        AND il.type = 'IN'
        AND il.movement_date BETWEEN $1::date AND $2::date
      ${whereSQL ? `${whereSQL.replace("i.id", "i.id")}` : ""}
      GROUP BY i.id
    `;

    // 📤 Outward movements within the range
    const outwardSQL = `
      SELECT 
        i.id AS item_id,
        COALESCE(SUM(ABS(il.quantity)), 0) AS outwards
      FROM item i
      LEFT JOIN item_ledger il ON il.item_id = i.id
        AND il.type = 'OUT'
        AND il.movement_date BETWEEN $1::date AND $2::date
      ${whereSQL ? `${whereSQL.replace("i.id", "i.id")}` : ""}
      GROUP BY i.id
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

    // 🧮 Combine data
    const result = new Map();

    const addOrUpdate = (row, key, field) => {
      if (!result.has(row.item_id)) {
        result.set(row.item_id, {
          item_id: row.item_id,
          item_name: row.item_name || "",
          opening_balance: 0,
          inwards: 0,
          outwards: 0,
          closing_balance: 0,
        });
      }
      const obj = result.get(row.item_id);
      obj[field] = Number(row[key] || 0);
      result.set(row.item_id, obj);
    };

    openingRes.rows.forEach((r) =>
      addOrUpdate(r, "opening_balance", "opening_balance")
    );
    inwardRes.rows.forEach((r) => addOrUpdate(r, "inwards", "inwards"));
    outwardRes.rows.forEach((r) => addOrUpdate(r, "outwards", "outwards"));

    // Calculate closing balance
    for (const row of result.values()) {
      row.closing_balance = row.opening_balance + row.inwards - row.outwards;
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
});

module.exports = router;
