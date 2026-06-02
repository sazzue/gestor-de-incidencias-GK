const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null,
  },
  name: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
}, {
  timestamps: true
});

branchSchema.index({ organization: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Branch", branchSchema);
