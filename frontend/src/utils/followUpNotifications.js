const STORAGE_PREFIX = "incident-followups-read";
export const FOLLOW_UP_READ_EVENT = "incident-followups-read";

const getUserKey = (user) => user?.id || user?._id || user?.email || "anonymous";
const getIncidentId = (incident) => incident?._id || incident?.id;

const getStorageKey = (user) => `${STORAGE_PREFIX}:${getUserKey(user)}`;

const readSeenMap = (user) => {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(user)) || "{}");
  } catch {
    return {};
  }
};

const writeSeenMap = (user, value) => {
  localStorage.setItem(getStorageKey(user), JSON.stringify(value));
};

export const getFollowUpSignature = (incident) => {
  const comments = Array.isArray(incident?.comments) ? incident.comments : [];
  const latestCommentAt = comments.reduce((latest, comment) => {
    const time = new Date(comment?.createdAt || 0).getTime();
    return Number.isFinite(time) && time > latest ? time : latest;
  }, 0);

  return comments.length > 0 ? `${comments.length}:${latestCommentAt}` : "";
};

export const hasUnreadFollowUp = (incident, user) => {
  const incidentId = getIncidentId(incident);
  const signature = getFollowUpSignature(incident);

  if (!incidentId || !signature) return false;

  return readSeenMap(user)[incidentId] !== signature;
};

export const getUnreadFollowUpIncidents = (incidents = [], user) =>
  incidents.filter((incident) => hasUnreadFollowUp(incident, user));

export const markIncidentFollowUpsRead = (incident, user) => {
  const incidentId = getIncidentId(incident);
  const signature = getFollowUpSignature(incident);

  if (!incidentId || !signature) return;

  const seen = readSeenMap(user);
  if (seen[incidentId] === signature) return;

  writeSeenMap(user, { ...seen, [incidentId]: signature });
  window.dispatchEvent(new Event(FOLLOW_UP_READ_EVENT));
};
