const express = require("express");
const router = express.Router();
const SystemSettings = require("../models/SystemSettings");
const Organization = require("../models/Organization");
const authMiddleware = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");
const { isPlatformAdminEmail, requirePlatformAdmin } = require("../utils/platformAdmin");
const { hasPermission } = require("../utils/permissions");
const { createSmtpTransporter } = require("../utils/mailDelivery");
const { decryptSecret, encryptSecret } = require("../utils/secretCrypto");
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

const serializeMailSettings = (organization) => {
  const settings = organization?.mailSettings || {};

  return {
    enabled: Boolean(settings.enabled),
    provider: settings.provider || "smtp",
    fromName: settings.fromName || "",
    fromEmail: settings.fromEmail || "",
    smtpHost: settings.smtpHost || "",
    smtpPort: settings.smtpPort || 587,
    smtpSecure: Boolean(settings.smtpSecure),
    smtpUser: settings.smtpUser || "",
    hasPassword: Boolean(settings.smtpPassEncrypted),
    lastTestedAt: settings.lastTestedAt || null,
    lastError: settings.lastError || "",
  };
};

const getUserOrganization = async (req) => {
  const organization = await Organization.findById(req.user.organization || null);

  if (!organization) {
    const error = new Error("Empresa no encontrada");
    error.status = 404;
    throw error;
  }

  return organization;
};

const buildMailPayload = (body, currentSettings = {}) => {
  const enabled = Boolean(body.enabled);
  const smtpPort = Number(body.smtpPort || 587);
  const payload = {
    "mailSettings.enabled": enabled,
    "mailSettings.provider": "smtp",
    "mailSettings.fromName": body.fromName?.toString().trim() || "",
    "mailSettings.fromEmail": body.fromEmail?.toString().trim().toLowerCase() || "",
    "mailSettings.smtpHost": body.smtpHost?.toString().trim() || "",
    "mailSettings.smtpPort": Number.isFinite(smtpPort) && smtpPort > 0 ? smtpPort : 587,
    "mailSettings.smtpSecure": Boolean(body.smtpSecure),
    "mailSettings.smtpUser": body.smtpUser?.toString().trim() || "",
  };

  if (Object.prototype.hasOwnProperty.call(body, "smtpPassword") && body.smtpPassword) {
    payload["mailSettings.smtpPassEncrypted"] = encryptSecret(body.smtpPassword);
  } else if (!currentSettings.smtpPassEncrypted) {
    payload["mailSettings.smtpPassEncrypted"] = "";
  }

  return payload;
};

const assertCompleteMailSettings = (settings) => {
  if (!settings.enabled) return;

  const requiredFields = [
    ["fromEmail", settings.fromEmail],
    ["smtpHost", settings.smtpHost],
    ["smtpUser", settings.smtpUser],
    ["smtpPassEncrypted", settings.smtpPassEncrypted],
  ];
  const missing = requiredFields.filter(([, value]) => !value).map(([field]) => field);

  if (missing.length > 0) {
    const error = new Error(`Configuracion SMTP incompleta: ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }
};

const toPlainMailSettings = (settings = {}, payload = {}) => ({
  enabled: Object.prototype.hasOwnProperty.call(payload, "mailSettings.enabled")
    ? payload["mailSettings.enabled"]
    : Boolean(settings.enabled),
  fromEmail: payload["mailSettings.fromEmail"] ?? settings.fromEmail,
  smtpHost: payload["mailSettings.smtpHost"] ?? settings.smtpHost,
  smtpUser: payload["mailSettings.smtpUser"] ?? settings.smtpUser,
  smtpPassEncrypted: payload["mailSettings.smtpPassEncrypted"] ?? settings.smtpPassEncrypted,
});

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
    const payload = pickFields(req.body, appearanceFields);

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

router.get("/mail", authMiddleware, requirePermission("SETTINGS_MANAGE"), async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const organization = await getUserOrganization(req);

    res.json(serializeMailSettings(organization));
  } catch (error) {
    res.status(error.status || 500).json({ msg: error.message || "Error al obtener correo de empresa" });
  }
});

router.put("/mail", authMiddleware, requirePermission("SETTINGS_MANAGE"), async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const organization = await getUserOrganization(req);
    const payload = buildMailPayload(req.body, organization.mailSettings || {});

    assertCompleteMailSettings(toPlainMailSettings(organization.mailSettings, payload));

    const updated = await Organization.findByIdAndUpdate(
      organization._id,
      {
        $set: {
          ...payload,
          "mailSettings.lastError": "",
        },
      },
      { new: true, runValidators: true }
    );

    res.json(serializeMailSettings(updated));
  } catch (error) {
    res.status(error.status || 500).json({
      msg: error.message || "Error al guardar correo de empresa",
    });
  }
});

router.post("/mail/test", authMiddleware, requirePermission("SETTINGS_MANAGE"), async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const organization = await getUserOrganization(req);
    const settings = organization.mailSettings || {};

    if (!settings.enabled) {
      return res.status(400).json({
        msg: "Activa el SMTP personalizado antes de enviar la prueba",
      });
    }

    assertCompleteMailSettings(settings);

    const transporter = createSmtpTransporter({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      user: settings.smtpUser,
      pass: decryptSecret(settings.smtpPassEncrypted),
    });
    const testEmail = req.body?.email || req.user.email;

    await transporter.sendMail({
      from: `"${(settings.fromName || organization.name || "Gestor de reportes").replace(/"/g, "'")}" <${settings.fromEmail}>`,
      to: testEmail,
      subject: "Prueba de correo - Gestor de reportes",
      text: "La configuracion de correo de la empresa funciona correctamente.",
    });

    const updated = await Organization.findByIdAndUpdate(
      organization._id,
      {
        $set: {
          "mailSettings.lastTestedAt": new Date(),
          "mailSettings.lastError": "",
        },
      },
      { new: true }
    );

    res.json({
      msg: "Correo de prueba enviado",
      settings: serializeMailSettings(updated),
    });
  } catch (error) {
    if (req.user?.organization) {
      await Organization.findByIdAndUpdate(req.user.organization, {
        $set: { "mailSettings.lastError": error.message || "Error al probar correo" },
      }).catch(() => {});
    }

    res.status(error.status || 500).json({
      msg: "No se pudo enviar el correo de prueba",
      error: error.message,
    });
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
