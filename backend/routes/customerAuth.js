// routes/customerAuth.js
//
// Self-service registration and login for the client mobile app.
// Separate from /auth, which is for staff: different table, different
// token type, and no roles or tasks anywhere near it.

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const logger = require("../winston");
const { t } = require("../modules/customerMessages");
const config = require("../config");
const { normalizePhone } = require("../modules/customerPhone");
const { requireCustomer, CUSTOMER_TOKEN_TYPE } = require("../middleware/customerAuth");

const router = express.Router();
const secret = config.get("auth:secret");
const tokenDuration = config.get("auth:tokenDuration");

const SALT_ROUNDS = 10;

function signCustomer(customer) {
  return jwt.sign(
    {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      type: CUSTOMER_TOKEN_TYPE,
    },
    secret,
    { expiresIn: tokenDuration }
  );
}

// The shape the app expects back for "who am I / where am I", with the
// region and district resolved to names so the app doesn't have to hold
// the whole geography list just to render a profile.
const PROFILE_SELECT = `
  SELECT c.id, c.name, c.phone, c.town, c.landmark, c.address,
         c.region_id, r.name AS region_name,
         c.district_id, d.name AS district_name,
         c.is_active, c.created_at
  FROM customer c
  LEFT JOIN region r ON r.id = c.region_id
  LEFT JOIN district d ON d.id = c.district_id
`;

/**
 * POST /customerAuth/register
 * body: { name, phone, password, region_id, district_id, town, landmark }
 */
router.post("/register", async (req, res) => {
  const {
    name,
    phone,
    password,
    region_id,
    district_id,
    town,
    landmark,
  } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: t(req, "nameRequired") });
  }
  if (!password || String(password).length < 4) {
    return res.status(400).json({ error: t(req, "passwordTooShort") });
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: t(req, "invalidPhone") });
  }

  if (!region_id || !district_id) {
    return res.status(400).json({ error: t(req, "regionDistrictRequired") });
  }
  if (!town || !String(town).trim()) {
    return res.status(400).json({ error: t(req, "townRequired") });
  }
  // The whole point of this field: a driver needs something findable.
  // An address alone routinely isn't, so it's mandatory, not optional.
  if (!landmark || !String(landmark).trim()) {
    return res
      .status(400)
      .json({ error: t(req, "landmarkRequired") });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // The district must genuinely belong to the region, otherwise the
    // delivery area data is quietly nonsense (Ilala in Mbeya).
    const districtRes = await client.query(
      `SELECT id FROM district WHERE id = $1 AND region_id = $2`,
      [district_id, region_id]
    );
    if (districtRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: t(req, "districtNotInRegion") });
    }

    const existing = await client.query(
      `SELECT id, password FROM customer WHERE phone = $1`,
      [normalizedPhone]
    );

    const hash = await bcrypt.hash(String(password), SALT_ROUNDS);
    let customerId;

    const claimable = existing.rows.find((r) => r.password === null);
    if (existing.rows.some((r) => r.password !== null)) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ error: t(req, "accountExists") });
    }

    if (claimable) {
      // Staff had already created this customer by phone (they buy from
      // us today, on paper). Attach the app account to that same record
      // rather than making a second one, so their existing history and
      // any debt stay attached to the account they now log into.
      const upd = await client.query(
        `
        UPDATE customer
        SET name = $1, password = $2, region_id = $3, district_id = $4,
            town = $5, landmark = $6, registered_via_app = true,
            is_active = true
        WHERE id = $7
        RETURNING id
        `,
        [
          String(name).trim(),
          hash,
          region_id,
          district_id,
          String(town).trim(),
          String(landmark).trim(),
          claimable.id,
        ]
      );
      customerId = upd.rows[0].id;
    } else {
      const ins = await client.query(
        `
        INSERT INTO customer
          (name, phone, password, region_id, district_id, town, landmark, registered_via_app)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING id
        `,
        [
          String(name).trim(),
          normalizedPhone,
          hash,
          region_id,
          district_id,
          String(town).trim(),
          String(landmark).trim(),
        ]
      );
      customerId = ins.rows[0].id;
    }

    const profileRes = await client.query(`${PROFILE_SELECT} WHERE c.id = $1`, [
      customerId,
    ]);

    await client.query("COMMIT");

    const customer = profileRes.rows[0];
    return res.status(201).json({
      customer,
      token: signCustomer(customer),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    // Two people registering the same number at the same instant: the
    // partial unique index catches what the SELECT above raced past.
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: t(req, "accountExists") });
    }
    logger.error("Customer registration failed", error);
    return res.status(500).json({ error: t(req, "registrationFailed") });
  } finally {
    client.release();
  }
});

/**
 * POST /customerAuth/login
 * body: { phone, password }
 */
router.post("/login", async (req, res) => {
  const { phone, password } = req.body || {};

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || !password) {
    return res.status(400).json({ error: t(req, "phoneAndPasswordRequired") });
  }

  try {
    const result = await pool.query(
      `SELECT id, password, is_active FROM customer
       WHERE phone = $1 AND password IS NOT NULL`,
      [normalizedPhone]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: t(req, "invalidCredentials") });
    }

    const row = result.rows[0];
    const ok = await bcrypt.compare(String(password), row.password);
    if (!ok) {
      return res.status(401).json({ error: t(req, "invalidCredentials") });
    }
    if (!row.is_active) {
      return res
        .status(403)
        .json({ error: t(req, "accountDeactivated") });
    }

    const profileRes = await pool.query(`${PROFILE_SELECT} WHERE c.id = $1`, [row.id]);
    const customer = profileRes.rows[0];

    return res.json({ customer, token: signCustomer(customer) });
  } catch (error) {
    logger.error("Customer login failed", error);
    return res.status(500).json({ error: t(req, "loginFailed") });
  }
});

/**
 * GET /customerAuth/me — current profile, used on app start to decide
 * whether the stored token is still good.
 */
router.get("/me", requireCustomer, async (req, res) => {
  try {
    const result = await pool.query(`${PROFILE_SELECT} WHERE c.id = $1`, [
      req.customer.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: t(req, "accountNotFound") });
    }
    return res.json({ customer: result.rows[0] });
  } catch (error) {
    logger.error("Fetch customer profile failed", error);
    return res.status(500).json({ error: t(req, "profileLoadFailed") });
  }
});

/**
 * PUT /customerAuth/me — update name / location.
 * Phone is deliberately not editable here: it's the login identity, and
 * changing it needs a verification step this feature doesn't have yet.
 */
router.put("/me", requireCustomer, async (req, res) => {
  const { name, region_id, district_id, town, landmark } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: t(req, "nameRequired") });
  }
  if (!region_id || !district_id) {
    return res.status(400).json({ error: t(req, "regionDistrictRequired") });
  }
  if (!town || !String(town).trim()) {
    return res.status(400).json({ error: t(req, "townRequired") });
  }
  if (!landmark || !String(landmark).trim()) {
    return res
      .status(400)
      .json({ error: t(req, "landmarkRequired") });
  }

  try {
    const districtRes = await pool.query(
      `SELECT id FROM district WHERE id = $1 AND region_id = $2`,
      [district_id, region_id]
    );
    if (districtRes.rows.length === 0) {
      return res.status(400).json({ error: t(req, "districtNotInRegion") });
    }

    await pool.query(
      `
      UPDATE customer
      SET name = $1, region_id = $2, district_id = $3, town = $4, landmark = $5
      WHERE id = $6
      `,
      [
        String(name).trim(),
        region_id,
        district_id,
        String(town).trim(),
        String(landmark).trim(),
        req.customer.id,
      ]
    );

    const result = await pool.query(`${PROFILE_SELECT} WHERE c.id = $1`, [
      req.customer.id,
    ]);
    return res.json({ customer: result.rows[0] });
  } catch (error) {
    logger.error("Update customer profile failed", error);
    return res.status(500).json({ error: t(req, "profileUpdateFailed") });
  }
});

/**
 * PUT /customerAuth/password — body: { current_password, new_password }
 */
router.put("/password", requireCustomer, async (req, res) => {
  const { current_password, new_password } = req.body || {};

  if (!current_password || !new_password) {
    return res.status(400).json({ error: t(req, "passwordsRequired") });
  }
  if (String(new_password).length < 4) {
    return res.status(400).json({ error: t(req, "passwordTooShort") });
  }

  try {
    const result = await pool.query(`SELECT password FROM customer WHERE id = $1`, [
      req.customer.id,
    ]);
    if (result.rows.length === 0 || !result.rows[0].password) {
      return res.status(404).json({ error: t(req, "accountNotFound") });
    }

    const ok = await bcrypt.compare(String(current_password), result.rows[0].password);
    if (!ok) {
      return res.status(401).json({ error: t(req, "currentPasswordWrong") });
    }

    const hash = await bcrypt.hash(String(new_password), SALT_ROUNDS);
    await pool.query(`UPDATE customer SET password = $1 WHERE id = $2`, [
      hash,
      req.customer.id,
    ]);

    return res.json({ success: true });
  } catch (error) {
    logger.error("Change customer password failed", error);
    return res.status(500).json({ error: t(req, "passwordChangeFailed") });
  }
});

module.exports = router;
