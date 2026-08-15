// routes/shop.js
//
// Everything the client mobile app does once a customer is signed in:
// browse the catalogue, place an order, and follow what has been
// scheduled for delivery.
//
// Every route here is scoped to req.customer.id. A customer can only
// ever see their own orders — the id is taken from the token, never
// from the request, so there is no parameter to tamper with.

const express = require("express");
const pool = require("../db");
const logger = require("../winston");
const { t } = require("../modules/customerMessages");
const { requireCustomer } = require("../middleware/customerAuth");

const router = express.Router();

router.use(requireCustomer);

/**
 * GET /shop/products — the catalogue, with the price the customer will
 * be charged. Products without a price are omitted rather than shown as
 * free: an order line has to have a number behind it.
 */
router.get("/products", async (req, res) => {
  try {
    const search = req.query.search?.trim();
    const params = [];
    let where = "WHERE price IS NOT NULL AND price > 0";

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where += ` AND LOWER(name) LIKE $1`;
    }

    const result = await pool.query(
      `SELECT id, name, description, unit, price
       FROM product
       ${where}
       ORDER BY name`,
      params
    );
    res.json({ data: result.rows });
  } catch (error) {
    logger.error("Fetch shop products failed", error);
    res.status(500).json({ error: t(req, "productsLoadFailed") });
  }
});

// Order + its lines + whatever has been scheduled so far. Shared by the
// list and detail views so both describe an order the same way.
async function loadOrders(customerId, { orderId = null, limit = null } = {}) {
  const params = [customerId];
  let where = "WHERE o.customer_id = $1";
  if (orderId) {
    params.push(orderId);
    where += ` AND o.id = $${params.length}`;
  }
  let limitSQL = "";
  if (limit) {
    params.push(limit);
    limitSQL = `LIMIT $${params.length}`;
  }

  const ordersRes = await pool.query(
    `
    SELECT o.id, o.order_date::text AS order_date, o.status, o.notes, o.created_at,
           COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total
    FROM customer_order o
    LEFT JOIN customer_order_item oi ON oi.order_id = o.id
    ${where}
    GROUP BY o.id
    ORDER BY o.id DESC
    ${limitSQL}
    `,
    params
  );

  const orders = ordersRes.rows;
  if (orders.length === 0) return [];

  const ids = orders.map((o) => o.id);

  const itemsRes = await pool.query(
    `
    SELECT oi.id, oi.order_id, oi.product_id, p.name AS product_name,
           p.unit, oi.quantity, oi.unit_price,
           (oi.quantity * oi.unit_price) AS line_total,
           COALESCE((
             SELECT SUM(di.quantity)
             FROM customer_order_delivery_item di
             WHERE di.order_item_id = oi.id
           ), 0) AS scheduled_quantity
    FROM customer_order_item oi
    JOIN product p ON p.id = oi.product_id
    WHERE oi.order_id = ANY($1::int[])
    ORDER BY p.name
    `,
    [ids]
  );

  const deliveriesRes = await pool.query(
    `
    SELECT d.id, d.order_id, d.delivery_date::text AS delivery_date, d.notes, d.created_at
    FROM customer_order_delivery d
    WHERE d.order_id = ANY($1::int[])
    ORDER BY d.delivery_date, d.id
    `,
    [ids]
  );

  const deliveryIds = deliveriesRes.rows.map((d) => d.id);
  const deliveryItemsRes = deliveryIds.length
    ? await pool.query(
        `
        SELECT di.id, di.delivery_id, di.order_item_id, di.quantity,
               p.name AS product_name, p.unit
        FROM customer_order_delivery_item di
        JOIN customer_order_item oi ON oi.id = di.order_item_id
        JOIN product p ON p.id = oi.product_id
        WHERE di.delivery_id = ANY($1::int[])
        ORDER BY p.name
        `,
        [deliveryIds]
      )
    : { rows: [] };

  const deliveries = deliveriesRes.rows.map((d) => ({
    ...d,
    items: deliveryItemsRes.rows.filter((di) => di.delivery_id === d.id),
  }));

  return orders.map((o) => ({
    ...o,
    items: itemsRes.rows.filter((i) => i.order_id === o.id),
    deliveries: deliveries.filter((d) => d.order_id === o.id),
  }));
}

/** GET /shop/orders — my orders, newest first */
router.get("/orders", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const orders = await loadOrders(req.customer.id, { limit });
    res.json({ data: orders });
  } catch (error) {
    logger.error("Fetch customer orders failed", error);
    res.status(500).json({ error: t(req, "ordersLoadFailed") });
  }
});

/** GET /shop/orders/:id */
router.get("/orders/:id", async (req, res) => {
  try {
    const orders = await loadOrders(req.customer.id, {
      orderId: Number(req.params.id),
    });
    if (orders.length === 0) {
      return res.status(404).json({ error: t(req, "orderNotFound") });
    }
    return res.json({ data: orders[0] });
  } catch (error) {
    logger.error("Fetch customer order failed", error);
    return res.status(500).json({ error: t(req, "orderLoadFailed") });
  }
});

/**
 * POST /shop/orders
 * body: { items: [{ product_id, quantity }], notes }
 *
 * Prices come from the database, never from the request: the app shows
 * the customer a total, but the authoritative total is recalculated
 * here so a modified request can't set its own price.
 */
router.post("/orders", async (req, res) => {
  const { items, notes } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: t(req, "orderEmpty") });
  }

  // Collapse duplicate lines for the same product rather than rejecting
  // them — the app shouldn't send any, and if it does, two lines of 5 is
  // plainly an order of 10.
  const wanted = new Map();
  for (const item of items) {
    const productId = Number(item?.product_id);
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: t(req, "lineNeedsProductAndQuantity") });
    }
    wanted.set(productId, (wanted.get(productId) || 0) + quantity);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const productIds = [...wanted.keys()];
    const productsRes = await client.query(
      `SELECT id, name, price FROM product
       WHERE id = ANY($1::int[]) AND price IS NOT NULL AND price > 0`,
      [productIds]
    );

    if (productsRes.rows.length !== productIds.length) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: t(req, "productUnavailable") });
    }

    const orderRes = await client.query(
      `INSERT INTO customer_order (customer_id, notes) VALUES ($1, $2) RETURNING id`,
      [req.customer.id, notes ? String(notes).trim() : null]
    );
    const orderId = orderRes.rows[0].id;

    for (const product of productsRes.rows) {
      await client.query(
        `INSERT INTO customer_order_item (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, product.id, wanted.get(product.id), product.price]
      );
    }

    await client.query("COMMIT");

    const orders = await loadOrders(req.customer.id, { orderId });
    return res.status(201).json({ data: orders[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error("Place customer order failed", error);
    return res.status(500).json({ error: t(req, "orderPlaceFailed") });
  } finally {
    client.release();
  }
});

/**
 * POST /shop/orders/:id/cancel
 *
 * Only while nothing has been scheduled yet. Once staff have promised a
 * delivery day the bakery may already be baking against it, so calling
 * off the order becomes a conversation, not a button.
 */
router.post("/orders/:id/cancel", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, status FROM customer_order WHERE id = $1 AND customer_id = $2`,
      [req.params.id, req.customer.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: t(req, "orderNotFound") });
    }
    const order = result.rows[0];

    if (order.status === "CANCELLED") {
      return res.status(400).json({ error: t(req, "orderAlreadyCancelled") });
    }
    if (order.status !== "PENDING") {
      return res.status(400).json({
        error: t(req, "orderAlreadyScheduled"),
      });
    }

    await pool.query(
      `UPDATE customer_order
       SET status = 'CANCELLED', cancelled_at = NOW()
       WHERE id = $1`,
      [order.id]
    );

    return res.json({ success: true });
  } catch (error) {
    logger.error("Cancel customer order failed", error);
    return res.status(500).json({ error: t(req, "orderCancelFailed") });
  }
});

module.exports = router;
