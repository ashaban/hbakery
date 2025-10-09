const express = require('express');
const formidable = require('formidable');
const pool = require('../db');
const router = express.Router();

/**
 * 🟢 GET /staff — with pagination, search, and status filter
 */
router.get('/', async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 10, 1);
  const offset = (page - 1) * limit;
  const search = (req.query.search || '').trim();
  const status = (req.query.status || '').trim();

  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(`s.name ILIKE $${params.length}`);
  }

  if (status) {
    params.push(status);
    where.push(`s.status = $${params.length}`);
  }

  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const totalSql = `SELECT COUNT(*)::int AS total FROM staff s ${whereSQL}`;
    const totalRes = await pool.query(totalSql, params);
    const totalRecords = totalRes.rows[0].total;
    const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

    const dataSql = `
      SELECT 
        s.id, s.name, s.phone, s.position,
        s.salary, TO_CHAR(s.hired_at, 'DD-MM-YYYY') AS hired_at,
        s.status
      FROM staff s
      ${whereSQL}
      ORDER BY s.name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const dataRes = await pool.query(dataSql, [...params, limit, offset]);

    res.json({
      data: dataRes.rows,
      totalPages,
      totalRecords
    });
  } catch (err) {
    console.error('Error fetching staff:', err);
    res.status(500).json({ error: 'Failed to load staff' });
  }
});

/**
 * 🟢 GET /staff/:id
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM staff WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

/**
 * 🟢 POST /staff
 */
router.post('/', async (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields) => {
    if (err) return res.status(400).json({ error: 'Invalid form data' });

    const name = fields.name?.[0] || fields.name;
    const phone = fields.phone?.[0] || fields.phone;
    const position = fields.position?.[0] || fields.position;
    const salary = Number(fields.salary?.[0] || fields.salary || 0);
    const status = fields.status?.[0] || fields.status || 'Active';

    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
      const { rows } = await pool.query(
        `INSERT INTO staff (name, phone, position, salary, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, phone || null, position || null, salary, status]
      );
      res.json({ message: 'Staff added successfully', staff: rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to add staff' });
    }
  });
});

/**
 * 🟢 PUT /staff/:id
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields) => {
    if (err) return res.status(400).json({ error: 'Invalid form data' });

    const name = fields.name?.[0] || fields.name;
    const phone = fields.phone?.[0] || fields.phone;
    const position = fields.position?.[0] || fields.position;
    const salary = Number(fields.salary?.[0] || fields.salary || 0);
    const status = fields.status?.[0] || fields.status || 'Active';

    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
      const { rowCount } = await pool.query(
        `UPDATE staff
         SET name=$1, phone=$2, position=$3, salary=$4, status=$5
         WHERE id=$6`,
        [name, phone || null, position || null, salary, status, id]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'Staff not found' });

      res.json({ message: 'Staff updated successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update staff' });
    }
  });
});

/**
 * 🔴 DELETE /staff/:id
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM staff WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Staff not found' });
    res.json({ message: 'Staff deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete staff' });
  }
});

module.exports = router;