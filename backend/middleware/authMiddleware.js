const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Organization = require("../models/Organization");
const { getAccessScopesForUser, getPermissionsForUser } = require("../utils/permissions");
const { isPlatformAdminEmail } = require("../utils/platformAdmin");

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "No hay token, acceso denegado" });
  }

  const token = header.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ msg: "Usuario no encontrado" });
    }

    if (user.organization) {
      const organization = await Organization.findById(user.organization);

      if (!organization) {
        return res.status(401).json({ msg: "Empresa no encontrada" });
      }

      if (organization.status === "suspended") {
        return res.status(403).json({ msg: "La empresa esta suspendida" });
      }
    }

    req.user = {
      ...decoded,
      id: user._id,
      nombre: user.nombre,
      username: user.username || null,
      email: user.email,
      role: user.role,
      isPlatformAdmin: isPlatformAdminEmail(user.email),
      organization: user.organization || null,
      department: user.department || null,
      branch: user.branch || null,
      branches: Array.isArray(user.branches) ? user.branches : [],
      accessScopes: getAccessScopesForUser(user),
      permissions: await getPermissionsForUser(user),
      mustChangePassword: user.mustChangePassword,
    };

    next();
  } catch (error) {
    return res.status(401).json({ msg: "Token invalido o expirado" });
  }
};

module.exports = authMiddleware;
