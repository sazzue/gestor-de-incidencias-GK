const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    default: "global",
    unique: true,
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
    default: "rgba(255,255,255,0.05)",
  },
  accentColor: {
    type: String,
    default: "#3b82f6",
  },
  loginImageUrl: {
    type: String,
    default: "",
  },
  sidebarImageUrl: {
    type: String,
    default: "",
  },
}, { timestamps: true });

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
