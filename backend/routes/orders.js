// routes/orders.js
//
// The staff side of customer ordering: see what customers have ordered
// from the mobile app, and schedule delivery — a date plus exactly which
// items and quantities go out on that date. An order can be split across
// several delivery days.
//
// Nothing here writes to the sales or stock ledger. A scheduled delivery
// is a promise, not a movement; staff still record the actual sale the
// normal way when the goods leave. That separation is deliberate — a
// customer-facing feature must not be able to move stock figures.

const express = require("express");
const pool = require("../db");
const logger = require("../winston");
const { requireTask } = require("../middleware/auth");
const { recordAudit } = require("../modules/auditLog");

const router = express.Router();

/**
 * Recompute an order's status from its deliveries. Status is never set
 * by hand (bar CANCELLED) so it can't drift out of step with the
 * deliveries it's supposed to describe.
 *
 * Runs on the passed client so it participates in the caller's
 * transaction.
 */
async function recomputeOrderStatus(client, orderId) {
  const current = await client.query(
    `SELECT status FROM customer_order WHERE id = $1`,
    [orderId]
  );
  if (current.rows.length === 0) return null;
  // A cancelled order stays cancelled; deliveries can't resurrect it.
  if (current.rows[0].status === "CANCELLED") return "CANCELLED";

  const totals = await client.query(
    `
    SELECT
      COALESCE(SUM(oi.quantity), 0) AS ordered,
      COALESCE(SUM(sched.scheduled), 0) AS scheduled,
      COALESCE(SUM(sched.delivered), 0) AS delivered
    FROM customer_order_item oi
    LEFT JOIN LATERAL (
      SELECT
        SUM(di.quantity) AS scheduled,
        SUM(di.quantity) FILTER (WHERE d.delivered_at IS NOT NULL) AS delivered
      FROM customer_order_delivery_item di
      JOIN customer_order_delivery d ON d.id = di.delivery_id
      WHERE di.order_item_id = oi.id
    ) sched ON true
    WHERE oi.order_id = $1
    `,
    [orderId]
  );

  const ordered = Number(totals.rows[0].ordered);
  const scheduled = Number(totals.rows[0].scheduled);
  const delivered = Number(totals.rows[0].delivered);

  let status;
  if (ordered > 0 && delivered >= ordered) status = "DELIVERED";
  else if (delivered > 0) status = "PARTIALLY_DELIVERED";
  else if (ordered > 0 && scheduled >= ordered) status = "SCHEDULED";
  else if (scheduled > 0) status = "PARTIALLY_SCHEDULED";
  else status = "PENDING";

  await client.query(`UPDATE customer_order SET status = $1 WHERE id = $2`, [
    status,
    orderId,
  ]);
  return status;
}

// Customer contact + location, which is the entire reason registration
// asks for a landmark: the driver has to be able to find the shop.
const ORDER_SELECT = `
  SELECT o.id, o.order_date::text AS order_date, o.status, o.notes, o.created_at,
         o.cancelled_at,
         c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
         c.town AS customer_town, c.landmark AS customer_landmark,
         r.name AS customer_region, d.name AS customer_district,
         COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total
  FROM customer_order o
  JOIN customer c ON c.id = o.customer_id
  LEFT JOIN region r ON r.id = c.region_id
  LEFT JOIN district d ON d.id = c.district_id
  LEFT JOIN customer_order_item oi ON oi.order_id = o.id
`;

const ORDER_GROUP_BY = `
  GROUP BY o.id, c.id, c.name, c.phone, c.town, c.landmark, r.name, d.name
`;

// Attaches lines + scheduled deliveries to a set of order rows.
async function attachDetail(orders) {
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
    SELECT d.id, d.order_id, d.delivery_date::text AS delivery_date, d.notes, d.delivered_at,
           d.created_at, u.name AS created_by_name
    FROM customer_order_delivery d
    LEFT JOIN users u ON u.id = d.created_by
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
               oi.product_id, p.name AS product_name, p.unit
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

/**
 * GET /orders?status=&search=&from=&to=&page=&limit=
 */
router.get("/", requireTask("can_see_orders"), async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];

    if (req.query.status) {
      params.push(req.query.status);
      where.push(`o.status = $${params.length}`);
    }
    if (req.query.search?.trim()) {
      params.push(`%${req.query.search.trim().toLowerCase()}%`);
      where.push(`(LOWER(c.name) LIKE $${params.length} OR c.phone LIKE $${params.length})`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`o.order_date >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`o.order_date <= $${params.length}`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRes = await pool.query(
      `SELECT COUNT(DISTINCT o.id) FROM customer_order o
       JOIN customer c ON c.id = o.customer_id ${whereSQL}`,
      params
    );
    const totalRecords = Number(countRes.rows[0].count);

    params.push(limit, offset);
    const ordersRes = await pool.query(
      `${ORDER_SELECT} ${whereSQL} ${ORDER_GROUP_BY}
       ORDER BY o.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const data = await attachDetail(ordersRes.rows);

    res.json({
      data,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page,
    });
  } catch (error) {
    logger.error("Fetch orders failed", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/**
 * GET /orders/deliveries?date=YYYY-MM-DD — everything promised for a
 * given day, which is what a driver's run sheet is built from.
 */
router.get("/deliveries", requireTask("can_see_orders"), async (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res.status(400).json({ error: "A date is required" });
  }

  try {
    const result = await pool.query(
      `
      SELECT d.id, d.delivery_date::text AS delivery_date, d.notes, d.delivered_at,
             o.id AS order_id,
             c.name AS customer_name, c.phone AS customer_phone,
             c.town AS customer_town, c.landmark AS customer_landmark,
             r.name AS customer_region, dd.name AS customer_district,
             json_agg(
               json_build_object(
                 'product_name', p.name,
                 'unit', p.unit,
                 'quantity', di.quantity
               ) ORDER BY p.name
             ) AS items
      FROM customer_order_delivery d
      JOIN customer_order o ON o.id = d.order_id
      JOIN customer c ON c.id = o.customer_id
      LEFT JOIN region r ON r.id = c.region_id
      LEFT JOIN district dd ON dd.id = c.district_id
      JOIN customer_order_delivery_item di ON di.delivery_id = d.id
      JOIN customer_order_item oi ON oi.id = di.order_item_id
      JOIN product p ON p.id = oi.product_id
      WHERE d.delivery_date = $1
      GROUP BY d.id, o.id, c.id, c.name, c.phone, c.town, c.landmark, r.name, dd.name
      ORDER BY r.name, dd.name, c.name
      `,
      [date]
    );
    res.json({ data: result.rows });
  } catch (error) {
    logger.error("Fetch deliveries for date failed", error);
    res.status(500).json({ error: "Failed to fetch deliveries" });
  }
});

/** GET /orders/:id */
router.get("/:id", requireTask("can_see_orders"), async (req, res) => {
  try {
    const ordersRes = await pool.query(
      `${ORDER_SELECT} WHERE o.id = $1 ${ORDER_GROUP_BY}`,
      [req.params.id]
    );
    if (ordersRes.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    const data = await attachDetail(ordersRes.rows);
    return res.json({ data: data[0] });
  } catch (error) {
    logger.error("Fetch order failed", error);
    return res.status(500).json({ error: "Failed to fetch order" });
  }
});

/**
 * POST /orders/:id/deliveries
 * body: { delivery_date, notes, items: [{ order_item_id, quantity }] }
 *
 * Schedules one delivery day. Quantities are validated against what's
 * still unscheduled, and the database's deferred trigger enforces the
 * same rule again at commit so two staff scheduling at once can't
 * between them promise more than was ordered.
 */
router.post(
  "/:id/deliveries",
  requireTask("can_schedule_order_delivery"),
  async (req, res) => {
    const orderId = Number(req.params.id);
    const { delivery_date, notes, items } = req.body || {};

    if (!delivery_date) {
      return res.status(400).json({ error: "A delivery date is required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Choose at least one item to deliver on that day" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const orderRes = await client.query(
        `SELECT id, status FROM customer_order WHERE id = $1 FOR UPDATE`,
        [orderId]
      );
      if (orderRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Order not found" });
      }
      if (orderRes.rows[0].status === "CANCELLED") {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "This order was cancelled — nothing can be scheduled for it" });
      }

      // What's left to promise, per line.
      const remainingRes = await client.query(
        `
        SELECT oi.id, p.name AS product_name, oi.quantity,
               COALESCE((
                 SELECT SUM(di.quantity)
                 FROM customer_order_delivery_item di
                 WHERE di.order_item_id = oi.id
               ), 0) AS scheduled
        FROM customer_order_item oi
        JOIN product p ON p.id = oi.product_id
        WHERE oi.order_id = $1
        `,
        [orderId]
      );
      const remaining = new Map(
        remainingRes.rows.map((r) => [
          r.id,
          {
            name: r.product_name,
            left: Number(r.quantity) - Number(r.scheduled),
          },
        ])
      );

      const lines = [];
      for (const item of items) {
        const orderItemId = Number(item?.order_item_id);
        const quantity = Number(item?.quantity);
        if (!orderItemId || !Number.isFinite(quantity) || quantity <= 0) {
          // A zero simply means "not this day" — skip rather than reject,
          // so the UI can send every line with whatever was typed.
          if (quantity === 0) continue;
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Every line needs a valid quantity" });
        }
        const line = remaining.get(orderItemId);
        if (!line) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "That item is not part of this order" });
        }
        if (quantity > line.left) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: `Only ${line.left} of ${line.name} is still unscheduled`,
          });
        }
        lines.push({ orderItemId, quantity });
      }

      if (lines.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Choose at least one item to deliver on that day" });
      }

      const deliveryRes = await client.query(
        `INSERT INTO customer_order_delivery (order_id, delivery_date, notes, created_by)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [orderId, delivery_date, notes ? String(notes).trim() : null, req.user?.id || null]
      );
      const deliveryId = deliveryRes.rows[0].id;

      for (const line of lines) {
        await client.query(
          `INSERT INTO customer_order_delivery_item (delivery_id, order_item_id, quantity)
           VALUES ($1, $2, $3)`,
          [deliveryId, line.orderItemId, line.quantity]
        );
      }

      const status = await recomputeOrderStatus(client, orderId);

      await client.query("COMMIT");

      await recordAudit(pool, {
        user: req.user,
        action: "CREATE",
        entity_type: "customer_order_delivery",
        entity_id: deliveryId,
        description: `Scheduled delivery for order #${orderId} on ${delivery_date}`,
      });

      return res.status(201).json({ id: deliveryId, status });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      logger.error("Schedule delivery failed", error);
      return res
        .status(500)
        .json({ error: error.message || "Failed to schedule delivery" });
    } finally {
      client.release();
    }
  }
);

/**
 * POST /orders/deliveries/:deliveryId/delivered — mark a scheduled day
 * as actually gone out. Toggling it back off is allowed: a mistaken tap
 * shouldn't need a database fix.
 */
router.post(
  "/deliveries/:deliveryId/delivered",
  requireTask("can_schedule_order_delivery"),
  async (req, res) => {
    const { delivered } = req.body || {};
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT order_id FROM customer_order_delivery WHERE id = $1`,
        [req.params.deliveryId]
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Delivery not found" });
      }
      const orderId = result.rows[0].order_id;

      const markDelivered = delivered !== false;
      await client.query(
        `UPDATE customer_order_delivery
         SET delivered_at = ${markDelivered ? "NOW()" : "NULL"},
             delivered_by = $1
         WHERE id = $2`,
        [markDelivered ? req.user?.id || null : null, req.params.deliveryId]
      );

      const status = await recomputeOrderStatus(client, orderId);
      await client.query("COMMIT");

      return res.json({ success: true, status });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      logger.error("Mark delivery delivered failed", error);
      return res.status(500).json({ error: "Failed to update delivery" });
    } finally {
      client.release();
    }
  }
);

/** DELETE /orders/deliveries/:deliveryId — unschedule a delivery day */
router.delete(
  "/deliveries/:deliveryId",
  requireTask("can_schedule_order_delivery"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT order_id, delivery_date, delivered_at
         FROM customer_order_delivery WHERE id = $1`,
        [req.params.deliveryId]
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Delivery not found" });
      }
      const { order_id: orderId, delivery_date, delivered_at } = result.rows[0];

      if (delivered_at) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "This delivery is already marked delivered. Undo that first.",
        });
      }

      await client.query(`DELETE FROM customer_order_delivery WHERE id = $1`, [
        req.params.deliveryId,
      ]);

      const status = await recomputeOrderStatus(client, orderId);
      await client.query("COMMIT");

      await recordAudit(pool, {
        user: req.user,
        action: "DELETE",
        entity_type: "customer_order_delivery",
        entity_id: Number(req.params.deliveryId),
        description: `Removed scheduled delivery for order #${orderId} on ${delivery_date}`,
      });

      return res.json({ success: true, status });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      logger.error("Delete delivery failed", error);
      return res.status(500).json({ error: "Failed to remove delivery" });
    } finally {
      client.release();
    }
  }
);

/** POST /orders/:id/cancel */
router.post("/:id/cancel", requireTask("can_cancel_order"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, status FROM customer_order WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (result.rows[0].status === "CANCELLED") {
      return res.status(400).json({ error: "This order is already cancelled" });
    }
    if (result.rows[0].status === "DELIVERED") {
      return res
        .status(400)
        .json({ error: "This order has already been delivered in full" });
    }

    await pool.query(
      `UPDATE customer_order
       SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_by = $1
       WHERE id = $2`,
      [req.user?.id || null, req.params.id]
    );

    await recordAudit(pool, {
      user: req.user,
      action: "CANCEL",
      entity_type: "customer_order",
      entity_id: Number(req.params.id),
      description: `Cancelled customer order #${req.params.id}`,
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error("Cancel order failed", error);
    return res.status(500).json({ error: "Failed to cancel order" });
  }
});

module.exports = router;
