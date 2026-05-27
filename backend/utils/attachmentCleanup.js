const Incident = require("../models/incident");
const { deleteIncidentFile, isR2Configured } = require("./r2Storage");

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_INTERVAL_HOURS = 24;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

const getRetentionDays = () => {
  const value = Number(process.env.ATTACHMENT_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_RETENTION_DAYS;
};

const getCleanupIntervalHours = () => {
  const value = Number(process.env.ATTACHMENT_CLEANUP_INTERVAL_HOURS || DEFAULT_INTERVAL_HOURS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_INTERVAL_HOURS;
};

const purgeExpiredIncidentAttachments = async () => {
  if (!isR2Configured()) {
    console.warn("attachment-cleanup skipped: Cloudflare R2 no esta configurado");
    return { scanned: 0, purgedIncidents: 0, deletedFiles: 0, failedFiles: 0 };
  }

  const retentionDays = getRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY);
  const incidents = await Incident.find({
    status: "resuelto",
    $or: [
      { resolvedAt: { $lte: cutoff } },
      { resolvedAt: null, updatedAt: { $lte: cutoff } },
    ],
    "attachments.0": { $exists: true },
  });

  let deletedFiles = 0;
  let failedFiles = 0;
  let purgedIncidents = 0;

  for (const incident of incidents) {
    const attachments = incident.attachments || [];
    const results = await Promise.allSettled(
      attachments.map((attachment) => deleteIncidentFile({ key: attachment.key }))
    );
    const deletedKeys = new Set();

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        deletedFiles += 1;
        deletedKeys.add(attachments[index].key);
      } else {
        failedFiles += 1;
        console.error("attachment-cleanup delete error:", {
          incidentId: incident._id,
          key: attachments[index]?.key,
          error: result.reason,
        });
      }
    });

    if (deletedKeys.size > 0) {
      incident.attachments = attachments.filter((attachment) => !deletedKeys.has(attachment.key));

      if (incident.attachments.length === 0) {
        incident.attachmentsPurgedAt = new Date();
        purgedIncidents += 1;
      }

      await incident.save();
    }
  }

  const summary = {
    scanned: incidents.length,
    purgedIncidents,
    deletedFiles,
    failedFiles,
    retentionDays,
  };

  console.log("attachment-cleanup completed:", summary);
  return summary;
};

const startAttachmentCleanupSchedule = () => {
  const intervalMs = getCleanupIntervalHours() * MS_PER_HOUR;

  setTimeout(() => {
    purgeExpiredIncidentAttachments().catch((error) => {
      console.error("attachment-cleanup startup error:", error);
    });
  }, 60 * 1000);

  setInterval(() => {
    purgeExpiredIncidentAttachments().catch((error) => {
      console.error("attachment-cleanup scheduled error:", error);
    });
  }, intervalMs);
};

module.exports = {
  purgeExpiredIncidentAttachments,
  startAttachmentCleanupSchedule,
};
