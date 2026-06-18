const express = require("express");
const router = express.Router();
const SystemSettings = require("../models/SystemSettings");
const Organization = require("../models/Organization");
const authMiddleware = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");
const { isPlatformAdminEmail, requirePlatformAdmin } = require("../utils/platformAdmin");
const { hasPermission } = require("../utils/permissions");
const { normalizeSlaHours, normalizeWarningPercent } = require("../utils/sla");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Solo se permiten archivos de imagen"));
    }

    cb(null, true);
  },
});

const appearanceFields = [
  "textColor",
  "titleColor",
  "backgroundColor",
  "cardColor",
  "inputColor",
  "accentColor",
  "sidebarImageUrl",
];

const buildSlaPayload = (body = {}) => {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body, "slaHours")) {
    payload.slaHours = normalizeSlaHours(body.slaHours);
  }

  if (Object.prototype.hasOwnProperty.call(body, "slaWarningPercent")) {
    payload.slaWarningPercent = normalizeWarningPercent(body.slaWarningPercent);
  }

  return payload;
};

const identityFields = [
  "systemName",
  "systemTitle",
  "systemDescription",
  "developer",
  "contactEmail",
  "version",
  "usageInfo",
  "rolesInfo",
  "departmentsInfo",
];

const loginFields = [
  "loginTitle",
  "loginSubtitle",
  "loginOrganizationPlaceholder",
  "loginUserPlaceholder",
  "loginPasswordPlaceholder",
  "loginButtonText",
  "loginLoadingText",
  "loginForgotPasswordText",
  "loginBackgroundColor",
  "loginCardColor",
  "loginTextColor",
  "loginTitleColor",
  "loginInputColor",
  "loginAccentColor",
];

const identityResponseFields = [...identityFields, ...loginFields, "loginImageUrl", "createdAt", "updatedAt"];

const pickFields = (body, fields) => {
  const payload = {};

  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = typeof body[field] === "string"
        ? body[field].trim()
        : body[field];
    }
  });

  return payload;
};

const getDefaultOrganizationId = async () => {
  const organization = await Organization.findOne({ slug: "default" }).select("_id");
  return organization?._id || null;
};

const getGlobalIdentity = async (defaultOrganizationId) => {
  if (!defaultOrganizationId) return {};

  const defaultSettings = await SystemSettings.findOne({
    key: "global",
    organization: defaultOrganizationId,
  }).lean();

  return defaultSettings
    ? pickFields(defaultSettings, [...identityFields, ...loginFields, "loginImageUrl"])
    : {};
};

const getSettings = async (organization = null) => {
  const organizationId = organization || await getDefaultOrganizationId();
  let settings = await SystemSettings.findOne({ key: "global", organization: organizationId });

  if (!settings) {
    settings = await SystemSettings.create({
      key: "global",
      organization: organizationId,
    });
  }

  return settings;
};

const removeIdentityFields = (settings) => {
  const base = typeof settings.toObject === "function" ? settings.toObject() : { ...(settings || {}) };

  [...identityFields, ...loginFields, "loginImageUrl"].forEach((field) => {
    delete base[field];
  });

  return base;
};

router.get("/", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener configuracion del sistema" });
  }
});

router.get("/current", authMiddleware, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const organization = req.user.organization || null;
    const settings = await getSettings(organization);
    const defaultOrganizationId = await getDefaultOrganizationId();
    const isDefaultOrganization = defaultOrganizationId && String(organization || "") === String(defaultOrganizationId);

    res.json(isDefaultOrganization ? settings : removeIdentityFields(settings));
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener configuracion de la empresa" });
  }
});

router.get("/identity", authMiddleware, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const defaultOrganizationId = await getDefaultOrganizationId();
    const settings = await getSettings(defaultOrganizationId);
    const base = typeof settings.toObject === "function" ? settings.toObject() : settings;
    res.json(pickFields(base, identityResponseFields));
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener identidad global del sistema" });
  }
});

router.put("/", authMiddleware, requirePermission("SETTINGS_MANAGE"), async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const organization = req.user.organization || null;
    const payload = {
      ...pickFields(req.body, appearanceFields),
      ...buildSlaPayload(req.body),
    };

    const settings = await SystemSettings.findOneAndUpdate(
      { key: "global", organization },
      { $set: payload, $setOnInsert: { key: "global", organization } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(settings);
  } catch (error) {
    res.status(500).json({ msg: "Error al guardar configuracion de la empresa" });
  }
});

router.put("/identity", authMiddleware, requirePlatformAdmin, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const organization = await getDefaultOrganizationId();
    const payload = pickFields(req.body, [...identityFields, ...loginFields]);

    if (!payload.systemName) {
      return res.status(400).json({ msg: "El nombre del sistema es obligatorio" });
    }

    if (!payload.version) {
      return res.status(400).json({ msg: "La version es obligatoria" });
    }

    const settings = await SystemSettings.findOneAndUpdate(
      { key: "global", organization },
      { $set: payload, $setOnInsert: { key: "global", organization } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(settings);
  } catch (error) {
    res.status(500).json({ msg: "Error al guardar identidad del sistema" });
  }
});

router.post(
  "/image/:field",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const allowedFields = ["loginImageUrl", "sidebarImageUrl"];

    if (!allowedFields.includes(req.params.field)) {
      return res.status(400).json({ msg: "Campo de imagen no valido" });
    }

    if (!req.file) {
      return res.status(400).json({ msg: "Debes seleccionar una imagen" });
    }

    const imageData = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const organization = req.user.organization || null;

    if (req.params.field === "loginImageUrl") {
      if (!isPlatformAdminEmail(req.user?.email)) {
        return res.status(403).json({ msg: "Solo el super admin puede cambiar la imagen de login" });
      }

      const defaultOrganization = await getDefaultOrganizationId();

      const settings = await SystemSettings.findOneAndUpdate(
        { key: "global", organization: defaultOrganization },
        {
          $set: { loginImageUrl: imageData },
          $setOnInsert: { key: "global", organization: defaultOrganization },
        },
        { new: true, upsert: true, runValidators: true }
      );

      return res.json(settings);
    }

    if (!hasPermission(req.user, "SETTINGS_MANAGE")) {
      return res.status(403).json({ msg: "No autorizado" });
    }

    const settings = await SystemSettings.findOneAndUpdate(
      { key: "global", organization },
      {
        $set: { [req.params.field]: imageData },
        $setOnInsert: { key: "global", organization },
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(settings);
  } catch (error) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ msg: "La imagen no puede pesar mas de 2 MB" });
    }

    res.status(500).json({ msg: error.message || "Error al subir imagen" });
  }
});

module.exports = router;
