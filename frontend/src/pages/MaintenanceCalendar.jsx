import { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { hasPermission } from "../config/permissions";
import { useAuthUser } from "../hooks/useAuthUser";
import { exportPdfReport } from "../utils/pdfReport";

const API_URL = import.meta.env.VITE_API_URL;
const normalizeDepartment = (department) =>
  department?.toString().trim().toLowerCase() || "";
const MAINTENANCE_FILTERS_KEY = "maintenance-filters";
const readStoredFilters = () => {
  try {
    return JSON.parse(sessionStorage.getItem(MAINTENANCE_FILTERS_KEY)) || {};
  } catch {
    return {};
  }
};
const normalizeText = (value) => String(value || "").trim().toLocaleLowerCase("es");
const getLocalDayStart = (value) => new Date(`${value}T00:00:00`);
const getLocalDayEnd = (value) => new Date(`${value}T23:59:59.999`);

function MaintenanceCalendar() {
  const storedFilters = useMemo(() => readStoredFilters(), []);
  const [date, setDate] = useState(new Date());
  const [maintenances, setMaintenances] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filterStatus, setFilterStatus] = useState(storedFilters.filterStatus || "all");
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(storedFilters.searchTerm || "");
  const [selectedBranch, setSelectedBranch] = useState(storedFilters.selectedBranch || "");
  const [selectedDepartment, setSelectedDepartment] = useState(storedFilters.selectedDepartment || "");
  const [startDate, setStartDate] = useState(storedFilters.startDate || "");
  const [endDate, setEndDate] = useState(storedFilters.endDate || "");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [branch, setBranch] = useState("");
  const [maintenanceDepartment, setMaintenanceDepartment] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [message, setMessage] = useState(null);
  const [modalMessage, setModalMessage] = useState(null);
  const [confirmingMaintenance, setConfirmingMaintenance] = useState(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [commentingMaintenance, setCommentingMaintenance] = useState(null);
  const [maintenanceComment, setMaintenanceComment] = useState("");

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
  const canExportMaintenance =
    hasPermission(user, "MAINTENANCE_EXPORT");
  const canDeleteMaintenancePermission =
    hasPermission(user, "DELETE_MAINTENANCE");

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
  const invalidDateRange = Boolean(startDate && endDate && startDate > endDate);
  const filtered = useMemo(() => {
    if (invalidDateRange) return [];

    const query = normalizeText(searchTerm);
    return maintenances.filter((maintenance) => {
      const branchId = String(maintenance.branch?._id || maintenance.branch || "");
      const branchName = maintenance.branch?.name || branches.find((branch) => String(branch._id) === branchId)?.name || "";
      const department = normalizeDepartment(maintenance.department?.name || maintenance.department);
      const searchableValues = [maintenance.title, maintenance.description, branchName, department];

      if (filterStatus !== "all" && maintenance.status !== filterStatus) return false;
      if (selectedBranch && branchId !== selectedBranch) return false;
      if (selectedDepartment && department !== selectedDepartment) return false;
      if (startDate && new Date(maintenance.date) < getLocalDayStart(startDate)) return false;
      if (endDate && new Date(maintenance.date) > getLocalDayEnd(endDate)) return false;
      return !query || searchableValues.some((value) => normalizeText(value).includes(query));
    });
  }, [branches, endDate, filterStatus, invalidDateRange, maintenances, searchTerm, selectedBranch, selectedDepartment, startDate]);

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

  const canDeleteMaintenance = (maintenance) =>
    canDeleteMaintenancePermission && canAccessMaintenanceScope(maintenance);

  const canCommentMaintenanceItem = (maintenance) =>
    canCommentMaintenance && canAccessMaintenanceScope(maintenance);

  const canAccessMaintenanceScope = (maintenance) => {
    const scope = user?.accessScopes?.maintenance;

    if (scope === "all") return true;

    if (scope === "department") {
      return Boolean(
        userDepartment &&
        normalizeDepartment(maintenance?.department) === userDepartment
      );
    }

    if (scope === "branch") {
      const maintenanceBranch = maintenance?.branch?._id || maintenance?.branch;
      return getUserBranchIds().includes(maintenanceBranch?.toString());
    }

    return false;
  };

  const toLocalDate = (d) => new Date(d).toLocaleDateString("sv-SE");

  const exportFilteredToPdf = () => {
    if (!canExportMaintenance) { alert("No tienes permisos para exportar mantenimientos"); return; }
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
      setMaintenances((prev) => [...prev, data]);
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
    sessionStorage.setItem(MAINTENANCE_FILTERS_KEY, JSON.stringify({
      searchTerm,
      filterStatus,
      selectedBranch,
      selectedDepartment,
      startDate,
      endDate,
    }));
  }, [endDate, filterStatus, searchTerm, selectedBranch, selectedDepartment, startDate]);

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

  const addMaintenanceComment = async () => {
    const text = maintenanceComment.trim();

    if (!commentingMaintenance?._id || !text) {
      setMessage({
        type: "error",
        title: "Comentario requerido",
        detail: "Escribe un comentario para guardar el seguimiento."
      });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/maintenance/${commentingMaintenance._id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const updated = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          title: updated.msg || "No se pudo agregar el comentario",
          detail: updated.error || `Error ${res.status}`
        });
        return;
      }

      setMaintenances((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
      setCommentingMaintenance(null);
      setMaintenanceComment("");
      setMessage({
        type: "success",
        title: "Comentario agregado",
        detail: "El seguimiento quedo guardado."
      });
    } catch (error) {
      console.error("Error comentando mantenimiento:", error);
      setMessage({
        type: "error",
        title: "Error de conexion",
        detail: "No se pudo conectar con el servidor."
      });
    }
  };

  const deleteMaintenance = async (maintenance) => {
    if (!maintenance?._id) return;
    if (!confirm(`Eliminar mantenimiento "${maintenance.title}"?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/maintenance/${maintenance._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          title: data.msg || "No se pudo eliminar el mantenimiento",
          detail: data.error || `Error ${res.status}`
        });
        return;
      }

      setMaintenances((prev) => prev.filter((m) => m._id !== maintenance._id));
      setMessage({
        type: "success",
        title: "Mantenimiento eliminado",
        detail: "El registro fue eliminado correctamente."
      });
    } catch (error) {
      console.error("Error eliminando mantenimiento:", error);
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

  const getItemsForDate = (items, selectedDate) =>
    items.filter((item) => toLocalDate(item.date) === toLocalDate(selectedDate));

  const selectedDateMaintenances = getItemsForDate(filtered, date);
  const selectedDateLabel = date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const programadosCount = filtered.filter((item) => item.status === "programado").length;
  const finalizadosCount = filtered.filter((item) => item.status === "finalizado").length;
  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setSelectedBranch("");
    setSelectedDepartment("");
    setStartDate("");
    setEndDate("");
  };

  const renderCalendarTile = ({ date: tileDate, view }) => {
    if (view !== "month") return null;

    const items = getItemsForDate(filtered, tileDate);
    if (items.length === 0) return null;

    return (
      <div className="tile-events">
        {items.slice(0, 2).map((item) => (
          <span key={item._id} className={`tile-event ${item.status}`}>
            {item.branch?.name || item.title}
          </span>
        ))}
        {items.length > 2 && <span className="tile-more">+{items.length - 2}</span>}
      </div>
    );
  };

  const getCalendarTileClass = ({ date: tileDate, view }) => {
    if (view !== "month") return "";
    return getItemsForDate(filtered, tileDate).length > 0 ? "has-maintenance" : "";
  };

  return (
    <>
      <div className="maintenance-page">
        <header className="maintenance-hero">
          <div>
            <span>Agenda operativa</span>
            <h1>Mantenimientos</h1>
            <p>Programa, confirma y da seguimiento a los trabajos por fecha, sucursal y departamento.</p>
          </div>
          <div className="hero-actions">
            {canCreateMaintenance && (
              <button className="create-btn" onClick={() => setShowModal(true)}>
                Programar mantenimiento
              </button>
            )}
            {canExportMaintenance && (
              <button onClick={exportFilteredToPdf} className="export-btn">Exportar PDF</button>
            )}
          </div>
        </header>

        <div className="summary-strip">
          <div>
            <span>Resultados</span>
            <strong>{filtered.length}/{maintenances.length}</strong>
          </div>
          <div>
            <span>Programados</span>
            <strong>{programadosCount}</strong>
          </div>
          <div>
            <span>Finalizados</span>
            <strong>{finalizadosCount}</strong>
          </div>
          <div>
            <span>Fecha seleccionada</span>
            <strong>{selectedDateMaintenances.length}</strong>
          </div>
        </div>

        <section className="toolbar-panel">
          {message && (
            <div className={`notice ${message.type}`}>
              <b>{message.title}</b>
              <span>{message.detail}</span>
            </div>
          )}
          <div className="filters">
            <input
              className="maintenance-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar titulo, descripcion o sucursal"
              aria-label="Buscar mantenimientos"
            />

            <button className={filterStatus === "all" ? "active" : ""} onClick={() => setFilterStatus("all")}>Todos</button>
            <button className={filterStatus === "programado" ? "active" : ""} onClick={() => setFilterStatus("programado")}>Programados</button>
            <button className={filterStatus === "finalizado" ? "active" : ""} onClick={() => setFilterStatus("finalizado")}>Finalizados</button>

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

            <label className="maintenance-date-filter">
              <span>Desde</span>
              <input type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="maintenance-date-filter">
              <span>Hasta</span>
              <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <button className="clear-filters" type="button" onClick={clearFilters}>Limpiar filtros</button>
          </div>
          {invalidDateRange && (
            <div className="filter-error">La fecha inicial no puede ser posterior a la fecha final.</div>
          )}
        </section>

        <div className="calendar-workspace">
          <section className="calendar-shell">
            <Calendar
              onChange={setDate}
              value={date}
              tileContent={renderCalendarTile}
              tileClassName={getCalendarTileClass}
            />
          </section>

          <aside className="day-panel">
            <div className="day-panel-header">
              <span>Fecha seleccionada</span>
              <h2>{selectedDateLabel}</h2>
              <p>{selectedDateMaintenances.length} mantenimiento(s)</p>
            </div>

          {selectedDateMaintenances.length === 0 ? (
            <div className="empty"><p>No hay mantenimientos para esta fecha.</p></div>
          ) : (
            selectedDateMaintenances.map((m) => (
              <div key={m._id} className="event-card">
                <div className="event-header">
                  <div>
                    <span>{m.branch?.name || "Sin sucursal"}</span>
                    <h4>{m.title}</h4>
                  </div>
                  <span className={`status ${m.status}`}>{m.status}</span>
                </div>
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
                {canViewMaintenanceComments && m.comments?.length > 0 && (
                  <div className="maintenance-comments">
                    <strong>Seguimiento</strong>
                    {[...m.comments].reverse().map((comment) => (
                      <div key={comment._id} className="maintenance-comment">
                        <p>{comment.text}</p>
                        <small>
                          {comment.createdBy?.nombre || comment.createdBy?.email || "Usuario"} Â· {" "}
                          {comment.createdAt ? new Date(comment.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : ""}
                        </small>
                      </div>
                    ))}
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
                  {canCommentMaintenanceItem(m) && (
                    <button className="comment-btn" onClick={() => { setCommentingMaintenance(m); setMaintenanceComment(""); }}>
                      Comentar
                    </button>
                  )}
                  {canDeleteMaintenance(m) && (
                    <button className="delete-btn" onClick={() => deleteMaintenance(m)}>
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          </aside>
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

      {commentingMaintenance && (
        <div className="modal">
          <div className="modal-content">
            <h3>Comentar mantenimiento</h3>
            <p className="modal-hint">{commentingMaintenance.title}</p>
            <textarea
              placeholder="Comentario de seguimiento..."
              value={maintenanceComment}
              onChange={(e) => setMaintenanceComment(e.target.value)}
              rows={4}
            />
            <div className="modal-buttons">
              <button onClick={addMaintenanceComment}>Guardar</button>
              <button onClick={() => { setCommentingMaintenance(null); setMaintenanceComment(""); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .maintenance-page { min-height: 100vh; padding: 28px; color: #e5edf8; }
        .maintenance-hero { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 18px; }
        .maintenance-hero span { display: block; color: #93c5fd; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
        .maintenance-hero h1 { margin: 0; color: #f8fafc; font-size: 28px; line-height: 1.15; }
        .maintenance-hero p { margin: 8px 0 0; color: #94a3b8; max-width: 620px; line-height: 1.45; }
        .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
        .summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
        .summary-strip div { min-width: 0; padding: 14px; border: 1px solid rgba(148,163,184,0.16); border-radius: 8px; background: rgba(15,23,42,0.58); }
        .summary-strip span { display: block; color: #94a3b8; font-size: 12px; margin-bottom: 6px; }
        .summary-strip strong { color: #f8fafc; font-size: 24px; line-height: 1; }
        .toolbar-panel { border: 1px solid rgba(148,163,184,0.14); border-radius: 8px; background: rgba(15,23,42,0.54); padding: 14px; margin-bottom: 16px; }
        .calendar-workspace { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, 430px); gap: 16px; align-items: start; }
        .calendar-shell, .day-panel { border: 1px solid rgba(148,163,184,0.14); border-radius: 8px; background: rgba(15,23,42,0.62); }
        .calendar-shell { padding: 16px; min-width: 0; }
        .day-panel { padding: 16px; position: sticky; top: 16px; display: grid; gap: 12px; max-height: calc(100vh - 32px); overflow: auto; }
        .day-panel-header { padding-bottom: 12px; border-bottom: 1px solid rgba(148,163,184,0.14); }
        .day-panel-header span { display: block; color: #93c5fd; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; }
        .day-panel-header h2 { margin: 0; color: #f8fafc; font-size: 18px; line-height: 1.25; text-transform: capitalize; }
        .day-panel-header p { margin: 6px 0 0; color: #94a3b8; font-size: 13px; }
        .react-calendar { width: 100%; border: 0; background: transparent; color: #e2e8f0; font-family: inherit; }
        .react-calendar__navigation { height: 46px; margin-bottom: 12px; }
        .react-calendar__navigation button { min-width: 42px; border: 0; border-radius: 8px; background: transparent; color: #e2e8f0; cursor: pointer; font: inherit; font-weight: 800; }
        .react-calendar__navigation button:enabled:hover, .react-calendar__navigation button:enabled:focus { background: rgba(59,130,246,0.16); }
        .react-calendar__month-view__weekdays { color: #93c5fd; font-size: 11px; font-weight: 900; text-transform: uppercase; }
        .react-calendar__month-view__weekdays abbr { text-decoration: none; }
        .react-calendar__month-view__days { display: grid !important; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
        .react-calendar__tile { min-height: 112px; padding: 10px; border: 1px solid rgba(148,163,184,0.12); border-radius: 8px; background: rgba(30,41,59,0.42); color: #e2e8f0; text-align: left; display: flex; flex-direction: column; gap: 7px; overflow: hidden; }
        .react-calendar__tile:enabled:hover, .react-calendar__tile:enabled:focus { background: rgba(59,130,246,0.15); border-color: rgba(96,165,250,0.38); }
        .react-calendar__tile--now { border-color: rgba(34,197,94,0.42); background: rgba(34,197,94,0.08); }
        .react-calendar__tile--active { background: rgba(59,130,246,0.24) !important; border-color: rgba(96,165,250,0.68); }
        .react-calendar__month-view__days__day--neighboringMonth { color: #64748b; }
        .react-calendar__tile.has-maintenance { box-shadow: inset 0 3px 0 rgba(96,165,250,0.82); }
        .tile-events { display: grid; gap: 4px; width: 100%; min-width: 0; }
        .tile-event, .tile-more { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 4px 6px; border-radius: 6px; color: #e2e8f0; font-size: 10px; font-weight: 800; line-height: 1.15; }
        .tile-event.programado { background: rgba(245,158,11,0.18); color: #fbbf24; }
        .tile-event.finalizado { background: rgba(34,197,94,0.16); color: #86efac; }
        .tile-more { color: #bfdbfe; background: rgba(96,165,250,0.14); }
        .notice { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; padding: 12px 14px; border-radius: 8px; font-size: 13px; border: 1px solid transparent; }
        .notice.success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: #86efac; }
        .notice.error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
        .notice span { color: #cbd5e1; }
        .filters { display: flex; gap: 8px; flex-wrap: wrap; }
        .filters button { padding: 8px 11px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #94a3b8; cursor: pointer; font-size: 12px; transition: 0.2s; }
        .filters button.active, .filters button:hover { background: #3b82f6; color: white; border-color: #3b82f6; }
        .filters select, .filters input { min-width: 180px; padding: 8px 11px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: var(--app-input); color: #e2e8f0; font-size: 12px; }
        .filters .maintenance-search { flex: 1 1 280px; }
        .maintenance-date-filter { flex: 1 1 180px; min-width: 0; display: flex; flex-direction: column; gap: 5px; color: #94a3b8; font-size: 11px; }
        .maintenance-date-filter input { width: 100%; min-width: 0; }
        .filters .clear-filters { border-color: rgba(148,163,184,0.25); color: #cbd5e1; }
        .filter-error { margin-top: 10px; color: #fca5a5; font-size: 12px; }
        .export-btn, .create-btn { padding: 10px 12px; border-radius: 8px; border: none; color: white; cursor: pointer; font-size: 14px; font-weight: 800; }
        .export-btn { background: #22c55e; }
        .create-btn { background: #3b82f6; }
        .event-card { border: 1px solid rgba(148,163,184,0.14); background: rgba(30,41,59,0.56); padding: 14px; border-radius: 8px; }
        .department { color: #93c5fd; font-size: 12px; font-weight: 700; margin: 0 0 6px; text-transform: capitalize; }
        .desc { color: #dbe6f3; font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
        .event-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
        .event-header span:first-child { display: block; color: #93c5fd; font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
        .event-header h4 { margin: 0; color: #f8fafc; font-size: 15px; line-height: 1.25; overflow-wrap: anywhere; }
        .status { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; white-space: nowrap; }
        .status.programado { background: rgba(245,158,11,0.2); color: #f59e0b; }
        .status.finalizado { background: rgba(34,197,94,0.2); color: #22c55e; }
        .footer { margin-top: 12px; display: grid; gap: 7px; }
        .confirmed-text { color: #22c55e; font-size: 12px; }
        .approval-comment, .maintenance-comments { margin-top: 10px; padding: 10px; border-radius: 8px; border: 1px solid rgba(96,165,250,0.2); background: rgba(96,165,250,0.08); }
        .approval-comment strong { display: block; color: #bfdbfe; font-size: 12px; margin-bottom: 6px; }
        .approval-comment p, .maintenance-comment p { margin: 0; color: #e2e8f0; font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
        .approval-comment small, .maintenance-comment small { display: block; color: #94a3b8; font-size: 11px; margin-top: 6px; }
        .maintenance-comments { display: grid; gap: 8px; }
        .maintenance-comments > strong { color: #bfdbfe; font-size: 12px; }
        .maintenance-comment { padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); }
        .confirm-btn, .comment-btn, .delete-btn { border: none; padding: 8px 10px; border-radius: 8px; color: white; cursor: pointer; font-weight: 800; font-size: 12px; }
        .confirm-btn { background: #22c55e; }
        .comment-btn { background: #3b82f6; }
        .delete-btn { background: #ef4444; }
        .empty { border: 1px dashed rgba(148,163,184,0.22); border-radius: 8px; padding: 18px; color: #94a3b8; background: rgba(15,23,42,0.38); }
        .create-btn:disabled { background: #475569; cursor: not-allowed; opacity: 0.6; }
        .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 999; padding: 18px; }
        .modal-content { background: #1e293b; padding: 24px; border-radius: 8px; width: min(400px, 100%); display: flex; flex-direction: column; gap: 10px; }
        .modal-hint { color: #cbd5e1; font-size: 13px; line-height: 1.4; }
        .modal-content input, .modal-content textarea, .modal-content select { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: var(--app-input); color: white; font-size: 14px; }
        .modal-buttons { display: flex; gap: 10px; margin-top: 6px; }
        .modal-buttons button:first-child { background: #3b82f6; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; flex: 1; }
        .modal-buttons button:last-child { background: #ef4444; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; flex: 1; }
        @media (max-width: 1120px) { .calendar-workspace { grid-template-columns: 1fr; } .day-panel { position: static; max-height: none; } }
        @media (max-width: 768px) {
          .maintenance-page { padding: 16px; }
          .maintenance-hero { flex-direction: column; }
          .hero-actions { width: 100%; justify-content: stretch; }
          .hero-actions button { flex: 1 1 180px; }
          .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .react-calendar__month-view__days { gap: 5px; }
          .react-calendar__tile { min-height: 86px; padding: 7px; }
          .tile-event { font-size: 9px; }
        }
        @media (max-width: 520px) {
          .summary-strip { grid-template-columns: 1fr; }
          .filters select, .filters input, .filters button, .maintenance-date-filter { width: 100%; }
          .react-calendar__tile { min-height: 70px; }
          .tile-events { display: none; }
        }
      `}</style>
    </>
  );
}

export default MaintenanceCalendar;
