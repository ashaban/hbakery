// routes/item.js
const express = require('express');
const router = express.Router();
const formidable = require('formidable');
const pool = require('../db');

// Create Item
router.post('/', async (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      const result = await pool.query(
        'INSERT INTO item (name, unit_id) VALUES ($1, $2) RETURNING *',
        [fields.name?.[0], fields.unit?.[0]]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  })
});

// Get all Items with Unit name
router.get('/', async (_, res) => {
  try {
    const result = await pool.query(`
      SELECT i.id, i.name, u.name AS unit
      FROM item i
      LEFT JOIN itemunit u ON i.unit_id = u.id
      ORDER BY i.id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Item
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      const result = await pool.query(
        'UPDATE item SET name=$1, unit_id=$2 WHERE id=$3 RETURNING *',
        [fields.name?.[0], fields.unit?.[0], id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  })
});

// Delete Item
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM item WHERE id=$1', [req.params.id]);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
