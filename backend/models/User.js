const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nombre: String,
  email: String,
  password: String,

  role: {
    type: String,
    enum: ["admin", "direccion", "gerencia", "departamento"],
    default: "departamento"
  },

  // 🔥 CAMBIO IMPORTANTE (TEMPORAL PERO FUNCIONAL)
  department: {
    type: String,
    default: null
  },

  permissions: [String]
});

module.exports = mongoose.model('User', userSchema);