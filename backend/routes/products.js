const express = require('express');
const formidable = require('formidable');
const pool = require('../db'); // your configured PostgreSQL pool
const router = express.Router();

/**
 * ✅ GET /products (with pagination and optional name search)
 * Supports query params: page, limit, search
 */
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : '%';

  try {
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM product WHERE name ILIKE $1',
      [search]
    );
    const totalRecords = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalRecords / limit);

    const result = await pool.query(
      `SELECT id, name, description, unit, price, 
              TO_CHAR(created_at, 'DD-MM-YYYY') AS created_at
         FROM product
        WHERE name ILIKE $1
        ORDER BY id DESC
        LIMIT $2 OFFSET $3`,
      [search, limit, offset]
    );

    res.json({
      data: result.rows,
      totalRecords,
      totalPages,
      currentPage: page
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * ✅ GET /products/:id (with its product_items)
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1) Fetch product
    const productResult = await pool.query(
      'SELECT * FROM product WHERE id = $1',
      [id]
    );
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // 2) Fetch product items with the unit coming from the item's unit mapping
    const itemsResult = await pool.query(
      `
      SELECT
        pi.id,
        pi.item_id,
        i.name AS item_name,
        pi.quantity_per_unit,
        COALESCE(u.shortname, u.name) AS unit
      FROM product_item AS pi
      JOIN item AS i
        ON i.id = pi.item_id
      LEFT JOIN itemunit AS u
        ON u.id = i.unit_id
      WHERE pi.product_id = $1
      ORDER BY pi.id
      `,
      [id]
    );

    // 3) Shape matches the UI expectations: { product, items[] with item_name, quantity_per_unit, unit }
    res.json({
      product: productResult.rows[0],
      items: itemsResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});


/**
 * ✅ POST /products — create product with its product_items
 */
router.post('/', async (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields) => {
    if (err) return res.status(400).json({ error: 'Invalid form data' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertProduct = await client.query(
        `INSERT INTO product (name, description, unit, price)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [fields.name?.[0], fields.description?.[0] || null, fields.unit?.[0] || null, fields.price?.[0] || 0]
      );
      const productId = insertProduct.rows[0].id;

      if (fields.items?.[0]) {
        const items = JSON.parse(fields.items?.[0]);
        for (const it of items) {
          await client.query(
            `INSERT INTO product_item (product_id, item_id, quantity_per_unit)
             VALUES ($1, $2, $3)`,
            [productId, it.item_id, it.quantity_per_unit || null]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ message: 'Product created successfully', product_id: productId });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Failed to create product' });
    } finally {
      client.release();
    }
  });
});

/**
 * ✅ PUT /products/:id — update product and its product_items
 */
router.put('/:id', async (req, res) => {
  const productId = req.params.id;
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields) => {
    if (err) return res.status(400).json({ error: 'Invalid form data' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE product SET name=$1, description=$2, unit=$3, price=$4 WHERE id=$5`,
        [fields.name?.[0], fields.description?.[0] || "", fields.unit?.[0] || null, fields.price?.[0] || 0, productId]
      );

      // Replace all product_items for this product
      await client.query(`DELETE FROM product_item WHERE product_id=$1`, [productId]);

      if (fields.items) {
        const items = JSON.parse(fields.items);
        for (const it of items) {
          await client.query(
            `INSERT INTO product_item (product_id, item_id, quantity_per_unit)
             VALUES ($1, $2, $3)`,
            [productId, it.item_id, it.quantity_per_unit]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ message: 'Product updated successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Failed to update product' });
    } finally {
      client.release();
    }
  });
});

/**
 * ✅ DELETE /products/:id — remove product (and cascades items)
 */
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM product WHERE id=$1', [req.params.id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
