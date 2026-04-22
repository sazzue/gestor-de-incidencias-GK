console.log("SECRET EN MIDDLEWARE:", process.env.JWT_SECRET);
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ msg: "No hay token" });
  }

  const token = header.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ msg: "Token inválido" });
  }
};

module.exports = authMiddleware;