import { useCallback, useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

const priorityLabels = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Critica",
};

function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [now] = useState(() => Date.now());
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const critical = open.filter((item) => item.priority === "critica" || item.priority === "alta");
    const resolvedWithDates = resolved.filter((item) => item.createdAt && getResolvedDate(item));
    const avgResolutionHours = resolvedWithDates.length
      ? resolvedWithDates.reduce((sum, item) => {
          const created = new Date(item.createdAt).getTime();
          const resolvedAt = new Date(getResolvedDate(item)).getTime();
          return sum + Math.max(0, resolvedAt - created);
        }, 0) / resolvedWithDates.length / 1000 / 60 / 60
      : 0;
    const inventoryValue = inventory
      .filter((item) => item.status === "activo")
      .reduce((sum, item) => sum + Number(item.price || 0), 0);
    const nextMaintenance = maintenances
      .filter((item) => item.status === "programado")
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

    return {
      total: incidents.length,
      open: open.length,
      resolved: resolved.length,
      overdue: overdue.length,
      critical: critical.length,
      avgResolutionHours,
      inventoryValue,
      nextMaintenance,
    };
  }, [incidents, inventory, maintenances, now]);

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

  const formatCurrency = (value) =>
    Number(value || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  const maxDepartmentCount = Math.max(...byDepartment.map(([, count]) => count), 1);
  const maxPriorityCount = Math.max(...byPriority.map((item) => item.count), 1);

  return (
    <div className="dashboard">
      <header className="header">
        <div>
          <h1>Panel ejecutivo</h1>
          <p>Bienvenido, {user?.nombre || "usuario"}</p>
        </div>
        <span className="role-badge">{user?.role || "sin rol"}</span>
      </header>

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
          <span>Valor activo</span>
          <strong>{formatCurrency(stats.inventoryValue)}</strong>
          <small>{inventory.filter((item) => item.status === "activo").length} equipos activos</small>
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
              const late = incident.dueAt && new Date(incident.dueAt).getTime() < now;
              return (
                <button
                  key={incident._id}
                  className={`queue-item ${late ? "late" : ""}`}
                  onClick={() => navigate(`/incidents/${incident._id}`)}
                >
                  <div>
                    <span>{getFolio(incident)}</span>
                    <strong>{incident.title}</strong>
                    <small>{incident.branch?.name || incident.branch || "Sin sucursal"} · {incident.department || "Sin departamento"}</small>
                  </div>
                  <div className="queue-meta">
                    <b>{priorityLabels[incident.priority] || "Media"}</b>
                    <small>{formatDate(incident.dueAt)}</small>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="panel">
          <h2>Cumplimiento</h2>
          <div className="score">
            <strong>{stats.resolved}</strong>
            <span>resueltas</span>
            <small>
              Promedio: {stats.avgResolutionHours ? `${stats.avgResolutionHours.toFixed(1)} h` : "sin datos"}
            </small>
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
        .role-badge {
          padding: 7px 13px;
          border-radius: 999px;
          background: rgba(255,255,255,0.07);
          color: #cbd5e1;
          font-size: 12px;
          text-transform: capitalize;
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
        @media (max-width: 1000px) {
          .executive-grid { grid-template-columns: 1fr; }
          .panel.large { grid-row: auto; }
        }
        @media (max-width: 650px) {
          .dashboard { padding: 16px; }
          .header { align-items: flex-start; flex-direction: column; }
          .queue-item { flex-direction: column; }
          .queue-meta { flex: auto; align-items: flex-start; }
          .bar-row { grid-template-columns: 82px minmax(0, 1fr) 28px; }
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
