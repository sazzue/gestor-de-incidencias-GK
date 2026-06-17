const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
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
  { _id: false }
);

const movementSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["entrada", "salida"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    previousQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    newQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const inventoryItemSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    serialNumber: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },
    provider: {
      type: String,
      default: "",
      trim: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    responsible: {
      type: String,
      default: "",
      trim: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    invoice: invoiceSchema,
    status: {
      type: String,
      enum: ["activo", "baja"],
      default: "activo",
    },
    disposalReason: {
      type: String,
      default: "",
      trim: true,
    },
    disposedAt: {
      type: Date,
      default: null,
    },
    disposedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    movements: [movementSchema],
  },
  { timestamps: true }
);

inventoryItemSchema.index({ organization: 1, serialNumber: 1 }, { unique: true });

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);
