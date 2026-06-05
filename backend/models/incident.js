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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    attachments: [attachmentSchema],
  },
  { timestamps: true }
);

incidentSchema.pre("validate", function setTicketDefaults(next) {
  if (!this.folio) {
    const date = new Date();
    const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    this.folio = `INC-${stamp}-${suffix}`;
  }

  if (!this.dueAt) {
    const slaDaysByPriority = {
      baja: 7,
      media: 3,
      alta: 1,
      critica: 0,
    };
    const days = slaDaysByPriority[this.priority] ?? slaDaysByPriority.media;
    const due = new Date();

    if (days === 0) {
      due.setHours(23, 59, 59, 999);
    } else {
      due.setDate(due.getDate() + days);
      due.setHours(18, 0, 0, 0);
    }

    this.dueAt = due;
  }

  next();
});

module.exports = mongoose.model("Incident", incidentSchema);
