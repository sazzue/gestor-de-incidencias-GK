const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const dns = require("dns");
const net = require("net");

dns.setDefaultResultOrder?.("ipv4first");

const getFrontendUrl = () => {
  const frontendUrl = process.env.FRONTEND_URL?.trim().replace(/\/+$/, "");

  if (!frontendUrl) return "";

  try {
    return new URL(frontendUrl).origin;
  } catch {
    return "";
  }
};

const getMailConfigurationStatus = () => {
  const hasSmtpHost = Boolean(process.env.SMTP_HOST?.trim());
  const hasSmtpUser = Boolean(process.env.SMTP_USER?.trim());
  const hasSmtpPass = Boolean(process.env.SMTP_PASS?.trim());
  const hasResendKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasMailFrom = Boolean(process.env.MAIL_FROM?.trim());
  const frontendUrl = getFrontendUrl();

  const smtpReady = hasSmtpHost && hasSmtpUser && hasSmtpPass;
  const resendReady = hasResendKey && hasMailFrom;

  const missing = [];
  if (!frontendUrl) missing.push("FRONTEND_URL");

  if (!smtpReady && !resendReady) {
    if (!hasSmtpHost) missing.push("SMTP_HOST");
    if (!hasSmtpUser) missing.push("SMTP_USER");
    if (!hasSmtpPass) missing.push("SMTP_PASS");
    if (hasResendKey && !hasMailFrom) missing.push("MAIL_FROM");
  }

  return {
    ready: Boolean(frontendUrl && (smtpReady || resendReady)),
    frontendUrlConfigured: Boolean(frontendUrl),
    provider: smtpReady ? "smtp" : resendReady ? "resend" : "none",
    missing,
  };
};

const formatAddress = ({ name, email }) => {
  if (!name) return email;
  return `"${name.replace(/"/g, "'")}" <${email}>`;
};

const resolveIpv4Host = async (host) => {
  if (net.isIP(host)) return host;

  try {
    const result = await dns.promises.lookup(host, { family: 4 });
    return result.address;
  } catch (error) {
    console.error("smtp ipv4 lookup error:", {
      host,
      code: error.code,
      message: error.message,
    });
    return host;
  }
};

const createSmtpTransporter = async ({ host, port, secure, user, pass }) => {
  const originalHost = host?.trim();
  const resolvedHost = await resolveIpv4Host(originalHost);

  return nodemailer.createTransport({
    host: resolvedHost,
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
    ...(net.isIP(originalHost) ? {} : { tls: { servername: originalHost } }),
  });
};

const getGlobalMailSettings = async () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      type: "global-smtp",
      resolvedHost: await resolveIpv4Host(process.env.SMTP_HOST),
      from: process.env.MAIL_FROM || formatAddress({
        name: "Gestor de reportes",
        email: process.env.SMTP_USER,
      }),
      transporter: await createSmtpTransporter({
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

const getMailSettings = async () => getGlobalMailSettings();

const isMailDeliveryConfigured = async () =>
  Boolean(await getMailSettings());

const sendMail = async ({ to, subject, text, html }) => {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) return null;

  const settings = await getMailSettings();

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
      resolvedHost: settings.resolvedHost,
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
  getMailConfigurationStatus,
  isMailDeliveryConfigured,
  sendMail,
};
