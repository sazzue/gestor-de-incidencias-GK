const router = require('express').Router();
const controllers = require('../controllers/auth');

// =======================
// AUTH ROUTES
// =======================
router.post('/register', controllers.register);
router.post('/login', controllers.login);

// 🔥 TEST ROUTE (opcional)
router.get('/register', (req, res) => {
  res.send('Ruta register OK');
});

// 👇 SIEMPRE AL FINAL
module.exports = router;