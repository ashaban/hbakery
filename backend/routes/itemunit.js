// routes/itemunit.js
const formidable = require('formidable');
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Create Unit
router.post('/', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      const result = await pool.query(
        'INSERT INTO itemunit (name, shortname) VALUES ($1, $2) RETURNING *',
        [fields.name?.[0], fields.shortname?.[0]]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  })
});

// Get all Units
router.get('/', async (_, res) => {
  try {
    const result = await pool.query('SELECT * FROM itemunit ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Unit
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      const result = await pool.query(
        'UPDATE itemunit SET name=$1, shortname=$2 WHERE id=$3 RETURNING *',
        [fields.name?.[0], fields.shortname?.[0], id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  })
});

// Delete Unit
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM itemunit WHERE id=$1', [req.params.id]);
    res.json({ message: 'Unit deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
