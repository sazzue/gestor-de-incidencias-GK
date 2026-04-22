const authorize = (...roles) => {
  return (req, res, next) => {
    // 🚨 validar usuario
    if (!req.user) {
      return res.status(401).json({ msg: "No autenticado" });
    }

      console.log("USER ROLE:", req.user.role);
    console.log("ROLES PERMITIDOS:", roles);


    // 🚨 validar rol
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ msg: "No autorizado" });
    }

    next();
  };
};

module.exports = authorize;