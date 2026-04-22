const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware"); // 👈 IMPORTANTE
const Maintenance = require("../models/Maintenance"); // 👈 tu modelo

// 🔹 OBTENER TODOS
router.get("/", auth, async (req, res) => {
  const data = await Maintenance.find()
    .populate("confirmedBy", "nombre email")
    .populate("branch", "name") // 👈 AGREGA ESTO
    .sort({ date: 1 });

  res.json(data);
});

// 🔹 CREAR
router.post("/", auth, async (req, res) => {
  try {
    const newMaintenance = await Maintenance.create({
      ...req.body,
      createdBy: req.user.id,
    });

    res.json(newMaintenance);
  } catch (error) {
    res.status(500).json({ msg: "Error creando mantenimiento" });
  }
});

// 🔥 👇 AQUÍ VA LO QUE ME MANDASTE 👇
router.put("/:id/confirm", auth, async (req, res) => {
  try {
    const maintenance = await Maintenance.findByIdAndUpdate(
      req.params.id,
      {
        status: "finalizado",
        confirmed: true,
        confirmedBy: req.user.id,
      },
      { new: true }
    ).populate("confirmedBy", "nombre email"); // 👈 AQUÍ SÍ VA

    if (!maintenance) {
      return res.status(404).json({ msg: "No encontrado" });
    }

    res.json(maintenance);

  } catch (error) {
    res.status(500).json({ msg: "Error servidor" });
  }
});
module.exports = router;