const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "No autorizado" });
    }
    next();
  };
};

module.exports = roleMiddleware;