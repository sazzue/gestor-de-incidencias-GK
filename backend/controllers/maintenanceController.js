// controllers/maintenanceController.js
const Maintenance = require("../models/Maintenance");

// ➕ CREAR
exports.createMaintenance = async (req, res) => {
  try {
    const data = await Maintenance.create({
      ...req.body,
      createdBy: req.user.id,
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ msg: "Error creando mantenimiento" });
  }
};

// 📄 GET
exports.getMaintenances = async (req, res) => {
  const data = await Maintenance.find().sort({ date: 1 });
  res.json(data);
};

// ✏ UPDATE
exports.updateMaintenance = async (req, res) => {
  const updated = await Maintenance.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json(updated);
};

// ✅ CONFIRMAR
exports.confirmMaintenance = async (req, res) => {
  const updated = await Maintenance.findByIdAndUpdate(
    req.params.id,
    { confirmed: true, status: "finalizado" },
    { new: true }
  );

  res.json(updated);
};

// 🗑 DELETE
exports.deleteMaintenance = async (req, res) => {
  await Maintenance.findByIdAndDelete(req.params.id);
  res.json({ msg: "Eliminado" });
};