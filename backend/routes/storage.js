const express = require("express");
const router = express.Router();

const Incident = require("../models/incident");
const InventoryItem = require("../models/InventoryItem");
const auth = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");
const { getR2ObjectStream, isR2Configured } = require("../utils/r2Storage");
const { streamZip } = require("../utils/zipStream");

const DEFAULT_R2_STORAGE_LIMIT_GB = 9;

const getStorageLimitBytes = () => {
  const limitGb = Number(process.env.R2_STORAGE_LIMIT_GB || DEFAULT_R2_STORAGE_LIMIT_GB);
  const safeLimitGb = Number.isFinite(limitGb) && limitGb > 0 ? limitGb : DEFAULT_R2_STORAGE_LIMIT_GB;
  return safeLimitGb * 1024 * 1024 * 1024;
};

const formatDate = (date) => (date ? new Date(date).toISOString() : "");

const sanitizeZipPath = (value) =>
  String(value || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._/-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\/+/, "")
    .slice(0, 180);

const csvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const buildManifest = (documents) => {
  const headers = [
    "tipo",
    "id_registro",
    "titulo",
    "sucursal",
    "departamento",
    "archivo",
    "ruta_zip",
    "tamano_bytes",
    "fecha_registro",
    "r2_key",
  ];

  const rows = documents.map((doc) => [
    doc.type,
    doc.recordId,
    doc.title,
    doc.branch,
    doc.department,
    doc.originalName,
    doc.zipPath,
    doc.size,
    formatDate(doc.createdAt),
    doc.key,
  ]);

  return [headers, ...rows]
    .map((row) => row.map(csvValue).join(","))
    .join("\n");
};

const getIncidentDocuments = async (organization = null) => {
  const incidents = await Incident.find({ organization, "attachments.0": { $exists: true } })
    .populate("branch", "name")
    .lean();

  return incidents.flatMap((incident) =>
    (incident.attachments || [])
      .filter((attachment) => attachment.key)
      .map((attachment) => ({
        type: "incidencia",
        recordId: incident._id,
        title: incident.title,
        branch: incident.branch?.name || "",
        department: incident.department || "",
        originalName: attachment.originalName || "archivo",
        key: attachment.key,
        size: attachment.size || 0,
        createdAt: incident.createdAt,
        zipPath: sanitizeZipPath(`incidencias/${incident._id}/${attachment.originalName || "archivo"}`),
      }))
  );
};

const getInventoryDocuments = async (organization = null) => {
  const items = await InventoryItem.find({ organization, "invoice.key": { $exists: true, $ne: "" } })
    .populate("branch", "name")
    .lean();

  return items.map((item) => ({
    type: "inventario",
    recordId: item._id,
    title: `${item.brand || ""} ${item.model || ""}`.trim(),
    branch: item.branch?.name || "",
    department: item.department || "",
    originalName: item.invoice?.originalName || "factura",
    key: item.invoice?.key,
    size: item.invoice?.size || 0,
    createdAt: item.createdAt,
    zipPath: sanitizeZipPath(`inventario/${item._id}/${item.invoice?.originalName || "factura"}`),
  }));
};

const getDocuments = async (organization = null) => {
  const [incidentDocs, inventoryDocs] = await Promise.all([
    getIncidentDocuments(organization),
    getInventoryDocuments(organization),
  ]);

  return [...incidentDocs, ...inventoryDocs].filter((doc) => doc.key);
};

const getUsageSummary = async (organization = null) => {
  const documents = await getDocuments(organization);
  const usageBytes = documents.reduce((total, doc) => total + (doc.size || 0), 0);
  const limitBytes = getStorageLimitBytes();

  return {
    configured: isR2Configured(),
    usageBytes,
    limitBytes,
    usagePercent: limitBytes > 0 ? (usageBytes / limitBytes) * 100 : 0,
    isAtLimit: usageBytes >= limitBytes,
    documentsCount: documents.length,
    incidentFilesCount: documents.filter((doc) => doc.type === "incidencia").length,
    inventoryInvoicesCount: documents.filter((doc) => doc.type === "inventario").length,
  };
};

router.get("/usage", auth, requirePermission("SETTINGS_MANAGE"), async (req, res) => {
  try {
    res.json(await getUsageSummary(req.user.organization || null));
  } catch (error) {
    res.status(500).json({ msg: "Error al calcular uso de almacenamiento", error: error.message });
  }
});

router.get("/backup.zip", auth, requirePermission("SETTINGS_MANAGE"), async (req, res) => {
  try {
    if (!isR2Configured()) {
      return res.status(503).json({ msg: "Cloudflare R2 no esta configurado" });
    }

    const organization = req.user.organization || null;
    const summary = await getUsageSummary(organization);

    if (!summary.isAtLimit) {
      return res.status(400).json({
        msg: "El respaldo manual esta disponible cuando el uso llegue al limite configurado de R2",
        usageBytes: summary.usageBytes,
        limitBytes: summary.limitBytes,
      });
    }

    const documents = await getDocuments(organization);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="respaldo-r2-${timestamp}.zip"`);
    res.setHeader("Cache-Control", "no-store");

    const entries = [
      {
        name: "manifest.csv",
        buffer: Buffer.from(buildManifest(documents), "utf8"),
      },
    ];

    for (const doc of documents) {
      entries.push({
        name: doc.zipPath,
        streamFactory: () => getR2ObjectStream({ key: doc.key }),
      });
    }

    await streamZip({ res, entries });
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ msg: "Error al generar respaldo", error: error.message });
    }

    res.destroy(error);
  }
});

module.exports = router;
