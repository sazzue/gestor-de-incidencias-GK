const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const MonthlyEvaluation = require("../models/MonthlyEvaluation");
const requirePermission = require("../middleware/requirePermission");

const criteria = ["urgent", "application", "followup", "maintenance", "service", "communication"];
const weights = [50, 20, 15, 5, 5, 5];
// Rating is the displayed option order: full, majority, partial, insufficient, not started.
const bonusRates = [100, 75, 50, 0, 0];
const achievementBands = ["100%", "90–99%", "80–89%", "50–79%", "Menos de 50%"];
const mexicoMonth = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City", year: "numeric", month: "2-digit",
}).format(new Date());
const lockedWindow = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City", day: "2-digit", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const day = Number(parts.find((part) => part.type === "day").value);
  const year = Number(parts.find((part) => part.type === "year").value);
  const month = Number(parts.find((part) => part.type === "month").value);
  return day >= new Date(year, month, 0).getDate() - 4;
};
const managerOnly = (req, res, next) => req.user.role === "gerencia"
  ? next() : res.status(403).json({ msg: "La evaluacion mensual es exclusiva para gerentes." });

router.get("/monthly/status", auth, managerOnly, async (req, res) => {
  const month = mexicoMonth();
  const evaluation = await MonthlyEvaluation.findOne({ manager: req.user.id, month }).lean();
  res.json({
    month,
    submitted: Boolean(evaluation && evaluation.scoringVersion >= 2),
    score: evaluation?.score ?? null,
    locked: lockedWindow(),
  });
});

router.post("/monthly", auth, managerOnly, async (req, res) => {
  const answers = req.body.answers;
  if (!Array.isArray(answers) || answers.length !== criteria.length ||
      criteria.some((criterion) => !answers.some((answer) => answer.criterion === criterion &&
        Number.isInteger(answer.rating) && answer.rating >= 1 && answer.rating <= 5))) {
    return res.status(400).json({ msg: "Completa una calificacion valida para cada rubro." });
  }
  const score = Math.round(answers.reduce((sum, answer) => {
    const index = criteria.indexOf(answer.criterion);
    return sum + (bonusRates[answer.rating - 1] / 100) * weights[index];
  }, 0) * 10) / 10;
  try {
    const values = {
      organization: req.user.organization || null,
      branch: req.user.branch || null,
      manager: req.user.id,
      month: mexicoMonth(),
      answers: criteria.map((criterion, index) => {
        const answer = answers.find((item) => item.criterion === criterion);
        const bonusRate = bonusRates[answer.rating - 1];
        return {
          ...answer,
          achievementBand: achievementBands[answer.rating - 1],
          bonusRate,
          weightedPoints: Math.round(weights[index] * bonusRate) / 100,
        };
      }),
      score,
      scoringVersion: 2,
    };
    const priorSubmission = await MonthlyEvaluation.findOne({ manager: req.user.id, month: mexicoMonth() });
    if (priorSubmission && priorSubmission.scoringVersion >= 2) {
      return res.status(409).json({ msg: "Ya enviaste la evaluacion de este mes." });
    }
    let evaluation;
    if (priorSubmission) {
      Object.assign(priorSubmission, values);
      evaluation = await priorSubmission.save();
    } else {
      evaluation = await MonthlyEvaluation.create(values);
    }
    res.status(201).json({ msg: "Evaluacion guardada.", score: evaluation.score });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ msg: "Ya enviaste la evaluacion de este mes." });
    throw error;
  }
});

router.get("/monthly/results", auth, requirePermission("EVALUATIONS_RESULTS_VIEW"), async (req, res) => {
  const month = (req.query.month || mexicoMonth()).toString();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ msg: "Mes invalido. Usa el formato AAAA-MM." });
  }
  const evaluations = await MonthlyEvaluation.find({
    organization: req.user.organization || null,
    month,
    scoringVersion: { $gte: 2 },
  }).populate("manager", "nombre email department")
    .populate("branch", "name")
    .sort({ createdAt: 1 }).lean();

  const totalPoints = Math.round(evaluations.reduce((sum, item) => sum + item.score, 0) * 10) / 10;
  const possiblePoints = evaluations.length * 100;
  const attainment = possiblePoints ? Math.round((totalPoints / possiblePoints) * 1000) / 10 : 0;
  res.json({
    month,
    count: evaluations.length,
    totalPoints,
    possiblePoints,
    attainment,
    target: 100,
    targetReached: evaluations.length > 0 && attainment >= 100,
    evaluations,
  });
});

module.exports = router;
