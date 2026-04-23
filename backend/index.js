require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const cors = require('cors');

const Role = require("./models/Role");

// Middleware global
app.use(cors());

// 📦 ROUTES
app.use("/api/roles", require("./routes/roleRoutes"));
app.use("/api/users", require("./routes/users"));
app.use("/api/branches", require("./routes/branches"));
app.use("/api/incidents", require("./routes/incidents"));
app.use("/api/maintenance", require("./routes/maintenance"));
app.use("/api/departments", require("./routes/departments"));

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    `
    default-src 'self';
    img-src 'self' data:;
    style-src 'self' 'unsafe-inline' https://www.gstatic.com;
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    connect-src *;
    `
  );
  next();
});

// 🔌 CONEXIÓN A MONGO
mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
  console.log('CONECTADO A MONGODB');

  // 🔥 SEED ROLES
  const roles = ["admin", "gerencia", "direccion", "departamento"];

  for (let role of roles) {
    const exists = await Role.findOne({ name: role });

    if (!exists) {
      await Role.create({ name: role });
      console.log("✅ Rol creado:", role);
    }
  }

  // 🚀 SERVER START
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
  });

})
.catch((error) => {
  console.error('Error al conectar a MongoDB:', error);
});