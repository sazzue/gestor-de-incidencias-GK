const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const MonthlyEvaluation = require("../models/MonthlyEvaluation");

const criteria = ["urgent", "application", "followup", "maintenance", "service", "communication"];
const weights = [50, 20, 15, 5, 5, 5];
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
  res.json({ month, submitted: Boolean(evaluation), score: evaluation?.score ?? null, locked: lockedWindow() });
});

router.post("/monthly", auth, managerOnly, async (req, res) => {
  const answers = req.body.answers;
  if (!Array.isArray(answers) || answers.length !== criteria.length ||
      criteria.some((criterion) => !answers.some((answer) => answer.criterion === criterion &&
        Number.isInteger(answer.rating) && answer.rating >= 0 && answer.rating <= 5))) {
    return res.status(400).json({ msg: "Completa una calificacion valida para cada rubro." });
  }
  const score = Math.round(answers.reduce((sum, answer) => {
    const index = criteria.indexOf(answer.criterion);
    return sum + (answer.rating / 5) * weights[index];
  }, 0) * 10) / 10;
  try {
    const evaluation = await MonthlyEvaluation.create({
      organization: req.user.organization || null,
      branch: req.user.branch || null,
      manager: req.user.id,
      month: mexicoMonth(),
      answers: criteria.map((criterion) => answers.find((answer) => answer.criterion === criterion)),
      score,
    });
    res.status(201).json({ msg: "Evaluacion guardada.", score: evaluation.score });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ msg: "Ya enviaste la evaluacion de este mes." });
    throw error;
  }
});

module.exports = router;
