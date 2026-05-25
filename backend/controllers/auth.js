const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getPermissionsForUser } = require("../utils/permissions");

exports.register = async (req, res) => {
  res.json({ msg: "register ok" });
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ❌ quitamos populate
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid" });

    const permissions = await getPermissionsForUser(user);

    // =========================
    // 🎟 TOKEN FINAL
    // =========================
    const token = jwt.sign(
      {
        id: user._id,
        nombre: user.nombre,
        role: user.role,
        department: user.department || null,
        branch: user.branch || null,
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
