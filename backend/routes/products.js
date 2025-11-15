const express = require("express");
const formidable = require("formidable");
const pool = require("../db"); // your configured PostgreSQL pool
const router = express.Router();
const { requireTask } = require("../middleware/auth");

/**
 * ✅ GET /products (with pagination and optional name search)
 * Supports query params: page, limit, search
 */

/**
 * ✅ GET /products/:id/groups - Get product groups with combinations for production
 * Returns groups with their combinations and ingredient quantities
 */
router.get("/:id/groups", requireTask("can_see_settings"), async (req, res) => {
  const { id } = req.params;

  try {
    // Verify product exists
    const productResult = await pool.query(
      "SELECT id, name FROM product WHERE id = $1",
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Get fixed items (mandatory ingredients)
    const fixedItemsRes = await pool.query(
      `
      SELECT 
        pi.item_id, 
        i.name AS item_name, 
        pi.quantity_per_unit,
        COALESCE(u.shortname, u.name) AS unit
      FROM product_item pi
      JOIN item i ON i.id = pi.item_id
      LEFT JOIN itemunit u ON u.id = i.unit_id
      WHERE pi.product_id = $1
      ORDER BY pi.id
      `,
      [id]
    );

    // Get groups
    const groupsRes = await pool.query(
      `
      SELECT 
        id, 
        name, 
        description, 
        is_mandatory, 
        selection_mode
      FROM product_item_group 
      WHERE product_id = $1
      ORDER BY id
      `,
      [id]
    );

    // Get options for all groups
    const optionsRes = await pool.query(
      `
      SELECT 
        o.id AS option_id,
        o.group_id,
        o.item_id,
        i.name AS item_name,
        COALESCE(u.shortname, u.name) AS unit,
        o.position
      FROM product_item_option o
      JOIN item i ON i.id = o.item_id
      LEFT JOIN itemunit u ON u.id = i.unit_id
      WHERE o.group_id IN (
        SELECT id FROM product_item_group WHERE product_id = $1
      )
      ORDER BY o.group_id, o.position
      `,
      [id]
    );

    // Get combinations
    const combinationsRes = await pool.query(
      `
      SELECT 
        c.id,
        c.group_id,
        c.combination_mask,
        c.name,
        c.is_default,
        c.notes
      FROM product_item_group_combination c
      WHERE c.group_id IN (
        SELECT id FROM product_item_group WHERE product_id = $1
      )
      ORDER BY c.group_id, c.id
      `,
      [id]
    );

    // Get combination quantities
    const quantitiesRes = await pool.query(
      `
      SELECT 
        q.combination_id,
        q.option_id,
        q.quantity_per_unit,
        o.item_id,
        i.name AS item_name,
        COALESCE(u.shortname, u.name) AS unit
      FROM product_item_group_combination_qty q
      JOIN product_item_option o ON o.id = q.option_id
      JOIN item i ON i.id = o.item_id
      LEFT JOIN itemunit u ON u.id = i.unit_id
      WHERE q.combination_id IN (
        SELECT c.id FROM product_item_group_combination c
        WHERE c.group_id IN (
          SELECT id FROM product_item_group WHERE product_id = $1
        )
      )
      ORDER BY q.combination_id, q.option_id
      `,
      [id]
    );

    // Organize options by group
    const optionsByGroup = optionsRes.rows.reduce((acc, option) => {
      if (!acc[option.group_id]) {
        acc[option.group_id] = [];
      }
      acc[option.group_id].push({
        option_id: option.option_id,
        item_id: option.item_id,
        item_name: option.item_name,
        unit: option.unit,
        position: option.position,
      });
      return acc;
    }, {});

    // Organize quantities by combination
    const quantitiesByCombination = quantitiesRes.rows.reduce((acc, qty) => {
      if (!acc[qty.combination_id]) {
        acc[qty.combination_id] = [];
      }
      acc[qty.combination_id].push({
        option_id: qty.option_id,
        item_id: qty.item_id,
        item_name: qty.item_name,
        quantity_per_unit: parseFloat(qty.quantity_per_unit),
        unit: qty.unit,
      });
      return acc;
    }, {});

    // Organize combinations by group
    const combinationsByGroup = combinationsRes.rows.reduce((acc, combo) => {
      if (!acc[combo.group_id]) {
        acc[combo.group_id] = [];
      }

      // Get options for this combination
      const options = quantitiesByCombination[combo.id] || [];

      acc[combo.group_id].push({
        id: combo.id,
        name: combo.name,
        is_default: combo.is_default,
        combination_mask: combo.combination_mask,
        notes: combo.notes,
        options: options,
      });
      return acc;
    }, {});

    // Build final groups structure
    const groups = groupsRes.rows.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      is_mandatory: group.is_mandatory,
      selection_mode: group.selection_mode,
      options: optionsByGroup[group.id] || [],
      combinations: combinationsByGroup[group.id] || [],
    }));

    res.json({
      product: {
        id: productResult.rows[0].id,
        name: productResult.rows[0].name,
      },
      fixed_items: fixedItemsRes.rows.map((item) => ({
        item_id: item.item_id,
        item_name: item.item_name,
        quantity_per_unit: parseFloat(item.quantity_per_unit),
        unit: item.unit,
      })),
      groups: groups,
    });
  } catch (err) {
    console.error("Error fetching product groups:", err);
    res.status(500).json({ error: "Failed to fetch product groups" });
  }
});

router.get("/", requireTask("can_see_settings"), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : "%";

  try {
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM product WHERE name ILIKE $1",
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
      currentPage: page,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

/**
 * ✅ GET /products/:id (with its product_items)
 */
router.get("/:id", requireTask("can_see_settings"), async (req, res) => {
  const { id } = req.params;
  try {
    // product
    const productResult = await pool.query(
      "SELECT * FROM product WHERE id = $1",
      [id]
    );
    if (productResult.rows.length === 0)
      return res.status(404).json({ error: "Product not found" });
    const product = productResult.rows[0];

    // mandatory items (unchanged)
    const itemsResult = await pool.query(
      `
      SELECT pi.id, pi.item_id, i.name AS item_name, pi.quantity_per_unit,
             COALESCE(u.shortname, u.name) AS unit
      FROM product_item pi
      JOIN item i ON i.id = pi.item_id
      LEFT JOIN itemunit u ON u.id = i.unit_id
      WHERE pi.product_id = $1
      ORDER BY pi.id
    `,
      [id]
    );

    // groups
    const groupsRes = await pool.query(
      `
      SELECT id, name, description, is_mandatory, selection_mode
      FROM product_item_group WHERE product_id = $1
      ORDER BY id
    `,
      [id]
    );

    // options per group
    const optionsRes = await pool.query(
      `
      SELECT o.id, o.group_id, o.item_id, i.name AS item_name, o.position,
             COALESCE(u.shortname, u.name) AS unit
      FROM product_item_option o
      JOIN item i ON i.id = o.item_id
      LEFT JOIN itemunit u ON u.id = i.unit_id
      WHERE o.group_id IN (SELECT id FROM product_item_group WHERE product_id = $1)
      ORDER BY o.group_id, o.position
    `,
      [id]
    );

    // combinations
    const combRes = await pool.query(
      `
      SELECT c.id, c.group_id, c.combination_mask, c.name, c.is_default, c.notes
      FROM product_item_group_combination c
      WHERE c.group_id IN (SELECT id FROM product_item_group WHERE product_id = $1)
      ORDER BY c.group_id, c.id
    `,
      [id]
    );

    // quantities per combination
    const qtyRes = await pool.query(
      `
      SELECT q.combination_id, q.option_id, q.quantity_per_unit, o.item_id
      FROM product_item_group_combination_qty q
      JOIN product_item_option o ON o.id = q.option_id
      WHERE q.combination_id IN (
        SELECT c.id FROM product_item_group_combination c
        WHERE c.group_id IN (SELECT id FROM product_item_group WHERE product_id = $1)
      )
      ORDER BY q.combination_id, q.option_id
    `,
      [id]
    );

    // assemble groups
    const optionsByGroup = optionsRes.rows.reduce((acc, r) => {
      (acc[r.group_id] ||= []).push({
        id: r.id,
        item_id: r.item_id,
        item_name: r.item_name,
        position: r.position,
        unit: r.unit,
      });
      return acc;
    }, {});

    const qtyByComb = qtyRes.rows.reduce((acc, r) => {
      (acc[r.combination_id] ||= []).push({
        option_id: r.option_id,
        item_id: r.item_id,
        quantity_per_unit: r.quantity_per_unit,
      });
      return acc;
    }, {});

    const combByGroup = combRes.rows.reduce((acc, r) => {
      (acc[r.group_id] ||= []).push({
        id: r.id,
        name: r.name,
        is_default: r.is_default,
        combination_mask: r.combination_mask,
        quantities: qtyByComb[r.id] || [],
      });
      return acc;
    }, {});

    const groups = groupsRes.rows.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      is_mandatory: g.is_mandatory,
      selection_mode: g.selection_mode,
      options: optionsByGroup[g.id] || [],
      combinations: combByGroup[g.id] || [],
    }));

    res.json({
      product,
      items: itemsResult.rows,
      groups,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product details" });
  }
});

/**
 * ✅ POST /products — create product with its product_items
 */
router.post("/", requireTask("can_add_settings"), async (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields) => {
    console.log(JSON.stringify(fields, 0, 2));
    if (err) return res.status(400).json({ error: "Invalid form data" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const insertProduct = await client.query(
        `INSERT INTO product (name, description, unit, price)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          fields.name?.[0],
          fields.description?.[0] || null,
          fields.unit?.[0] || null,
          fields.price?.[0] || 0,
        ]
      );
      const productId = insertProduct.rows[0].id;

      // mandatory items (unchanged)
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

      // NEW (groups)
      if (fields.groups?.[0]) {
        const groups = JSON.parse(fields.groups?.[0]);

        for (const g of groups) {
          const {
            rows: [grp],
          } = await client.query(
            `INSERT INTO product_item_group (product_id, name, description, is_mandatory, selection_mode)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [
              productId,
              g.name || null,
              g.description || null,
              !!g.is_mandatory,
              g.selection_mode || "ANY",
            ]
          );
          const groupId = grp.id;

          // options
          const optionIdByItem = {};
          if (Array.isArray(g.options)) {
            for (const opt of g.options) {
              const {
                rows: [o],
              } = await client.query(
                `INSERT INTO product_item_option (group_id, item_id, position)
                 VALUES ($1, $2, $3) RETURNING id`,
                [groupId, opt.item_id, opt.position ?? 0]
              );
              optionIdByItem[opt.item_id] = o.id;
            }
          }

          // combinations + quantities
          if (Array.isArray(g.combinations)) {
            for (const cmb of g.combinations) {
              const {
                rows: [c],
              } = await client.query(
                `INSERT INTO product_item_group_combination (group_id, combination_mask, name, is_default, notes)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [
                  groupId,
                  cmb.combination_mask,
                  cmb.name || null,
                  !!cmb.is_default,
                  cmb.notes || null,
                ]
              );
              const combId = c.id;

              if (Array.isArray(cmb.quantities)) {
                for (const q of cmb.quantities) {
                  const optionId = optionIdByItem[q.item_id];
                  if (!optionId)
                    throw new Error(
                      `Option not found for item ${q.item_id} in group ${groupId}`
                    );
                  await client.query(
                    `INSERT INTO product_item_group_combination_qty (combination_id, option_id, quantity_per_unit)
                     VALUES ($1, $2, $3)`,
                    [combId, optionId, q.quantity_per_unit]
                  );
                }
              }
            }
          }
        }
      }

      await client.query("COMMIT");
      res.json({
        message: "Product created successfully",
        product_id: productId,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Failed to create product" });
    } finally {
      client.release();
    }
  });
});

/**
 * ✅ PUT /products/:id — update product and its product_items
 */
router.put("/:id", requireTask("can_add_settings"), async (req, res) => {
  const productId = req.params.id;
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields) => {
    if (err) return res.status(400).json({ error: "Invalid form data" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE product SET name=$1, description=$2, unit=$3, price=$4 WHERE id=$5`,
        [
          fields.name?.[0],
          fields.description?.[0] || "",
          fields.unit?.[0] || null,
          fields.price?.[0] || 0,
          productId,
        ]
      );

      /* Replace mandatory items */
      await client.query(`DELETE FROM product_item WHERE product_id=$1`, [
        productId,
      ]);
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

      /* Replace groups entirely */
      const groupIdsRes = await client.query(
        `SELECT id FROM product_item_group WHERE product_id=$1`,
        [productId]
      );
      const groupIds = groupIdsRes.rows.map((r) => r.id);
      if (groupIds.length) {
        await client.query(
          `DELETE FROM product_item_group_combination_qty WHERE combination_id IN (
          SELECT id FROM product_item_group_combination WHERE group_id = ANY($1::int[])
        )`,
          [groupIds]
        );
        await client.query(
          `DELETE FROM product_item_group_combination WHERE group_id = ANY($1::int[])`,
          [groupIds]
        );
        await client.query(
          `DELETE FROM product_item_option WHERE group_id = ANY($1::int[])`,
          [groupIds]
        );
        await client.query(
          `DELETE FROM product_item_group WHERE id = ANY($1::int[])`,
          [groupIds]
        );
      }

      if (fields.groups) {
        const groups = JSON.parse(fields.groups);

        for (const g of groups) {
          const {
            rows: [grp],
          } = await client.query(
            `INSERT INTO product_item_group (product_id, name, description, is_mandatory, selection_mode)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [
              productId,
              g.name || null,
              g.description || null,
              !!g.is_mandatory,
              g.selection_mode || "ANY",
            ]
          );
          const groupId = grp.id;

          const optionIdByItem = {};
          if (Array.isArray(g.options)) {
            for (const opt of g.options) {
              const {
                rows: [o],
              } = await client.query(
                `INSERT INTO product_item_option (group_id, item_id, position)
                 VALUES ($1, $2, $3) RETURNING id`,
                [groupId, opt.item_id, opt.position ?? 0]
              );
              optionIdByItem[opt.item_id] = o.id;
            }
          }

          if (Array.isArray(g.combinations)) {
            for (const cmb of g.combinations) {
              const {
                rows: [c],
              } = await client.query(
                `INSERT INTO product_item_group_combination (group_id, combination_mask, name, is_default, notes)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [
                  groupId,
                  cmb.combination_mask,
                  cmb.name || null,
                  !!cmb.is_default,
                  cmb.notes || null,
                ]
              );
              const combId = c.id;

              if (Array.isArray(cmb.quantities)) {
                for (const q of cmb.quantities) {
                  const optionId = optionIdByItem[q.item_id];
                  if (!optionId)
                    throw new Error(
                      `Option not found for item ${q.item_id} in group ${groupId}`
                    );
                  await client.query(
                    `INSERT INTO product_item_group_combination_qty (combination_id, option_id, quantity_per_unit)
                     VALUES ($1, $2, $3)`,
                    [combId, optionId, q.quantity_per_unit]
                  );
                }
              }
            }
          }
        }
      }

      await client.query("COMMIT");
      res.json({ message: "Product updated successfully" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Failed to update product" });
    } finally {
      client.release();
    }
  });
});

/**
 * ✅ DELETE /products/:id — remove product (and cascades items)
 */
router.delete("/:id", requireTask("can_add_settings"), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Check if product exists
    const check = await client.query("SELECT id FROM product WHERE id = $1", [
      id,
    ]);
    if (check.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Product not found" });
    }

    // 2️⃣ Delete all group-related data (quantities → combinations → options → groups)
    const groupIdsResult = await client.query(
      `SELECT id FROM product_item_group WHERE product_id = $1`,
      [id]
    );
    const groupIds = groupIdsResult.rows.map((r) => r.id);

    if (groupIds.length > 0) {
      // get all combination ids for these groups
      const combinationIdsResult = await client.query(
        `SELECT id FROM product_item_group_combination WHERE group_id = ANY($1::int[])`,
        [groupIds]
      );
      const combinationIds = combinationIdsResult.rows.map((r) => r.id);

      if (combinationIds.length > 0) {
        await client.query(
          `DELETE FROM product_item_group_combination_qty WHERE combination_id = ANY($1::int[])`,
          [combinationIds]
        );
      }

      await client.query(
        `DELETE FROM product_item_group_combination WHERE group_id = ANY($1::int[])`,
        [groupIds]
      );
      await client.query(
        `DELETE FROM product_item_option WHERE group_id = ANY($1::int[])`,
        [groupIds]
      );
      await client.query(
        `DELETE FROM product_item_group WHERE id = ANY($1::int[])`,
        [groupIds]
      );
    }

    // 3️⃣ Delete mandatory product items
    await client.query(`DELETE FROM product_item WHERE product_id = $1`, [id]);

    // 4️⃣ Delete product itself
    await client.query(`DELETE FROM product WHERE id = $1`, [id]);

    await client.query("COMMIT");
    res.json({
      message:
        "✅ Product and all related ingredient data deleted successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error deleting product:", err);
    res
      .status(500)
      .json({ error: "Failed to delete product", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
