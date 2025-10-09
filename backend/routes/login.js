const express = require('express');
const formidable = require('formidable');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const logger = require('../winston');
const config = require('../config');

const router = express.Router();

router.post('/authenticate', async (req, res) => {
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields) => {
    if (err) return res.status(400).json({ message: 'Invalid form data' });

    const email = fields.username?.[0];
    const password = fields.password?.[0];

    try {
      // Use parameterized query to prevent SQL injection
      const query = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.password,
          r.name AS role
        FROM users u
        INNER JOIN roles r ON r.id = u.role
        WHERE u.email = $1
      `;
      const result = await pool.query(query, [email]);
      if (result.rows.length === 0) {
        logger.warn(`Failed authenticating user ${email}`);
        return res.status(200).json({
          token: null,
          role: null,
          userID: null,
        });
      }

      const user = result.rows[0];
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (passwordMatch) {
        const tokenDuration = config.get('auth:tokenDuration');
        const secret = config.get('auth:secret');

        const token = jwt.sign(
          { id: user.id },
          secret,
          { expiresIn: tokenDuration }
        );

        logger.info(`Successfully authenticated user ${email}`);
        return res.status(200).json({
          token,
          name: user.name,
          role: user.role,
        });
      } else {
        logger.warn(`Password mismatch for user ${email}`);
        return res.status(200).json({
          token: null,
          userID: null,
        });
      }

    } catch (error) {
      console.error('Error during authentication:', error);
      logger.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
});

// --------------------
// REFRESH TOKEN
// --------------------
router.post('/refreshToken', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    const tokenDuration = config.get('auth:tokenDuration');
    const secret = config.get('auth:secret');

    jwt.verify(token, secret, (err, user) => {
      if (err) return res.sendStatus(403);
      const newToken = jwt.sign(
        { id: user.id },
        secret,
        { expiresIn: tokenDuration }
      );

      res.json({ token: newToken });
    });
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

module.exports = router;
