const User = require("../models/User");
const { sendMail } = require("./mailDelivery");

const splitList = (value = "") =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const unique = (items) => [...new Set(items.filter(Boolean))];

const normalizeDepartment = (department) =>
  department?.toString().trim().toLowerCase();

const escapeRegExp = (value = "") =>
  value.toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (value = "") =>
  value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isWhatsappConfigured = () =>
  Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
  );

const getConfiguredEmails = (type) => {
  if (type === "incident") {
    return splitList(process.env.ALERT_INCIDENT_EMAIL_TO);
  }

  return splitList(process.env.ALERT_MAINTENANCE_EMAIL_TO || process.env.ALERT_EMAIL_TO);
};

const getDepartmentRecipientQueries = ({ department, permission }) => {
  if (!department) return [];

  const departmentMatcher = new RegExp(`^${escapeRegExp(department)}$`, "i");

  return [{
    role: "departamento",
    department: departmentMatcher,
  }, {
    permissions: permission,
    department: departmentMatcher,
  }];
};

const getRecipientQueries = ({ type, record, createdByUser }) => {
  const department = normalizeDepartment(record?.department);

  if (type === "incident") {
    return getDepartmentRecipientQueries({
      department,
      permission: "VIEW_INCIDENTS_DEPARTMENT",
    });
  }

  if (type === "maintenance" && createdByUser?.role === "departamento") {
    return [{ role: { $in: ["gerencia", "direccion"] } }];
  }

  return [];
};

const getAlertEmails = async ({ organization, type, record, createdByUser }) => {
  const configuredEmails = getConfiguredEmails(type);
  const recipientQueries = getRecipientQueries({ type, record, createdByUser });
  const users = recipientQueries.length > 0
    ? await User.find({
        organization: organization || null,
        $or: recipientQueries,
      }).select("email")
    : [];

  return unique([
    ...configuredEmails,
    ...users.map((user) => user.email),
  ]);
};

const sendWhatsapp = async ({ text }) => {
  const recipients = unique(splitList(process.env.ALERT_WHATSAPP_TO));

  if (!isWhatsappConfigured() || recipients.length === 0) return;

  const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  await Promise.all(
    recipients.map(async (to) => {
      const response = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text.slice(0, 4000) },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`WhatsApp API error ${response.status}: ${body}`);
      }
    })
  );
};

const formatBranch = (record) => record.branch?.name || record.branch || "Sin sucursal";

const formatCreator = (record) =>
  record.createdBy?.nombre || record.createdBy?.email || "Usuario no disponible";

const buildNotification = ({ type, record }) => {
  const label = type === "maintenance" ? "mantenimiento" : "incidencia";
  const title = record.title || "Sin titulo";
  const department = record.department || "Sin departamento";
  const branch = formatBranch(record);
  const createdBy = formatCreator(record);
  const date = record.date ? `\nFecha programada: ${record.date}` : "";

  const text = [
    `Nueva ${label}: ${title}`,
    `Sucursal: ${branch}`,
    `Departamento: ${department}`,
    `Creado por: ${createdBy}${date}`,
    "",
    record.description || "Sin descripcion",
  ].join("\n");

  return {
    subject: `Nueva ${label}: ${title}`,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;">
        <h2>Nueva ${label}: ${escapeHtml(title)}</h2>
        <p><strong>Sucursal:</strong> ${escapeHtml(branch)}</p>
        <p><strong>Departamento:</strong> ${escapeHtml(department)}</p>
        <p><strong>Creado por:</strong> ${escapeHtml(createdBy)}</p>
        ${record.date ? `<p><strong>Fecha programada:</strong> ${escapeHtml(record.date)}</p>` : ""}
        <p>${escapeHtml(record.description || "Sin descripcion")}</p>
      </div>
    `,
  };
};

const notifyNewRecord = async ({ type, record, organization, createdByUser }) => {
  try {
    const notification = buildNotification({ type, record });
    const emailRecipients = await getAlertEmails({
      organization,
      type,
      record,
      createdByUser,
    });

    const results = await Promise.allSettled([
      sendMail({ organization, to: emailRecipients, ...notification }),
      sendWhatsapp({ text: notification.text }),
    ]);

    results
      .filter((result) => result.status === "rejected")
      .forEach((result) => {
        console.error("notification error:", result.reason);
      });
  } catch (error) {
    console.error("notification error:", error);
  }
};

module.exports = {
  notifyNewRecord,
};
