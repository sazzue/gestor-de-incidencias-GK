import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";

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
  const [updating, setUpdating] = useState(false);

  const token = localStorage.getItem("token");

  const canViewComments =
    user?.role === "admin" ||
    user?.role === "gerencia" ||
    user?.role === "direccion" ||
    user?.permissions?.includes("VIEW_INCIDENT_COMMENTS");

  const canUpdate =
    user?.role === "admin" ||
    user?.permissions?.includes("VIEW_INCIDENTS_ALL") ||
    user?.permissions?.includes("VIEW_INCIDENTS_DEPARTMENT");

  const canCommentIncident = useMemo(() => {
    if (user?.role === "admin") return true;
    if (!user?.permissions?.includes("COMMENT_INCIDENT")) return false;

    return (
      user?.role === "departamento" &&
      user?.department?.toLowerCase().trim() === incident?.department?.toLowerCase().trim()
    );
  }, [incident, user]);

  const formatDate = (date) =>
    date
      ? new Date(date).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
      : "Sin fecha";

  const getResolvedDate = (item) =>
    item?.resolvedAt || (item?.status === "resuelto" ? item?.updatedAt : null);

  const slaState = useMemo(() => {
    if (!incident?.dueAt || incident.status === "resuelto") return "ok";
    return new Date(incident.dueAt).getTime() < Date.now() ? "late" : "ok";
  }, [incident]);

  const fetchIncident = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/incidents/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchIncident();
  }, [id, token]);

  const updateStatus = async (status) => {
    try {
      setUpdating(true);
      setMessage(null);
      const res = await fetch(`${API_URL}/api/incidents/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

  const downloadAttachment = async (attachmentId) => {
    try {
      const res = await fetch(`${API_URL}/api/incidents/${id}/attachments/${attachmentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
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
            <span><b>Sucursal</b>{incident.branch?.name || incident.branch || "Sin sucursal"}</span>
            <span><b>Departamento</b>{incident.department || "Sin departamento"}</span>
            <span><b>Creado por</b>{incident.createdBy?.nombre || incident.createdBy?.email || "Usuario"}</span>
            <span><b>Creacion</b>{formatDate(incident.createdAt)}</span>
            <span><b>Resolucion</b>{getResolvedDate(incident) ? formatDate(getResolvedDate(incident)) : "Pendiente"}</span>
          </div>

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
