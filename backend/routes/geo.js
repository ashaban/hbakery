// routes/geo.js
//
// Regions and districts for the client app's registration screen.
// Deliberately unauthenticated: a customer needs these to fill in the
// form that creates their account, so requiring a token would be
// circular. The data is a published list of Tanzanian councils — there
// is nothing here worth protecting.

const express = require("express");
const pool = require("../db");
const logger = require("../winston");
const { t } = require("../modules/customerMessages");

const router = express.Router();

/** GET /geo/regions */
router.get("/regions", async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, name FROM region ORDER BY name`);
    res.json({ data: result.rows });
  } catch (error) {
    logger.error("Fetch regions failed", error);
    res.status(500).json({ error: t(req, "regionsLoadFailed") });
  }
});

/** GET /geo/districts?region_id=1 */
router.get("/districts", async (req, res) => {
  const regionId = Number(req.query.region_id);

  try {
    if (regionId) {
      const result = await pool.query(
        `SELECT id, region_id, name FROM district WHERE region_id = $1 ORDER BY name`,
        [regionId]
      );
      return res.json({ data: result.rows });
    }

    // No filter: return everything, so the app can cache the whole list
    // once and switch regions offline without another round trip.
    const result = await pool.query(
      `SELECT id, region_id, name FROM district ORDER BY region_id, name`
    );
    return res.json({ data: result.rows });
  } catch (error) {
    logger.error("Fetch districts failed", error);
    return res.status(500).json({ error: t(req, "districtsLoadFailed") });
  }
});

module.exports = router;
