import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";
import { useSystemSettings } from "../hooks/useSystemSettings";

const API_URL = import.meta.env.VITE_API_URL;

function Sidebar() {
  const [user, setUser] = useState(null);
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const refreshUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await res.json();

        if (!res.ok) {
          setUser(jwtDecode(localStorage.getItem("token")));
          return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(jwtDecode(data.token));
        window.dispatchEvent(new Event("auth-updated"));
      } catch (error) {
        setUser(jwtDecode(localStorage.getItem("token")));
      }
    };

    refreshUser();
    window.addEventListener("auth-refresh", refreshUser);
    const interval = setInterval(refreshUser, 5000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("auth-refresh", refreshUser);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const hasPermission = (permission) =>
    user?.role === "admin" || user?.permissions?.includes(permission);

  const canCreateIncidents = hasPermission("CREATE_INCIDENT");
  const canViewIncidents =
    hasPermission("VIEW_INCIDENTS_ALL") ||
    hasPermission("VIEW_INCIDENTS_DEPARTMENT") ||
    hasPermission("VIEW_INCIDENTS_BRANCH");
  const canAccessUsers = hasPermission("CREATE_USERS");
  const canAccessSettings = user?.role === "admin";
  const canViewMaintenance =
    hasPermission("VIEW_MAINTENANCE_ALL") ||
    hasPermission("VIEW_MAINTENANCE_DEPARTMENT") ||
    hasPermission("VIEW_MAINTENANCE_BRANCH") ||
    hasPermission("CREATE_MAINTENANCE") ||
    hasPermission("CONFIRM_MAINTENANCE");

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <aside className="sidebar">
        <div>
          <p className="version-tag"><b>v{settings.version}</b></p>

          <div className="logo-container">
            <img src={settings.sidebarImageUrl || logo} alt="Logo" />
            <h2>{settings.systemName}</h2>
          </div>

          <button
            onClick={() => navigate("/info")}
            className={`sidebar-btn info-btn ${isActive("/info") ? "active" : ""}`}
          >
            Informacion del sistema
          </button>

          <nav>
            <button
              onClick={() => navigate("/dashboard")}
              className={`sidebar-btn ${isActive("/dashboard") ? "active" : ""}`}
            >
              Dashboard
            </button>

            <button
              disabled={!canViewIncidents}
              onClick={() => navigate("/incidents")}
              className={`sidebar-btn ${isActive("/incidents") ? "active" : ""} ${!canViewIncidents ? "disabled" : ""}`}
            >
              Incidencias
            </button>

            <button
              disabled={!canCreateIncidents}
              onClick={() => navigate("/create")}
              className={`sidebar-btn ${isActive("/create") ? "active" : ""} ${!canCreateIncidents ? "disabled" : ""}`}
            >
              Crear solicitud
            </button>

            <button
              disabled={!canViewMaintenance}
              onClick={() => navigate("/maintenance")}
              className={`sidebar-btn ${isActive("/maintenance") ? "active" : ""} ${!canViewMaintenance ? "disabled" : ""}`}
            >
              Mantenimientos
            </button>

            <button
              disabled={!canAccessUsers}
              onClick={() => navigate("/users")}
              className={`sidebar-btn ${isActive("/users") ? "active" : ""} ${!canAccessUsers ? "disabled" : ""}`}
            >
              Usuarios
            </button>

            <button
              disabled={!canAccessSettings}
              onClick={() => navigate("/settings")}
              className={`sidebar-btn ${isActive("/settings") ? "active" : ""} ${!canAccessSettings ? "disabled" : ""}`}
            >
              Configuracion
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
            Salir
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
          background: color-mix(in srgb, var(--app-card) 86%, transparent);
          backdrop-filter: blur(10px);
          border-right: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow-y: auto;
        }

        .version-tag {
          font-size: 11px;
          color: var(--app-text);
          opacity: 0.55;
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
          color: var(--app-title);
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
          color: var(--app-text);
          cursor: pointer;
          transition: 0.2s;
          text-align: left;
          font-size: 14px;
        }

        .sidebar-btn:hover:not(.disabled) {
          background: rgba(255,255,255,0.08);
          color: var(--app-title);
        }

        .sidebar-btn.active {
          background: color-mix(in srgb, var(--app-accent) 18%, transparent);
          color: var(--app-accent);
          font-weight: 500;
        }

        .info-btn {
          margin-bottom: 8px;
          color: var(--app-accent);
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
          color: var(--app-text);
        }

        .user-name {
          font-weight: 600;
          color: var(--app-title);
          margin-bottom: 4px;
        }

        .user-meta {
          display: block;
          font-size: 11px;
          color: var(--app-text);
          opacity: 0.65;
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
