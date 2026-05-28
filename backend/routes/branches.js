const express = require("express");
const router = express.Router();
const Branch = require("../models/branch");
const User = require("../models/User");
const Incident = require("../models/incident");
const Maintenance = require("../models/Maintenance");
const InventoryItem = require("../models/InventoryItem");
const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const ROLES = require("../config/roles");

router.post("/", authMiddleware, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const name = req.body.name?.toLowerCase().trim();

    if (!name) {
      return res.status(400).json({ msg: "El nombre de la sucursal es obligatorio" });
    }

    const existingBranch = await Branch.findOne({ name });
    if (existingBranch) {
      return res.status(400).json({ msg: "La sucursal ya existe" });
    }

    const branch = await Branch.create({ name });

    res.status(201).json(branch);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ msg: "La sucursal ya existe" });
    }

    console.error(error);
    res.status(500).json({ msg: "Error al crear sucursal" });
  }
});

router.get("/", async (req, res) => {
  try {
    const branches = await Branch.find().sort({ name: 1 });
    res.json(branches);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener sucursales" });
  }
});

router.delete("/:id", authMiddleware, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({ msg: "Sucursal no encontrada" });
    }

    const [users, incidents, maintenances, inventoryItems] = await Promise.all([
      User.countDocuments({
        $or: [
          { branch: branch._id },
          { branches: branch._id }
        ]
      }),
      Incident.countDocuments({ branch: branch._id }),
      Maintenance.countDocuments({ branch: branch._id }),
      InventoryItem.countDocuments({ branch: branch._id }),
    ]);

    if (users || incidents || maintenances || inventoryItems) {
      return res.status(400).json({
        msg: "No se puede eliminar la sucursal porque ya está en uso",
        error: "Quita la sucursal de los usuarios asignados o conserva la sucursal para mantener el historial de incidencias y mantenimientos."
      });
    }

    await branch.deleteOne();
    res.json({ msg: "Sucursal eliminada" });
  } catch (error) {
    res.status(500).json({ msg: "Error al eliminar sucursal" });
  }
});

module.exports = router;
