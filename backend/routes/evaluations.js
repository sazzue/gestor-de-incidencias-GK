const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const MonthlyEvaluation = require("../models/MonthlyEvaluation");
const Branch = require("../models/branch");
const User = require("../models/User");
const requirePermission = require("../middleware/requirePermission");

const criteria = ["urgent", "application", "followup", "maintenance", "service", "communication"];
const weights = [50, 20, 15, 5, 5, 5];
// Rating is the displayed option order: full, majority, partial, insufficient, not started.
const bonusRates = [100, 75, 50, 0, 0];
const achievementBands = ["100%", "90–99%", "80–89%", "50–79%", "Menos de 50%"];
const excludedBranchNames = new Set(["oficina manzanares", "abinsa", "oficina roble"]);
const normalizeBranchName = (value) => String(value || "").trim().toLocaleLowerCase("es-MX");
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

const getAssignedBranches = async (user) => {
  const assignedIds = [...new Set([
    ...(Array.isArray(user.branches) ? user.branches : []),
    ...(user.branch ? [user.branch] : []),
  ].map((branch) => String(branch?._id || branch)).filter(Boolean))];
  const assignedBranches = assignedIds.length
    ? await Branch.find({
      _id: { $in: assignedIds },
      organization: user.organization || null,
    }).select("name").sort({ name: 1 }).lean()
    : [];
  const branches = assignedBranches.filter((branch) => !excludedBranchNames.has(normalizeBranchName(branch.name)));
  return { assignedIds, assignedBranches, branches };
};

router.get("/monthly/status", auth, managerOnly, async (req, res) => {
  const month = mexicoMonth();
  const { assignedIds, assignedBranches, branches } = await getAssignedBranches(req.user);
  if (assignedIds.length === 0 || assignedIds.length > 2 || assignedBranches.length !== assignedIds.length || branches.length === 0) {
    return res.json({ month, eligible: false, branches: [], submitted: false, locked: lockedWindow() });
  }
  const eligibleBranchIds = branches.map((branch) => String(branch._id));
  const evaluations = await MonthlyEvaluation.find({
    organization: req.user.organization || null,
    month,
    branch: { $in: eligibleBranchIds },
    scoringVersion: 3,
  }).lean();
  const submittedByBranch = new Map(evaluations.map((item) => [String(item.branch), item]));
  const branchStatus = branches.map((branch) => {
    const evaluation = submittedByBranch.get(String(branch._id));
    const submitted = Boolean(evaluation);
    return { id: String(branch._id), name: branch.name, submitted, score: submitted ? evaluation.score : null };
  });
  res.json({
    month,
    eligible: true,
    branches: branchStatus,
    submitted: branchStatus.every((branch) => branch.submitted),
    locked: lockedWindow(),
  });
});

router.post("/monthly", auth, managerOnly, async (req, res) => {
  const branchId = String(req.body.branchId || "");
  const { assignedIds, assignedBranches, branches } = await getAssignedBranches(req.user);
  if (assignedIds.length === 0 || assignedIds.length > 2 || assignedBranches.length !== assignedIds.length || branches.length === 0) {
    return res.status(403).json({ msg: "La evaluacion solo aplica a gerentes con una o dos sucursales asignadas." });
  }
  if (!branches.some((branch) => String(branch._id) === branchId)) {
    return res.status(403).json({ msg: "Solo puedes evaluar una sucursal que tengas asignada." });
  }
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
      branch: branchId,
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
      scoringVersion: 3,
    };
    const existingSubmission = await MonthlyEvaluation.findOne({
      organization: req.user.organization || null,
      month: values.month,
      branch: branchId,
      scoringVersion: 3,
    });
    if (existingSubmission) {
      return res.status(409).json({ msg: "Esta sucursal ya tiene una evaluacion enviada para este mes." });
    }
    let evaluation;
    const legacySubmission = await MonthlyEvaluation.findOne({
      organization: req.user.organization || null,
      month: values.month,
      branch: branchId,
      scoringVersion: { $lt: 3 },
    }).sort({ createdAt: -1 });
    if (legacySubmission) {
      Object.assign(legacySubmission, values);
      evaluation = await legacySubmission.save();
    } else {
      evaluation = await MonthlyEvaluation.create(values);
    }
    res.status(201).json({ msg: "Evaluacion guardada.", score: evaluation.score });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ msg: "Esta sucursal ya tiene una evaluacion enviada para este mes." });
    throw error;
  }
});

router.get("/monthly/results", auth, requirePermission("EVALUATIONS_RESULTS_VIEW"), async (req, res) => {
  const month = (req.query.month || mexicoMonth()).toString();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ msg: "Mes invalido. Usa el formato AAAA-MM." });
  }
  const organization = req.user.organization || null;
  const [allBranchDocs, managerDocs, evaluations] = await Promise.all([
    Branch.find({ organization }).select("name").sort({ name: 1 }).lean(),
    User.find({ organization, role: "gerencia" }).select("nombre email branch branches").lean(),
    MonthlyEvaluation.find({ organization, month, scoringVersion: 3 }).sort({ createdAt: -1 }).lean(),
  ]);
  const branchById = new Map(allBranchDocs.map((branch) => [String(branch._id), branch]));
  const branchDocs = allBranchDocs.filter((branch) => !excludedBranchNames.has(normalizeBranchName(branch.name)));
  const evaluationByBranch = new Map(evaluations.map((evaluation) => [String(evaluation.branch), evaluation]));
  const branches = branchDocs.map((branch) => {
    const branchId = String(branch._id);
    const managers = managerDocs.filter((manager) => {
      const ids = [...new Set([
        ...(Array.isArray(manager.branches) ? manager.branches : []),
        ...(manager.branch ? [manager.branch] : []),
      ].map(String))];
      return ids.length > 0 && ids.length <= 2 && !ids.some((id) => !branchById.has(id)) && ids.includes(branchId);
    });
    const evaluation = evaluationByBranch.get(branchId);
    const responder = evaluation && managerDocs.find((manager) => String(manager._id) === String(evaluation.manager));
    const managerName = responder
      ? responder.nombre || responder.email
      : managers.map((manager) => manager.nombre || manager.email).join(", ");
    const expectedCount = managers.length > 0 ? 1 : 0;
    const submittedCount = evaluation ? 1 : 0;
    const totalPoints = evaluation?.score || 0;
    const possiblePoints = expectedCount * 100;
    return {
      id: branchId,
      name: branch.name,
      managerName: managerName || "Sin gerente elegible",
      status: expectedCount === 0 ? "sin_gerente_elegible" : evaluation ? "respondida" : "pendiente",
      expectedCount,
      submittedCount,
      totalPoints,
      possiblePoints,
      attainment: possiblePoints ? Math.round((totalPoints / possiblePoints) * 1000) / 10 : 0,
      score: evaluation?.score ?? null,
    };
  });
  const assignments = branches.filter((branch) => branch.expectedCount > 0);
  const totalPoints = Math.round(assignments.reduce((sum, branch) => sum + (branch.score || 0), 0) * 10) / 10;
  const possiblePoints = assignments.length * 100;
  const submittedCount = assignments.filter((branch) => branch.status === "respondida").length;
  const attainment = possiblePoints ? Math.round((totalPoints / possiblePoints) * 1000) / 10 : 0;
  res.json({
    month,
    count: submittedCount,
    expectedCount: assignments.length,
    totalPoints,
    possiblePoints,
    attainment,
    target: 100,
    targetReached: assignments.length > 0 && submittedCount === assignments.length && attainment >= 100,
    branches,
  });
});

module.exports = router;
