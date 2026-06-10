export const SLA_STATES = {
  ON_TIME: "on-time",
  WARNING: "warning",
  OVERDUE: "overdue",
  MET: "met",
  BREACHED: "breached",
  NONE: "none",
};

export const SLA_LABELS = {
  [SLA_STATES.ON_TIME]: "A tiempo",
  [SLA_STATES.WARNING]: "Proxima a vencer",
  [SLA_STATES.OVERDUE]: "Vencida",
  [SLA_STATES.MET]: "Cumplida",
  [SLA_STATES.BREACHED]: "Incumplida",
  [SLA_STATES.NONE]: "Sin limite",
};

export const getResolvedDate = (incident) =>
  incident?.resolvedAt || (incident?.status === "resuelto" ? incident?.updatedAt : null);

export const getSlaState = (incident, warningPercent = 25, now = Date.now()) => {
  if (!incident?.dueAt) return SLA_STATES.NONE;

  const dueAt = new Date(incident.dueAt).getTime();
  const createdAt = new Date(incident.createdAt || incident.dueAt).getTime();
  const resolvedAt = getResolvedDate(incident);

  if (resolvedAt) {
    return new Date(resolvedAt).getTime() <= dueAt
      ? SLA_STATES.MET
      : SLA_STATES.BREACHED;
  }

  if (now > dueAt) return SLA_STATES.OVERDUE;

  const duration = Math.max(1, dueAt - createdAt);
  const remainingPercent = ((dueAt - now) / duration) * 100;
  return remainingPercent <= Number(warningPercent || 25)
    ? SLA_STATES.WARNING
    : SLA_STATES.ON_TIME;
};

export const getSlaLabel = (incident, warningPercent, now) =>
  SLA_LABELS[getSlaState(incident, warningPercent, now)];
