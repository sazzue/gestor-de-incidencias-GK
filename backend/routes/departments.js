// routes/departments.js
const express = require("express");
const router = express.Router();
const Department = require("../models/Department");

router.get("/", async (req, res) => {
  const deps = await Department.find();
  res.json(deps);
});

module.exports = router;