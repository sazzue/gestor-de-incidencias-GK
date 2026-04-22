const express = require('express');
const cors = require('cors');

const app = express();

// ========================
// 🔐 MIDDLEWARES GLOBALES
// ========================

// CORS (ajustable para producción)
app.use(cors({
  origin: "*", // luego lo puedes cambiar a tu frontend de Vercel
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// Leer JSON
app.use(express.json());

// Si vas a recibir formularios (opcional pero útil)
app.use(express.urlencoded({ extended: true }));

// ========================
// 🧪 RUTA DE PRUEBA
// ========================
app.get("/", (req, res) => {
  res.json({
    message: "API de incidencias funcionando 🚀"
  });
});

module.exports = app;