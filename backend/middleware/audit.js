const AuditLog = require("../models/AuditLog");
const { getAuditAction, getAuditModule, sanitizeAuditValue } = require("../utils/audit");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXCLUDED_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
]);

const auditMiddleware = (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method) || EXCLUDED_PATHS.has(req.path)) {
    return next();
  }

  let responseBody;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    if (!req.user || res.statusCode < 200 || res.statusCode >= 400) return;

    const pathSegments = req.originalUrl.split("?")[0].split("/").filter(Boolean);
    const resourceId =
      req.params?.id ||
      responseBody?._id ||
      responseBody?.id ||
      responseBody?.organization?._id ||
      pathSegments[2] ||
      "";

    const log = {
      organization: req.user.organization || responseBody?.organization || null,
      actor: {
        id: req.user.id || null,
        name: req.user.nombre || "",
        email: req.user.email || "",
        role: req.user.role || "",
      },
      action: getAuditAction(req.method),
      module: getAuditModule(req.originalUrl),
      resourceId: resourceId?.toString() || "",
      method: req.method,
      path: req.originalUrl.split("?")[0],
      statusCode: res.statusCode,
      ip: req.ip || "",
      userAgent: req.get("user-agent") || "",
      changes: sanitizeAuditValue(req.body || {}),
    };

    AuditLog.create(log).catch((error) => {
      console.error("audit log error:", error.message);
    });
  });

  return next();
};

module.exports = auditMiddleware;
