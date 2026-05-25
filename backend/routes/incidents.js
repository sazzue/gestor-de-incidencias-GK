const express = require("express");
const router = express.Router();

const {
  getIncidents,
  createIncident,
  updateStatus,
} = require("../controllers/incidentsController");

const authMiddleware = require("../middleware/authMiddleware");


// 📥 ver incidencias
router.get(
  "/",
  authMiddleware, // 🔥 también aquí
  getIncidents
);

router.post(
  "/",
  authMiddleware,
  createIncident
);

// 🔄 cambiar estatus
router.put(
  "/:id/status",
  authMiddleware,
  updateStatus
);

module.exports = router;
