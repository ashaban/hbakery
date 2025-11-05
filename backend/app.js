// app.js
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const config = require("./config");
const loginRoutes = require("./routes/login");
const usersRoutes = require("./routes/users");
const itemRoutes = require("./routes/item");
const unitRoutes = require("./routes/itemunit");
const outletRoutes = require("./routes/outlets");
const purchaseRoutes = require("./routes/itempurchase");
const productsRoutes = require("./routes/products");
const productionRoutes = require("./routes/production");
const stockTransfersRoutes = require("./routes/stocktransfers");
const salesRoutes = require("./routes/sales");
const productOutRoutes = require("./routes/productOut");
const expenditureRoutes = require("./routes/expenditure");
const staffRoutes = require("./routes/staffs");
const customersRoutes = require("./routes/customers");
const reportRoutes = require("./routes/reports");

const jwtValidator = function (req, res, next) {
  let allowedPaths = ["/authenticate"];
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
    res.set("Access-Control-Allow-Origin", "*");
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
        res.set("Access-Control-Allow-Origin", "*");
        res.set("WWW-Authenticate", 'Bearer realm="Token expired"');
        res.set("charset", "utf - 8");
        res.status(401).json({
          error: "Token expired",
        });
      } else {
        if (req.path == "/isTokenActive/") {
          res.set("Access-Control-Allow-Origin", "*");
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
app.use("/login/", loginRoutes);
app.use(jwtValidator);
app.use("/users", usersRoutes);
app.use("/items", itemRoutes);
app.use("/units", unitRoutes);
app.use("/outlets", outletRoutes);
app.use("/purchases", purchaseRoutes);
app.use("/products", productsRoutes);
app.use("/productions", productionRoutes);
app.use("/stocktransfers", stockTransfersRoutes);
app.use("/sales", salesRoutes);
app.use("/productOut", productOutRoutes);
app.use("/expenditures", expenditureRoutes);
app.use("/staffs", staffRoutes);
app.use("/customers", customersRoutes);
app.use("/reports", reportRoutes);

app.get("/", (req, res) => {
  res.send("PostgreSQL Item Management API");
});

const PORT = 3007;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
