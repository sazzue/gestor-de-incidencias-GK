const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const ROLES = require("../config/roles");
const {
  createOrganization,
  getOrganizations,
  updateOrganization,
} = require("../controllers/organizationController");

const platformAdminOnly = (req, res, next) => {
  const allowedEmails = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmails.length > 0 && !allowedEmails.includes(req.user.email?.toLowerCase())) {
    return res.status(403).json({ msg: "Solo un administrador de plataforma puede gestionar empresas" });
  }

  next();
};

router.get("/", authMiddleware, authorize(ROLES.ADMIN), platformAdminOnly, getOrganizations);
router.post("/", authMiddleware, authorize(ROLES.ADMIN), platformAdminOnly, createOrganization);
router.put("/:id", authMiddleware, authorize(ROLES.ADMIN), platformAdminOnly, updateOrganization);

module.exports = router;
