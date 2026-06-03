const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["trial", "active", "suspended"],
      default: "active",
    },
    plan: {
      type: String,
      enum: ["basic", "pro", "enterprise"],
      default: "basic",
    },
    ownerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    addOns: {
      extraUsers: {
        type: Number,
        default: 0,
        min: 0,
      },
      extraBranches: {
        type: Number,
        default: 0,
        min: 0,
      },
      extraStorageGb: {
        type: Number,
        default: 0,
        min: 0,
      },
      implementation: {
        type: Boolean,
        default: false,
      },
      training: {
        type: Boolean,
        default: false,
      },
    },
    mailSettings: {
      enabled: {
        type: Boolean,
        default: false,
      },
      provider: {
        type: String,
        enum: ["smtp"],
        default: "smtp",
      },
      fromName: {
        type: String,
        default: "",
        trim: true,
      },
      fromEmail: {
        type: String,
        default: "",
        lowercase: true,
        trim: true,
      },
      smtpHost: {
        type: String,
        default: "",
        trim: true,
      },
      smtpPort: {
        type: Number,
        default: 587,
      },
      smtpSecure: {
        type: Boolean,
        default: false,
      },
      smtpUser: {
        type: String,
        default: "",
        trim: true,
      },
      smtpPassEncrypted: {
        type: String,
        default: "",
      },
      lastTestedAt: {
        type: Date,
        default: null,
      },
      lastError: {
        type: String,
        default: "",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", organizationSchema);
