import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { ROLES } from "../config/roles";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

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

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = token ? jwtDecode(token) : null;

  const formatDate = (date) =>
    new Date(date).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

  useEffect(() => {
    if (!token) return;
    fetchIncidents();
    fetchBranches();
    fetchDepartments();
  }, [token]);

  useEffect(() => {
    if (user?.role === "departamento") {
      setFilterDept(user.department?.toLowerCase().trim());
    }
  }, []);

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

  const exportIncidents = () => {
    if (filteredIncidents.length === 0) { alert("No hay incidencias para exportar"); return; }
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
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const branchName = branches.find((b) => b._id === selectedBranch)?.name || "todas";
    saveAs(new Blob([excelBuffer], { type: "application/octet-stream" }), `incidencias_${branchName}.xlsx`);
  };

  const updateStatus = async (id, status) => {
    try {
      await fetch(`${API_URL}/api/incidents/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      fetchIncidents();
    } catch (error) {
      console.error(error);
    }
  };

  const canUpdate = user?.role === ROLES.ADMIN || user?.role === ROLES.DEPARTAMENTO;
  const canCreate = [ROLES.ADMIN, ROLES.GERENCIA, ROLES.DIRECCION].includes(user?.role);

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

        <button className="btn-export" onClick={exportIncidents}>📊 Exportar</button>
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
              <span>📍 {inc.branch?.name || inc.branch || "Sin sucursal"}</span>
              <span>🏢 {inc.department || "Sin departamento"}</span>
              <span>📅 {formatDate(inc.createdAt)}</span>
              <span>👤 {inc.createdBy?.nombre || inc.createdBy?.email}</span>
            </div>

            <div className="actions">
              {canUpdate ? (
                <>
                  <button className="btn-process" onClick={() => updateStatus(inc._id, "en_proceso")}>
                    En proceso
                  </button>
                  <button className="btn-done" onClick={() => updateStatus(inc._id, "resuelto")}>
                    Resuelto
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
        .page { padding: 28px; min-height: 100vh; color: #fff; }

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
          padding: 9px 12px;
          border-radius: 8px;
          border: 1px solid #1e293b;
          background: #0b1220;
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
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .card {
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
        }
        .card-top h3 { font-size: 15px; font-weight: 600; }

        .desc { font-size: 13px; color: #94a3b8; line-height: 1.5; }

        .meta { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #64748b; }

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

        .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }

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

        @media (max-width: 600px) {
          .page { padding: 16px; }
          .grid { grid-template-columns: 1fr; }
          .filters-bar { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

export default Incidents;
