const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const InventoryItem = require("../models/InventoryItem");
const Supplier = require("../models/Supplier");
const auth = require("../middleware/authMiddleware");
const { ACCESS_SCOPES } = require("../config/permissions");
const { hasPermission } = require("../utils/permissions");

const normalizeDepartment = (department) =>
  department?.toString().trim().toLowerCase();

const getAssignedBranchIds = (user) => {
  const branches = Array.isArray(user.branches) ? user.branches : [];
  const ids = branches.length > 0 ? branches : user.branch ? [user.branch] : [];
  return ids.map((branch) => branch?.toString()).filter(Boolean);
};

const canUseBranch = (user, branchId) => {
  const scope = user.accessScopes?.inventory || ACCESS_SCOPES.DEPARTMENT;
  if (scope === ACCESS_SCOPES.ALL) return true;
  return getAssignedBranchIds(user).includes(branchId?.toString());
};

const canUseDepartment = (user, department) => {
  const scope = user.accessScopes?.inventory || ACCESS_SCOPES.DEPARTMENT;
  if (scope === ACCESS_SCOPES.ALL) return true;
  if (scope !== ACCESS_SCOPES.DEPARTMENT) return true;
  return normalizeDepartment(user.department) === normalizeDepartment(department);
};

const getSupplierQueryForUser = (user) => {
  const organization = user.organization || null;
  const scope = user.accessScopes?.inventory || ACCESS_SCOPES.DEPARTMENT;

  if (scope === ACCESS_SCOPES.ALL) return { organization };

  if (scope === ACCESS_SCOPES.BRANCH) {
    const branchIds = getAssignedBranchIds(user);
    if (branchIds.length === 0) return null;
    return { organization, branch: { $in: branchIds } };
  }

  const department = normalizeDepartment(user.department);
  if (!department) return null;
  return { organization, department };
};

const canAccessSupplier = (user, supplier) => {
  const scope = user.accessScopes?.inventory || ACCESS_SCOPES.DEPARTMENT;
  if (scope === ACCESS_SCOPES.ALL) return true;

  if (scope === ACCESS_SCOPES.BRANCH) {
    const branchId = supplier.branch?._id || supplier.branch;
    return getAssignedBranchIds(user).includes(branchId?.toString());
  }

  return normalizeDepartment(user.department) === normalizeDepartment(supplier.department);
};

const requireAnySupplierPermission = (req, res, next) => {
  if (
    hasPermission(req.user, "SUPPLIERS_VIEW") ||
    hasPermission(req.user, "SUPPLIERS_CREATE") ||
    hasPermission(req.user, "SUPPLIERS_UPDATE") ||
    hasPermission(req.user, "SUPPLIERS_DELETE") ||
    hasPermission(req.user, "CREATE_INVENTORY") ||
    hasPermission(req.user, "INVENTORY_UPDATE")
  ) {
    return next();
  }

  return res.status(403).json({ msg: "No tienes permisos para ver proveedores" });
};

router.get("/", auth, requireAnySupplierPermission, async (req, res) => {
  try {
    const query = getSupplierQueryForUser(req.user);
    if (!query) {
      return res.status(403).json({ msg: "No tienes alcance para ver proveedores" });
    }

    const suppliers = await Supplier.find(query)
      .populate("branch", "name")
      .populate("createdBy", "nombre email")
      .sort({ name: 1 });

    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener proveedores", error: error.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    if (!hasPermission(req.user, "SUPPLIERS_CREATE")) {
      return res.status(403).json({ msg: "No tienes permisos para crear proveedores" });
    }

    const name = req.body.name?.trim();
    const address = req.body.address?.trim() || "";
    const phone = req.body.phone?.trim() || "";
    const branch = req.body.branch;
    const department = normalizeDepartment(req.body.department);

    if (!name || !branch || !department) {
      return res.status(400).json({
        msg: "Datos incompletos",
        error: "Nombre, sucursal y departamento son obligatorios",
      });
    }

    if (!canUseBranch(req.user, branch)) {
      return res.status(403).json({ msg: "No puedes crear proveedores para esta sucursal" });
    }

    if (!canUseDepartment(req.user, department)) {
      return res.status(403).json({ msg: "No puedes crear proveedores para otro departamento" });
    }

    const supplier = await Supplier.create({
      organization: req.user.organization || null,
      name,
      address,
      phone,
      branch,
      department,
      createdBy: req.user.id,
    });

    const populated = await Supplier.findById(supplier._id)
      .populate("branch", "name")
      .populate("createdBy", "nombre email");

    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ msg: "El proveedor ya existe para esa sucursal y departamento" });
    }

    res.status(500).json({ msg: "Error al crear proveedor", error: error.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    if (!hasPermission(req.user, "SUPPLIERS_UPDATE")) {
      return res.status(403).json({ msg: "No tienes permisos para modificar proveedores" });
    }

    const supplier = await Supplier.findOne({
      _id: req.params.id,
      organization: req.user.organization || null,
    });

    if (!supplier) {
      return res.status(404).json({ msg: "Proveedor no encontrado" });
    }

    if (!canAccessSupplier(req.user, supplier)) {
      return res.status(403).json({ msg: "No autorizado para modificar este proveedor" });
    }

    const name = req.body.name?.trim();
    const address = req.body.address?.trim() || "";
    const phone = req.body.phone?.trim() || "";
    const branch = req.body.branch;
    const department = normalizeDepartment(req.body.department);

    if (!name || !branch || !department) {
      return res.status(400).json({
        msg: "Datos incompletos",
        error: "Nombre, sucursal y departamento son obligatorios",
      });
    }

    if (!canUseBranch(req.user, branch)) {
      return res.status(403).json({ msg: "No puedes mover proveedores a esta sucursal" });
    }

    if (!canUseDepartment(req.user, department)) {
      return res.status(403).json({ msg: "No puedes mover proveedores a otro departamento" });
    }

    supplier.name = name;
    supplier.address = address;
    supplier.phone = phone;
    supplier.branch = branch;
    supplier.department = department;
    await supplier.save();

    await InventoryItem.updateMany(
      { organization: req.user.organization || null, supplier: supplier._id },
      { provider: supplier.name }
    );

    const updated = await Supplier.findById(supplier._id)
      .populate("branch", "name")
      .populate("createdBy", "nombre email");

    res.json(updated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ msg: "El proveedor ya existe para esa sucursal y departamento" });
    }

    res.status(500).json({ msg: "Error al modificar proveedor", error: error.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    if (!hasPermission(req.user, "SUPPLIERS_DELETE")) {
      return res.status(403).json({ msg: "No tienes permisos para borrar proveedores" });
    }

    const supplier = await Supplier.findOne({
      _id: req.params.id,
      organization: req.user.organization || null,
    });

    if (!supplier) {
      return res.status(404).json({ msg: "Proveedor no encontrado" });
    }

    if (!canAccessSupplier(req.user, supplier)) {
      return res.status(403).json({ msg: "No autorizado para borrar este proveedor" });
    }

    const inUse = mongoose.isValidObjectId(req.params.id)
      ? await InventoryItem.countDocuments({
          organization: req.user.organization || null,
          supplier: req.params.id,
        })
      : 0;

    if (inUse > 0) {
      return res.status(400).json({
        msg: "No se puede borrar el proveedor porque ya esta en uso",
        error: "Conserva el proveedor para mantener el historial de inventario.",
      });
    }

    await supplier.deleteOne();
    res.json({ msg: "Proveedor eliminado" });
  } catch (error) {
    res.status(500).json({ msg: "Error al borrar proveedor", error: error.message });
  }
});

module.exports = router;
