import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const canCreateIncidents = ["admin", "gerencia", "direccion"].includes(user?.role);
  const canAccessUsers = user?.role === "admin";
 const canViewMaintenance =
  ["admin", "gerencia", "direccion"].includes(user?.role) ||
  (user?.role === "departamento" &&
    user?.department?.toLowerCase().trim() === "sistemas");

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      setUser(jwtDecode(token));
    }

    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      setIncidents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  };

  // KPIs
  const total = incidents.length;
  const pendientes = incidents.filter(i => i.status === "pendiente").length;
  const proceso = incidents.filter(i => i.status === "en_proceso").length;
  const resueltas = incidents.filter(i => i.status === "resuelto").length;

  
  return (
    <div className="layout">

      {/* SIDEBAR */}
      
      <aside className="sidebar">
        <p><b>Versión:</b> 1.0.0</p>

        <div className="logo-container">
  <img src={logo} alt="Logo" />
  <h2>Gestor de reportes</h2>
</div>
       

        <button
  onClick={() => navigate("/info")}
  className="info-btn"
>
  ℹ️ Información del sistema
</button>

        <nav>

          <button onClick={() => navigate("/incidents")}>📌 Incidencias</button>

          <button
            disabled={!canCreateIncidents}
            onClick={() => navigate("/create")}
            className={!canCreateIncidents ? "disabled" : ""}
          >
            ➕ Crear solicitud
          </button>

          <button
            disabled={!canViewMaintenance}
            onClick={() => navigate("/maintenance")}
            className={!canViewMaintenance ? "disabled" : ""}
          >
            🛠 Mantenimientos
          </button>

          <button
            disabled={!canAccessUsers}
            onClick={() => navigate("/users")}
            className={!canAccessUsers ? "disabled" : ""}
          >
            👥 Usuarios
          </button>
        </nav>

        <div className="sidebar-footer">
          <p>{user?.nombre}</p>
          <span>
  {user?.department && user.department !== "null"
    ? user.department
    : "Sin departamento"} | {user?.role}
</span>

          <button className="logout-btn" onClick={handleLogout}>
            🚪 Salir
          </button>
        </div>
      </aside>

      {/* CONTENIDO */}
      <main className="main">

        {/* HEADER */}
        <div className="header">
          <div>
            <h1>📊 Dashboard</h1>
            <p>Bienvenido, {user?.nombre}</p>
          </div>
          <span className="role">{user?.role}</span>
        </div>

        {/* KPIs */}
        <div className="kpis">
          <div className="card">
            <h4>-Total-</h4>
            <p>{total}</p>
          </div>

          <div className="card red">
            <h4>-Pendientes-</h4>
            <p>{pendientes}</p>
          </div>

          <div className="card yellow">
            <h4>-En proceso-</h4>
            <p>{proceso}</p>
          </div>

          <div className="card green">
            <h4>-Resueltas-</h4>
            <p>{resueltas}</p>
          </div>
        </div>

        {/* CONTENIDO */}
        <div className="content">
          <div className="panel">
            <h3>Últimas incidencias</h3>

            {incidents.slice(0, 5).map((inc) => (
  <div key={inc._id} className="incident-item">

    <div className="incident-left">
      <h4>{inc.title}</h4>
      <span className="dept">
        {inc.department || "Sin departamento"}
      </span>
    </div>

    <div className="incident-right">
      <span className={`status ${inc.status}`}>
        {inc.status.replace("_", " ")}
      </span>
    </div>

  </div>
))}
          </div>

          <div className="panel">
            <h3>Resumen</h3>
            <p><b>Departamento:</b> {user?.department}</p>
            <p><b>Rol:</b> {user?.role}</p>
          </div>
        </div>

      </main>

 {/* CSS */}
<style>{`

.logo-container {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.logo-container img {
  width: 80px;
  height: 80px;
  object-fit: contain;
}
  
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .layout {
    display: flex;
    min-height: 100vh;
    background: #0b1220;
    color: white;
    font-family: 'Inter', sans-serif;
  }

  /* SIDEBAR */
  .sidebar {
    width: 240px;
    padding: 20px;
    background: rgba(255,255,255,0.04);
    backdrop-filter: blur(10px);
    border-right: 1px solid rgba(255,255,255,0.08);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .sidebar h2 {
    font-size: 18px;
    margin-bottom: 20px;
  }

  .sidebar nav {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sidebar button {
    padding: 10px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #cbd5f5;
    cursor: pointer;
    transition: 0.2s;
    text-align: left;
  }

  .sidebar button:hover {
    background: rgba(255,255,255,0.08);
    color: white;
  }

  .info-btn {
    margin-bottom: 15px;
    background: #3b82f6;
    color: white;
    font-weight: 500;
  }

  .disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .sidebar-footer {
    margin-top: 20px;
    font-size: 13px;
    color: #94a3b8;
  }

  .logout-btn {
    margin-top: 10px;
    width: 100%;
    background: #ef4444;
    color: white;
    border-radius: 8px;
  }

  /* MAIN */
  .main {
    flex: 1;
    padding: 25px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
  }

  .header h1 {
    font-size: 22px;
  }

  .role {
    background: rgba(255,255,255,0.08);
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 12px;
  }

  /* KPIs */
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 15px;
  }

  .card {
    background: rgba(255,255,255,0.05);
    padding: 18px;
    border-radius: 12px;
    transition: 0.2s;
  }

  .card:hover {
    transform: translateY(-3px);
    background: rgba(255,255,255,0.08);
  }

  .card h4 {
    font-size: 13px;
    color: #94a3b8;
  }

  .card p {
    font-size: 22px;
    font-weight: bold;
    margin-top: 5px;
  }

  .red p { color: #ef4444; }
  .yellow p { color: #f59e0b; }
  .green p { color: #22c55e; }

  /* CONTENT */
  .content {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    margin-top: 25px;
  }

  .panel {
    background: rgba(255,255,255,0.05);
    padding: 20px;
    border-radius: 14px;
  }

  .panel h3 {
    margin-bottom: 15px;
    font-size: 16px;
  }

  /* 🔥 LISTA PROFESIONAL */
  .incident-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    transition: 0.2s;
  }

  .incident-item:hover {
    background: rgba(255,255,255,0.03);
    border-radius: 8px;
  }

  .incident-left h4 {
    font-size: 14px;
    margin-bottom: 4px;
  }

  .dept {
    font-size: 12px;
    color: #9ca3af;
  }

  .incident-right {
    display: flex;
    align-items: center;
  }

  /* STATUS MODERNO */
  .status {
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .pendiente {
    background: rgba(239,68,68,0.2);
    color: #ef4444;
  }

  .en_proceso {
    background: rgba(245,158,11,0.2);
    color: #f59e0b;
  }

  .resuelto {
    background: rgba(34,197,94,0.2);
    color: #22c55e;
  }

  /* RESPONSIVE */
  @media (max-width: 1024px) {
    .content {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .layout {
      flex-direction: column;
    }

    .sidebar {
      width: 100%;
      flex-direction: row;
      overflow-x: auto;
    }

    .sidebar nav {
      flex-direction: row;
    }
  }
`}</style>
</div>
  );
}

      export default Dashboard;