const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const Maintenance = require("../models/Maintenance");
const { hasPermission } = require("../utils/permissions");

const getAssignedBranchIds = (user) => {
  const branches = Array.isArray(user.branches) ? user.branches : [];
  const ids = branches.length > 0 ? branches : user.branch ? [user.branch] : [];
  return ids.map((branch) => branch?.toString()).filter(Boolean);
};

router.get("/", auth, async (req, res) => {
  const data = await Maintenance.find()
    .populate("confirmedBy", "nombre email")
    .populate("branch", "name")
    .sort({ date: 1 });

  res.json(data);
});

router.post("/", auth, async (req, res) => {
  try {
    if (!hasPermission(req.user, "CREATE_MAINTENANCE")) {
      return res.status(403).json({ msg: "No tienes permisos para crear mantenimientos" });
    }

    const { title, description, branch, date } = req.body;
    if (!title || !description || !branch || !date) {
      return res.status(400).json({
        msg: "Datos incompletos",
        error: "title, description, branch y date son obligatorios"
      });
    }

    const newMaintenance = await Maintenance.create({
      ...req.body,
      createdBy: req.user.id,
    });

    res.json(newMaintenance);
  } catch (error) {
    res.status(500).json({ msg: "Error creando mantenimiento", error: error.message });
  }
});

router.put("/:id/confirm", auth, async (req, res) => {
  try {
    if (!hasPermission(req.user, "CONFIRM_MAINTENANCE")) {
      return res.status(403).json({ msg: "No tienes permisos para confirmar mantenimientos" });
    }

    const maintenance = await Maintenance.findById(req.params.id);

    if (!maintenance) {
      return res.status(404).json({ msg: "No encontrado" });
    }

    if (req.user.role !== "admin") {
      const assignedBranchIds = getAssignedBranchIds(req.user);
      const maintenanceBranch = maintenance.branch?.toString();

      if (!assignedBranchIds.includes(maintenanceBranch)) {
        return res.status(403).json({
          msg: "No puedes confirmar mantenimientos de sucursales no asignadas"
        });
      }
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
