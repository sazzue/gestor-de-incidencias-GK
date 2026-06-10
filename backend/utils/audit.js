const SENSITIVE_KEYS = new Set([
  "authorization",
  "password",
  "newpassword",
  "confirmpassword",
  "token",
  "resetpasswordtoken",
  "smtppass",
  "smtppassencrypted",
  "ownerpassword",
  "secret",
  "apikey",
  "accesskey",
  "accesskeyid",
]);

const sanitizeAuditValue = (value, depth = 0) => {
  if (depth > 4) return "[omitted]";
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeAuditValue(item, depth + 1));
  }

  if (typeof value !== "object") {
    return typeof value === "string" && value.length > 500
      ? `${value.slice(0, 500)}...`
      : value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => [key, sanitizeAuditValue(item, depth + 1)])
  );
};

const getAuditAction = (method) => {
  if (method === "POST") return "create";
  if (method === "DELETE") return "delete";
  return "update";
};

const getAuditModule = (path = "") => {
  const segments = path.split("?")[0].split("/").filter(Boolean);
  return segments[1] || "system";
};

module.exports = { getAuditAction, getAuditModule, sanitizeAuditValue };
