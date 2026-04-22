const express = require("express");
const router = express.Router();
const Branch = require("../models/branch");

router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    const branch = await Branch.create({ name });

    res.status(201).json(branch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al crear sucursal" });
  }
});

router.get("/", async (req, res) => {
  try {
    const branches = await Branch.find();
    res.json(branches);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener sucursales" });
  }
});

module.exports = router;