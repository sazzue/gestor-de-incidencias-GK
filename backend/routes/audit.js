const express = require("express");
const AuditLog = require("../models/AuditLog");
const authMiddleware = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");

const router = express.Router();
const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/", authMiddleware, requirePermission("AUDIT_VIEW"), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
    const query = { organization: req.user.organization || null };

    if (req.query.module) query.module = req.query.module;
    if (req.query.action) query.action = req.query.action;
    if (req.query.actor) {
      const actor = escapeRegex(req.query.actor.toString().trim().slice(0, 100));
      query.$or = [
        { "actor.name": { $regex: actor, $options: "i" } },
        { "actor.email": { $regex: actor, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("audit query error:", error);
    res.status(500).json({ msg: "No se pudo consultar la bitacora" });
  }
});

module.exports = router;
