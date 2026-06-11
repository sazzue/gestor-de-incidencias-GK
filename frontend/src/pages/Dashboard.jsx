import { useCallback, useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import { useSystemSettings } from "../hooks/useSystemSettings";
import { useSlaClock } from "../hooks/useSlaClock";
import { getSlaState, SLA_STATES } from "../utils/sla";

const API_URL = import.meta.env.VITE_API_URL;

const priorityLabels = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Critica",
};

function Dashboard() {
  const { settings } = useSystemSettings();
  const [incidents, setIncidents] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [inventory, setInventory] = useState([]);
  const now = useSlaClock();
  const [user] = useState(() => {
    const token = localStorage.getItem("token");
    return token ? jwtDecode(token) : null;
  });
  const navigate = useNavigate();

  const requestJson = useCallback(async (path) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const [incidentData, maintenanceData, inventoryData] = await Promise.all([
        requestJson("/api/incidents"),
        requestJson("/api/maintenance"),
        requestJson("/api/inventory"),
      ]);

      setIncidents(incidentData);
      setMaintenances(maintenanceData);
      setInventory(inventoryData);
    } catch (error) {
      console.error(error);
    }
  }, [requestJson]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const formatDate = (date) =>
    date
      ? new Date(date).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
      : "Sin fecha";

  const getResolvedDate = (incident) =>
    incident.resolvedAt || (incident.status === "resuelto" ? incident.updatedAt : null);

  const getFolio = (incident) => incident.folio || `INC-${incident._id.slice(-6).toUpperCase()}`;

  const stats = useMemo(() => {
    const open = incidents.filter((item) => item.status !== "resuelto");
    const resolved = incidents.filter((item) => item.status === "resuelto");
    const overdue = open.filter((item) => item.dueAt && new Date(item.dueAt).getTime() < now);
    const warning = open.filter((item) =>
      getSlaState(item, settings.slaWarningPercent, now) === SLA_STATES.WARNING
    );
    const critical = open.filter((item) => item.priority === "critica" || item.priority === "alta");
    const resolvedWithDates = resolved.filter((item) => item.createdAt && getResolvedDate(item));
    const resolvedWithinSla = resolved.filter((item) =>
      getSlaState(item, settings.slaWarningPercent, now) === SLA_STATES.MET
    );
    const avgResolutionHours = resolvedWithDates.length
      ? resolvedWithDates.reduce((sum, item) => {
          const created = new Date(item.createdAt).getTime();
          const resolvedAt = new Date(getResolvedDate(item)).getTime();
          return sum + Math.max(0, resolvedAt - created);
        }, 0) / resolvedWithDates.length / 1000 / 60 / 60
      : 0;
    const activeInventory = inventory.filter((item) => item.status === "activo");
    const inventoryWithoutResponsible = activeInventory.filter((item) => !item.responsible?.trim());
    const nextMaintenance = maintenances
      .filter((item) => item.status === "programado")
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

    return {
      total: incidents.length,
      open: open.length,
      resolved: resolved.length,
      overdue: overdue.length,
      warning: warning.length,
      critical: critical.length,
      avgResolutionHours,
      compliancePercent: resolved.length
        ? (resolvedWithinSla.length / resolved.length) * 100
        : 0,
      activeInventory: activeInventory.length,
      inventoryWithoutResponsible: inventoryWithoutResponsible.length,
      nextMaintenance,
    };
  }, [incidents, inventory, maintenances, now, settings.slaWarningPercent]);

  const byDepartment = useMemo(() => {
    const counts = incidents.reduce((acc, item) => {
      const key = item.department || "Sin departamento";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [incidents]);

  const byPriority = useMemo(() => {
    const open = incidents.filter((item) => item.status !== "resuelto");
    return ["critica", "alta", "media", "baja"].map((priority) => ({
      priority,
      count: open.filter((item) => (item.priority || "media") === priority).length,
    }));
  }, [incidents]);

  const attentionQueue = useMemo(() => {
    return incidents
      .filter((item) => item.status !== "resuelto")
      .sort((a, b) => {
        const aLate = a.dueAt && new Date(a.dueAt).getTime() < now ? 1 : 0;
        const bLate = b.dueAt && new Date(b.dueAt).getTime() < now ? 1 : 0;
        if (aLate !== bLate) return bLate - aLate;
        return new Date(a.dueAt || a.createdAt) - new Date(b.dueAt || b.createdAt);
      })
      .slice(0, 6);
  }, [incidents, now]);

  const incidentTrend = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);

    const periods = [
      { label: "Hace 4 sem.", from: 0, to: 5 },
      { label: "Hace 3 sem.", from: 6, to: 11 },
      { label: "Hace 2 sem.", from: 12, to: 17 },
      { label: "Semana pasada", from: 18, to: 23 },
      { label: "Esta semana", from: 24, to: 29 },
    ];

    return periods.map((period) => ({
      label: period.label,
      count: incidents.filter((incident) => {
        const createdAt = new Date(incident.createdAt).getTime();
        if (!Number.isFinite(createdAt)) return false;
        const day = Math.floor((createdAt - start.getTime()) / dayMs);
        return day >= period.from && day <= period.to;
      }).length,
    }));
  }, [incidents]);

  const recentActivity = useMemo(() => {
    const activity = [
      ...incidents.map((incident) => ({
        id: `incident-${incident._id}`,
        type: "Incidencia",
        title: incident.status === "resuelto" ? `Se resolvio ${getFolio(incident)}` : `Se actualizo ${getFolio(incident)}`,
        detail: incident.title || "Incidencia sin titulo",
        date: incident.updatedAt || incident.createdAt,
        path: `/incidents/${incident._id}`,
      })),
      ...maintenances.map((maintenance) => ({
        id: `maintenance-${maintenance._id}`,
        type: "Mantenimiento",
        title: maintenance.status === "finalizado" ? "Mantenimiento finalizado" : "Mantenimiento programado",
        detail: maintenance.title || "Mantenimiento sin titulo",
        date: maintenance.updatedAt || maintenance.createdAt || maintenance.date,
        path: "/maintenance",
      })),
      ...inventory.map((item) => ({
        id: `inventory-${item._id}`,
        type: "Inventario",
        title: item.status === "baja" ? "Articulo dado de baja" : "Articulo registrado",
        detail: [item.model, item.brand].filter(Boolean).join(" / ") || "Articulo sin nombre",
        date: item.updatedAt || item.createdAt,
        path: "/inventory",
      })),
    ];

    return activity
      .filter((item) => item.date && Number.isFinite(new Date(item.date).getTime()))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);
  }, [incidents, inventory, maintenances]);

  const maxDepartmentCount = Math.max(...byDepartment.map(([, count]) => count), 1);
  const maxPriorityCount = Math.max(...byPriority.map((item) => item.count), 1);
  const maxTrendCount = Math.max(...incidentTrend.map((item) => item.count), 1);
  const currentDate = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="dashboard">
      <header className="header">
        <div>
          <span className="eyebrow">Resumen operativo</span>
          <h1>Panel ejecutivo</h1>
          <p>Bienvenido, {user?.nombre || "usuario"} · {currentDate}</p>
        </div>
        <div className="header-actions">
          <button className="secondary-action" onClick={() => navigate("/inventory")}>Ver inventario</button>
          <button className="primary-action" onClick={() => navigate("/create")}>Nueva incidencia</button>
          <span className="role-badge">{user?.role || "sin rol"}</span>
        </div>
      </header>

      <section className={`operation-status ${stats.overdue > 0 ? "attention" : "healthy"}`}>
        <div className="status-indicator" />
        <div>
          <strong>{stats.overdue > 0 ? "La operacion requiere atencion" : "Operacion dentro de los tiempos establecidos"}</strong>
          <span>
            {stats.overdue > 0
              ? `${stats.overdue} incidencia${stats.overdue === 1 ? "" : "s"} con SLA vencido.`
              : `${stats.open} incidencia${stats.open === 1 ? "" : "s"} abierta${stats.open === 1 ? "" : "s"} y ninguna vencida.`}
          </span>
        </div>
        <button onClick={() => navigate("/incidents")}>Revisar incidencias</button>
      </section>

      <section className="kpis">
        <button className="metric" onClick={() => navigate("/incidents")}>
          <span>Incidencias abiertas</span>
          <strong>{stats.open}</strong>
          <small>{stats.total} historicas</small>
        </button>
        <button className={`metric ${stats.overdue > 0 ? "danger" : "success"}`} onClick={() => navigate("/incidents")}>
          <span>SLA vencido</span>
          <strong>{stats.overdue}</strong>
          <small>{stats.overdue > 0 ? "Requiere seguimiento" : "Todo en tiempo"}</small>
        </button>
        <button className="metric warning" onClick={() => navigate("/incidents")}>
          <span>Alta prioridad</span>
          <strong>{stats.critical}</strong>
          <small>Criticas y altas abiertas</small>
        </button>
        <button className="metric" onClick={() => navigate("/inventory")}>
          <span>Inventario activo</span>
          <strong>{stats.activeInventory}</strong>
          <small>{stats.inventoryWithoutResponsible} sin responsable asignado</small>
        </button>
      </section>

      <section className="executive-grid">
        <div className="panel large">
          <div className="panel-title">
            <h2>Focos de atencion</h2>
            <button onClick={() => navigate("/incidents")}>Ver todo</button>
          </div>

          {attentionQueue.length === 0 ? (
            <div className="empty-state">No hay incidencias abiertas.</div>
          ) : (
            attentionQueue.map((incident) => {
              const slaState = getSlaState(incident, settings.slaWarningPercent, now);
              const late = slaState === SLA_STATES.OVERDUE;
              return (
                <button
                  key={incident._id}
                  className={`queue-item ${late ? "late" : slaState === SLA_STATES.WARNING ? "warning" : ""}`}
                  onClick={() => navigate(`/incidents/${incident._id}`)}
                >
                  <div>
                    <span>{getFolio(incident)}</span>
                    <strong>{incident.title}</strong>
                    <small>{incident.branch?.name || incident.branch || "Sin sucursal"} · {incident.department || "Sin departamento"}</small>
                  </div>
                  <div className="queue-meta">
                    <b>{priorityLabels[incident.priority] || "Media"}</b>
                    <small>{slaState === SLA_STATES.WARNING ? "Proxima a vencer" : formatDate(incident.dueAt)}</small>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="panel">
          <h2>Cumplimiento</h2>
          <div className="score">
            <strong>{stats.compliancePercent.toFixed(0)}%</strong>
            <span>resueltas dentro del SLA</span>
            <small>
              {stats.resolved} resueltas · Promedio: {stats.avgResolutionHours ? `${stats.avgResolutionHours.toFixed(1)} h` : "sin datos"}
            </small>
          </div>
          <div className="next-maintenance">
            <span>Proximas a vencer</span>
            <b>{stats.warning}</b>
            <small>Incidencias abiertas en zona de alerta</small>
          </div>
          <div className="next-maintenance">
            <span>Proximo mantenimiento</span>
            <b>{stats.nextMaintenance?.title || "Sin programar"}</b>
            <small>{stats.nextMaintenance ? formatDate(stats.nextMaintenance.date) : "Agenda limpia"}</small>
          </div>
        </div>

        <div className="panel">
          <h2>Abiertas por prioridad</h2>
          <div className="bars">
            {byPriority.map((item) => (
              <div className="bar-row" key={item.priority}>
                <span>{priorityLabels[item.priority]}</span>
                <div><i style={{ width: `${(item.count / maxPriorityCount) * 100}%` }} /></div>
                <b>{item.count}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Departamentos con mas reportes</h2>
          <div className="bars">
            {byDepartment.length === 0 ? (
              <div className="empty-state">Sin datos por mostrar.</div>
            ) : (
              byDepartment.map(([department, count]) => (
                <div className="bar-row" key={department}>
                  <span>{department}</span>
                  <div><i style={{ width: `${(count / maxDepartmentCount) * 100}%` }} /></div>
                  <b>{count}</b>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="insights-grid">
        <div className="panel trend-panel">
          <div className="panel-title">
            <div>
              <h2>Tendencia de incidencias</h2>
              <p>Reportes creados durante los ultimos 30 dias</p>
            </div>
            <b>{incidentTrend.reduce((sum, item) => sum + item.count, 0)} reportes</b>
          </div>
          <div className="trend-chart" aria-label="Incidencias creadas en los ultimos 30 dias">
            {incidentTrend.map((item) => (
              <div className="trend-column" key={item.label}>
                <div className="trend-value">{item.count}</div>
                <div className="trend-track">
                  <i style={{ height: `${Math.max((item.count / maxTrendCount) * 100, item.count ? 8 : 2)}%` }} />
                </div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel activity-panel">
          <div className="panel-title">
            <div>
              <h2>Actividad reciente</h2>
              <p>Ultimos movimientos de la operacion</p>
            </div>
          </div>
          {recentActivity.length === 0 ? (
            <div className="empty-state">Todavia no hay actividad para mostrar.</div>
          ) : (
            <div className="activity-list">
              {recentActivity.map((item) => (
                <button key={item.id} className="activity-item" onClick={() => navigate(item.path)}>
                  <span className={`activity-icon ${item.type.toLowerCase()}`}>{item.type.slice(0, 1)}</span>
                  <span className="activity-copy">
                    <b>{item.title}</b>
                    <small>{item.detail}</small>
                  </span>
                  <time>{formatDate(item.date)}</time>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <style>{`
        .dashboard { min-height: 100vh; padding: 28px; color: #fff; }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }
        .header h1 { font-size: 26px; line-height: 1.15; }
        .header p { color: #94a3b8; font-size: 14px; margin-top: 5px; }
        .eyebrow {
          display: block;
          margin-bottom: 6px;
          color: #60a5fa;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .header-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
        .header-actions button,
        .operation-status button {
          padding: 9px 13px;
          border-radius: 8px;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .primary-action {
          border: 1px solid #2563eb;
          background: #2563eb;
          color: #fff;
        }
        .secondary-action {
          border: 1px solid rgba(148,163,184,0.24);
          background: rgba(255,255,255,0.045);
          color: #cbd5e1;
        }
        .role-badge {
          padding: 7px 13px;
          border-radius: 999px;
          background: rgba(255,255,255,0.07);
          color: #cbd5e1;
          font-size: 12px;
          text-transform: capitalize;
        }
        .operation-status {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 13px;
          padding: 14px 16px;
          margin-bottom: 18px;
          border: 1px solid rgba(34,197,94,0.2);
          border-radius: 9px;
          background: linear-gradient(90deg, rgba(34,197,94,0.1), rgba(255,255,255,0.025));
        }
        .operation-status.attention {
          border-color: rgba(239,68,68,0.25);
          background: linear-gradient(90deg, rgba(239,68,68,0.11), rgba(255,255,255,0.025));
        }
        .status-indicator {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 0 5px rgba(34,197,94,0.12);
        }
        .operation-status.attention .status-indicator {
          background: #ef4444;
          box-shadow: 0 0 0 5px rgba(239,68,68,0.12);
        }
        .operation-status strong { display: block; color: #e2e8f0; font-size: 13px; }
        .operation-status span { display: block; margin-top: 3px; color: #94a3b8; font-size: 12px; }
        .operation-status button {
          border: 1px solid rgba(96,165,250,0.3);
          background: rgba(96,165,250,0.1);
          color: #bfdbfe;
        }
        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }
        .metric {
          min-height: 118px;
          padding: 17px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.045);
          color: inherit;
          text-align: left;
          cursor: pointer;
          transition: 0.2s;
        }
        .metric:hover { transform: translateY(-2px); border-color: rgba(96,165,250,0.35); }
        .metric span, .metric small { color: #94a3b8; font-size: 12px; }
        .metric strong {
          display: block;
          margin: 8px 0 5px;
          font-size: 27px;
          color: #e2e8f0;
          overflow-wrap: anywhere;
        }
        .metric.danger strong { color: #fca5a5; }
        .metric.success strong { color: #86efac; }
        .metric.warning strong { color: #fbbf24; }
        .executive-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
          gap: 18px;
        }
        .panel {
          min-width: 0;
          padding: 18px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.045);
        }
        .panel.large { grid-row: span 3; }
        .panel-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .panel h2, .panel-title h2 { font-size: 15px; color: #e2e8f0; margin-bottom: 12px; }
        .panel-title h2 { margin-bottom: 0; }
        .panel-title p { margin-top: 4px; color: #64748b; font-size: 12px; }
        .panel-title > b { color: #93c5fd; font-size: 12px; white-space: nowrap; }
        .panel-title button {
          padding: 7px 10px;
          border-radius: 7px;
          border: 1px solid rgba(96,165,250,0.28);
          background: rgba(96,165,250,0.1);
          color: #bfdbfe;
          cursor: pointer;
        }
        .queue-item {
          width: 100%;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 13px 0;
          border: 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }
        .queue-item:hover strong { color: #93c5fd; }
        .queue-item span { color: #93c5fd; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; }
        .queue-item strong { display: block; margin: 4px 0; font-size: 14px; overflow-wrap: anywhere; }
        .queue-item small { color: #94a3b8; font-size: 12px; }
        .queue-item.late .queue-meta b { color: #fca5a5; }
        .queue-item.warning { border-color: rgba(245,158,11,0.28); background: rgba(245,158,11,0.07); }
        .queue-item.warning .queue-meta b { color: #fbbf24; }
        .queue-meta {
          flex: 0 0 145px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        .queue-meta b { color: #fbbf24; font-size: 12px; }
        .score {
          padding: 14px;
          border-radius: 8px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.2);
          margin-bottom: 12px;
        }
        .score strong { display: block; color: #86efac; font-size: 30px; }
        .score span, .score small, .next-maintenance span, .next-maintenance small {
          display: block;
          color: #94a3b8;
          font-size: 12px;
        }
        .next-maintenance {
          padding: 14px;
          border-radius: 8px;
          background: rgba(96,165,250,0.08);
          border: 1px solid rgba(96,165,250,0.2);
        }
        .next-maintenance b {
          display: block;
          color: #e2e8f0;
          margin: 5px 0;
          overflow-wrap: anywhere;
        }
        .bars { display: grid; gap: 11px; }
        .bar-row {
          display: grid;
          grid-template-columns: 95px minmax(0, 1fr) 30px;
          gap: 10px;
          align-items: center;
          font-size: 12px;
          color: #cbd5e1;
        }
        .bar-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bar-row div {
          height: 8px;
          border-radius: 999px;
          background: rgba(148,163,184,0.18);
          overflow: hidden;
        }
        .bar-row i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #60a5fa;
        }
        .bar-row b { text-align: right; color: #e2e8f0; }
        .empty-state {
          padding: 14px;
          border-radius: 8px;
          border: 1px dashed rgba(255,255,255,0.15);
          color: #94a3b8;
          font-size: 13px;
        }
        .insights-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
          gap: 18px;
          margin-top: 18px;
        }
        .trend-chart {
          height: 230px;
          display: grid;
          grid-template-columns: repeat(5, minmax(52px, 1fr));
          gap: 12px;
          align-items: end;
          padding-top: 12px;
        }
        .trend-column {
          height: 100%;
          display: grid;
          grid-template-rows: 20px minmax(100px, 1fr) 34px;
          gap: 7px;
          text-align: center;
        }
        .trend-value { color: #dbeafe; font-size: 12px; font-weight: 800; }
        .trend-track {
          position: relative;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          border-bottom: 1px solid rgba(148,163,184,0.16);
          background: linear-gradient(to top, rgba(148,163,184,0.06) 1px, transparent 1px);
          background-size: 100% 25%;
        }
        .trend-track i {
          display: block;
          width: min(42px, 68%);
          min-height: 3px;
          border-radius: 7px 7px 2px 2px;
          background: linear-gradient(180deg, #60a5fa, #2563eb);
          box-shadow: 0 8px 20px rgba(37,99,235,0.2);
        }
        .trend-column > span { color: #94a3b8; font-size: 10px; line-height: 1.2; }
        .activity-list { display: grid; }
        .activity-item {
          width: 100%;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          padding: 11px 0;
          border: 0;
          border-bottom: 1px solid rgba(148,163,184,0.1);
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }
        .activity-item:last-child { border-bottom: 0; }
        .activity-item:hover .activity-copy b { color: #93c5fd; }
        .activity-icon {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: rgba(96,165,250,0.12);
          color: #93c5fd;
          font-size: 11px;
          font-weight: 800;
        }
        .activity-icon.mantenimiento { background: rgba(245,158,11,0.12); color: #fbbf24; }
        .activity-icon.inventario { background: rgba(34,197,94,0.12); color: #86efac; }
        .activity-copy { min-width: 0; }
        .activity-copy b, .activity-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .activity-copy b { color: #e2e8f0; font-size: 12px; }
        .activity-copy small, .activity-item time { margin-top: 3px; color: #64748b; font-size: 10px; }
        .activity-item time { white-space: nowrap; }
        @media (max-width: 1000px) {
          .executive-grid, .insights-grid { grid-template-columns: 1fr; }
          .panel.large { grid-row: auto; }
        }
        @media (max-width: 650px) {
          .dashboard { padding: 16px; }
          .header { align-items: flex-start; flex-direction: column; }
          .header-actions { width: 100%; }
          .header-actions button { flex: 1; }
          .operation-status { grid-template-columns: auto 1fr; }
          .operation-status button { grid-column: 1 / -1; }
          .queue-item { flex-direction: column; }
          .queue-meta { flex: auto; align-items: flex-start; }
          .bar-row { grid-template-columns: 82px minmax(0, 1fr) 28px; }
          .trend-chart { gap: 6px; overflow-x: auto; }
          .activity-item { grid-template-columns: 34px minmax(0, 1fr); }
          .activity-item time { grid-column: 2; margin-top: -6px; }
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
