const mongoose = require("mongoose");
const { calculateDueAt } = require("../utils/sla");

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

const commentSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const incidentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    title: String,
    description: String,
    folio: {
      type: String,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["incident", "internal_task"],
      default: "incident",
      index: true,
    },
    priority: {
      type: String,
      enum: ["baja", "media", "alta", "critica"],
      default: "media",
    },
    dueAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      default: "pendiente",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionComment: {
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
    attachmentsPurgedAt: {
      type: Date,
      default: null,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    department: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    attachments: [attachmentSchema],
    comments: [commentSchema],
    activityLog: [activitySchema],
  },
  { timestamps: true }
);

incidentSchema.pre("validate", function setTicketDefaults(next) {
  if (!this.folio) {
    const date = new Date();
    const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const prefix = this.type === "internal_task" ? "TIN" : "INC";
    this.folio = `${prefix}-${stamp}-${suffix}`;
  }

  if (!this.dueAt) {
    this.dueAt = calculateDueAt({
      createdAt: this.createdAt || new Date(),
      priority: this.priority,
    });
  }

  next();
});

module.exports = mongoose.model("Incident", incidentSchema);
