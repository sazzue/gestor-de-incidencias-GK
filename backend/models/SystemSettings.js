const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null,
  },
  key: {
    type: String,
    default: "global",
  },
  systemName: {
    type: String,
    default: "Gestor de reportes",
  },
  systemTitle: {
    type: String,
    default: "Sistema de Gestión de Incidencias",
  },
  systemDescription: {
    type: String,
    default: "Este sistema permite registrar, gestionar y dar seguimiento a incidencias dentro de la organización.",
  },
  developer: {
    type: String,
    default: "Ing. Saúl Rubalcava",
  },
  contactEmail: {
    type: String,
    default: "sistemas@grupokampai.mx",
  },
  version: {
    type: String,
    default: "1.0.0",
  },
  usageInfo: {
    type: String,
    default: "Crear incidencias desde el dashboard\nAsignar departamento\nActualizar estatus\nVisualizar reportes",
  },
  rolesInfo: {
    type: String,
    default: "Admin: Control total\nDirección: Supervisión\nGerencia: Seguimiento y cierre\nDepartamento: Gestión de incidencias",
  },
  departmentsInfo: {
    type: String,
    default: "Sistemas\nMantenimiento\nCostos\nMarketing",
  },
  textColor: {
    type: String,
    default: "#e2e8f0",
  },
  titleColor: {
    type: String,
    default: "#ffffff",
  },
  backgroundColor: {
    type: String,
    default: "#0b1220",
  },
  cardColor: {
    type: String,
    default: "#111827",
  },
  inputColor: {
    type: String,
    default: "#020617",
  },
  accentColor: {
    type: String,
    default: "#3b82f6",
  },
  loginImageUrl: {
    type: String,
    default: "",
  },
  loginTitle: {
    type: String,
    default: "Iniciar sesion",
  },
  loginSubtitle: {
    type: String,
    default: "Accede a {systemName}",
  },
  loginOrganizationPlaceholder: {
    type: String,
    default: "Empresa",
  },
  loginUserPlaceholder: {
    type: String,
    default: "Correo o usuario",
  },
  loginPasswordPlaceholder: {
    type: String,
    default: "Contrasena",
  },
  loginButtonText: {
    type: String,
    default: "Entrar",
  },
  loginLoadingText: {
    type: String,
    default: "Ingresando...",
  },
  loginForgotPasswordText: {
    type: String,
    default: "Olvidaste tu contrasena?",
  },
  loginBackgroundColor: {
    type: String,
    default: "#0b1220",
  },
  loginCardColor: {
    type: String,
    default: "#111827",
  },
  loginTextColor: {
    type: String,
    default: "#e2e8f0",
  },
  loginTitleColor: {
    type: String,
    default: "#ffffff",
  },
  loginInputColor: {
    type: String,
    default: "#020617",
  },
  loginAccentColor: {
    type: String,
    default: "#3b82f6",
  },
  sidebarImageUrl: {
    type: String,
    default: "",
  },
  slaHours: {
    baja: { type: Number, default: 168, min: 1, max: 8760 },
    media: { type: Number, default: 72, min: 1, max: 8760 },
    alta: { type: Number, default: 24, min: 1, max: 8760 },
    critica: { type: Number, default: 4, min: 1, max: 8760 },
  },
  slaWarningPercent: {
    type: Number,
    default: 25,
    min: 5,
    max: 90,
  },
}, { timestamps: true });

systemSettingsSchema.index({ organization: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
