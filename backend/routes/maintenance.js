const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const Maintenance = require("../models/Maintenance");
const { hasPermission } = require("../utils/permissions");
const { notifyNewRecord } = require("../utils/notifications");

const MAINTENANCE_DEPARTMENTS = ["sistemas", "mantenimiento"];

const normalizeDepartment = (department) =>
  department?.toString().trim().toLowerCase();

const isMaintenanceDepartment = (department) =>
  MAINTENANCE_DEPARTMENTS.includes(normalizeDepartment(department));

const getAssignedBranchIds = (user) => {
  const branches = Array.isArray(user.branches) ? user.branches : [];
  const ids = branches.length > 0 ? branches : user.branch ? [user.branch] : [];
  return ids.map((branch) => branch?.toString()).filter(Boolean);
};

const getMaintenanceQueryForUser = (user) => {
  const organization = user.organization || null;

  if (
    user.role === "admin" ||
    user.role === "direccion" ||
    hasPermission(user, "VIEW_MAINTENANCE_ALL")
  ) {
    return { organization };
  }

  if (user.role === "gerencia" || hasPermission(user, "VIEW_MAINTENANCE_BRANCH")) {
    const assignedBranchIds = getAssignedBranchIds(user);
    if (assignedBranchIds.length === 0) {
      return null;
    }

    return { organization, branch: { $in: assignedBranchIds } };
  }

  const department = normalizeDepartment(user.department);
  if (
    hasPermission(user, "VIEW_MAINTENANCE_DEPARTMENT") &&
    isMaintenanceDepartment(department)
  ) {
    return { organization, department };
  }

  return null;
};

const canAccessMaintenance = (user, maintenance) => {
  if (
    user.role === "admin" ||
    user.role === "direccion" ||
    hasPermission(user, "VIEW_MAINTENANCE_ALL")
  ) return true;

  if (user.role === "gerencia" || hasPermission(user, "VIEW_MAINTENANCE_BRANCH")) {
    const maintenanceBranch = maintenance.branch?._id || maintenance.branch;
    return getAssignedBranchIds(user).includes(maintenanceBranch?.toString());
  }

  if (hasPermission(user, "VIEW_MAINTENANCE_DEPARTMENT")) {
    const userDepartment = normalizeDepartment(user.department);
    const maintenanceDepartment = normalizeDepartment(maintenance.department);

    return (
      isMaintenanceDepartment(userDepartment) &&
      maintenanceDepartment === userDepartment
    );
  }

  return false;
};

router.get("/", auth, async (req, res) => {
  try {
    const query = getMaintenanceQueryForUser(req.user);

    if (!query) {
      return res.status(403).json({ msg: "No tienes permisos para ver mantenimientos" });
    }

    const data = await Maintenance.find(query)
      .populate("confirmedBy", "nombre email")
      .populate("branch", "name")
      .sort({ date: 1 });

    res.json(data);
  } catch (error) {
    res.status(500).json({ msg: "Error cargando mantenimientos", error: error.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    if (!hasPermission(req.user, "CREATE_MAINTENANCE")) {
      return res.status(403).json({ msg: "No tienes permisos para crear mantenimientos" });
    }

    const { title, description, branch, date } = req.body;
    const department = normalizeDepartment(req.body.department);

    if (!title || !description || !branch || !date || !department) {
      return res.status(400).json({
        msg: "Datos incompletos",
        error: "title, description, branch, department y date son obligatorios"
      });
    }

    if (!isMaintenanceDepartment(department)) {
      return res.status(400).json({
        msg: "Departamento no valido",
        error: "Solo se pueden programar mantenimientos para sistemas o mantenimiento"
      });
    }

    if (
      req.user.role === "departamento" &&
      normalizeDepartment(req.user.department) !== department
    ) {
      return res.status(403).json({
        msg: "No puedes crear mantenimientos para otro departamento"
      });
    }

    if (req.user.role === "gerencia") {
      const assignedBranchIds = getAssignedBranchIds(req.user);
      if (!assignedBranchIds.includes(branch?.toString())) {
        return res.status(403).json({
          msg: "No puedes crear mantenimientos de sucursales no asignadas"
        });
      }
    }

    const newMaintenance = await Maintenance.create({
      ...req.body,
      organization: req.user.organization || null,
      department,
      createdBy: req.user.id,
    });

    const populated = await Maintenance.findById(newMaintenance._id)
      .populate("createdBy", "nombre email")
      .populate("confirmedBy", "nombre email")
      .populate("branch", "name");

    await notifyNewRecord({
      type: "maintenance",
      record: populated || newMaintenance,
      organization: req.user.organization || null,
      createdByUser: req.user,
    });

    res.json(populated);
  } catch (error) {
    res.status(500).json({ msg: "Error creando mantenimiento", error: error.message });
  }
});

router.put("/:id/confirm", auth, async (req, res) => {
  try {
    if (!hasPermission(req.user, "CONFIRM_MAINTENANCE")) {
      return res.status(403).json({ msg: "No tienes permisos para confirmar mantenimientos" });
    }

    const maintenance = await Maintenance.findOne({
      _id: req.params.id,
      organization: req.user.organization || null,
    });

    if (!maintenance) {
      return res.status(404).json({ msg: "No encontrado" });
    }

    if (!canAccessMaintenance(req.user, maintenance)) {
      return res.status(403).json({
        msg: "No puedes confirmar este mantenimiento"
      });
    }

    maintenance.status = "finalizado";
    maintenance.confirmed = true;
    maintenance.confirmedBy = req.user.id;
    await maintenance.save();

    const updated = await Maintenance.findById(maintenance._id)
      .populate("confirmedBy", "nombre email")
      .populate("branch", "name");

    res.json(updated);
  } catch (error) {
    res.status(500).json({ msg: "Error servidor", error: error.message });
  }
});

module.exports = router;
