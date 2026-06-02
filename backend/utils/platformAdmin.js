const getPlatformAdminEmails = () =>
  (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const isPlatformAdminEmail = (email) => {
  if (!email) return false;

  return getPlatformAdminEmails().includes(email.toLowerCase().trim());
};

const requirePlatformAdmin = (req, res, next) => {
  if (!isPlatformAdminEmail(req.user?.email)) {
    return res.status(403).json({
      msg: "Solo el super admin del sistema puede acceder a esta seccion",
    });
  }

  next();
};

module.exports = {
  getPlatformAdminEmails,
  isPlatformAdminEmail,
  requirePlatformAdmin,
};
