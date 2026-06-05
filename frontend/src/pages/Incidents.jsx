import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import { exportPdfReport } from "../utils/pdfReport";

const API_URL = import.meta.env.VITE_API_URL;

function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [filteredIncidents, setFilteredIncidents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [uploadingIncidentId, setUploadingIncidentId] = useState(null);
  const [resolutionComments, setResolutionComments] = useState({});

  const navigate = useNavigate();
  const user = useAuthUser();

  const formatDate = (date) =>
    new Date(date).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  const getResolvedDate = (incident) =>
    incident.resolvedAt || (incident.status === "resuelto" ? incident.updatedAt : null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetchIncidents();
    fetchBranches();
    fetchDepartments();
  }, [user]);

  useEffect(() => {
    if (
      user?.permissions?.includes("VIEW_INCIDENTS_DEPARTMENT") &&
      !user?.permissions?.includes("VIEW_INCIDENTS_ALL") &&
      !user?.permissions?.includes("VIEW_INCIDENTS_BRANCH")
    ) {
      setFilterDept(user.department?.toLowerCase().trim());
    }
  }, [user]);

  useEffect(() => {
    filterIncidents();
  }, [incidents, selectedBranch, filterDept, filterStatus, startDate, endDate]);

  const fetchIncidents = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setIncidents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBranches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando sucursales:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando departamentos:", error);
    }
  };

  const filterIncidents = () => {
    let result = [...incidents];

    if (selectedBranch) {
      result = result.filter((i) => {
        if (i.branch?._id) return i.branch._id === selectedBranch;
        if (typeof i.branch === "string") return i.branch === selectedBranch;
        return false;
      });
    }

    if (filterDept) {
      result = result.filter(
        (i) => i.department && i.department.toLowerCase().trim() === filterDept
      );
    }

    if (filterStatus) result = result.filter((i) => i.status === filterStatus);

    if (startDate)
      result = result.filter((i) => new Date(i.createdAt) >= new Date(startDate));

    if (endDate)
      result = result.filter(
        (i) => new Date(i.createdAt) <= new Date(endDate + "T23:59:59")
      );

    setFilteredIncidents(result);
  };

  const exportIncidentsPdf = () => {
    if (filteredIncidents.length === 0) { alert("No hay incidencias para exportar"); return; }
    const rows = filteredIncidents.map((i) => ({
      title: i.title,
      description: i.description,
      branch: i.branch?.name || i.branch || "Sin sucursal",
      department: i.department?.name || i.department || "Sin departamento",
      status: i.status?.replace("_", " ") || "",
      createdAt: new Date(i.createdAt).toLocaleDateString("es-MX"),
      resolvedAt: getResolvedDate(i)
        ? new Date(getResolvedDate(i)).toLocaleDateString("es-MX")
        : "",
    }));
    const branchName = branches.find((b) => b._id === selectedBranch)?.name || "todas";
    exportPdfReport({
      title: "Reporte de incidencias",
      subtitle: `Sucursal: ${branchName}`,
      summary: [
        { label: "Total", value: filteredIncidents.length },
        { label: "Pendientes", value: filteredIncidents.filter((item) => item.status === "pendiente").length },
        { label: "En proceso", value: filteredIncidents.filter((item) => item.status === "en_proceso").length },
        { label: "Resueltas", value: filteredIncidents.filter((item) => item.status === "resuelto").length },
      ],
      columns: [
        { key: "title", label: "Titulo" },
        { key: "description", label: "Descripcion" },
        { key: "branch", label: "Sucursal" },
        { key: "department", label: "Departamento" },
        { key: "status", label: "Estado" },
        { key: "createdAt", label: "Fecha" },
        { key: "resolvedAt", label: "Resuelto" },
      ],
      rows,
    });
  };

  const canViewComments =
    user?.role === "admin" ||
    user?.role === "gerencia" ||
    user?.role === "direccion" ||
    user?.permissions?.includes("VIEW_INCIDENT_COMMENTS");

  const canCommentIncident = (incident) => {
    if (user?.role === "admin") return true;
    if (!user?.permissions?.includes("COMMENT_INCIDENT")) return false;

    return (
      user?.role === "departamento" &&
      user?.department?.toLowerCase().trim() === incident.department?.toLowerCase().trim()
    );
  };

  const updateStatus = async (id, status) => {
    try {
      const token = localStorage.getItem("token");
      const comment = status === "resuelto" ? resolutionComments[id]?.trim() : "";

      await fetch(`${API_URL}/api/incidents/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, comment }),
      });
      if (status === "resuelto") {
        setResolutionComments((current) => ({ ...current, [id]: "" }));
      }
      fetchIncidents();
    } catch (error) {
      console.error(error);
    }
  };

  const downloadAttachment = async (incidentId, attachmentId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/incidents/${incidentId}/attachments/${attachmentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.msg || "No se pudo descargar el archivo");
        return;
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      alert("No se pudo generar el enlace de descarga");
    }
  };

  const uploadAttachments = async (incidentId, files) => {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return;

    try {
      setUploadingIncidentId(incidentId);
      const token = localStorage.getItem("token");
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("attachments", file));

      const res = await fetch(`${API_URL}/api/incidents/${incidentId}/attachments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || data.msg || "No se pudieron subir los archivos");
        return;
      }

      fetchIncidents();
    } catch (error) {
      console.error(error);
      alert("No se pudieron subir los archivos");
    } finally {
      setUploadingIncidentId(null);
    }
  };

  const canUpdate =
    user?.role === "admin" ||
    user?.permissions?.includes("VIEW_INCIDENTS_ALL") ||
    user?.permissions?.includes("VIEW_INCIDENTS_DEPARTMENT");
  const canCreate =
    user?.role === "admin" || user?.permissions?.includes("CREATE_INCIDENT");

  return (
    <div className="page">

      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1>📋 Incidencias</h1>
          <p>Mostrando {filteredIncidents.length} resultados</p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => navigate("/create")}>
            ➕ Crear solicitud
          </button>
        )}
      </div>

      {/* FILTROS */}
      <div className="filters-bar">
        <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>

        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">Todos los departamentos</option>
          {departments.map((dep) => (
            <option key={dep._id} value={dep.name.toLowerCase()}>{dep.name}</option>
          ))}
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_proceso">En proceso</option>
          <option value="resuelto">Resuelto</option>
        </select>

        <input type="date" onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" onChange={(e) => setEndDate(e.target.value)} />

        <button className="btn-export" onClick={exportIncidentsPdf}>Exportar PDF</button>
      </div>

      {/* GRID */}
      <div className="grid">
        {filteredIncidents.map((inc) => (
          <div key={inc._id} className="card">
            <div className="card-top">
              <h3>{inc.title}</h3>
              <span className={`status ${inc.status}`}>
                {inc.status.replace("_", " ")}
              </span>
            </div>

            <p className="desc">{inc.description}</p>

            <div className="meta">
              {getResolvedDate(inc) && <span>Resuelto: {formatDate(getResolvedDate(inc))}</span>}
              <span>📍 {inc.branch?.name || inc.branch || "Sin sucursal"}</span>
              <span>🏢 {inc.department || "Sin departamento"}</span>
              <span>📅 {formatDate(inc.createdAt)}</span>
              <span>👤 {inc.createdBy?.nombre || inc.createdBy?.email}</span>
            </div>

            {inc.attachments?.length > 0 && (
              <div className="attachments">
                <strong>Archivos</strong>
                {inc.attachments.map((file) => (
                  <button
                    key={file._id}
                    className="attachment-link"
                    onClick={() => downloadAttachment(inc._id, file._id)}
                  >
                    {file.originalName}
                  </button>
                ))}
              </div>
            )}

            {canViewComments && inc.resolutionComment?.text && (
              <div className="comment-box read-only">
                <strong>Comentario de cierre</strong>
                <p>{inc.resolutionComment.text}</p>
                <small>
                  {inc.resolutionComment.createdBy?.nombre || inc.resolutionComment.createdBy?.email || "Usuario"} · {" "}
                  {inc.resolutionComment.createdAt ? formatDate(inc.resolutionComment.createdAt) : ""}
                </small>
              </div>
            )}

            {inc.status !== "resuelto" && canCommentIncident(inc) && (
              <div className="comment-box">
                <label>
                  Comentario de cierre
                  <textarea
                    value={resolutionComments[inc._id] || ""}
                    onChange={(e) => setResolutionComments((current) => ({
                      ...current,
                      [inc._id]: e.target.value,
                    }))}
                    placeholder="Describe que se realizo antes de cerrar..."
                    rows={3}
                  />
                </label>
              </div>
            )}

            <label className={`upload-files ${uploadingIncidentId === inc._id ? "loading" : ""}`}>
              {uploadingIncidentId === inc._id ? "Subiendo..." : "Subir archivos"}
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.csv"
                disabled={uploadingIncidentId === inc._id}
                onChange={(e) => {
                  uploadAttachments(inc._id, e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="upload-hint">Max. 5 MB por archivo, 10 archivos, 30 MB por incidencia.</span>

            <div className="actions">
              {inc.status === "resuelto" ? (
                <span className="closed-status">Cerrada</span>
              ) : canUpdate ? (
                <>
                  <button className="btn-process" onClick={() => updateStatus(inc._id, "en_proceso")}>
                    En proceso
                  </button>
                  <button className="btn-done" onClick={() => updateStatus(inc._id, "resuelto")}>
                    Resolver
                  </button>
                </>
              ) : (
                <span className="no-perm">🔒 Sin autorización</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .page {
          width: 100%;
          max-width: 100%;
          min-height: 100vh;
          padding: 28px;
          color: #fff;
          overflow-x: hidden;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .page-header h1 { font-size: 22px; }
        .page-header p { font-size: 13px; color: #64748b; margin-top: 4px; }

        .btn-primary {
          padding: 10px 18px;
          border-radius: 8px;
          border: none;
          background: #3b82f6;
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: 0.2s;
        }
        .btn-primary:hover { background: #2563eb; transform: translateY(-1px); }

        .filters-bar {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 24px;
          padding: 16px;
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .filters-bar select,
        .filters-bar input {
          flex: 1 1 180px;
          min-width: 0;
          padding: 9px 12px;
          border-radius: 8px;
          border: 1px solid #1e293b;
          background: var(--app-input);
          color: #e2e8f0;
          font-size: 13px;
          transition: 0.2s;
        }
        .filters-bar select:focus,
        .filters-bar input:focus {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
        }

        .btn-export {
          flex: 1 1 160px;
          min-width: 0;
          padding: 9px 14px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: 0.2s;
        }
        .btn-export:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(34,197,94,0.3); }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
          gap: 16px;
          width: 100%;
          max-width: 100%;
        }

        .card {
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 18px;
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: 0.25s;
        }
        .card:hover {
          transform: translateY(-3px);
          background: rgba(255,255,255,0.07);
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          min-width: 0;
        }
        .card-top h3 {
          flex: 1 1 auto;
          min-width: 0;
          font-size: 15px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .desc {
          min-width: 0;
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.5;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .meta {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          color: #64748b;
        }
        .meta span {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .attachments {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
          color: #94a3b8;
        }

        .comment-box {
          min-width: 0;
          padding: 10px;
          border: 1px solid rgba(96,165,250,0.18);
          border-radius: 8px;
          background: rgba(96,165,250,0.06);
          font-size: 12px;
        }
        .comment-box label {
          display: flex;
          flex-direction: column;
          gap: 7px;
          color: #bfdbfe;
          font-weight: 700;
        }
        .comment-box textarea {
          width: 100%;
          min-width: 0;
          padding: 9px 10px;
          border-radius: 7px;
          border: 1px solid rgba(148,163,184,0.25);
          background: var(--app-input);
          color: #e2e8f0;
          resize: vertical;
          font-family: inherit;
          font-size: 12px;
        }
        .comment-box.read-only strong {
          display: block;
          color: #bfdbfe;
          margin-bottom: 6px;
        }
        .comment-box.read-only p {
          color: #e2e8f0;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .comment-box.read-only small {
          display: block;
          color: #94a3b8;
          margin-top: 6px;
        }

        .attachment-link {
          width: 100%;
          padding: 7px 9px;
          border-radius: 7px;
          border: 1px solid rgba(96,165,250,0.25);
          background: rgba(96,165,250,0.08);
          color: #bfdbfe;
          cursor: pointer;
          font-size: 12px;
          text-align: left;
          overflow-wrap: anywhere;
        }
        .attachment-link:hover { border-color: rgba(96,165,250,0.55); color: #fff; }

        .upload-files {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          min-height: 34px;
          padding: 8px 10px;
          border-radius: 7px;
          border: 1px dashed rgba(148,163,184,0.35);
          background: rgba(148,163,184,0.06);
          color: #cbd5e1;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          text-align: center;
          transition: 0.2s;
        }
        .upload-files:hover { border-color: rgba(96,165,250,0.6); color: #fff; }
        .upload-files.loading { opacity: 0.65; cursor: wait; }
        .upload-files input { display: none; }

        .upload-hint {
          display: block;
          max-width: 100%;
          color: #64748b;
          font-size: 11px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .status {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
          white-space: nowrap;
        }
        .pendiente  { background: rgba(239,68,68,0.15);  color: #ef4444; }
        .en_proceso { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .resuelto   { background: rgba(34,197,94,0.15);  color: #22c55e; }

        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          min-width: 0;
          margin-top: 4px;
        }

        .btn-process {
          background: rgba(245,158,11,0.12);
          border: 1px solid rgba(245,158,11,0.35);
          padding: 6px 12px; border-radius: 7px;
          color: #f59e0b; cursor: pointer; font-size: 13px; transition: 0.2s;
        }
        .btn-process:hover { background: #f59e0b; color: #000; }

        .btn-done {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          padding: 6px 12px; border-radius: 7px;
          color: #22c55e; cursor: pointer; font-size: 13px; transition: 0.2s;
        }
        .btn-done:hover { background: #22c55e; color: #000; }

        .no-perm { font-size: 12px; color: #475569; }
        .closed-status {
          font-size: 12px;
          color: #86efac;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.25);
          border-radius: 7px;
          padding: 6px 10px;
        }

        @media (max-width: 600px) {
          .page { padding: 14px; }
          .grid { grid-template-columns: minmax(0, 1fr); }
          .card { padding: 16px; border-radius: 12px; }
          .filters-bar { flex-direction: column; }
          .filters-bar select,
          .filters-bar input,
          .btn-export {
            width: 100%;
            flex-basis: auto;
          }
        }
      `}</style>
    </div>
  );
}

export default Incidents;
