const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getAccessScopesForUser, getPermissionsForUser } = require("../utils/permissions");

exports.register = async (req, res) => {
  res.json({ msg: "register ok" });
};

exports.login = async (req, res) => {
  try {
    const identifier = (req.body.email || req.body.username || req.body.identifier || "")
      .toLowerCase()
      .trim();
    const { password } = req.body;

    // ❌ quitamos populate
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier }
      ]
    });
    if (!user) return res.status(400).json({ message: "Invalid" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid" });

    const permissions = await getPermissionsForUser(user);
    const accessScopes = getAccessScopesForUser(user);

    // =========================
    // 🎟 TOKEN FINAL
    // =========================
    const token = jwt.sign(
      {
        id: user._id,
        nombre: user.nombre,
        username: user.username || null,
        role: user.role,
        department: user.department || null,
        branch: user.branch || null,
        branches: user.branches || [],
        accessScopes,
        permissions,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error en login" });
  }
};
