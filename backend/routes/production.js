const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/discrepancyReasons', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, description FROM discrepancy_reason ORDER BY name');
    res.json({ data: rows });
  } catch (err) {
    console.error('Failed to fetch discrepancy reasons:', err);
    res.status(500).json({ error: 'Failed to fetch discrepancy reasons' });
  }
});

router.post('/', async (req, res) => {
    console.log(JSON.stringify(req.body,0,2))
  const client = await pool.connect();
  try {
    const { product_id, mode, qty_product, base_ingredient_id, base_ingredient_qty, notes, ingredients, staffs } = req.body;
    if (!product_id || !qty_product || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO product_production (product_id, mode, qty_product, base_ingredient_id, base_ingredient_qty, produced_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [product_id, mode, qty_product, base_ingredient_id || null, base_ingredient_qty || null, req.user?.id || 1, notes || null]
    );
    const productionId = rows[0].id;

    const insertLine = `
      INSERT INTO product_production_item (production_id, item_id, qty_required)
      VALUES ($1, $2, $3)
    `;
    for (const ing of ingredients) {
      await client.query(insertLine, [
        productionId,
        ing.item_id,
        ing.qty_required
      ]);
    }

    if (Array.isArray(staffs) && staffs.length > 0) {
      for (const sid of staffs) {
        await client.query(
          `INSERT INTO product_production_staff (production_id, staff_id, role, notes)
           VALUES ($1, $2, $3, $4)`,
          [productionId, sid.staff_id.id, sid.role, sid.notes || '']
        );
      }
    }

    await client.query('COMMIT');
    res.json({ id: productionId, message: 'Production saved successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to save production' });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { product_id, mode, qty_product, base_ingredient_id, base_ingredient_qty, notes, ingredients, staffs, discrepancies } = req.body;

    if (!id || !product_id || !qty_product || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    await client.query('BEGIN');

    // 1️⃣ Update header
    await client.query(
      `UPDATE product_production
         SET product_id = $1,
             mode = $2,
             qty_product = $3,
             base_ingredient_id = $4,
             base_ingredient_qty = $5,
             notes = $6,
             updated_at = NOW(),
             updated_by = $7
       WHERE id = $8`,
      [product_id, mode, qty_product, base_ingredient_id || null, base_ingredient_qty || null, notes || null, req.user?.id || 1, id]
    );

    // 2️⃣ Replace production items
    await client.query('DELETE FROM product_production_item WHERE production_id = $1', [id]);

    const insertItemSQL = `
      INSERT INTO product_production_item (production_id, item_id, qty_required)
      VALUES ($1, $2, $3)
    `;
    for (const ing of ingredients) {
      await client.query(insertItemSQL, [id, ing.item_id, ing.qty_required]);
    }

    // 3️⃣ Replace assigned staff
    await client.query('DELETE FROM product_production_staff WHERE production_id = $1', [id]);
    if (Array.isArray(staffs) && staffs.length > 0) {
      for (const sid of staffs) {
        await client.query(
          `INSERT INTO product_production_staff (production_id, staff_id, role, notes)
           VALUES ($1, $2, $3, $4)`,
          [id, sid.staff_id.id, sid.role, sid.notes || '']
        );
      }
    }

    // 4️⃣ Replace discrepancies
    await client.query('DELETE FROM product_production_discrepancy WHERE production_id=$1', [id]);
    for (const d of discrepancies || []) {
      await client.query(`
        INSERT INTO product_production_discrepancy (production_id, reason_id, notes)
        VALUES ($1, $2, $3)
      `, [id, d.reason_id, d.notes || null]);
    }

    await client.query('COMMIT');
    res.json({ id, message: 'Production updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to update production:', err);
    res.status(500).json({ error: 'Failed to update production' });
  } finally {
    client.release();
  }
});

router.get('/', async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const where = [];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`p.name ILIKE $${params.length}`);
    }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // --- Count total ---
    const totalSql = `
      SELECT COUNT(*)::int AS total
      FROM product_production pp
      JOIN product p ON p.id = pp.product_id
      ${whereSQL}
    `;
    const totalRes = await pool.query(totalSql, params);
    const totalRecords = totalRes.rows[0].total;
    const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

    // --- Get paginated data ---
    const rowsSql = `
      SELECT
        pp.id,
        TO_CHAR(pp.produced_at, 'DD-MM-YYYY HH24:MI:SS') AS produced_at,
        pp.mode,
        pp.qty_product,
        p.id AS product_id,
        p.name AS product_name,
        p.unit AS product_unit,
        u.name AS produced_by_name,
        COUNT(DISTINCT ps.staff_id) AS staff_count,

        -- 🧠 Team Leader logic:
        COALESCE(
            (
            SELECT s.name
            FROM product_production_staff ps2
            JOIN staff s ON s.id = ps2.staff_id
            WHERE ps2.production_id = pp.id AND LOWER(ps2.role) = 'team leader'
            LIMIT 1
            ),
            (
            SELECT s.name
            FROM product_production_staff ps3
            JOIN staff s ON s.id = ps3.staff_id
            WHERE ps3.production_id = pp.id
            ORDER BY ps3.id ASC
            LIMIT 1
            )
        ) AS team_leader_name

        FROM product_production pp
        JOIN product p ON p.id = pp.product_id
        LEFT JOIN users u ON u.id = pp.produced_by
        LEFT JOIN product_production_staff ps ON ps.production_id = pp.id
        ${whereSQL}
        GROUP BY pp.id, p.id, u.name
        ORDER BY pp.produced_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
    const rowsRes = await pool.query(rowsSql, [...params, limit, offset]);

    res.json({
      data: rowsRes.rows,
      totalPages,
      totalRecords
    });
  } catch (err) {
    console.error('Error loading productions:', err);
    res.status(500).json({ error: 'Failed to fetch productions' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Header
    const hdrRes = await pool.query(`
      SELECT 
        pp.*, 
        p.name AS product_name, 
        u.name AS produced_by_name
      FROM product_production pp
      JOIN product p ON p.id = pp.product_id
      LEFT JOIN users u ON u.id = pp.produced_by
      WHERE pp.id = $1
    `, [id]);

    if (hdrRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Lines
    const linesRes = await pool.query(`
      SELECT 
        ppi.item_id, 
        i.name AS item_name,
        ppi.qty_required,
        iu.shortname AS unit
      FROM product_production_item ppi
      JOIN item i ON i.id = ppi.item_id
      LEFT JOIN itemunit iu ON iu.id = i.unit_id
      WHERE ppi.production_id = $1
      ORDER BY i.name
    `, [id]);

    // Staff
    const staffRes = await pool.query(`
      SELECT s.id, s.name, ps.role, ps.notes
      FROM product_production_staff ps
      JOIN staff s ON s.id = ps.staff_id
      WHERE ps.production_id = $1
      ORDER BY s.name
    `, [id]);

    const discRes = await pool.query(`
      SELECT d.id, dr.name, d.notes
      FROM product_production_discrepancy d
      JOIN discrepancy_reason dr ON dr.id = d.reason_id
      WHERE d.production_id=$1
    `, [id]);

    res.json({
      production: hdrRes.rows[0],
      items: linesRes.rows,
      staff: staffRes.rows,
      discrepancies: discRes.rows
    });
  } catch (err) {
    console.error('❌ Error fetching production:', err);
    res.status(500).json({ error: 'Failed to fetch production details' });
  }
});


router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Missing production ID' });
    }

    await client.query('BEGIN');

    // Check if production exists
    const checkRes = await client.query(
      'SELECT id FROM product_production WHERE id = $1',
      [id]
    );
    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Production not found' });
    }

    // Delete child items first
    await client.query(
      'DELETE FROM product_production_item WHERE production_id = $1',
      [id]
    );

    // Delete production header
    await client.query(
      'DELETE FROM product_production WHERE id = $1',
      [id]
    );

    await client.query('COMMIT');
    res.json({ id, message: 'Production deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to delete production:', err);
    res.status(500).json({ error: 'Failed to delete production' });
  } finally {
    client.release();
  }
});

module.exports = router;