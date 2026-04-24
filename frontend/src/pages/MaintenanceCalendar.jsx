import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { jwtDecode } from "jwt-decode";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const API_URL = import.meta.env.VITE_API_URL;

function MaintenanceCalendar() {
  const [date, setDate] = useState(new Date());
  const [maintenances, setMaintenances] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [branches, setBranches] = useState([]);
  const [user, setUser] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [branch, setBranch] = useState("");
  const [dateInput, setDateInput] = useState("");

  const token = localStorage.getItem("token");

  const canCreate =
    user?.permissions?.includes("CREATE_MAINTENANCE") ||
    (user?.role === "departamento" &&
      user?.department?.toLowerCase().trim() === "sistemas");

  const canConfirm =
    user?.permissions?.includes("CONFIRM_MAINTENANCE") ||
    ["admin", "gerencia", "direccion"].includes(user?.role);

  const toLocalDate = (d) => new Date(d).toLocaleDateString("sv-SE");

  const exportFilteredToExcel = () => {
    if (filtered.length === 0) { alert("No hay datos para exportar"); return; }
    const data = filtered.map((m) => ({
      Titulo: m.title,
      Descripcion: m.description,
      Sucursal: m.branch?.name || "Sin sucursal",
      Estado: m.status,
      Fecha: new Date(m.date).toLocaleDateString("es-MX"),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mantenimientos");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([excelBuffer], { type: "application/octet-stream" }), "mantenimientos_filtrados.xlsx");
  };

  const exportByBranch = () => {
    if (filtered.length === 0) { alert("No hay datos para exportar"); return; }
    const data = filtered.map((m) => ({
      Titulo: m.title,
      Descripcion: m.description,
      Sucursal: m.branch?.name,
      Estado: m.status,
      Fecha: new Date(m.date).toLocaleDateString("es-MX"),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sucursal");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const branchName = branches.find((b) => b._id === selectedBranch)?.name || "todas";
    saveAs(new Blob([excelBuffer], { type: "application/octet-stream" }), `mantenimientos_${branchName}.xlsx`);
  };

  const createMaintenance = async () => {
    if (!title || !description || !branch || !dateInput) { alert("Todos los campos son obligatorios"); return; }
    try {
      const res = await fetch(`${API_URL}/api/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, description, branch, date: dateInput + "T12:00:00", status: "programado" }),
      });
      const data = await res.json();
      setMaintenances((prev) => { const updated = [...prev, data]; filterByDate(updated, date); return updated; });
      setShowModal(false);
      setTitle(""); setDescription(""); setBranch(""); setDateInput("");
    } catch (error) {
      console.error("Error creando mantenimiento:", error);
    }
  };

  useEffect(() => {
    if (token) setUser(jwtDecode(token));
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { filterByDate(maintenances, date); }, [filterStatus, date, maintenances, selectedBranch]);

  useEffect(() => {
    fetch(`${API_URL}/api/branches`)
      .then(res => res.json())
      .then(data => setBranches(data))
      .catch(err => console.error(err));
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/maintenance`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMaintenances(data);
    } catch (error) {
      console.error("Error cargando mantenimientos:", error);
    }
  };

  const filterByDate = (data, selectedDate) => {
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
    setFiltered(result);
  };

  const confirmMaintenance = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/maintenance/${id}/confirm`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const updated = await res.json();
      setMaintenances((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
    } catch (error) {
      console.error("Error confirmando:", error);
    }
  };

  return (
    <>
      <div className="layout-calendar">
        {/* IZQUIERDA */}
        <div className="calendar-panel">
          <h2>📅 Mantenimientos</h2>
          <Calendar onChange={setDate} value={date} />

          <div className="filters">
            <button className={filterStatus === "all" ? "active" : ""} onClick={() => setFilterStatus("all")}>Todos</button>
            <button className={filterStatus === "programado" ? "active" : ""} onClick={() => setFilterStatus("programado")}>Programados</button>
            <button className={filterStatus === "finalizado" ? "active" : ""} onClick={() => setFilterStatus("finalizado")}>Finalizados</button>
            <button className={filterStatus === "day" ? "active" : ""} onClick={() => setFilterStatus("day")}>📅 Este día</button>
            <button className={filterStatus === "day-programado" ? "active" : ""} onClick={() => setFilterStatus("day-programado")}>📅 Programados hoy</button>
            <button className={filterStatus === "day-finalizado" ? "active" : ""} onClick={() => setFilterStatus("day-finalizado")}>📅 Finalizados hoy</button>

            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (<option key={b._id} value={b._id}>{b.name}</option>))}
            </select>
          </div>

          <button disabled={!canCreate} className="create-btn" onClick={() => setShowModal(true)}>
            {canCreate ? "➕ Programar mantenimiento" : "🔒 Solo Sistemas puede crear"}
          </button>

          <button onClick={exportFilteredToExcel} className="export-btn">📊 Exportar filtrados</button>
          <button onClick={exportByBranch} className="export-btn">📊 Exportar por sucursal</button>
        </div>

        {/* DERECHA */}
        <div className="events-panel">
          <h3>Eventos del día</h3>
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
                <p className="desc">{m.description}</p>
                <div className="footer">
                  <small>{new Date(m.date).toLocaleDateString("es-MX")}</small>
                  {m.status === "finalizado" && m.confirmedBy && (
                    <small className="confirmed-text">✔ Confirmado por: {m.confirmedBy.nombre || m.confirmedBy.email}</small>
                  )}
                  {canConfirm && m.status === "programado" && (
                    <button className="confirm-btn" onClick={() => confirmMaintenance(m._id)}>✔ Confirmar</button>
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
            <input type="text" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Sucursal</option>
              {branches.map((b) => (<option key={b._id} value={b._id}>{b.name}</option>))}
            </select>
            <textarea placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
            <div className="modal-buttons">
              <button onClick={createMaintenance}>Guardar</button>
              <button onClick={() => setShowModal(false)}>Cancelar</button>
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
          background: #0b1220;
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

        .modal-content input,
        .modal-content textarea,
        .modal-content select {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #334155;
          background: #0b1220;
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
