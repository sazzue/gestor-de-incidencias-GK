import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { hasPermission } from "../config/permissions";
import { useAuthUser } from "../hooks/useAuthUser";
import { exportPdfReport } from "../utils/pdfReport";

const API_URL = import.meta.env.VITE_API_URL;
const normalizeDepartment = (department) =>
  department?.toString().trim().toLowerCase() || "";

function MaintenanceCalendar() {
  const [date, setDate] = useState(new Date());
  const [maintenances, setMaintenances] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [branch, setBranch] = useState("");
  const [maintenanceDepartment, setMaintenanceDepartment] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [message, setMessage] = useState(null);
  const [modalMessage, setModalMessage] = useState(null);
  const [confirmingMaintenance, setConfirmingMaintenance] = useState(null);
  const [approvalComment, setApprovalComment] = useState("");

  const token = localStorage.getItem("token");
  const user = useAuthUser();

  const canCreate =
    hasPermission(user, "CREATE_MAINTENANCE");

  const canConfirm =
    hasPermission(user, "CONFIRM_MAINTENANCE");
  const canViewMaintenanceComments =
    hasPermission(user, "VIEW_MAINTENANCE_COMMENTS");
  const canCommentMaintenance =
    hasPermission(user, "COMMENT_MAINTENANCE");

  const userDepartment = normalizeDepartment(user?.department);
  const isMaintenanceDepartmentUser =
    hasPermission(user, "VIEW_MAINTENANCE_DEPARTMENT") &&
    Boolean(userDepartment);
  const canChooseDepartment = canCreate && user?.accessScopes?.maintenance !== "department";
  const canCreateMaintenance = canCreate;
  const departmentOptions = departments.map((department) => ({
    value: normalizeDepartment(department.name),
    label: department.name,
  }));
  if (
    userDepartment &&
    !departmentOptions.some((department) => department.value === userDepartment)
  ) {
    departmentOptions.push({ value: userDepartment, label: user.department });
  }
  const getDepartmentLabel = (department) =>
    departmentOptions.find((item) => item.value === normalizeDepartment(department))?.label ||
    department ||
    "Sin departamento";

  const getUserBranchIds = () => {
    const userBranches = Array.isArray(user?.branches) ? user.branches : [];
    if (userBranches.length > 0) {
      return userBranches.map((item) => item?._id || item).filter(Boolean);
    }

    const singleBranch = user?.branch?._id || user?.branch;
    return singleBranch ? [singleBranch] : [];
  };

  const canConfirmMaintenance = (maintenance) => {
    if (!canConfirm) return false;
    if (hasPermission(user, "VIEW_MAINTENANCE_ALL")) return true;

    if (hasPermission(user, "VIEW_MAINTENANCE_DEPARTMENT")) {
      return (
        isMaintenanceDepartmentUser &&
        normalizeDepartment(maintenance?.department) === userDepartment
      );
    }

    if (hasPermission(user, "VIEW_MAINTENANCE_BRANCH")) {
      const maintenanceBranch = maintenance?.branch?._id || maintenance?.branch;
      return getUserBranchIds().includes(maintenanceBranch);
    }

    return true;
  };

  const toLocalDate = (d) => new Date(d).toLocaleDateString("sv-SE");

  const exportFilteredToPdf = () => {
    if (filtered.length === 0) { alert("No hay datos para exportar"); return; }
    const rows = filtered.map((m) => ({
      title: m.title,
      description: m.description,
      branch: m.branch?.name || "Sin sucursal",
      department: getDepartmentLabel(m.department),
      status: m.status,
      date: new Date(m.date).toLocaleDateString("es-MX"),
      confirmedBy: m.confirmedBy?.nombre || m.confirmedBy?.email || "",
    }));
    const branchName = branches.find((b) => b._id === selectedBranch)?.name || "todas";
    exportPdfReport({
      title: "Reporte de mantenimientos",
      subtitle: `Sucursal: ${branchName}`,
      summary: [
        { label: "Total", value: filtered.length },
        { label: "Programados", value: filtered.filter((item) => item.status === "programado").length },
        { label: "Finalizados", value: filtered.filter((item) => item.status === "finalizado").length },
        { label: "Fecha vista", value: date.toLocaleDateString("es-MX") },
      ],
      columns: [
        { key: "title", label: "Titulo" },
        { key: "description", label: "Descripcion" },
        { key: "branch", label: "Sucursal" },
        { key: "department", label: "Departamento" },
        { key: "status", label: "Estado" },
        { key: "date", label: "Fecha" },
        { key: "confirmedBy", label: "Confirmado por" },
      ],
      rows,
    });
  };

  async function fetchData() {
    try {
      const res = await fetch(`${API_URL}/api/maintenance`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMaintenances(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando mantenimientos:", error);
    }
  }

  function filterByDate(data, selectedDate) {
    let result = [...data];
    const selected = toLocalDate(selectedDate);
    switch (filterStatus) {
      case "day": result = result.filter((m) => toLocalDate(m.date) === selected); break;
      case "day-programado": result = result.filter((m) => toLocalDate(m.date) === selected && m.status === "programado"); break;
      case "day-finalizado": result = result.filter((m) => toLocalDate(m.date) === selected && m.status === "finalizado"); break;
      case "programado":
      case "finalizado": result = result.filter((m) => m.status === filterStatus); break;
    }
    if (selectedBranch) result = result.filter((m) => m.branch?._id === selectedBranch);
    if (selectedDepartment) result = result.filter((m) => normalizeDepartment(m.department) === selectedDepartment);
    setFiltered(result);
  }

  const createMaintenance = async () => {
    setModalMessage(null);
    setMessage(null);
    const departmentToSave = isMaintenanceDepartmentUser && !canChooseDepartment ? userDepartment : maintenanceDepartment;

    if (!title || !description || !branch || !departmentToSave || !dateInput) {
      setModalMessage({
        type: "error",
        title: "Faltan campos obligatorios",
        detail: "Titulo, descripcion, sucursal, departamento y fecha son obligatorios."
      });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          description,
          branch,
          department: departmentToSave,
          date: dateInput + "T12:00:00",
          status: "programado"
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalMessage({
          type: "error",
          title: data.msg || "No se pudo crear el mantenimiento",
          detail: data.error || `Error ${res.status}`
        });
        return;
      }
      setMaintenances((prev) => { const updated = [...prev, data]; filterByDate(updated, date); return updated; });
      setShowModal(false);
      setMessage({
        type: "success",
        title: "Mantenimiento creado correctamente",
        detail: "El mantenimiento quedo programado."
      });
      setTitle(""); setDescription(""); setBranch(""); setMaintenanceDepartment(""); setDateInput("");
    } catch (error) {
      console.error("Error creando mantenimiento:", error);
      setModalMessage({
        type: "error",
        title: "Error de conexion",
        detail: "No se pudo conectar con el servidor."
      });
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isMaintenanceDepartmentUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMaintenanceDepartment(userDepartment);
    }
  }, [isMaintenanceDepartmentUser, userDepartment]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    filterByDate(maintenances, date);
  }, [filterStatus, date, maintenances, selectedBranch, selectedDepartment]);

  useEffect(() => {
    fetch(`${API_URL}/api/branches`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setBranches(data))
      .catch(err => console.error(err));

    fetch(`${API_URL}/api/departments`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setDepartments(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  }, []);

  const confirmMaintenance = async (id, comment = "") => {
    try {
      const res = await fetch(`${API_URL}/api/maintenance/${id}/confirm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comment }),
      });
      const updated = await res.json();
      if (!res.ok) {
        setMessage({
          type: "error",
          title: updated.msg || "No se pudo confirmar el mantenimiento",
          detail: updated.error || `Error ${res.status}`
        });
        return;
      }
      setMaintenances((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
      setMessage({
        type: "success",
        title: "Mantenimiento confirmado",
        detail: "El estado cambio a finalizado."
      });
      setConfirmingMaintenance(null);
      setApprovalComment("");
    } catch (error) {
      console.error("Error confirmando:", error);
      setMessage({
        type: "error",
        title: "Error de conexion",
        detail: "No se pudo conectar con el servidor."
      });
    }
  };

  const openConfirmMaintenance = (maintenance) => {
    if (canCommentMaintenance) {
      setConfirmingMaintenance(maintenance);
      setApprovalComment("");
      return;
    }

    confirmMaintenance(maintenance._id);
  };

  return (
    <>
      <div className="layout-calendar">
        {/* IZQUIERDA */}
        <div className="calendar-panel">
          <h2>Mantenimientos</h2>
          {message && (
            <div className={`notice ${message.type}`}>
              <b>{message.title}</b>
              <span>{message.detail}</span>
            </div>
          )}
          <Calendar onChange={setDate} value={date} />

          <div className="filters">
            <button className={filterStatus === "all" ? "active" : ""} onClick={() => setFilterStatus("all")}>Todos</button>
            <button className={filterStatus === "programado" ? "active" : ""} onClick={() => setFilterStatus("programado")}>Programados</button>
            <button className={filterStatus === "finalizado" ? "active" : ""} onClick={() => setFilterStatus("finalizado")}>Finalizados</button>
            <button className={filterStatus === "day" ? "active" : ""} onClick={() => setFilterStatus("day")}>Este dia</button>
            <button className={filterStatus === "day-programado" ? "active" : ""} onClick={() => setFilterStatus("day-programado")}>Programados hoy</button>
            <button className={filterStatus === "day-finalizado" ? "active" : ""} onClick={() => setFilterStatus("day-finalizado")}>Finalizados hoy</button>

            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (<option key={b._id} value={b._id}>{b.name}</option>))}
            </select>

            {(canChooseDepartment || hasPermission(user, "VIEW_MAINTENANCE_BRANCH")) && (
              <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)}>
                <option value="">Todos los departamentos</option>
                {departmentOptions.map((dep) => (
                  <option key={dep.value} value={dep.value}>{dep.label}</option>
                ))}
              </select>
            )}
          </div>

          <button disabled={!canCreateMaintenance} className="create-btn" onClick={() => setShowModal(true)}>
            {canCreateMaintenance ? "Programar mantenimiento" : "Sin permiso para programar mantenimientos"}
          </button>

          <button onClick={exportFilteredToPdf} className="export-btn">Exportar PDF</button>
        </div>

        {/* DERECHA */}
        <div className="events-panel">
          <h3>Eventos del dia</h3>
          {filtered.length === 0 ? (
            <div className="empty"><p>No hay mantenimientos</p></div>
          ) : (
            filtered.map((m) => (
              <div key={m._id} className="event-card">
                <div className="event-header">
                  <h4>{m.title}</h4>
                  <span className={`status ${m.status}`}>{m.status}</span>
                </div>
                <p className="branch">{m.branch?.name}</p>
                <p className="department">{getDepartmentLabel(m.department)}</p>
                <p className="desc">{m.description}</p>
                {canViewMaintenanceComments && m.approvalComment?.text && (
                  <div className="approval-comment">
                    <strong>Comentario de autorizacion</strong>
                    <p>{m.approvalComment.text}</p>
                    <small>
                      {m.approvalComment.createdBy?.nombre || m.approvalComment.createdBy?.email || "Usuario"} · {" "}
                      {m.approvalComment.createdAt ? new Date(m.approvalComment.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : ""}
                    </small>
                  </div>
                )}
                <div className="footer">
                  <small>{new Date(m.date).toLocaleDateString("es-MX")}</small>
                  {m.status === "finalizado" && m.confirmedBy && (
                    <small className="confirmed-text">Confirmado por: {m.confirmedBy.nombre || m.confirmedBy.email}</small>
                  )}
                  {canConfirmMaintenance(m) && m.status === "programado" && (
                    <button className="confirm-btn" onClick={() => openConfirmMaintenance(m)}>
                      {canCommentMaintenance ? "Autorizar y comentar" : "Confirmar"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Nuevo mantenimiento</h3>
            {modalMessage && (
              <div className={`notice ${modalMessage.type}`}>
                <b>{modalMessage.title}</b>
                <span>{modalMessage.detail}</span>
              </div>
            )}
            <input type="text" placeholder="Titulo" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Sucursal</option>
              {branches.map((b) => (<option key={b._id} value={b._id}>{b.name}</option>))}
            </select>
            <select
              value={isMaintenanceDepartmentUser && !canChooseDepartment ? userDepartment : maintenanceDepartment}
              onChange={(e) => setMaintenanceDepartment(e.target.value)}
              disabled={isMaintenanceDepartmentUser && !canChooseDepartment}
            >
              <option value="">Departamento</option>
              {departmentOptions.map((dep) => (
                <option key={dep.value} value={dep.value}>{dep.label}</option>
              ))}
            </select>
            <textarea placeholder="Descripcion" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
            <div className="modal-buttons">
              <button onClick={createMaintenance}>Guardar</button>
              <button onClick={() => setShowModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {confirmingMaintenance && (
        <div className="modal">
          <div className="modal-content">
            <h3>Autorizar mantenimiento</h3>
            <p className="modal-hint">{confirmingMaintenance.title}</p>
            <textarea
              placeholder="Comentario de autorizacion..."
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              rows={4}
            />
            <div className="modal-buttons">
              <button onClick={() => confirmMaintenance(confirmingMaintenance._id, approvalComment)}>
                Autorizar
              </button>
              <button onClick={() => { setConfirmingMaintenance(null); setApprovalComment(""); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .layout-calendar {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 20px;
          padding: 28px;
          min-height: 100vh;
          color: #fff;
        }

        .calendar-panel, .events-panel {
          background: rgba(255,255,255,0.05);
          padding: 20px;
          border-radius: 16px;
        }

        .notice {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin: 10px 0;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 13px;
          border: 1px solid transparent;
        }
        .notice.success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: #86efac; }
        .notice.error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
        .notice span { color: #cbd5e1; }

        .filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        .filters button {
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          font-size: 12px;
          transition: 0.2s;
        }

        .filters button.active, .filters button:hover {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .filters select {
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.1);
          background: var(--app-input);
          color: #e2e8f0;
          font-size: 12px;
        }

        .export-btn {
          margin-top: 10px;
          padding: 10px;
          border-radius: 8px;
          border: none;
          background: #22c55e;
          color: white;
          cursor: pointer;
          width: 100%;
          font-size: 14px;
        }

        .event-card {
          background: rgba(255,255,255,0.05);
          padding: 15px;
          border-radius: 10px;
          margin-bottom: 10px;
        }

        .department {
          color: #93c5fd;
          font-size: 12px;
          font-weight: 600;
          margin-top: 3px;
        }

        .event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .status {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
        }

        .status.programado { background: rgba(245,158,11,0.2); color: #f59e0b; }
        .status.finalizado { background: rgba(34,197,94,0.2); color: #22c55e; }

        .footer {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .confirmed-text { color: #22c55e; font-size: 12px; }

        .approval-comment {
          margin-top: 10px;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid rgba(96,165,250,0.2);
          background: rgba(96,165,250,0.08);
        }
        .approval-comment strong {
          display: block;
          color: #bfdbfe;
          font-size: 12px;
          margin-bottom: 6px;
        }
        .approval-comment p {
          color: #e2e8f0;
          font-size: 12px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .approval-comment small {
          display: block;
          color: #94a3b8;
          font-size: 11px;
          margin-top: 6px;
        }

        .confirm-btn {
          background: #22c55e;
          border: none;
          padding: 6px 10px;
          border-radius: 6px;
          color: white;
          cursor: pointer;
        }

        .create-btn {
          margin-top: 15px;
          padding: 10px;
          width: 100%;
          border-radius: 8px;
          border: none;
          background: #3b82f6;
          color: white;
          cursor: pointer;
        }

        .create-btn:disabled {
          background: #475569;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .modal {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0,0,0,0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 999;
        }

        .modal-content {
          background: #1e293b;
          padding: 24px;
          border-radius: 12px;
          width: 90%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .modal-hint {
          color: #cbd5e1;
          font-size: 13px;
          line-height: 1.4;
        }

        .modal-content input,
        .modal-content textarea,
        .modal-content select {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #334155;
          background: var(--app-input);
          color: white;
          font-size: 14px;
        }

        .modal-buttons { display: flex; gap: 10px; margin-top: 6px; }
        .modal-buttons button:first-child { background: #3b82f6; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; flex: 1; }
        .modal-buttons button:last-child { background: #ef4444; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; flex: 1; }

        @media (max-width: 1024px) {
          .layout-calendar { grid-template-columns: 250px 1fr; }
        }

        @media (max-width: 768px) {
          .layout-calendar { grid-template-columns: 1fr; padding: 16px; }
        }
      `}</style>
    </>
  );
}

export default MaintenanceCalendar;
