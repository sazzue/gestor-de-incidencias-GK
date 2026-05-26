const express = require("express");
const router = express.Router();
const SystemSettings = require("../models/SystemSettings");
const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const ROLES = require("../config/roles");
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

const editableFields = [
  "systemName",
  "systemTitle",
  "systemDescription",
  "developer",
  "contactEmail",
  "version",
  "usageInfo",
  "rolesInfo",
  "departmentsInfo",
  "textColor",
  "titleColor",
  "backgroundColor",
  "cardColor",
  "inputColor",
  "accentColor",
  "loginImageUrl",
  "sidebarImageUrl",
];

const getSettings = async () => {
  let settings = await SystemSettings.findOne({ key: "global" });

  if (!settings) {
    settings = await SystemSettings.create({ key: "global" });
  }

  return settings;
};

router.get("/", async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener configuración del sistema" });
  }
});

router.put("/", authMiddleware, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const payload = {};

    editableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        payload[field] = typeof req.body[field] === "string"
          ? req.body[field].trim()
          : req.body[field];
      }
    });

    if (!payload.systemName) {
      return res.status(400).json({ msg: "El nombre del sistema es obligatorio" });
    }

    if (!payload.version) {
      return res.status(400).json({ msg: "La versión es obligatoria" });
    }

    const settings = await SystemSettings.findOneAndUpdate(
      { key: "global" },
      { $set: payload, $setOnInsert: { key: "global" } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(settings);
  } catch (error) {
    res.status(500).json({ msg: "Error al guardar configuración del sistema" });
  }
});

router.post("/image/:field", authMiddleware, authorize(ROLES.ADMIN), upload.single("image"), async (req, res) => {
  try {
    const allowedFields = ["loginImageUrl", "sidebarImageUrl"];

    if (!allowedFields.includes(req.params.field)) {
      return res.status(400).json({ msg: "Campo de imagen no válido" });
    }

    if (!req.file) {
      return res.status(400).json({ msg: "Debes seleccionar una imagen" });
    }

    const imageData = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const settings = await SystemSettings.findOneAndUpdate(
      { key: "global" },
      {
        $set: { [req.params.field]: imageData },
        $setOnInsert: { key: "global" }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(settings);
  } catch (error) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ msg: "La imagen no puede pesar más de 2 MB" });
    }

    res.status(500).json({ msg: error.message || "Error al subir imagen" });
  }
});

module.exports = router;
