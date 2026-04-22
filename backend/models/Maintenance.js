// models/Maintenance.js
const mongoose = require("mongoose");

const maintenanceSchema = new mongoose.Schema({
  title: String,
  description: String,
  observations: String,

  branch: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Branch"
},

  status: {
    type: String,
    enum: ["programado", "finalizado"],
    default: "programado",
  },

  confirmedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
},

  date: String,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

}, { timestamps: true });

module.exports = mongoose.model("Maintenance", maintenanceSchema);