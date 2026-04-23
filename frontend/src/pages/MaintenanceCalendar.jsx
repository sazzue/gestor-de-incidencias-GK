import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { jwtDecode } from "jwt-decode";
import Navbar from "../components/Navbar";
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

  // FORM
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

  const toLocalDate = (d) =>
    new Date(d).toLocaleDateString("sv-SE");

  const exportFilteredToExcel = () => {
  if (filtered.length === 0) {
    alert("No hay datos para exportar");
    return;
  }

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

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const file = new Blob([excelBuffer], {
    type: "application/octet-stream",
  });

  saveAs(file, "mantenimientos_filtrados.xlsx");
};

const exportByBranch = () => {
  if (filtered.length === 0) {
    alert("No hay datos para exportar");
    return;
  }

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

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const file = new Blob([excelBuffer], {
    type: "application/octet-stream",
  });

  const branchName =
    branches.find((b) => b._id === selectedBranch)?.name || "todas";

  saveAs(file, `mantenimientos_${branchName}.xlsx`);
};

  const createMaintenance = async () => {
    if (!title || !description || !branch || !dateInput) {
      alert("Todos los campos son obligatorios");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/maintenance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          branch,
          date: dateInput + "T12:00:00",
          status: "programado",
        }),
      });

      const data = await res.json();

      setMaintenances((prev) => {
        const updated = [...prev, data];
        filterByDate(updated, date);
        return updated;
      });

      setShowModal(false);
      setTitle("");
      setDescription("");
      setBranch("");
      setDateInput("");

    } catch (error) {
      console.error("Error creando mantenimiento:", error);
    }
  };

  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token);
      setUser(decoded);
    }

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterByDate(maintenances, date);
  }, [filterStatus, date, maintenances,selectedBranch]);

  useEffect(() => {
  fetch(`${API_URL}/api/branches`)
    .then(res => res.json())
    .then(data => setBranches(data))
    .catch(err => console.error(err));
}, []);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/maintenance`, {
        headers: { Authorization: `Bearer ${token}` },
      });

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
    case "day":
      // Solo del día seleccionado (todos los status)
      result = result.filter((m) => toLocalDate(m.date) === selected);
      break;
    case "day-programado":
      // Solo programados del día
      result = result.filter(
        (m) => toLocalDate(m.date) === selected && m.status === "programado"
      );
      break;
    case "day-finalizado":
      // Solo finalizados del día
      result = result.filter(
        (m) => toLocalDate(m.date) === selected && m.status === "finalizado"
      );
      break;
    case "programado":
    case "finalizado":
      // Todos los del status (sin filtrar fecha)
      result = result.filter((m) => m.status === filterStatus);
      break;
    // "all" no filtra nada
  }
  if (selectedBranch) {
    result = result.filter((m) => m.branch?._id === selectedBranch);
  }
  setFiltered(result);
};

  const confirmMaintenance = async (id) => {
    try {
      const res = await fetch(
        `${API_URL}/api/maintenance/${id}/confirm`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const updated = await res.json();

      setMaintenances((prev) =>
        prev.map((m) => (m._id === updated._id ? updated : m))
      );
    } catch (error) {
      console.error("Error confirmando:", error);
    }
  };

  return (
    <>
      <Navbar />

      <div className="layout-calendar">
        {/* IZQUIERDA */}
        <div className="calendar-panel">
          <h2>📅 Mantenimientos</h2>

          <Calendar onChange={setDate} value={date} />

 <div className="filters">
  <button onClick={() => setFilterStatus("all")}>Todos (historial)</button>
  <button onClick={() => setFilterStatus("programado")}>Programados</button>
  <button onClick={() => setFilterStatus("finalizado")}>Finalizados</button>
  <button onClick={() => setFilterStatus("day")}>📅 Este día (todos)</button>
  <button onClick={() => setFilterStatus("day-programado")}>📅 Programados hoy</button>
  <button onClick={() => setFilterStatus("day-finalizado")}>📅 Finalizados hoy</button>

  <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
    <option value="">Todas las sucursales</option>
    {branches.map((b) => (
      <option key={b._id} value={b._id}>{b.name}</option>
    ))}
  </select>
</div>

<button
  className={filterStatus === "all" ? "active" : ""}
  onClick={() => setFilterStatus("all")}
>
  Todos
</button>


          <button
  disabled={!canCreate}
  className="create-btn"
  onClick={() => setShowModal(true)}
>
  {canCreate
    ? "➕ Programar mantenimiento"
    : "🔒 Solo Sistemas puede crear"}
</button>

<button onClick={exportFilteredToExcel} className="export-btn">
  📊 Exportar filtrados
</button>

<button onClick={exportByBranch} className="export-btn">
  📊 Exportar por sucursal
</button>
        </div>

        {/* DERECHA */}
        <div className="events-panel">
          <h3>Eventos del día</h3>

          {filtered.length === 0 ? (
            <div className="empty">
              <p>No hay mantenimientos</p>
            </div>
          ) : (
            filtered.map((m) => (
              <div key={m._id} className="event-card">
                <div className="event-header">
                  <h4>{m.title}</h4>
                  <span className={`status ${m.status}`}>
                    {m.status}
                  </span>
                </div>

                <p className="branch">{m.branch?.name}</p>
                <p className="desc">{m.description}</p>

                <div className="footer">
                  <small>
                    {new Date(m.date).toLocaleDateString("es-MX")}
                  </small>

                  {m.status === "finalizado" && m.confirmedBy && (
                    <small className="confirmed-text">
                      ✔ Confirmado por:{" "}
                      {m.confirmedBy.nombre || m.confirmedBy.email}
                    </small>
                  )}

                  {canConfirm && m.status === "programado" && (
                    <button
                      className="confirm-btn"
                      onClick={() => confirmMaintenance(m._id)}
                    >
                      ✔ Confirmar
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

            <input
              type="text"
              placeholder="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            <option value="">Sucursal</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
            {b.name}
           </option>
            ))}
          </select>

            <textarea
              placeholder="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <input
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
            />

            <div className="modal-buttons">
              <button onClick={createMaintenance}>Guardar</button>
              <button onClick={() => setShowModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS RESPONSIVE */}
      <style>{`
        body {
          margin: 0;
        }

        .layout-calendar {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 20px;
          padding: 90px 20px 20px;
          max-width: 1400px;
          margin: auto;
          min-height: 100vh;
          background: #0b1220;
          color: #fff;
        }

        .calendar-panel,
        .events-panel {
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

        .filters button.active {
  background: #3b82f6;
  color: white;
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
}

        .event-card {
          background: rgba(255,255,255,0.05);
          padding: 15px;
          border-radius: 10px;
          margin-bottom: 10px;
        }

        .footer {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .confirmed-text {
          color: #22c55e;
          font-size: 12px;
        }

        button, input, textarea {
          font-size: 16px;
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
  background: #475569;   /* gris oscuro */
  cursor: not-allowed;
  opacity: 0.6;
}

        .modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .modal-content {
          background: #525354;
          padding: 20px;
          border-radius: 10px;
          width: 90%;
          max-width: 400px;
        }

        .modal-content input,
        .modal-content textarea {
          width: 100%;
          margin-top: 10px;
          padding: 8px;
          border-radius: 6px;
          border: none;
        }

        .modal-content select {
  width: 100%;
  margin-top: 10px;
  padding: 8px;
  border-radius: 6px;
  border: none;
}

        .modal-buttons {
          margin-top: 10px;
          display: flex;
          gap: 10px;
        }

        .modal-buttons button:first-child {
          background: #3b82f6;
          color: white;
        }

        .modal-buttons button:last-child {
          background: #ef4444;
          color: white;
        }

        /* 📱 TABLET */
        @media (max-width: 1024px) {
          .layout-calendar {
            grid-template-columns: 250px 1fr;
          }
        }

        /* 📱 CELULAR */
        @media (max-width: 768px) {
          .layout-calendar {
            grid-template-columns: 1fr;
            padding: 80px 10px;
          }

          .calendar-panel {
            order: 2;
          }

          .events-panel {
            order: 1;
          }
        }
      `}</style>
    </>
  );
}

export default MaintenanceCalendar;