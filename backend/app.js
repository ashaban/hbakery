// app.js
const express = require("express");
const cors = require("cors");
const app = express();

// The Capacitor Android apps serve their bundled files from the device
// itself, so their requests arrive cross-origin from the WebView's own
// scheme (https://localhost on Android, capacitor://localhost on iOS)
// rather than from the real site address — neither can be spoofed by a
// web page, since both are the app itself. Without this the APK gets a
// CORS failure on every call, surfacing as a login that never completes.
//
// Both apps — the staff one (tz.co.hanein.bakery) and the customer
// ordering one (tz.co.hanein.shop) — share this same WebView origin, so
// one entry covers both.
const allowedOrigins = [
  "https://hanein.co.tz",
  "https://localhost",
  "capacitor://localhost",
];
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header at all: same-origin browser requests, curl, the
      // mobile WebView's own asset loads. Nothing to check.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      // Withhold the headers rather than throwing: the browser then blocks
      // the response itself, which is the actual enforcement. Throwing
      // would turn a routine cross-origin probe into a 500 in the logs.
      callback(null, false);
    },
  })
);

// Last-resort safety net: an unhandled rejection (e.g. a ROLLBACK that
// itself throws) must never silently crash the server mid-transaction.
// Route handlers should always catch their own errors; this only fires if
// one slips through, so we can find out about it instead of the process
// dying and leaving a DB client in an unknown state.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

// Same reasoning, for synchronous/EventEmitter failures: this has
// concretely happened via the log rotator's internal WriteStream emitting
// 'error' (e.g. an EACCES on backend/logs after it was created by a
// different OS user) on an emitter winston's own transport-level 'error'
// handler doesn't cover, which otherwise kills the whole process over a
// pure logging failure. Keep the process alive; a logging hiccup should
// never take sales/transfers/production down with it.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (process kept alive):", err);
});
const jwt = require("jsonwebtoken");
const config = require("./config");
const usersRoutes = require("./routes/users");
const itemRoutes = require("./routes/item");
const unitRoutes = require("./routes/itemunit");
const outletRoutes = require("./routes/outlets");
const purchaseRoutes = require("./routes/itempurchase");
const productsRoutes = require("./routes/products");
const productionRoutes = require("./routes/production");
const productionPlansRoutes = require("./routes/productionPlans");
const stockTransfersRoutes = require("./routes/stocktransfers");
const salesRoutes = require("./routes/sales");
const productOutRoutes = require("./routes/productOut");
const expenditureRoutes = require("./routes/expenditure");
const staffRoutes = require("./routes/staffs");
const customersRoutes = require("./routes/customers");
const loansRoutes = require("./routes/loans");
const payablesRoutes = require("./routes/payables");
const reportRoutes = require("./routes/reports");
const authRoutes = require("./routes/auth");
const roleRoutes = require("./routes/roles");
const taskRoutes = require("./routes/tasks");
const auditLogRoutes = require("./routes/auditlog");
const ordersRoutes = require("./routes/orders");
const geoRoutes = require("./routes/geo");
const customerAuthRoutes = require("./routes/customerAuth");
const shopRoutes = require("./routes/shop");
const { CUSTOMER_TOKEN_TYPE } = require("./middleware/customerAuth");

const jwtValidator = function (req, res, next) {
  let allowedPaths = ["/auth/login", "/auth/refreshToken"];
  let allowedStartsWith = [];
  if (
    allowedPaths.includes(req.path) ||
    allowedStartsWith.some((path) => req.path.startsWith(path))
  ) {
    return next();
  }
  if (
    !req.headers.authorization ||
    req.headers.authorization.split(" ").length !== 2
  ) {
    console.error("Token is missing");
    res.set("WWW-Authenticate", 'Bearer realm="Token is required"');
    res.set("charset", "utf - 8");
    res.status(401).json({
      error: "Token is missing",
    });
  } else {
    const tokenArray = req.headers.authorization.split(" ");
    const token = (req.headers.authorization = tokenArray[1]);
    jwt.verify(token, config.get("auth:secret"), (err, decoded) => {
      if (err) {
        console.warn("Token expired");
        res.set("WWW-Authenticate", 'Bearer realm="Token expired"');
        res.set("charset", "utf - 8");
        res.status(401).json({
          error: "Token expired",
        });
      } else if (decoded && decoded.type === CUSTOMER_TOKEN_TYPE) {
        // Customer app tokens are signed with the same secret, so they
        // verify here just fine — but they must never reach a staff
        // route. Most are task-gated and a customer token carries no
        // tasks, but a few (e.g. GET /customers) are not, and that one
        // would hand a customer the entire customer list. Stop the whole
        // class of problem at the door rather than route by route.
        console.warn("Customer token rejected on staff route", req.path);
        res.status(403).json({ error: "Forbidden" });
      } else {
        req.user = decoded;
        if (req.path == "/isTokenActive/") {
          res.status(200).send(true);
        } else {
          return next();
        }
      }
    });
  }
};

app.use(express.json());

// Base routes
app.use("/", express.static(`${__dirname}/gui`));

// SPA fallback: express.static only matches files that exist on disk, so a
// refresh on a client-side route (e.g. /Purchases) falls through here. Serve
// the app shell for those instead of letting them reach jwtValidator below,
// which has no notion of frontend routes and would reject them for having no
// Authorization header.
const apiPrefixes = [
  "/users", "/items", "/units", "/outlets", "/purchases", "/products",
  "/productions", "/productionPlans", "/stocktransfers", "/sales", "/productOut", "/expenditures",
  "/staffs", "/loans", "/payables", "/customers", "/reports", "/auth", "/roles", "/tasks",
  "/isTokenActive", "/auditlog", "/orders", "/geo", "/customerAuth", "/shop",
];
app.use((req, res, next) => {
  const isApiRequest = apiPrefixes.some(
    (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`)
  );
  if (req.method !== "GET" || isApiRequest || !req.accepts("html")) {
    return next();
  }
  res.sendFile(`${__dirname}/gui/index.html`);
});

// ── Client mobile app ────────────────────────────────────────────────
// Mounted BEFORE jwtValidator, which only understands staff tokens and
// would reject a customer's outright. These routes carry their own guard
// (requireCustomer) where they need one; /geo is intentionally open,
// since a customer needs the region list to fill in the form that
// creates their account.
app.use("/geo", geoRoutes);
app.use("/customerAuth", customerAuthRoutes);
app.use("/shop", shopRoutes);

app.use(jwtValidator);
app.use("/orders", ordersRoutes);
app.use("/users", usersRoutes);
app.use("/items", itemRoutes);
app.use("/units", unitRoutes);
app.use("/outlets", outletRoutes);
app.use("/purchases", purchaseRoutes);
app.use("/products", productsRoutes);
app.use("/productions", productionRoutes);
app.use("/productionPlans", productionPlansRoutes);
app.use("/stocktransfers", stockTransfersRoutes);
app.use("/sales", salesRoutes);
app.use("/productOut", productOutRoutes);
app.use("/expenditures", expenditureRoutes);
app.use("/staffs", staffRoutes);
app.use("/loans", loansRoutes);
app.use("/payables", payablesRoutes);
app.use("/customers", customersRoutes);
app.use("/reports", reportRoutes);
app.use("/auth", authRoutes);
app.use("/roles", roleRoutes);
app.use("/tasks", taskRoutes);
app.use("/auditlog", auditLogRoutes);

app.get("/", (req, res) => {
  res.send("PostgreSQL Item Management API");
});

// Defaults to 3007 exactly as before; the override exists so a second
// instance can be started on another port for testing without editing
// this file and risking the edit being left behind.
const PORT = Number(process.env.PORT) || 3007;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
