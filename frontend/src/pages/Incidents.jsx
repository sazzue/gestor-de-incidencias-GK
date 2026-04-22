import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { ROLES } from "../config/roles";
import { useNavigate } from "react-router-dom";
import theme from "../styles/theme";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const API_URL = import.meta.env.VITE_API_URL;

function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [filteredIncidents, setFilteredIncidents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]); // ✅ AGREGADO
  const [selectedBranch, setSelectedBranch] = useState("");

  // 🔥 SOLO FILTROS DE EXPORTACIÓN
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = token ? jwtDecode(token) : null;

  const formatDate = (date) => {
    return new Date(date).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  useEffect(() => {
    if (!token) return;
    fetchIncidents();
    fetchBranches();
    fetchDepartments(); // ✅ AGREGADO
  }, [token]);

  useEffect(() => {
    if (user?.role === "departamento") {
      setFilterDept(user.department?.toLowerCase().trim());
    }
  }, [user]);

  useEffect(() => {
    filterIncidents();
  }, [incidents, selectedBranch, filterDept, filterStatus, startDate, endDate]);

  const fetchIncidents = async () => {
    try {
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
      const res = await fetch(`${API_URL}/api/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      setBranches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando sucursales:", error);
    }
  };

  // ✅ AGREGADO
  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando departamentos:", error);
    }
  };

  // 🔥 FILTRO CORREGIDO
  const filterIncidents = () => {
    let result = [...incidents];

    // 🔹 sucursal
    if (selectedBranch) {
      result = result.filter((i) => {
        if (i.branch?._id) return i.branch._id === selectedBranch;
        if (typeof i.branch === "string") return i.branch === selectedBranch;
        return false;
      });
    }

    // 🔹 departamento
   if (filterDept) {
  result = result.filter(
    (i) =>
      i.department &&
      i.department.toLowerCase().trim() ===
        filterDept
  );
}

    // 🔹 estado
    if (filterStatus) {
      result = result.filter((i) => i.status === filterStatus);
    }

    // 🔹 fecha inicio
    if (startDate) {
      result = result.filter(
        (i) => new Date(i.createdAt) >= new Date(startDate)
      );
    }

    // 🔹 fecha fin
    if (endDate) {
      result = result.filter(
        (i) => new Date(i.createdAt) <= new Date(endDate + "T23:59:59")
      );
    }

    setFilteredIncidents(result); // ✅ CRÍTICO
  };

  const exportIncidents = () => {
    if (filteredIncidents.length === 0) {
      alert("No hay incidencias para exportar");
      return;
    }

    const data = filteredIncidents.map((i) => ({
      Titulo: i.title,
      Descripcion: i.description,
      Sucursal: i.branch?.name || i.branch || "Sin sucursal",
      Departamento: i.department?.name || i.department || "Sin departamento",
      Estado: i.status,
      Fecha: new Date(i.createdAt).toLocaleDateString("es-MX"),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Incidencias");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const file = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

    const branchName =
      branches.find((b) => b._id === selectedBranch)?.name || "todas";

    saveAs(file, `incidencias_${branchName}.xlsx`);
  };

  const updateStatus = async (id, status) => {
    try {
      await fetch(`${API_URL}/api/incidents/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      fetchIncidents();
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pendiente":
        return "#ef4444";
      case "en_proceso":
        return "#f59e0b";
      case "resuelto":
        return "#22c55e";
      default:
        return "#6b7280";
    }
  };

  const canUpdate =
    user?.role === ROLES.ADMIN ||
    user?.role === ROLES.DEPARTAMENTO;

  return (
    <div style={styles.container}>
      <h2 style={styles.logo}>📋 Incidencias</h2>

      <div className="navbar">
        <div>
          {(user?.role === ROLES.ADMIN ||
            user?.role === ROLES.GERENCIA ||
            user?.role === ROLES.DIRECCION) && (
            <button
              style={styles.navBtn}
              onClick={() => navigate("/create")}
            >
              + Crear Solicitud
            </button>
          )}
        </div>

        <div className="filters">

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">Departamento</option>
            {departments.map((dep) => (
              <option key={dep._id} value={dep.name.toLowerCase()}>
            {dep.name}
            </option>
            ))}
          </select>

          <select onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En proceso</option>
            <option value="resuelto">Resuelto</option>
          </select>

          <input type="date" onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" onChange={(e) => setEndDate(e.target.value)} />

          <button onClick={exportIncidents} className="export-btn">
            📊 Exportar
          </button>
        </div>
      </div>

      <p style={{ fontSize: "12px", color: "#9ca3af" }}>
        Mostrando {filteredIncidents.length} incidencias
      </p>

      <div className="grid">
        {filteredIncidents.map((inc) => (
          <div key={inc._id} className="card">
            <h3>{inc.title}</h3>

            <p className="desc">{inc.description}</p>

            <div className="info-row">
              <span>📍 {inc.branch?.name || inc.branch}</span>
              <span>🏢 {inc.department || "Sin departamento"}</span>
            </div>

            <div className="info-row">
              <span>📅 {formatDate(inc.createdAt)}</span>
              <span>
                👤 {inc.createdBy?.nombre || inc.createdBy?.email}
              </span>
            </div>

            <div
              className="status"
              style={{ background: getStatusColor(inc.status) }}
            >
              {inc.status.replace("_", " ").toUpperCase()}
            </div>

            <div className="actions">
  {canUpdate ? (
    <>
      <button
        className="process"
        onClick={() => updateStatus(inc._id, "en_proceso")}
      >
        En proceso
      </button>

      <button
        className="done"
        onClick={() => updateStatus(inc._id, "resuelto")}
      >
        Resuelto
      </button>
    </>
  ) : (
    <span className="no-perm">
      🔒 Sin autorización
    </span>
  )}
</div>
          </div>
        ))}
      </div>

      <style>{`
/* 🔥 NAVBAR */
.navbar {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  flex-wrap: wrap;
  margin-bottom: 25px;
}

/* 🔎 FILTROS */
.filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

input, select {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #1e293b;
  background: #020617;
  color: #e2e8f0;
  font-size: 14px;
  transition: 0.2s;
}

input:focus, select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.25);
}

/* 📊 EXPORT BUTTON */
.export-btn {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  border: none;
  padding: 10px 14px;
  border-radius: 10px;
  color: white;
  cursor: pointer;
  font-weight: 600;
  transition: 0.2s;
}

.export-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.5);
}

/* 📦 GRID */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 18px;
}

/* 🧾 CARD */
.card {
  background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  padding: 18px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid rgba(255,255,255,0.05);
  transition: 0.25s;
  backdrop-filter: blur(10px);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 15px 40px rgba(0,0,0,0.6);
}

/* 📝 TITULO */
.card h3 {
  font-size: 16px;
  font-weight: 600;
}

/* 📄 DESCRIPCIÓN */
.desc {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.4;
}

/* 📊 INFO ROW */
.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #9ca3af;
  flex-wrap: wrap;
  gap: 5px;
}

/* 🔥 STATUS */
.status {
  margin-top: 5px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  width: fit-content;
  text-transform: uppercase;
}

/* 🎯 COLORES STATUS */
.status.pendiente {
  background: rgba(239,68,68,0.2);
  color: #ef4444;
}

.status.en_proceso {
  background: rgba(245,158,11,0.2);
  color: #f59e0b;
}

.status.resuelto {
  background: rgba(34,197,94,0.2);
  color: #22c55e;
}

/* ⚙️ ACTIONS */
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

/* 🟡 BOTÓN PROCESO */
.process {
  background: rgba(245,158,11,0.15);
  border: 1px solid rgba(245,158,11,0.4);
  padding: 6px 12px;
  border-radius: 8px;
  color: #f59e0b;
  cursor: pointer;
  transition: 0.2s;
}

.process:hover {
  background: #f59e0b;
  color: #000;
}

/* 🟢 BOTÓN RESUELTO */
.done {
  background: rgba(34,197,94,0.15);
  border: 1px solid rgba(34,197,94,0.4);
  padding: 6px 12px;
  border-radius: 8px;
  color: #22c55e;
  cursor: pointer;
  transition: 0.2s;
}

.done:hover {
  background: #22c55e;
  color: #000;
}

/* 🔒 SIN PERMISO */
.no-perm {
  font-size: 12px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 5px;
}

/* 📱 RESPONSIVE */
@media (max-width: 600px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .navbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
`}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#0b1220",
    color: "#fff",
    padding: "20px",
  },
  logo: {
    fontSize: "22px",
    marginBottom: "15px",
  },
  navBtn: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #333",
    background: "transparent",
    color: "white",
    cursor: "pointer",
  },
};

export default Incidents;