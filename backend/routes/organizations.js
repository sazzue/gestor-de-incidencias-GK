const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { requirePlatformAdmin } = require("../utils/platformAdmin");
const {
  createOrganization,
  getOrganizations,
  updateOrganization,
} = require("../controllers/organizationController");

router.get("/", authMiddleware, requirePlatformAdmin, getOrganizations);
router.post("/", authMiddleware, requirePlatformAdmin, createOrganization);
router.put("/:id", authMiddleware, requirePlatformAdmin, updateOrganization);

module.exports = router;
