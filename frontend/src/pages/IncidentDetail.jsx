import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { hasPermission } from "../config/permissions";
import { useAuthUser } from "../hooks/useAuthUser";
import { markIncidentFollowUpsRead } from "../utils/followUpNotifications";

const API_URL = import.meta.env.VITE_API_URL;

const priorityLabels = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Critica",
};

function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthUser();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [resolutionComment, setResolutionComment] = useState("");
  const [followUpComment, setFollowUpComment] = useState("");
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const canViewComments =
    hasPermission(user, "VIEW_INCIDENT_COMMENTS");

  const canUpdate =
    hasPermission(user, "VIEW_INCIDENTS_ALL") ||
    hasPermission(user, "VIEW_INCIDENTS_DEPARTMENT");

  const canAssign =
    hasPermission(user, "INCIDENTS_ASSIGN");

  const canCommentIncident = useMemo(() => {
    if (!hasPermission(user, "COMMENT_INCIDENT")) return false;
    if (hasPermission(user, "VIEW_INCIDENTS_ALL") || hasPermission(user, "VIEW_INCIDENTS_BRANCH")) return true;

    return (
      user?.department?.toLowerCase().trim() === incident?.department?.toLowerCase().trim()
    );
  }, [incident, user]);

  const formatDate = (date) =>
    date
      ? new Date(date).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
      : "Sin fecha";

  const getResolvedDate = (item) =>
    item?.resolvedAt || (item?.status === "resuelto" ? item?.updatedAt : null);

  const [now] = useState(() => Date.now());

  const slaState = useMemo(() => {
    if (!incident?.dueAt || incident.status === "resuelto") return "ok";
    return new Date(incident.dueAt).getTime() < now ? "late" : "ok";
  }, [incident, now]);

  const fetchIncident = useCallback(async ({ showLoader = false } = {}) => {
    try {
      if (showLoader) setLoading(true);
      const currentToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/incidents/${id}`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudo cargar la incidencia" });
        setIncident(null);
        return;
      }

      setIncident(data);
    } catch {
      setMessage({ type: "error", title: "Error de conexion con el servidor" });
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [id]);

  const fetchAssignableUsers = useCallback(async () => {
    try {
      const currentToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/incidents/assignees`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await res.json();

      if (res.ok) {
        setAssignableUsers(Array.isArray(data) ? data : []);
      }
    } catch {
      setAssignableUsers([]);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem("token")) {
      fetchIncident({ showLoader: true });
      if (canAssign) fetchAssignableUsers();
    }
  }, [canAssign, fetchAssignableUsers, fetchIncident]);

  useEffect(() => {
    if (incident && user) {
      markIncidentFollowUpsRead(incident, user);
    }
  }, [incident, user]);

  const updateStatus = async (status) => {
    try {
      setUpdating(true);
      setMessage(null);
      const currentToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/incidents/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({
          status,
          comment: status === "resuelto" ? resolutionComment : "",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudo actualizar el ticket" });
        return;
      }

      setResolutionComment("");
      await fetchIncident();
      setMessage({ type: "success", title: "Ticket actualizado" });
    } catch {
      setMessage({ type: "error", title: "Error de conexion con el servidor" });
    } finally {
      setUpdating(false);
    }
  };

  const assignIncident = async (assignedTo) => {
    try {
      setAssigning(true);
      setMessage(null);
      const currentToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/incidents/${id}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({ assignedTo: assignedTo || null }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudo asignar el ticket" });
        return;
      }

      setIncident(data);
      setMessage({ type: "success", title: "Responsable actualizado" });
    } catch {
      setMessage({ type: "error", title: "Error de conexion con el servidor" });
    } finally {
      setAssigning(false);
    }
  };

  const addFollowUpComment = async () => {
    const text = followUpComment.trim();

    if (!text) {
      setMessage({ type: "error", title: "Escribe un comentario de seguimiento" });
      return;
    }

    try {
      setCommenting(true);
      setMessage(null);
      const currentToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/incidents/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudo agregar el comentario" });
        return;
      }

      setIncident(data);
      setFollowUpComment("");
      setMessage({ type: "success", title: "Comentario agregado" });
    } catch {
      setMessage({ type: "error", title: "Error de conexion con el servidor" });
    } finally {
      setCommenting(false);
    }
  };

  const downloadAttachment = async (attachmentId) => {
    try {
      const currentToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/incidents/${id}/attachments/${attachmentId}/download`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudo descargar el archivo" });
        return;
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      setMessage({ type: "error", title: "No se pudo generar el enlace de descarga" });
    }
  };

  if (loading) {
    return <div className="ticket-page"><div className="empty-state">Cargando ticket...</div></div>;
  }

  if (!incident) {
    return (
      <div className="ticket-page">
        <button className="ghost-btn" onClick={() => navigate("/incidents")}>Volver</button>
        {message && <div className={`notice ${message.type}`}>{message.title}</div>}
      </div>
    );
  }

  return (
    <div className="ticket-page">
      <div className="ticket-header">
        <div>
          <button className="ghost-btn" onClick={() => navigate("/incidents")}>Volver</button>
          <p className="folio">{incident.folio || `INC-${incident._id.slice(-6).toUpperCase()}`}</p>
          <h1>{incident.title}</h1>
        </div>
        <div className="header-badges">
          <span className={`priority ${incident.priority || "media"}`}>
            {priorityLabels[incident.priority] || "Media"}
          </span>
          <span className={`status ${incident.status}`}>{incident.status?.replace("_", " ")}</span>
        </div>
      </div>

      {message && <div className={`notice ${message.type}`}>{message.title}</div>}

      <div className="ticket-grid">
        <section className="main-panel">
          <h2>Descripcion</h2>
          <p>{incident.description}</p>

          {canViewComments && incident.resolutionComment?.text && (
            <div className="comment-box">
              <strong>Comentario de cierre</strong>
              <p>{incident.resolutionComment.text}</p>
              <small>
                {incident.resolutionComment.createdBy?.nombre || incident.resolutionComment.createdBy?.email || "Usuario"} ·{" "}
                {formatDate(incident.resolutionComment.createdAt)}
              </small>
            </div>
          )}

          <div className="section-title">
            <h2>Seguimiento</h2>
            <span>{incident.comments?.length || 0} comentario(s)</span>
          </div>

          <div className="follow-up-form">
            <textarea
              rows={3}
              placeholder="Agrega una nota de seguimiento para este ticket..."
              value={followUpComment}
              onChange={(e) => setFollowUpComment(e.target.value)}
            />
            <button disabled={commenting} onClick={addFollowUpComment}>
              {commenting ? "Guardando..." : "Agregar comentario"}
            </button>
          </div>

          {incident.comments?.length > 0 ? (
            <div className="conversation">
              {[...incident.comments].reverse().map((comment) => (
                <article key={comment._id} className="conversation-item">
                  <div>
                    <strong>{comment.createdBy?.nombre || comment.createdBy?.email || "Usuario"}</strong>
                    <small>{formatDate(comment.createdAt)}</small>
                  </div>
                  <p>{comment.text}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">Aun no hay comentarios de seguimiento.</div>
          )}

          <h2>Archivos</h2>
          {incident.attachments?.length > 0 ? (
            <div className="attachments">
              {incident.attachments.map((file) => (
                <button key={file._id} onClick={() => downloadAttachment(file._id)}>
                  <span>{file.originalName}</span>
                  <small>{formatDate(file.uploadedAt)}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">Sin archivos adjuntos.</div>
          )}
        </section>

        <aside className="side-panel">
          <div className={`sla-card ${slaState}`}>
            <span>SLA</span>
            <strong>{slaState === "late" ? "Vencido" : "En tiempo"}</strong>
            <small>Limite: {formatDate(incident.dueAt)}</small>
          </div>

          <div className="meta-list">
            <span><b>Responsable</b>{incident.assignedTo?.nombre || incident.assignedTo?.email || "Sin asignar"}</span>
            <span><b>Sucursal</b>{incident.branch?.name || incident.branch || "Sin sucursal"}</span>
            <span><b>Departamento</b>{incident.department || "Sin departamento"}</span>
            <span><b>Creado por</b>{incident.createdBy?.nombre || incident.createdBy?.email || "Usuario"}</span>
            <span><b>Creacion</b>{formatDate(incident.createdAt)}</span>
            <span><b>Resolucion</b>{getResolvedDate(incident) ? formatDate(getResolvedDate(incident)) : "Pendiente"}</span>
          </div>

          {canAssign && (
            <label className="assignment-box">
              Responsable
              <select
                value={incident.assignedTo?._id || ""}
                disabled={assigning}
                onChange={(e) => assignIncident(e.target.value)}
              >
                <option value="">Sin asignar</option>
                {assignableUsers.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.nombre || item.email} {item.department ? `- ${item.department}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {incident.status !== "resuelto" && canCommentIncident && (
            <label className="close-comment">
              Comentario de cierre
              <textarea
                rows={4}
                placeholder="Describe que se realizo antes de cerrar..."
                value={resolutionComment}
                onChange={(e) => setResolutionComment(e.target.value)}
              />
            </label>
          )}

          {incident.status !== "resuelto" && canUpdate && (
            <div className="actions">
              <button disabled={updating} onClick={() => updateStatus("en_proceso")}>Marcar en proceso</button>
              <button disabled={updating} className="done" onClick={() => updateStatus("resuelto")}>Resolver ticket</button>
            </div>
          )}

          <div className="timeline">
            <h2>Bitacora</h2>
            {incident.activityLog?.length > 0 ? (
              [...incident.activityLog].reverse().map((event) => (
                <div key={event._id} className="timeline-item">
                  <span />
                  <div>
                    <strong>{event.message}</strong>
                    <small>
                      {event.createdBy?.nombre || event.createdBy?.email || "Sistema"} · {formatDate(event.createdAt)}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">Sin actividad registrada.</div>
            )}
          </div>
        </aside>
      </div>

      <style>{`
        .ticket-page { min-height: 100vh; padding: 28px; color: #fff; }
        .ticket-header {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 18px;
        }
        .ticket-header h1 { font-size: 26px; line-height: 1.2; overflow-wrap: anywhere; }
        .folio { color: #93c5fd; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; margin: 12px 0 5px; }
        .header-badges { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .ghost-btn {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(148,163,184,0.25);
          background: transparent;
          color: #cbd5e1;
          cursor: pointer;
        }
        .ticket-grid { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 18px; }
        .main-panel, .side-panel {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          padding: 20px;
        }
        .main-panel h2 { font-size: 14px; color: #cbd5e1; margin: 0 0 10px; }
        .main-panel p { color: #e2e8f0; line-height: 1.55; margin-bottom: 22px; overflow-wrap: anywhere; }
        .priority, .status {
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          text-transform: capitalize;
        }
        .priority.baja { background: rgba(34,197,94,0.14); color: #86efac; }
        .priority.media { background: rgba(96,165,250,0.14); color: #93c5fd; }
        .priority.alta { background: rgba(245,158,11,0.16); color: #fbbf24; }
        .priority.critica { background: rgba(239,68,68,0.18); color: #fca5a5; }
        .status.pendiente { background: rgba(239,68,68,0.15); color: #f87171; }
        .status.en_proceso { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .status.resuelto { background: rgba(34,197,94,0.15); color: #22c55e; }
        .notice {
          margin-bottom: 16px;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 13px;
          border: 1px solid transparent;
        }
        .notice.success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: #86efac; }
        .notice.error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
        .sla-card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          border: 1px solid rgba(34,197,94,0.24);
          background: rgba(34,197,94,0.08);
        }
        .sla-card.late { border-color: rgba(239,68,68,0.32); background: rgba(239,68,68,0.1); }
        .sla-card span, .sla-card small { color: #94a3b8; font-size: 12px; }
        .sla-card strong { font-size: 22px; color: #e2e8f0; }
        .meta-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
        .meta-list span { display: flex; flex-direction: column; gap: 3px; color: #e2e8f0; font-size: 13px; }
        .meta-list b { color: #94a3b8; font-size: 11px; text-transform: uppercase; }
        .section-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
        }
        .section-title span {
          color: #94a3b8;
          font-size: 12px;
        }
        .follow-up-form {
          display: grid;
          gap: 10px;
          margin-bottom: 14px;
        }
        .follow-up-form textarea,
        .assignment-box select {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #334155;
          background: var(--app-input);
          color: #e2e8f0;
          resize: vertical;
          font: inherit;
        }
        .follow-up-form button {
          justify-self: flex-start;
          padding: 9px 12px;
          border-radius: 8px;
          border: 1px solid rgba(96,165,250,0.35);
          background: rgba(96,165,250,0.12);
          color: #bfdbfe;
          cursor: pointer;
          font-weight: 700;
        }
        .conversation {
          display: grid;
          gap: 10px;
          margin-bottom: 22px;
        }
        .conversation-item {
          padding: 12px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.035);
        }
        .conversation-item div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 7px;
        }
        .conversation-item strong { color: #e2e8f0; font-size: 13px; }
        .conversation-item small { color: #94a3b8; font-size: 11px; white-space: nowrap; }
        .conversation-item p { margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.45; }
        .assignment-box {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid rgba(96,165,250,0.2);
          background: rgba(96,165,250,0.07);
          margin-bottom: 16px;
          color: #bfdbfe;
          font-size: 13px;
          font-weight: 700;
        }
        .attachments { display: grid; gap: 8px; }
        .attachments button {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid rgba(96,165,250,0.25);
          background: rgba(96,165,250,0.08);
          color: #bfdbfe;
          text-align: left;
          cursor: pointer;
        }
        .attachments span { overflow-wrap: anywhere; }
        .attachments small { color: #94a3b8; white-space: nowrap; }
        .comment-box, .close-comment {
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid rgba(96,165,250,0.2);
          background: rgba(96,165,250,0.07);
          margin-bottom: 18px;
          color: #bfdbfe;
          font-size: 13px;
        }
        .comment-box small { color: #94a3b8; }
        .close-comment textarea {
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #334155;
          background: var(--app-input);
          color: #e2e8f0;
          resize: vertical;
          font: inherit;
        }
        .actions { display: grid; gap: 10px; }
        .actions button {
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid rgba(245,158,11,0.35);
          background: rgba(245,158,11,0.12);
          color: #fbbf24;
          cursor: pointer;
          font-weight: 700;
        }
        .actions .done {
          border-color: rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.12);
          color: #86efac;
        }
        .timeline {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .timeline h2 { font-size: 14px; margin-bottom: 12px; color: #e2e8f0; }
        .timeline-item {
          display: grid;
          grid-template-columns: 12px minmax(0, 1fr);
          gap: 10px;
          padding-bottom: 13px;
        }
        .timeline-item > span {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #60a5fa;
          margin-top: 5px;
        }
        .timeline-item strong {
          display: block;
          color: #e2e8f0;
          font-size: 12px;
          overflow-wrap: anywhere;
        }
        .timeline-item small {
          display: block;
          color: #94a3b8;
          font-size: 11px;
          margin-top: 3px;
        }
        .empty-state {
          background: rgba(255,255,255,0.04);
          border: 1px dashed rgba(255,255,255,0.16);
          border-radius: 8px;
          padding: 16px;
          color: #94a3b8;
        }
        @media (max-width: 900px) {
          .ticket-page { padding: 16px; }
          .ticket-grid { grid-template-columns: 1fr; }
          .ticket-header { flex-direction: column; }
          .header-badges { justify-content: flex-start; }
        }
      `}</style>
    </div>
  );
}

export default IncidentDetail;
