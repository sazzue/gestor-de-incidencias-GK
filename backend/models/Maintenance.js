// models/Maintenance.js
const mongoose = require("mongoose");

const maintenanceSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null,
  },

  title: String,
  description: String,
  observations: String,

  branch: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Branch"
},

  department: {
    type: String,
    trim: true,
    lowercase: true,
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

  approvalComment: {
    text: {
      type: String,
      default: "",
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdAt: {
      type: Date,
      default: null,
    },
  },

  date: String,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

}, { timestamps: true });

module.exports = mongoose.model("Maintenance", maintenanceSchema);
