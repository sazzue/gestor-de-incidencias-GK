require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const cors = require('cors');

const Role = require("./models/Role");
const Department = require("./models/Department");
const User = require("./models/User");
const Organization = require("./models/Organization");
const Branch = require("./models/branch");
const Incident = require("./models/incident");
const Maintenance = require("./models/Maintenance");
const InventoryItem = require("./models/InventoryItem");
const SystemSettings = require("./models/SystemSettings");
const { startAttachmentCleanupSchedule } = require("./utils/attachmentCleanup");

const dropLegacyIndex = async (Model, indexName) => {
  try {
    await Model.collection.dropIndex(indexName);
    console.log(`Indice legacy eliminado: ${Model.modelName}.${indexName}`);
  } catch (error) {
    if (error.codeName !== "IndexNotFound" && error.code !== 27) {
      console.warn(`No se pudo eliminar indice ${Model.modelName}.${indexName}:`, error.message);
    }
  }
};

// Middleware global
app.use(cors());

// 📦 ROUTES
app.use("/api/auth", require("./routes/auth"));
app.use("/api/organizations", require("./routes/organizations"));
app.use("/api/roles", require("./routes/roleRoutes"));
app.use("/api/users", require("./routes/users"));
app.use("/api/branches", require("./routes/branches"));
app.use("/api/incidents", require("./routes/incidents"));
app.use("/api/maintenance", require("./routes/maintenance"));
app.use("/api/inventory", require("./routes/inventory"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/storage", require("./routes/storage"));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "gestor-incidencias-api" });
});

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    `
    default-src 'self';
    img-src 'self' data:;
    style-src 'self' 'unsafe-inline' https://www.gstatic.com;
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    connect-src *;
    `
  );
  next();
});

app.use("/api", (req, res) => {
  res.status(404).json({
    msg: "Ruta de API no encontrada",
    path: req.originalUrl,
  });
});

app.use((error, req, res, next) => {
  console.error("API error:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(error.status || 500).json({
    msg: "Error interno del servidor",
    error: process.env.NODE_ENV === "production" ? undefined : error.message,
  });
});

// 🔌 CONEXIÓN A MONGO
mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
  console.log('CONECTADO A MONGODB');

  const defaultOrganization = await Organization.findOneAndUpdate(
    { slug: "default" },
    {
      $setOnInsert: {
        name: process.env.DEFAULT_ORGANIZATION_NAME || "Empresa principal",
        slug: "default",
        status: "active",
        plan: "basic",
      },
    },
    { new: true, upsert: true }
  );

  await Promise.all([
    User.updateMany({ organization: { $exists: false } }, { organization: defaultOrganization._id }),
    User.updateMany({ organization: null }, { organization: defaultOrganization._id }),
    Branch.updateMany({ organization: { $exists: false } }, { organization: defaultOrganization._id }),
    Branch.updateMany({ organization: null }, { organization: defaultOrganization._id }),
    Department.updateMany({ organization: { $exists: false } }, { organization: defaultOrganization._id }),
    Department.updateMany({ organization: null }, { organization: defaultOrganization._id }),
    Incident.updateMany({ organization: { $exists: false } }, { organization: defaultOrganization._id }),
    Incident.updateMany({ organization: null }, { organization: defaultOrganization._id }),
    Maintenance.updateMany({ organization: { $exists: false } }, { organization: defaultOrganization._id }),
    Maintenance.updateMany({ organization: null }, { organization: defaultOrganization._id }),
    InventoryItem.updateMany({ organization: { $exists: false } }, { organization: defaultOrganization._id }),
    InventoryItem.updateMany({ organization: null }, { organization: defaultOrganization._id }),
    SystemSettings.updateMany({ organization: { $exists: false } }, { organization: defaultOrganization._id }),
    SystemSettings.updateMany({ organization: null }, { organization: defaultOrganization._id }),
  ]);

  await Promise.all([
    dropLegacyIndex(User, "email_1"),
    dropLegacyIndex(User, "username_1"),
    dropLegacyIndex(Branch, "name_1"),
    dropLegacyIndex(Department, "name_1"),
    dropLegacyIndex(InventoryItem, "serialNumber_1"),
    dropLegacyIndex(SystemSettings, "key_1"),
  ]);

  // 🔥 SEED ROLES
  const roles = ["admin", "gerencia", "direccion", "departamento"];

  for (let role of roles) {
    const exists = await Role.findOne({ name: role });

    if (!exists) {
      await Role.create({ name: role });
      console.log("✅ Rol creado:", role);
    }
  }

  // 🚀 SERVER START
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
    startAttachmentCleanupSchedule();
  });

})
.catch((error) => {
  console.error('Error al conectar a MongoDB:', error);
});
