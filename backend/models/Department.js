// models/Department.js
const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  permissions: {
    type: [String],
    default: []
  }
}, { timestamps: true });

DepartmentSchema.index({ organization: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Department", DepartmentSchema);
