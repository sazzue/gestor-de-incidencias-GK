const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT),
  secure: true, // true para puerto 465, false para 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { nombre, email, password, role, department, permissions } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ msg: "El correo ya está registrado" });
    }

    const hashed = await bcrypt.hash(password, 12);

    await User.create({
      nombre,
      email: email.toLowerCase(),
      password: hashed,
      role,
      department,
      permissions,
      mustChangePassword: true, // 🔐 siempre true al crear usuario
    });

    res.status(201).json({ msg: "Usuario creado correctamente" });
  } catch (error) {
    console.error("register error:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Credenciales incorrectas" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ msg: "Credenciales incorrectas" });

    // ── Permisos ──────────────────────────────
    let permissions = [];

    const departmentName = user.department?.trim();

    if (user.role === "departamento" && departmentName === "sistemas") {
      permissions.push("CREATE_MAINTENANCE");
    }

    if (["admin", "gerencia", "direccion"].includes(user.role)) {
      permissions.push("CONFIRM_MAINTENANCE");
    }

    // ── Token ─────────────────────────────────
    const token = jwt.sign(
      {
        id:                 user._id,
        nombre:             user.nombre,
        role:               user.role,
        department:         user.department || null,
        permissions,
        mustChangePassword: user.mustChangePassword, // 🔐
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id:                 user._id,
        nombre:             user.nombre,
        email:              user.email,
        role:               user.role,
        department:         user.department || null,
        mustChangePassword: user.mustChangePassword, // 🔐 frontend lo necesita
      },
    });
  } catch (error) {
    console.error("login error:", error);
    res.status(500).json({ msg: "Error en login" });
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/change-password
// Primer inicio de sesión — cambio obligatorio
// ─────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ msg: "La contraseña debe tener al menos 8 caracteres" });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await User.findByIdAndUpdate(userId, {
      password:           hashed,
      mustChangePassword: false, // ✅ ya no se pedirá de nuevo
    });

    res.json({ msg: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("change-password error:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
// Solicitar correo de recuperación
// ─────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // 🔍 LOG TEMPORAL
    console.log("SMTP CONFIG:", {
      host:       process.env.SMTP_HOST,
      port:       process.env.SMTP_PORT,
      user:       process.env.SMTP_USER,
      passExists: !!process.env.SMTP_PASS,
      frontend:   process.env.FRONTEND_URL,
    });


    const genericMsg = "Si el correo está registrado, recibirás un enlace en breve.";

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ msg: genericMsg });

    const token   = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await User.findByIdAndUpdate(user._id, {
      resetPasswordToken:   token,
      resetPasswordExpires: expires,
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
  from:    `"Sistema de Incidencias" <${process.env.SMTP_USER}>`,
  to:      user.email,
  subject: "Restablecer contraseña — Sistema de Incidencias",
  html: `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#f8fafc;border-radius:12px;">
      <h2 style="color:#1e293b;">Restablecer contraseña</h2>
      <p style="color:#475569;">Hola <strong>${user.nombre || user.email}</strong>,</p>
      <p style="color:#475569;">
        Recibimos una solicitud para restablecer tu contraseña.<br/>
        Este enlace es válido por <strong>1 hora</strong>.
      </p>
      <a href="${resetLink}"
         style="display:inline-block;margin:16px 0;padding:12px 28px;
                background:#2563eb;color:#fff;border-radius:8px;
                text-decoration:none;font-weight:600;font-size:15px;">
        Cambiar contraseña
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
        Si no solicitaste esto, puedes ignorar este correo.
      </p>
    </div>
  `,
});

    res.json({ msg: genericMsg });
  } catch (error) {
    console.error("forgot-password error:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/reset-password
// Confirmar nueva contraseña con token del correo
// ─────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ msg: "La contraseña debe tener al menos 8 caracteres" });
    }

    const user = await User.findOne({
      resetPasswordToken:   token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ msg: "El enlace es inválido o ya expiró" });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await User.findByIdAndUpdate(user._id, {
      password:             hashed,
      mustChangePassword:   false,
      resetPasswordToken:   null,
      resetPasswordExpires: null,
    });

    res.json({ msg: "Contraseña restablecida. Ya puedes iniciar sesión." });
  } catch (error) {
    console.error("reset-password error:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};
