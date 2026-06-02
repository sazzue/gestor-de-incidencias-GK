const express = require("express");
const multer = require("multer");
const router = express.Router();

const InventoryItem = require("../models/InventoryItem");
const auth = require("../middleware/authMiddleware");
const { hasPermission } = require("../utils/permissions");
const { assertStorageWithinPlanLimit, assertWithinPlanLimit } = require("../utils/planLimits");
const {
  getInventoryInvoiceUrl,
  isR2Configured,
  uploadInventoryInvoice,
} = require("../utils/r2Storage");

const allowedInvoiceTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedInvoiceTypes.has(file.mimetype)) {
      return cb(new Error("Solo se permiten facturas en PDF o imagen"));
    }

    cb(null, true);
  },
});

const handleUploadErrors = (err, req, res, next) => {
  if (!err) return next();

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ msg: "La factura debe pesar maximo 8 MB" });
  }

  return res.status(400).json({ msg: err.message || "Factura invalida" });
};

const getAssignedBranchIds = (user) => {
  const branches = Array.isArray(user.branches) ? user.branches : [];
  const ids = branches.length > 0 ? branches : user.branch ? [user.branch] : [];
  return ids.map((branch) => branch?.toString()).filter(Boolean);
};

const normalizeDepartment = (department) =>
  department?.toString().trim().toLowerCase();

const canViewAllInventory = (user) =>
  user.role === "admin" ||
  user.role === "direccion" ||
  hasPermission(user, "VIEW_INVENTORY_ALL");

const getInventoryQueryForUser = (user) => {
  const organization = user.organization || null;

  if (canViewAllInventory(user)) return { organization };

  if (hasPermission(user, "VIEW_INVENTORY_DEPARTMENT")) {
    const department = normalizeDepartment(user.department);
    if (!department) return null;
    return { organization, department };
  }

  if (
    user.role === "gerencia" ||
    hasPermission(user, "VIEW_INVENTORY_BRANCH") ||
    hasPermission(user, "CREATE_INVENTORY") ||
    hasPermission(user, "DISPOSE_INVENTORY")
  ) {
    const branchIds = getAssignedBranchIds(user);
    if (branchIds.length === 0) return null;
    return { organization, branch: { $in: branchIds } };
  }

  return null;
};

const canUseBranch = (user, branchId) => {
  if (canViewAllInventory(user)) return true;
  if (hasPermission(user, "VIEW_INVENTORY_DEPARTMENT")) return true;
  return getAssignedBranchIds(user).includes(branchId?.toString());
};

const canUseDepartment = (user, department) => {
  if (canViewAllInventory(user)) return true;
  if (!hasPermission(user, "VIEW_INVENTORY_DEPARTMENT")) return false;
  return normalizeDepartment(user.department) === normalizeDepartment(department);
};

const canAccessItem = (user, item) => {
  if (canViewAllInventory(user)) return true;
  if (
    hasPermission(user, "VIEW_INVENTORY_DEPARTMENT") &&
    canUseDepartment(user, item.department)
  ) {
    return true;
  }

  if (
    !(
      user.role === "gerencia" ||
      hasPermission(user, "VIEW_INVENTORY_BRANCH") ||
      hasPermission(user, "CREATE_INVENTORY") ||
      hasPermission(user, "DISPOSE_INVENTORY")
    )
  ) {
    return false;
  }

  const branchId = item.branch?._id || item.branch;
  return canUseBranch(user, branchId);
};

router.get("/", auth, async (req, res) => {
  try {
    const query = getInventoryQueryForUser(req.user);

    if (!query) {
      return res.status(403).json({ msg: "No tienes permisos para ver inventario" });
    }

    const items = await InventoryItem.find(query)
      .populate("branch", "name")
      .populate("createdBy", "nombre email")
      .populate("disposedBy", "nombre email")
      .sort({ createdAt: -1 });

    res.json(items);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener inventario", error: error.message });
  }
});

router.post("/", auth, upload.single("invoice"), handleUploadErrors, async (req, res) => {
  try {
    if (!hasPermission(req.user, "CREATE_INVENTORY")) {
      return res.status(403).json({ msg: "No tienes permisos para registrar equipos" });
    }

    const { model, brand, serialNumber, provider, responsible, price, branch } = req.body;
    const department = normalizeDepartment(req.body.department);
    const numericPrice = Number(price);

    if (!model || !brand || !serialNumber || !provider || !responsible || !branch || !department || !Number.isFinite(numericPrice)) {
      return res.status(400).json({
        msg: "Datos incompletos",
        error: "Modelo, marca, numero de serie, proveedor, responsable, precio, sucursal y departamento son obligatorios",
      });
    }

    if (!canUseBranch(req.user, branch)) {
      return res.status(403).json({ msg: "No puedes registrar equipos para esta sucursal" });
    }

    if (
      req.user.role === "departamento" &&
      hasPermission(req.user, "VIEW_INVENTORY_DEPARTMENT") &&
      !canUseDepartment(req.user, department)
    ) {
      return res.status(403).json({ msg: "No puedes registrar equipos para otro departamento" });
    }

    if (req.file && !isR2Configured()) {
      return res.status(503).json({ msg: "Cloudflare R2 no esta configurado para cargar facturas" });
    }

    if (req.file) {
      await assertWithinPlanLimit({
        organization: req.user.organization,
        metric: "files",
        increment: 1,
      });
      await assertStorageWithinPlanLimit({
        organization: req.user.organization,
        incrementBytes: req.file.size || 0,
      });
    }

    const item = await InventoryItem.create({
      organization: req.user.organization || null,
      model,
      brand,
      serialNumber: serialNumber.trim(),
      provider,
      responsible,
      price: numericPrice,
      branch,
      department,
      createdBy: req.user.id,
    });

    if (req.file) {
      item.invoice = await uploadInventoryInvoice({
        inventoryId: item._id,
        file: req.file,
        uploadedBy: req.user.id,
      });
      await item.save();
    }

    const populated = await InventoryItem.findById(item._id)
      .populate("branch", "name")
      .populate("createdBy", "nombre email")
      .populate("disposedBy", "nombre email");

    res.status(201).json(populated);
  } catch (error) {
    if (error.code === "PLAN_LIMIT_EXCEEDED") {
      return res.status(error.status || 403).json({ msg: error.message });
    }

    if (error.code === 11000) {
      return res.status(400).json({ msg: "El numero de serie ya existe" });
    }

    res.status(500).json({ msg: "Error al registrar equipo", error: error.message });
  }
});

router.put("/:id/invoice", auth, upload.single("invoice"), handleUploadErrors, async (req, res) => {
  try {
    if (!hasPermission(req.user, "CREATE_INVENTORY")) {
      return res.status(403).json({ msg: "No tienes permisos para cargar facturas" });
    }

    if (!req.file) {
      return res.status(400).json({ msg: "La factura es obligatoria" });
    }

    if (!isR2Configured()) {
      return res.status(503).json({ msg: "Cloudflare R2 no esta configurado para cargar facturas" });
    }

    const item = await InventoryItem.findOne({
      _id: req.params.id,
      organization: req.user.organization || null,
    });

    if (!item) {
      return res.status(404).json({ msg: "Equipo no encontrado" });
    }

    if (!canAccessItem(req.user, item)) {
      return res.status(403).json({ msg: "No autorizado para cargar factura en este equipo" });
    }

    await assertWithinPlanLimit({
      organization: req.user.organization,
      metric: "files",
      increment: item.invoice?.key ? 0 : 1,
    });
    await assertStorageWithinPlanLimit({
      organization: req.user.organization,
      incrementBytes: Math.max(0, (req.file.size || 0) - (item.invoice?.size || 0)),
    });

    item.invoice = await uploadInventoryInvoice({
      inventoryId: item._id,
      file: req.file,
      uploadedBy: req.user.id,
    });
    await item.save();

    const updated = await InventoryItem.findById(item._id)
      .populate("branch", "name")
      .populate("createdBy", "nombre email")
      .populate("disposedBy", "nombre email");

    res.json(updated);
  } catch (error) {
    if (error.code === "PLAN_LIMIT_EXCEEDED") {
      return res.status(error.status || 403).json({ msg: error.message });
    }

    res.status(500).json({ msg: "Error al cargar factura", error: error.message });
  }
});

router.put("/:id/dispose", auth, async (req, res) => {
  try {
    if (!hasPermission(req.user, "DISPOSE_INVENTORY")) {
      return res.status(403).json({ msg: "No tienes permisos para dar de baja equipos" });
    }

    const reason = req.body.reason?.trim();

    if (!reason) {
      return res.status(400).json({ msg: "El motivo de baja es obligatorio" });
    }

    const item = await InventoryItem.findOne({
      _id: req.params.id,
      organization: req.user.organization || null,
    });

    if (!item) {
      return res.status(404).json({ msg: "Equipo no encontrado" });
    }

    if (!canAccessItem(req.user, item)) {
      return res.status(403).json({ msg: "No puedes dar de baja equipos de esta sucursal" });
    }

    if (item.status === "baja") {
      return res.status(400).json({ msg: "El equipo ya esta dado de baja" });
    }

    item.status = "baja";
    item.disposalReason = reason;
    item.disposedAt = new Date();
    item.disposedBy = req.user.id;
    await item.save();

    const updated = await InventoryItem.findById(item._id)
      .populate("branch", "name")
      .populate("createdBy", "nombre email")
      .populate("disposedBy", "nombre email");

    res.json(updated);
  } catch (error) {
    res.status(500).json({ msg: "Error al dar de baja equipo", error: error.message });
  }
});

router.get("/:id/invoice", auth, async (req, res) => {
  try {
    const item = await InventoryItem.findOne({
      _id: req.params.id,
      organization: req.user.organization || null,
    });

    if (!item) {
      return res.status(404).json({ msg: "Equipo no encontrado" });
    }

    if (!canAccessItem(req.user, item)) {
      return res.status(403).json({ msg: "No autorizado para ver esta factura" });
    }

    if (!item.invoice?.key) {
      return res.status(404).json({ msg: "Este equipo no tiene factura cargada" });
    }

    const url = await getInventoryInvoiceUrl({ key: item.invoice.key });

    res.json({
      url,
      expiresIn: 300,
      fileName: item.invoice.originalName,
    });
  } catch (error) {
    res.status(500).json({ msg: "Error al generar enlace de factura", error: error.message });
  }
});

module.exports = router;
