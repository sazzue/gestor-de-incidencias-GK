const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const { getPermissionsForUser } = require("../utils/permissions");

const getMailTransporter = () => {
  const port = Number(process.env.SMTP_PORT || 587);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const isMailConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.FRONTEND_URL
  );

const isResendConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM && process.env.FRONTEND_URL);

const isPasswordResetDeliveryConfigured = () => isResendConfigured() || isMailConfigured();

const buildPasswordResetHtml = (user, resetLink) => `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#f8fafc;border-radius:12px;">
    <h2 style="color:#1e293b;">Restablecer contrasena</h2>
    <p style="color:#475569;">Hola <strong>${user.nombre || user.email}</strong>,</p>
    <p style="color:#475569;">
      Recibimos una solicitud para restablecer tu contrasena.<br/>
      Este enlace es valido por <strong>1 hora</strong>.
    </p>
    <a href="${resetLink}"
       style="display:inline-block;margin:16px 0;padding:12px 28px;
              background:#2563eb;color:#fff;border-radius:8px;
              text-decoration:none;font-weight:600;font-size:15px;">
      Cambiar contrasena
    </a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
      Si no solicitaste esto, puedes ignorar este correo.
    </p>
  </div>
`;

const sendPasswordResetEmail = async ({ user, resetLink }) => {
  const message = {
    to: user.email,
    subject: "Restablecer contrasena - Sistema de Incidencias",
    html: buildPasswordResetHtml(user, resetLink),
  };

  if (isResendConfigured()) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: process.env.MAIL_FROM,
      ...message,
    });

    if (result.error) {
      throw result.error;
    }

    return result;
  }

  return getMailTransporter().sendMail({
    from: `"Sistema de Incidencias" <${process.env.SMTP_USER}>`,
    ...message,
  });
};

const buildUserPayload = async (user) => {
  const permissions = await getPermissionsForUser(user);

  return {
    tokenPayload: {
      id: user._id,
      nombre: user.nombre,
      username: user.username || null,
      role: user.role,
      department: user.department || null,
      branch: user.branch || null,
      branches: user.branches || [],
      permissions,
      mustChangePassword: user.mustChangePassword,
    },
    userPayload: {
      id: user._id,
      nombre: user.nombre,
      username: user.username || null,
      email: user.email,
      role: user.role,
      department: user.department || null,
      branch: user.branch || null,
      branches: user.branches || [],
      permissions,
      mustChangePassword: user.mustChangePassword,
    },
  };
};

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { nombre, email, password, role, department, permissions } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ msg: "El correo ya esta registrado" });
    }

    const hashed = await bcrypt.hash(password, 12);

    await User.create({
      nombre,
      email: email.toLowerCase(),
      password: hashed,
      role,
      department,
      permissions,
      mustChangePassword: true,
    });

    res.status(201).json({ msg: "Usuario creado correctamente" });
  } catch (error) {
    console.error("register error:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const identifier = (req.body.email || req.body.username || req.body.identifier || "")
      .toLowerCase()
      .trim();
    const { password } = req.body;

    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
      ],
    });
    if (!user) return res.status(400).json({ msg: "Credenciales incorrectas" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ msg: "Credenciales incorrectas" });

    const { tokenPayload, userPayload } = await buildUserPayload(user);
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({ token, user: userPayload });
  } catch (error) {
    console.error("login error:", error);
    res.status(500).json({ msg: "Error en login" });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    const { tokenPayload, userPayload } = await buildUserPayload(user);
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({ token, user: userPayload });
  } catch (error) {
    console.error("me error:", error);
    res.status(500).json({ msg: "Error al obtener usuario" });
  }
};

// POST /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ msg: "La contrasena debe tener al menos 8 caracteres" });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await User.findByIdAndUpdate(userId, {
      password: hashed,
      mustChangePassword: false,
    });

    res.json({ msg: "Contrasena actualizada correctamente" });
  } catch (error) {
    console.error("change-password error:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ msg: "Ingresa un correo valido" });
    }

    const genericMsg = "Si el correo esta registrado, recibiras un enlace en breve.";
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) return res.json({ msg: genericMsg });

    if (!isPasswordResetDeliveryConfigured()) {
      console.error("forgot-password error: email delivery configuration is incomplete");
      return res.status(503).json({
        msg: "El servicio de correo no esta configurado. Intenta mas tarde.",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      resetPasswordToken: token,
      resetPasswordExpires: expires,
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail({ user, resetLink });
    } catch (mailError) {
      await User.findByIdAndUpdate(user._id, {
        resetPasswordToken: null,
        resetPasswordExpires: null,
      });

      console.error("forgot-password mail error:", mailError);
      return res.status(503).json({
        msg: "No se pudo enviar el correo de recuperacion. Revisa la configuracion de correo.",
      });
    }

    res.json({ msg: genericMsg });
  } catch (error) {
    console.error("forgot-password error:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ msg: "La contrasena debe tener al menos 8 caracteres" });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ msg: "El enlace es invalido o ya expiro" });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await User.findByIdAndUpdate(user._id, {
      password: hashed,
      mustChangePassword: false,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    res.json({ msg: "Contrasena restablecida. Ya puedes iniciar sesion." });
  } catch (error) {
    console.error("reset-password error:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};
