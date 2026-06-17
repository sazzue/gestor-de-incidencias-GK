import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";
import { hasPermission } from "../config/permissions";
import { useSystemSettings } from "../hooks/useSystemSettings";
import {
  FOLLOW_UP_READ_EVENT,
  getUnreadFollowUpIncidents,
} from "../utils/followUpNotifications";

const API_URL = import.meta.env.VITE_API_URL;

function Sidebar({ isOpen = false, onNavigate }) {
  const [user, setUser] = useState(null);
  const [followUpCount, setFollowUpCount] = useState(0);
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
      } catch {
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

  const canCreateIncidents = hasPermission(user, "CREATE_INCIDENT");
  const canViewIncidents = hasPermission(user, "INCIDENTS_VIEW");
  const canViewInternalTasks = hasPermission(user, "INTERNAL_TASKS_VIEW");
  const canCreateInternalTasks = hasPermission(user, "INTERNAL_TASKS_CREATE");
  const canAccessUsers = hasPermission(user, "CREATE_USERS");
  const canAccessCatalogs = hasPermission(user, "CATALOGS_MANAGE");
  const canAccessSettings = hasPermission(user, "SETTINGS_MANAGE");
  const canAccessAudit = hasPermission(user, "AUDIT_VIEW");
  const canAccessOrganizations = Boolean(user?.isPlatformAdmin);
  const canAccessSuppliers =
    hasPermission(user, "SUPPLIERS_VIEW") ||
    hasPermission(user, "SUPPLIERS_CREATE") ||
    hasPermission(user, "SUPPLIERS_UPDATE") ||
    hasPermission(user, "SUPPLIERS_DELETE");
  const canViewMaintenance =
    hasPermission(user, "VIEW_MAINTENANCE_ALL") ||
    hasPermission(user, "VIEW_MAINTENANCE_DEPARTMENT") ||
    hasPermission(user, "VIEW_MAINTENANCE_BRANCH") ||
    hasPermission(user, "CREATE_MAINTENANCE") ||
    hasPermission(user, "CONFIRM_MAINTENANCE");
  const canViewInventory =
    hasPermission(user, "VIEW_INVENTORY_ALL") ||
    hasPermission(user, "VIEW_INVENTORY_DEPARTMENT") ||
    hasPermission(user, "VIEW_INVENTORY_BRANCH") ||
    hasPermission(user, "CREATE_INVENTORY") ||
    hasPermission(user, "DISPOSE_INVENTORY");
  const permissionKey = (user?.permissions || []).join("|");
  const scopeKey = JSON.stringify(user?.accessScopes || {});
  const displayedFollowUpCount = canViewIncidents ? followUpCount : 0;

  useEffect(() => {
    if (!user || !canViewIncidents) {
      return;
    }

    let isActive = true;

    const fetchFollowUps = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch(`${API_URL}/api/incidents?type=incident`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!isActive || !res.ok) return;

        const count = Array.isArray(data)
          ? getUnreadFollowUpIncidents(data, user).length
          : 0;

        setFollowUpCount(count);
      } catch {
        if (isActive) setFollowUpCount(0);
      }
    };

    fetchFollowUps();
    window.addEventListener("auth-refresh", fetchFollowUps);
    window.addEventListener(FOLLOW_UP_READ_EVENT, fetchFollowUps);
    const interval = setInterval(fetchFollowUps, 30000);

    return () => {
      isActive = false;
      clearInterval(interval);
      window.removeEventListener("auth-refresh", fetchFollowUps);
      window.removeEventListener(FOLLOW_UP_READ_EVENT, fetchFollowUps);
    };
  }, [user, canViewIncidents, permissionKey, scopeKey]);

  const isActive = (path) => location.pathname === path;

  const goTo = (path) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <>
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div>
          <div className="logo-container">
            <img src={settings.sidebarImageUrl || logo} alt="Logo" />
            <h2>{settings.systemName}</h2>
          </div>

          <button
            onClick={() => goTo("/info")}
            className={`sidebar-btn info-btn ${isActive("/info") ? "active" : ""}`}
          >
            Informacion del sistema
          </button>

          <nav>
            <button
              onClick={() => goTo("/dashboard")}
              className={`sidebar-btn ${isActive("/dashboard") ? "active" : ""}`}
            >
              Dashboard
            </button>

            <button
              disabled={!canViewIncidents}
              onClick={() => goTo("/incidents")}
              className={`sidebar-btn ${isActive("/incidents") ? "active" : ""} ${!canViewIncidents ? "disabled" : ""}`}
            >
              <span>Incidencias</span>
              {displayedFollowUpCount > 0 && (
                <span className="follow-up-badge" title={`${displayedFollowUpCount} incidencia(s) con seguimiento`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Z" />
                    <path d="M9.5 21h5" />
                  </svg>
                  <b>{displayedFollowUpCount}</b>
                </span>
              )}
            </button>

            <button
              disabled={!canCreateIncidents}
              onClick={() => goTo("/create")}
              className={`sidebar-btn ${isActive("/create") ? "active" : ""} ${!canCreateIncidents ? "disabled" : ""}`}
            >
              Crear solicitud
            </button>

            <button
              disabled={!canViewInternalTasks}
              onClick={() => goTo("/internal-tasks")}
              className={`sidebar-btn ${isActive("/internal-tasks") ? "active" : ""} ${!canViewInternalTasks ? "disabled" : ""}`}
            >
              Tareas internas
            </button>

            {canCreateInternalTasks && (
              <button
                onClick={() => goTo("/internal-tasks/create")}
                className={`sidebar-btn ${isActive("/internal-tasks/create") ? "active" : ""}`}
              >
                Crear tarea interna
              </button>
            )}

            <button
              disabled={!canViewMaintenance}
              onClick={() => goTo("/maintenance")}
              className={`sidebar-btn ${isActive("/maintenance") ? "active" : ""} ${!canViewMaintenance ? "disabled" : ""}`}
            >
              Mantenimientos
            </button>

            <button
              disabled={!canViewInventory}
              onClick={() => goTo("/inventory")}
              className={`sidebar-btn ${isActive("/inventory") ? "active" : ""} ${!canViewInventory ? "disabled" : ""}`}
            >
              Inventario
            </button>

            {canAccessSuppliers && (
              <button
                onClick={() => goTo("/suppliers")}
                className={`sidebar-btn ${isActive("/suppliers") ? "active" : ""}`}
              >
                Proveedores
              </button>
            )}

            <button
              disabled={!canAccessUsers}
              onClick={() => goTo("/users")}
              className={`sidebar-btn ${isActive("/users") ? "active" : ""} ${!canAccessUsers ? "disabled" : ""}`}
            >
              Usuarios
            </button>

            {canAccessCatalogs && (
              <button
                onClick={() => goTo("/catalogs")}
                className={`sidebar-btn ${isActive("/catalogs") ? "active" : ""}`}
              >
                Catalogos
              </button>
            )}

            {canAccessSettings && (
              <button
                onClick={() => goTo("/settings")}
                className={`sidebar-btn ${isActive("/settings") ? "active" : ""}`}
              >
                Configuracion
              </button>
            )}

            {canAccessAudit && (
              <button
                onClick={() => goTo("/audit")}
                className={`sidebar-btn ${isActive("/audit") ? "active" : ""}`}
              >
                Bitacora
              </button>
            )}

            {canAccessOrganizations && (
              <button
                onClick={() => goTo("/platform-identity")}
                className={`sidebar-btn ${isActive("/platform-identity") ? "active" : ""}`}
              >
                Identidad
              </button>
            )}

            {canAccessOrganizations && (
              <button
                onClick={() => goTo("/organizations")}
                className={`sidebar-btn ${isActive("/organizations") ? "active" : ""}`}
              >
                Empresas
              </button>
            )}
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
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .follow-up-badge {
          min-width: 28px;
          height: 22px;
          padding: 0 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-radius: 999px;
          background: rgba(245,158,11,0.18);
          color: #fbbf24;
          border: 1px solid rgba(245,158,11,0.3);
          font-size: 11px;
          font-weight: 800;
          line-height: 1;
          flex-shrink: 0;
        }

        .follow-up-badge svg {
          width: 13px;
          height: 13px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
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
            position: fixed;
            top: 0;
            left: 0;
            z-index: 1001;
            width: min(82vw, 300px);
            min-width: 0;
            height: 100dvh;
            transform: translateX(-105%);
            transition: transform 0.24s ease;
            box-shadow: 18px 0 42px rgba(0,0,0,0.38);
            border-right: 1px solid rgba(255,255,255,0.12);
          }

          .sidebar.open {
            transform: translateX(0);
          }

          nav {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}

export default Sidebar;
