const router      = require("express").Router();
const controllers = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// ── Públicas ──────────────────────────────────────────
router.post("/register",        controllers.register);
router.post("/login",           controllers.login);
router.post("/forgot-password", controllers.forgotPassword);
router.post("/reset-password",  controllers.resetPassword);

// ── Protegida (requiere JWT válido) ───────────────────
router.post("/change-password", authMiddleware, controllers.changePassword);

module.exports = router;
