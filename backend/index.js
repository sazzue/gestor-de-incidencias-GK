require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const cors = require('cors');
const express = require('express');
const roleRoutes = require("./routes/roleRoutes");
const Role = require("./models/Role");
const departmentRoutes = require("./routes/departments");


app.use(cors());
app.use(express.json());

app.use("/api/roles", roleRoutes);
app.use("/api/users", require("./routes/users"));
app.use("/api/branches", require("./routes/branches"));
app.use("/api/incidents", require("./routes/incidents"));
app.use("/api/maintenance", require("./routes/maintenance"));
app.use("/api/departments", require("./routes/departments"));

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
  console.log('URI:', process.env.MONGODB_URI);
  console.log('CONECTADO');

   // 🔥 SEED DE ROLES AQUÍ
  const roles = ["admin", "gerencia", "direccion", "departamento"];

  for (let role of roles) {
    const exists = await Role.findOne({ name: role });

    if (!exists) {
      await Role.create({ name: role });
      console.log("✅ Rol creado:", role);
    }
  }

  // 🔥 SEED DE DEPARTAMENTOS AQUÍ
  const departamentos = ["sistemas", "marketing", "mantenimiento", "costos"];

  for (let depto of departamentos) {
    const exists = await mongoose.connection.db.collection('departments').findOne({ name: depto });

    if (!exists) {
      await mongoose.connection.db.collection('departments').insertOne({ name: depto });
      console.log("✅ Departamento creado:", depto);
    }
  }


 // 🚀 levantar servidor
app.listen(process.env.PORT, () => {
  console.log(`Servidor escuchando en el puerto ${process.env.PORT}`);
});
})
.catch((error) => {
  console.error('Error al conectar a MongoDB:', error);
});