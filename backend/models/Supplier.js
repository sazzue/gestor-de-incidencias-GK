const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    branches: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    }],
    scope: {
      type: String,
      enum: ["all", "branch", "department"],
      default: "department",
      trim: true,
    },
    department: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

supplierSchema.index(
  { organization: 1, scope: 1, department: 1, branch: 1, name: 1 },
  { unique: true }
);

module.exports = mongoose.model("Supplier", supplierSchema);
