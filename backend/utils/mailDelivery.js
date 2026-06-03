const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const Organization = require("../models/Organization");
const { decryptSecret } = require("./secretCrypto");

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
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user,
      pass,
    },
  });

const getOrganizationMailSettings = async (organization) => {
  if (!organization) return null;

  const organizationDoc = typeof organization === "object" && organization.mailSettings
    ? organization
    : await Organization.findById(organization).select("mailSettings name");
  const settings = organizationDoc?.mailSettings;

  if (
    !settings?.enabled ||
    settings.provider !== "smtp" ||
    !settings.fromEmail ||
    !settings.smtpHost ||
    !settings.smtpUser ||
    !settings.smtpPassEncrypted
  ) {
    return null;
  }

  return {
    type: "organization-smtp",
    from: formatAddress({
      name: settings.fromName || organizationDoc.name || "Gestor de reportes",
      email: settings.fromEmail,
    }),
    transporter: createSmtpTransporter({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      user: settings.smtpUser,
      pass: decryptSecret(settings.smtpPassEncrypted),
    }),
  };
};

const getGlobalMailSettings = () => {
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
    return {
      type: "resend",
      from: process.env.MAIL_FROM,
      resend: new Resend(process.env.RESEND_API_KEY),
    };
  }

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

  return null;
};

const getMailSettings = async (organization) =>
  await getOrganizationMailSettings(organization) || getGlobalMailSettings();

const isMailDeliveryConfigured = async (organization) =>
  Boolean(await getMailSettings(organization));

const sendMail = async ({ organization, to, subject, text, html }) => {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) return null;

  const settings = await getMailSettings(organization);

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

  return settings.transporter.sendMail(message);
};

module.exports = {
  createSmtpTransporter,
  getFrontendUrl,
  isMailDeliveryConfigured,
  sendMail,
};
