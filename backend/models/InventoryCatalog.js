const mongoose = require("mongoose");

const inventoryCatalogSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    type: {
      type: String,
      enum: ["article", "brand", "responsible"],
      required: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedValue: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

inventoryCatalogSchema.index(
  { organization: 1, type: 1, normalizedValue: 1 },
  { unique: true }
);

module.exports = mongoose.model("InventoryCatalog", inventoryCatalogSchema);
