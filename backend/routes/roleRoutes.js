const express = require("express");
const router = express.Router();
const Role = require("../models/Role");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const roles = await Role.find().select("name -_id");
    res.json(roles);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener roles" });
  }
});

module.exports = router;
