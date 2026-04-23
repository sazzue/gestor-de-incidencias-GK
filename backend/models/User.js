const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nombre: String,

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: ["admin", "direccion", "gerencia", "departamento"],
    default: "departamento"
  },

  department: {
    type: String,
    default: null
  },

  permissions: [String],

  // 🔐 Forzar cambio de contraseña en primer inicio de sesión
  mustChangePassword: {
    type: Boolean,
    default: true
  },

  // 🔑 Recuperación de contraseña por correo
  resetPasswordToken: {
    type: String,
    default: null
  },

  resetPasswordExpires: {
    type: Date,
    default: null
  }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
