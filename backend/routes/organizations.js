const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const ROLES = require("../config/roles");
const { requirePlatformAdmin } = require("../utils/platformAdmin");
const {
  createOrganization,
  getOrganizations,
  updateOrganization,
} = require("../controllers/organizationController");

router.get("/", authMiddleware, authorize(ROLES.ADMIN), requirePlatformAdmin, getOrganizations);
router.post("/", authMiddleware, authorize(ROLES.ADMIN), requirePlatformAdmin, createOrganization);
router.put("/:id", authMiddleware, authorize(ROLES.ADMIN), requirePlatformAdmin, updateOrganization);

module.exports = router;
