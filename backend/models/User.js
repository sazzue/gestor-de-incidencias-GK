const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null
  },

  nombre: String,

  username: {
    type: String,
    sparse: true,
    lowercase: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
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

  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    default: null
  },

  branches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch"
  }],

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

userSchema.index({ organization: 1, email: 1 }, { unique: true });
userSchema.index(
  { organization: 1, username: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model('User', userSchema);
