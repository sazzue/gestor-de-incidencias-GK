import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";

function Sidebar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) setUser(jwtDecode(token));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const canCreateIncidents = ["admin", "gerencia", "direccion"].includes(user?.role);
  const canAccessUsers = user?.role === "admin";
  const canViewMaintenance =
    ["admin", "gerencia", "direccion"].includes(user?.role) ||
    (user?.role === "departamento" &&
      user?.department?.toLowerCase().trim() === "sistemas");

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <aside className="sidebar">
        <div>
          <p className="version-tag"><b>v1.0.0</b></p>

          <div className="logo-container">
            <img src={logo} alt="Logo" />
            <h2>Gestor de reportes</h2>
          </div>

          <button
            onClick={() => navigate("/info")}
            className={`sidebar-btn info-btn ${isActive("/info") ? "active" : ""}`}
          >
            ℹ️ Información del sistema
          </button>

          <nav>
            <button
              onClick={() => navigate("/dashboard")}
              className={`sidebar-btn ${isActive("/dashboard") ? "active" : ""}`}
            >
              📊 Dashboard
            </button>

            <button
              onClick={() => navigate("/incidents")}
              className={`sidebar-btn ${isActive("/incidents") ? "active" : ""}`}
            >
              📌 Incidencias
            </button>

            <button
              disabled={!canCreateIncidents}
              onClick={() => navigate("/create")}
              className={`sidebar-btn ${isActive("/create") ? "active" : ""} ${!canCreateIncidents ? "disabled" : ""}`}
            >
              ➕ Crear solicitud
            </button>

            <button
              disabled={!canViewMaintenance}
              onClick={() => navigate("/maintenance")}
              className={`sidebar-btn ${isActive("/maintenance") ? "active" : ""} ${!canViewMaintenance ? "disabled" : ""}`}
            >
              🛠 Mantenimientos
            </button>

            <button
              disabled={!canAccessUsers}
              onClick={() => navigate("/users")}
              className={`sidebar-btn ${isActive("/users") ? "active" : ""} ${!canAccessUsers ? "disabled" : ""}`}
            >
              👥 Usuarios
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <p className="user-name">{user?.nombre}</p>
          <span className="user-meta">
            {user?.department && user.department !== "null"
              ? user.department
              : "Sin departamento"}{" "}
            | {user?.role}
          </span>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Salir
          </button>
        </div>
      </aside>

      <style>{`
        .sidebar {
          width: 240px;
          min-width: 240px;
          height: 100vh;
          position: sticky;
          top: 0;
          padding: 20px;
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(10px);
          border-right: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow-y: auto;
        }

        .version-tag {
          font-size: 11px;
          color: #475569;
          margin-bottom: 12px;
        }

        .logo-container {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }

        .logo-container img {
          width: 42px;
          height: 42px;
          object-fit: contain;
        }

        .logo-container h2 {
          font-size: 14px;
          color: #e2e8f0;
          line-height: 1.3;
        }

        nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 8px;
        }

        .sidebar-btn {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          transition: 0.2s;
          text-align: left;
          font-size: 14px;
        }

        .sidebar-btn:hover:not(.disabled) {
          background: rgba(255,255,255,0.08);
          color: white;
        }

        .sidebar-btn.active {
          background: rgba(59,130,246,0.15);
          color: #60a5fa;
          font-weight: 500;
        }

        .info-btn {
          margin-bottom: 8px;
          color: #93c5fd;
        }

        .disabled {
          opacity: 0.3;
          cursor: not-allowed !important;
        }

        .sidebar-footer {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-size: 13px;
          color: #94a3b8;
        }

        .user-name {
          font-weight: 600;
          color: #e2e8f0;
          margin-bottom: 4px;
        }

        .user-meta {
          display: block;
          font-size: 11px;
          color: #64748b;
          margin-bottom: 10px;
          text-transform: capitalize;
        }

        .logout-btn {
          width: 100%;
          padding: 9px;
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.3);
          color: #f87171;
          border-radius: 8px;
          cursor: pointer;
          transition: 0.2s;
          font-size: 13px;
        }

        .logout-btn:hover {
          background: #ef4444;
          color: white;
        }

        @media (max-width: 768px) {
          .sidebar {
            width: 100%;
            min-width: unset;
            height: auto;
            position: relative;
            flex-direction: row;
            flex-wrap: wrap;
            overflow-x: auto;
          }

          nav {
            flex-direction: row;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </>
  );
}

export default Sidebar;
