const express = require('express');
const router = express.Router();
const pool = require('../db');


router.get('/productionProfitability', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      start_date,
      end_date,
      ingredients,
      products,
      team_leader
    } = req.query;

    const where = ["pp.produced_at IS NOT NULL"];
    const params = [];

    // 🗓️ Date range (produced_at)
    if (start_date && end_date) {
      params.push(start_date, end_date);
      where.push(`pp.produced_at::date BETWEEN $${params.length - 1}::date AND $${params.length}::date`);
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
      const placeholders = arr.map((_, i) => `$${params.length + i + 1}`).join(',');
      params.push(...arr);
      where.push(`ppi.item_id IN (${placeholders})`);
    }

    // 📦 Product filter
    if (products) {
      const arr = Array.isArray(products) ? products : [products];
      const placeholders = arr.map((_, i) => `$${params.length + i + 1}`).join(',');
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

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // 🧾 Ingredient consumption and cost (using item_ledger)
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
      ${whereSQL ? `${whereSQL} AND il.type = 'OUT'` 
                 : `WHERE il.type = 'OUT'`}
      GROUP BY i.id, i.name
      ORDER BY i.name;
    `;
    const ingredientsRes = await client.query(ingredientsSQL, params);
    const ingredientData = ingredientsRes.rows;

    // 💰 Labour cost (completed productions only)
    const labourSQL = `
      SELECT 
        COALESCE(SUM(s.salary / 30.0), 0) AS total_labour_cost
      FROM product_production pp
      JOIN product_production_staff ps ON ps.production_id = pp.id
      JOIN staff s ON s.id = ps.staff_id
      ${whereSQL ? `${whereSQL} AND pp.produced_at IS NOT NULL`
                 : `WHERE pp.produced_at IS NOT NULL`};
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

    // 📊 Totals
    const totalIngredientCost = ingredientData.reduce((sum, i) => sum + Number(i.total_cost || 0), 0);
    const totalRevenue = productData.reduce((sum, p) => sum + Number(p.total_value || 0), 0);
    const totalCost = totalIngredientCost + Number(totalLabourCost);
    const margin = totalRevenue - totalCost;

    res.json({
      filters: { start_date, end_date, ingredients, products, team_leader },
      totals: {
        totalRevenue,
        totalIngredientCost,
        totalLabourCost,
        totalCost,
        margin
      },
      ingredients: ingredientData,
      products: productData
    });
  } catch (err) {
    console.error('❌ Error generating profitability report:', err);
    res.status(500).json({ error: 'Failed to generate profitability report' });
  } finally {
    client.release();
  }
});

module.exports = router;