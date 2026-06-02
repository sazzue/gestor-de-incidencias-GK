// routes/departments.js
const express = require("express");
const router = express.Router();
const Department = require("../models/Department");
const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const ROLES = require("../config/roles");
const { normalizePermissions } = require("../utils/permissions");

router.get("/", authMiddleware, async (req, res) => {
  const deps = await Department.find({ organization: req.user.organization || null }).sort({ name: 1 });
  res.json(deps);
});

router.post("/", authMiddleware, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const name = req.body.name?.toLowerCase().trim();
    const organization = req.user.organization || null;

    if (!name) {
      return res.status(400).json({ msg: "El nombre del departamento es obligatorio" });
    }

    const department = await Department.create({
      name,
      organization,
      permissions: normalizePermissions(req.body.permissions)
    });

    res.status(201).json(department);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ msg: "El departamento ya existe" });
    }

    res.status(500).json({ msg: "Error al crear departamento" });
  }
});

router.put("/:id", authMiddleware, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const name = req.body.name?.toLowerCase().trim();
    const organization = req.user.organization || null;

    if (!name) {
      return res.status(400).json({ msg: "El nombre del departamento es obligatorio" });
    }

    const department = await Department.findByIdAndUpdate(
      {
        _id: req.params.id,
        organization,
      },
      {
        name,
        permissions: normalizePermissions(req.body.permissions)
      },
      { new: true, runValidators: true }
    );

    if (!department) {
      return res.status(404).json({ msg: "Departamento no encontrado" });
    }

    res.json(department);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ msg: "El departamento ya existe" });
    }

    res.status(500).json({ msg: "Error al actualizar departamento" });
  }
});

router.delete("/:id", authMiddleware, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const department = await Department.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization || null,
    });

    if (!department) {
      return res.status(404).json({ msg: "Departamento no encontrado" });
    }

    res.json({ msg: "Departamento eliminado" });
  } catch (error) {
    res.status(500).json({ msg: "Error al eliminar departamento" });
  }
});

module.exports = router;
