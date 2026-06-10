require("dotenv").config();
const mongoose = require("mongoose");
const app = require("./app");

const Role = require("./models/Role");
const Department = require("./models/Department");
const User = require("./models/User");
const Organization = require("./models/Organization");
const Branch = require("./models/branch");
const Incident = require("./models/incident");
const Maintenance = require("./models/Maintenance");
const InventoryItem = require("./models/InventoryItem");
const InventoryCatalog = require("./models/InventoryCatalog");
const Supplier = require("./models/Supplier");
const SystemSettings = require("./models/SystemSettings");
const AuditLog = require("./models/AuditLog");
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

const assignDefaultOrganization = async (organizationId) => {
  await Promise.all([
    User.updateMany({ organization: { $exists: false } }, { organization: organizationId }),
    User.updateMany({ organization: null }, { organization: organizationId }),
    Branch.updateMany({ organization: { $exists: false } }, { organization: organizationId }),
    Branch.updateMany({ organization: null }, { organization: organizationId }),
    Department.updateMany({ organization: { $exists: false } }, { organization: organizationId }),
    Department.updateMany({ organization: null }, { organization: organizationId }),
    Incident.updateMany({ organization: { $exists: false } }, { organization: organizationId }),
    Incident.updateMany({ organization: null }, { organization: organizationId }),
    Maintenance.updateMany({ organization: { $exists: false } }, { organization: organizationId }),
    Maintenance.updateMany({ organization: null }, { organization: organizationId }),
    InventoryItem.updateMany({ organization: { $exists: false } }, { organization: organizationId }),
    InventoryItem.updateMany({ organization: null }, { organization: organizationId }),
    InventoryCatalog.updateMany({ organization: { $exists: false } }, { organization: organizationId }),
    InventoryCatalog.updateMany({ organization: null }, { organization: organizationId }),
    Supplier.updateMany({ organization: { $exists: false } }, { organization: organizationId }),
    Supplier.updateMany({ organization: null }, { organization: organizationId }),
    SystemSettings.updateMany({ organization: { $exists: false } }, { organization: organizationId }),
    SystemSettings.updateMany({ organization: null }, { organization: organizationId }),
    AuditLog.updateMany({ organization: { $exists: false } }, { organization: organizationId }),
    AuditLog.updateMany({ organization: null }, { organization: organizationId }),
  ]);
};

const initializeDatabase = async () => {
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

  await assignDefaultOrganization(defaultOrganization._id);

  await Promise.all([
    dropLegacyIndex(User, "email_1"),
    dropLegacyIndex(User, "username_1"),
    dropLegacyIndex(Branch, "name_1"),
    dropLegacyIndex(Department, "name_1"),
    dropLegacyIndex(InventoryItem, "serialNumber_1"),
    dropLegacyIndex(SystemSettings, "key_1"),
  ]);

  for (const role of ["admin", "gerencia", "direccion", "departamento"]) {
    const exists = await Role.findOne({ name: role });
    if (!exists) await Role.create({ name: role });
  }
};

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Conectado a MongoDB");
    await initializeDatabase();

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Servidor escuchando en puerto ${port}`);
      startAttachmentCleanupSchedule();
    });
  })
  .catch((error) => {
    console.error("Error al conectar a MongoDB:", error);
    process.exitCode = 1;
  });
