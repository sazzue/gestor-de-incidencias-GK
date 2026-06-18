const nodemailer = require("nodemailer");
const { Resend } = require("resend");

const getFrontendUrl = () => {
  const frontendUrl = process.env.FRONTEND_URL?.trim().replace(/\/+$/, "");

  if (!frontendUrl) return "";

  try {
    return new URL(frontendUrl).origin;
  } catch {
    return "";
  }
};

const formatAddress = ({ name, email }) => {
  if (!name) return email;
  return `"${name.replace(/"/g, "'")}" <${email}>`;
};

const createSmtpTransporter = ({ host, port, secure, user, pass }) =>
  nodemailer.createTransport({
    host,
    port: Number(port || 587),
    secure: Boolean(secure) || Number(port) === 465,
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user,
      pass,
    },
  });

const getGlobalMailSettings = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      type: "global-smtp",
      from: process.env.MAIL_FROM || formatAddress({
        name: "Gestor de reportes",
        email: process.env.SMTP_USER,
      }),
      transporter: createSmtpTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === "true",
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }),
    };
  }

  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
    return {
      type: "resend",
      from: process.env.MAIL_FROM,
      resend: new Resend(process.env.RESEND_API_KEY),
    };
  }

  return null;
};

const getMailSettings = () => getGlobalMailSettings();

const isMailDeliveryConfigured = async () =>
  Boolean(getMailSettings());

const sendMail = async ({ to, subject, text, html }) => {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) return null;

  const settings = getMailSettings();

  if (!settings) {
    throw new Error("El servicio de correo no esta configurado");
  }

  const message = {
    from: settings.from,
    to: recipients,
    subject,
    text,
    html,
  };

  if (settings.type === "resend") {
    const result = await settings.resend.emails.send(message);
    if (result.error) throw result.error;
    return result;
  }

  try {
    return await settings.transporter.sendMail(message);
  } catch (error) {
    console.error("sendMail smtp error:", {
      type: settings.type,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true",
      from: settings.from,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      response: error.response,
      message: error.message,
    });
    throw error;
  }
};

module.exports = {
  createSmtpTransporter,
  getFrontendUrl,
  isMailDeliveryConfigured,
  sendMail,
};
