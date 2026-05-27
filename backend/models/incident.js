const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    key: String,
    originalName: String,
    mimeType: String,
    size: Number,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const incidentSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    status: {
      type: String,
      default: "pendiente",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    attachmentsPurgedAt: {
      type: Date,
      default: null,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    department: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    attachments: [attachmentSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Incident", incidentSchema);
