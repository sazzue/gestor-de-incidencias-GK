const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");
const { requirePlatformAdmin } = require("../utils/platformAdmin");
const {
  createOrganization,
  getOrganizations,
  updateOrganization,
} = require("../controllers/organizationController");

router.get("/", authMiddleware, requirePermission("ORGANIZATIONS_MANAGE"), requirePlatformAdmin, getOrganizations);
router.post("/", authMiddleware, requirePermission("ORGANIZATIONS_MANAGE"), requirePlatformAdmin, createOrganization);
router.put("/:id", authMiddleware, requirePermission("ORGANIZATIONS_MANAGE"), requirePlatformAdmin, updateOrganization);

module.exports = router;
