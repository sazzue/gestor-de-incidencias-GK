// models/Department.js
const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  permissions: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model("Department", DepartmentSchema);
