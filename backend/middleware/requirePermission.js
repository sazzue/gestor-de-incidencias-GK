const { hasPermission } = require("../utils/permissions");

const requirePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ msg: "No autenticado" });
    }

    const allowed = permissions.some((permission) => hasPermission(req.user, permission));

    if (!allowed) {
      return res.status(403).json({ msg: "No autorizado" });
    }

    next();
  };
};

module.exports = requirePermission;
