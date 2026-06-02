const Branch = require("../models/branch");
const Incident = require("../models/incident");
const InventoryItem = require("../models/InventoryItem");
const Organization = require("../models/Organization");
const User = require("../models/User");
const { getPlatformAdminEmails } = require("./platformAdmin");

const GB = 1024 * 1024 * 1024;

const PLAN_LIMITS = {
  basic: {
    users: 5,
    branches: 1,
    incidents: 100,
    files: 100,
    storageBytes: 1 * GB,
  },
  pro: {
    users: 25,
    branches: 10,
    incidents: 1000,
    files: 1000,
    storageBytes: 5 * GB,
  },
  enterprise: {
    users: null,
    branches: null,
    incidents: null,
    files: null,
    storageBytes: null,
  },
};

const LIMIT_LABELS = {
  users: "usuarios",
  branches: "sucursales",
  incidents: "incidencias",
  files: "archivos",
  storageBytes: "almacenamiento",
};

const getOrganizationFilter = (organization) => ({ organization: organization || null });

const sumIncidentAttachments = async (organization) => {
  const [result] = await Incident.aggregate([
    { $match: getOrganizationFilter(organization) },
    { $unwind: "$attachments" },
    {
      $group: {
        _id: null,
        files: { $sum: 1 },
        storageBytes: { $sum: { $ifNull: ["$attachments.size", 0] } },
      },
    },
  ]);

  return {
    files: result?.files || 0,
    storageBytes: result?.storageBytes || 0,
  };
};

const sumInventoryInvoices = async (organization) => {
  const [result] = await InventoryItem.aggregate([
    {
      $match: {
        ...getOrganizationFilter(organization),
        "invoice.key": { $exists: true, $ne: "" },
      },
    },
    {
      $group: {
        _id: null,
        files: { $sum: 1 },
        storageBytes: { $sum: { $ifNull: ["$invoice.size", 0] } },
      },
    },
  ]);

  return {
    files: result?.files || 0,
    storageBytes: result?.storageBytes || 0,
  };
};

const getOrganizationUsage = async (organization) => {
  const platformAdminEmails = getPlatformAdminEmails();
  const userQuery = {
    ...getOrganizationFilter(organization),
    ...(platformAdminEmails.length ? { email: { $nin: platformAdminEmails } } : {}),
  };

  const [
    users,
    branches,
    incidents,
    inventoryItems,
    incidentFiles,
    inventoryInvoices,
  ] = await Promise.all([
    User.countDocuments(userQuery),
    Branch.countDocuments(getOrganizationFilter(organization)),
    Incident.countDocuments(getOrganizationFilter(organization)),
    InventoryItem.countDocuments(getOrganizationFilter(organization)),
    sumIncidentAttachments(organization),
    sumInventoryInvoices(organization),
  ]);

  return {
    users,
    branches,
    incidents,
    inventoryItems,
    files: incidentFiles.files + inventoryInvoices.files,
    storageBytes: incidentFiles.storageBytes + inventoryInvoices.storageBytes,
  };
};

const getPlanLimits = (plan = "basic") => PLAN_LIMITS[plan] || PLAN_LIMITS.basic;

const getOrganizationPlanSummary = async (organization) => {
  const limits = getPlanLimits(organization.plan);
  const usage = await getOrganizationUsage(organization._id);

  return {
    limits,
    usage,
  };
};

const assertWithinPlanLimit = async ({ organization, metric, increment = 1 }) => {
  if (!organization) return;

  const organizationDoc = await Organization.findById(organization).select("plan");
  if (!organizationDoc) return;

  const limits = getPlanLimits(organizationDoc.plan);
  const limit = limits[metric];
  if (limit === null || limit === undefined) return;

  const usage = await getOrganizationUsage(organization);
  const nextValue = (usage[metric] || 0) + increment;

  if (nextValue > limit) {
    const label = LIMIT_LABELS[metric] || metric;
    const error = new Error(`El plan actual permite maximo ${limit} ${label}. Uso actual: ${usage[metric] || 0}.`);
    error.status = 403;
    error.code = "PLAN_LIMIT_EXCEEDED";
    throw error;
  }
};

const assertStorageWithinPlanLimit = async ({ organization, incrementBytes = 0 }) => {
  if (!organization || incrementBytes <= 0) return;

  const organizationDoc = await Organization.findById(organization).select("plan");
  if (!organizationDoc) return;

  const limits = getPlanLimits(organizationDoc.plan);
  const limit = limits.storageBytes;
  if (limit === null || limit === undefined) return;

  const usage = await getOrganizationUsage(organization);
  const nextValue = (usage.storageBytes || 0) + incrementBytes;

  if (nextValue > limit) {
    const error = new Error(`El plan actual no tiene almacenamiento disponible suficiente.`);
    error.status = 403;
    error.code = "PLAN_LIMIT_EXCEEDED";
    throw error;
  }
};

module.exports = {
  PLAN_LIMITS,
  assertStorageWithinPlanLimit,
  assertWithinPlanLimit,
  getOrganizationPlanSummary,
  getOrganizationUsage,
  getPlanLimits,
};
