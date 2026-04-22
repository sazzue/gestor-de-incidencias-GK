const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
}, {
  timestamps: true
});

module.exports = mongoose.model("Branch", branchSchema);