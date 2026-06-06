const express = require("express");
const multer = require("multer");
const router = express.Router();

const {
  addAttachments,
  addComment,
  assignIncident,
  getIncidents,
  getAssignableUsers,
  getIncidentById,
  getAttachmentDownloadUrl,
  createIncident,
  updateStatus,
} = require("../controllers/incidentsController");

const authMiddleware = require("../middleware/authMiddleware");

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error("Solo se permiten PDF, imagenes y archivos Excel/CSV"));
    }

    cb(null, true);
  },
});

const handleUploadErrors = (err, req, res, next) => {
  if (!err) return next();

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ msg: "Cada archivo debe pesar maximo 5 MB" });
  }

  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({ msg: "Puedes subir maximo 5 archivos" });
  }

  return res.status(400).json({ msg: err.message || "Archivo invalido" });
};

router.get("/", authMiddleware, getIncidents);
router.get("/assignees", authMiddleware, getAssignableUsers);
router.get("/:id", authMiddleware, getIncidentById);

router.post(
  "/",
  authMiddleware,
  upload.array("attachments", 5),
  handleUploadErrors,
  createIncident
);

router.post(
  "/:id/attachments",
  authMiddleware,
  upload.array("attachments", 5),
  handleUploadErrors,
  addAttachments
);

router.get(
  "/:id/attachments/:attachmentId/download",
  authMiddleware,
  getAttachmentDownloadUrl
);

router.put("/:id/status", authMiddleware, updateStatus);
router.put("/:id/assign", authMiddleware, assignIncident);
router.post("/:id/comments", authMiddleware, addComment);

module.exports = router;
