// middleware/customerAuth.js
//
// Customers authenticate with the same JWT secret as staff, but their
// tokens carry `type: "customer"` and never carry a `tasks` array. Two
// guards keep the two populations apart:
//
//   * requireCustomer (here) rejects anything that isn't a customer
//     token, so a staff token can't act as a customer.
//   * the staff jwtValidator in app.js rejects tokens whose type is
//     "customer", so a customer token can't reach any staff route —
//     including the handful that aren't individually task-gated.
//
// Without that second guard a customer token would sail through
// jwtValidator and could read, for example, the whole customer list.

const jwt = require("jsonwebtoken");
const config = require("../config");

const secret = config.get("auth:secret");

const CUSTOMER_TOKEN_TYPE = "customer";

function requireCustomer(req, res, next) {
  const header = req.headers["authorization"];
  const token = header && header.includes(" ") ? header.split(" ")[1] : header;

  if (!token) {
    return res.status(401).json({ error: "Token is missing" });
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Token expired" });
    }
    if (!decoded || decoded.type !== CUSTOMER_TOKEN_TYPE) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.customer = decoded;
    next();
  });
}

module.exports = { requireCustomer, CUSTOMER_TOKEN_TYPE };
