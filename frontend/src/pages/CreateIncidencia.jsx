
import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import { ROLES } from "../config/roles";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";

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
console.log("USER TOKEN:", user); // 👈 AQUÍ
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const resBranches = await fetch(`${API_URL}/api/branches`);
      const dataBranches = await resBranches.json();

      const resDepartments = await fetch(`${API_URL}/api/departments`);
      const dataDepartments = await resDepartments.json();

      setBranches(dataBranches);
      setDepartments(dataDepartments);
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || !branch ) {
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
        body: JSON.stringify({
          title,
          description,
          branch,
          department
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.msg || "Error al crear incidencia");
        return;
      }

      alert("Incidencia creada ✅");

      setTitle("");
      setDescription("");
      setBranch("");
      setDepartment("");

    } catch (error) {
      console.error("Error conexión:", error);
    }
  };

  // 🔒 PROTECCIÓN
  if (
    !user ||
    ![ROLES.ADMIN, ROLES.GERENCIA, ROLES.DIRECCION].includes(user.role)
  ) {
    return (
      <div className="container" style={{
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
}}>
  <div className="card">
    <h2>No tienes acceso</h2>
  </div>
</div>
    );
  }

  return (
  <div className="container">

    <div className="card" style={{ maxWidth: "500px", margin: "0 auto" }}>

      {/* HEADER */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
        flexWrap: "wrap",
        gap: "10px"
      }}>
        <h2>Crear nueva solicitud</h2>

        <button
          className="btn"
          style={{ background: "transparent", border: "1px solid #334155" }}
          onClick={() => navigate("/incidents")}
        >
          ← Volver
        </button>
      </div>

      {/* FORM */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

        <input
          className="input"
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <select
          className="input"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="">Departamento</option>
          {departments.map((dep) => (
            <option key={dep._id} value={dep.name.toLowerCase()}>
              {dep.name}
            </option>
          ))}
        </select>

        <textarea
          className="input"
          placeholder="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <select
          className="input"
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

        <button className="btn" onClick={handleSubmit}>
          Enviar
        </button>

      </div>

    </div>

      {/* 🎨 CSS PRO + RESPONSIVE */}
      <style>{`
        

        .wrapper {
          width: 100%;
          max-width: 500px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .header h2 {
          color: #e2e8f0;
          font-size: 22px;
        }

        .header button {
          background: transparent;
          border: 1px solid #1e293b;
          color: #94a3b8;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: #0f172a;
          padding: 25px;
          border-radius: 14px;
          border: 1px solid #1e293b;
          box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        }


        /* 🚫 NO ACCESS */
        .no-access {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: #020617;
          color: #fff;
        }

        /* 📱 MOBILE */
        @media (max-width: 600px) {
          .wrapper {
            max-width: 100%;
          }

          .form {
            padding: 20px;
          }

          .header {
            flex-direction: column;
            align-items: flex-start;
          }

          .header button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default CreateIncidencia;