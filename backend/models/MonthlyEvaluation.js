const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  criterion: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 500, default: "" },
    bonusRate: { type: Number, required: true, min: 0, max: 100 },
    weightedPoints: { type: Number, required: true, min: 0, max: 100 },
    achievementBand: { type: String, required: true },
}, { _id: false });

const monthlyEvaluationSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  month: { type: String, required: true },
  answers: { type: [answerSchema], required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  scoringVersion: { type: Number, default: 2 },
}, { timestamps: true });

monthlyEvaluationSchema.index({ manager: 1, month: 1 }, { unique: true });
module.exports = mongoose.model("MonthlyEvaluation", monthlyEvaluationSchema);
