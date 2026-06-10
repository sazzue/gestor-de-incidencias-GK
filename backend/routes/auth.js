const router = require("express").Router();
const controllers = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const createRateLimiter = require("../middleware/rateLimit");

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Demasiados intentos de inicio de sesion. Intenta de nuevo en 15 minutos.",
});

const passwordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiadas solicitudes. Intenta de nuevo en 15 minutos.",
});

router.post("/login", loginLimiter, controllers.login);
router.post("/forgot-password", passwordLimiter, controllers.forgotPassword);
router.post("/reset-password", passwordLimiter, controllers.resetPassword);
router.get("/me", authMiddleware, controllers.me);
router.post("/change-password", authMiddleware, controllers.changePassword);

module.exports = router;
