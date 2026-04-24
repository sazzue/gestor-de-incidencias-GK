
import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import { ROLES } from "../config/roles";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

function CreateIncidencia() {
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = token ? jwtDecode(token) : null;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resBranches, resDepartments] = await Promise.all([
        fetch(`${API_URL}/api/branches`),
        fetch(`${API_URL}/api/departments`),
      ]);
      setBranches(await resBranches.json());
      setDepartments(await resDepartments.json());
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || !branch) {
      alert("Todos los campos son obligatorios");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/incidents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, description, branch, department }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.msg || "Error al crear incidencia"); return; }
      alert("Incidencia creada ✅");
      setTitle(""); setDescription(""); setBranch(""); setDepartment("");
    } catch (error) {
      console.error("Error conexión:", error);
    }
  };

  if (!user || ![ROLES.ADMIN, ROLES.GERENCIA, ROLES.DIRECCION].includes(user.role)) {
    return (
      <div className="page center">
        <div className="form-card">
          <h2>🔒 Sin acceso</h2>
          <p>No tienes permisos para crear solicitudes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">

      <div className="page-header">
        <div>
          <h1>➕ Crear solicitud</h1>
          <p>Registra una nueva incidencia</p>
        </div>
        <button className="btn-back" onClick={() => navigate("/incidents")}>
          ← Volver
        </button>
      </div>

      <div className="form-card">
        <div className="form-group">
          <label>Título</label>
          <input
            placeholder="Ej. Falla en sistema de cómputo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Departamento</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">Seleccionar departamento</option>
            {departments.map((dep) => (
              <option key={dep._id} value={dep.name.toLowerCase()}>{dep.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Descripción</label>
          <textarea
            placeholder="Describe el problema con detalle..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        <div className="form-group">
          <label>Sucursal</label>
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">Seleccionar sucursal</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
        </div>

        <button className="btn-submit" onClick={handleSubmit}>
          Enviar solicitud
        </button>
      </div>

      <style>{`
        .page {
          padding: 28px;
          min-height: 100vh;
          color: #fff;
        }

        .page.center {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .page-header h1 { font-size: 22px; }
        .page-header p { font-size: 13px; color: #64748b; margin-top: 4px; }

        .btn-back {
          padding: 9px 16px;
          border-radius: 8px;
          border: 1px solid #1e293b;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          font-size: 14px;
          transition: 0.2s;
        }
        .btn-back:hover { border-color: #3b82f6; color: white; }

        .form-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 28px;
          max-width: 560px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 500;
          color: #94a3b8;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #1e293b;
          background: #0b1220;
          color: #e2e8f0;
          font-size: 14px;
          transition: 0.2s;
          font-family: inherit;
          resize: vertical;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
        }

        .btn-submit {
          padding: 12px;
          border-radius: 9px;
          border: none;
          background: #3b82f6;
          color: white;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
          margin-top: 4px;
        }
        .btn-submit:hover { background: #2563eb; transform: translateY(-1px); }

        @media (max-width: 600px) {
          .page { padding: 16px; }
          .form-card { padding: 20px; }
        }
      `}</style>
    </div>
  );
}

export default CreateIncidencia;
