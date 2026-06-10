const express = require("express");
const cors = require("cors");
const { buildCorsOptions, securityHeaders } = require("./middleware/security");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(require("./middleware/audit"));

app.get("/", (req, res) => {
  res.json({ message: "API de incidencias funcionando" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/organizations", require("./routes/organizations"));
app.use("/api/roles", require("./routes/roleRoutes"));
app.use("/api/users", require("./routes/users"));
app.use("/api/branches", require("./routes/branches"));
app.use("/api/incidents", require("./routes/incidents"));
app.use("/api/maintenance", require("./routes/maintenance"));
app.use("/api/inventory", require("./routes/inventory"));
app.use("/api/suppliers", require("./routes/suppliers"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/storage", require("./routes/storage"));
app.use("/api/audit", require("./routes/audit"));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "gestor-incidencias-api" });
});

app.use("/api", (req, res) => {
  res.status(404).json({
    msg: "Ruta de API no encontrada",
    path: req.originalUrl,
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  console.error("API error:", error);
  return res.status(error.status || 500).json({
    msg: "Error interno del servidor",
    error: process.env.NODE_ENV === "production" ? undefined : error.message,
  });
});

module.exports = app;
