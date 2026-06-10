const DEFAULT_SLA_HOURS = {
  baja: 168,
  media: 72,
  alta: 24,
  critica: 4,
};

const DEFAULT_SLA_WARNING_PERCENT = 25;

const normalizeSlaHours = (value = {}) => Object.fromEntries(
  Object.entries(DEFAULT_SLA_HOURS).map(([priority, fallback]) => {
    const hours = Number(value?.[priority]);
    return [priority, Number.isFinite(hours) && hours > 0 ? hours : fallback];
  })
);

const normalizeWarningPercent = (value) => {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return DEFAULT_SLA_WARNING_PERCENT;
  return Math.min(90, Math.max(5, percent));
};

const calculateDueAt = ({ createdAt = new Date(), priority = "media", slaHours = {} }) => {
  const hoursByPriority = normalizeSlaHours(slaHours);
  const hours = hoursByPriority[priority] || hoursByPriority.media;
  return new Date(new Date(createdAt).getTime() + hours * 60 * 60 * 1000);
};

module.exports = {
  DEFAULT_SLA_HOURS,
  DEFAULT_SLA_WARNING_PERCENT,
  calculateDueAt,
  normalizeSlaHours,
  normalizeWarningPercent,
};
