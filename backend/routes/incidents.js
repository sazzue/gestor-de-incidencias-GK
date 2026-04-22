const express = require("express");
const router = express.Router();

const {
  getIncidents,
  createIncident,
  updateStatus,
} = require("../controllers/incidentsController");

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const ROLES = require("../config/roles");


// 📥 ver incidencias
router.get(
  "/",
  authMiddleware, // 🔥 también aquí
  getIncidents
);

router.post(
  "/",
  authMiddleware,
  authorize(ROLES.ADMIN, ROLES.GERENCIA, ROLES.DIRECCION),
  createIncident
);

// 🔄 cambiar estatus
router.put(
  "/:id/status",
  authMiddleware, // 🔥 FALTABA ESTO
  authorize(ROLES.ADMIN, ROLES.DEPARTAMENTO),
  updateStatus
);

module.exports = router;