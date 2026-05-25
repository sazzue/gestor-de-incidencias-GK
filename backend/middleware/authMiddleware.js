const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getPermissionsForUser } = require("../utils/permissions");

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

    req.user = {
      ...decoded,
      id: user._id,
      nombre: user.nombre,
      role: user.role,
      department: user.department || null,
      branch: user.branch || null,
      permissions: await getPermissionsForUser(user),
      mustChangePassword: user.mustChangePassword,
    };

    next();
  } catch (error) {
    return res.status(401).json({ msg: "Token invalido o expirado" });
  }
};

module.exports = authMiddleware;
