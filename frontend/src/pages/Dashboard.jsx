import { useCallback, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [user] = useState(() => {
    const token = localStorage.getItem("token");
    return token ? jwtDecode(token) : null;
  });
  const [now] = useState(() => Date.now());
  const navigate = useNavigate();

  const fetchIncidents = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchIncidents();
  }, [fetchIncidents]);

  const getDaysWithoutResolution = (incident) => {
    const lastChange = new Date(incident.updatedAt || incident.createdAt);
    const diff = now - lastChange.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const total = incidents.length;
  const pendientes = incidents.filter(i => i.status === "pendiente").length;
  const proceso = incidents.filter(i => i.status === "en_proceso").length;
  const resueltas = incidents.filter(i => i.status === "resuelto").length;
  const urgentes = incidents
    .filter((i) => i.status !== "resuelto" && getDaysWithoutResolution(i) > 3)
    .sort((a, b) => getDaysWithoutResolution(b) - getDaysWithoutResolution(a));

  return (
    <div className="dashboard">

      {/* HEADER */}
      <div className="header">
        <div>
          <h1>📊 Dashboard</h1>
          <p>Bienvenido, {user?.nombre}</p>
        </div>
        <span className="role-badge">{user?.role}</span>
      </div>

      {/* KPIs */}
      <div className="kpis">
        <div className="card">
          <h4>Total</h4>
          <p>{total}</p>
        </div>
        <div className="card red">
          <h4>Pendientes</h4>
          <p>{pendientes}</p>
        </div>
        <div className="card yellow">
          <h4>En proceso</h4>
          <p>{proceso}</p>
        </div>
        <div className="card green">
          <h4>Resueltas</h4>
          <p>{resueltas}</p>
        </div>
        <div className="card urgent">
          <h4>Urgentes</h4>
          <p>{urgentes.length}</p>
        </div>
      </div>

      {/* CONTENT */}
      <div className="content">
        <div className="panel">
          <h3>Últimas incidencias</h3>
          {incidents.slice(0, 5).map((inc) => (
            <div key={inc._id} className="incident-item">
              <div className="incident-left">
                <h4>{inc.title}</h4>
                <span className="dept">{inc.department || "Sin departamento"}</span>
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
          <h3>Incidencias urgentes</h3>
          <p className="panel-note">Mas de 3 dias sin resolverse.</p>

          {urgentes.length === 0 ? (
            <div className="empty-state">
              No hay incidencias urgentes.
            </div>
          ) : (
            urgentes.slice(0, 6).map((inc) => (
              <button
                key={inc._id}
                className="urgent-item"
                onClick={() => navigate("/incidents")}
              >
                <div>
                  <h4>{inc.title}</h4>
                  <span>{inc.department || "Sin departamento"}</span>
                </div>
                <strong>{getDaysWithoutResolution(inc)} dias</strong>
              </button>
            ))
          )}
        </div>
      </div>

      <style>{`
        .dashboard {
          padding: 28px;
          min-height: 100vh;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
        }

        .header h1 { font-size: 22px; }
        .header p { color: #94a3b8; font-size: 14px; margin-top: 4px; }

        .role-badge {
          background: rgba(255,255,255,0.08);
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 12px;
          text-transform: capitalize;
        }

        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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

        .card h4 { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .card p { font-size: 28px; font-weight: bold; margin-top: 6px; }

        .red p { color: #ef4444; }
        .yellow p { color: #f59e0b; }
        .green p { color: #22c55e; }
        .urgent p { color: #fb7185; }

        .content {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          margin-top: 28px;
        }

        .panel {
          background: rgba(255,255,255,0.05);
          padding: 20px;
          border-radius: 14px;
        }

        .panel h3 { margin-bottom: 15px; font-size: 15px; }
        .panel-note { color: #94a3b8; font-size: 12px; margin-bottom: 12px; }

        .incident-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 8px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          transition: 0.2s;
        }

        .incident-item:hover {
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
        }

        .incident-left h4 { font-size: 14px; margin-bottom: 3px; }
        .dept { font-size: 12px; color: #9ca3af; }

        .status {
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .pendiente { background: rgba(239,68,68,0.2); color: #ef4444; }
        .en_proceso { background: rgba(245,158,11,0.2); color: #f59e0b; }
        .resuelto { background: rgba(34,197,94,0.2); color: #22c55e; }

        .urgent-item {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 12px 10px;
          margin-bottom: 10px;
          border: 1px solid rgba(251,113,133,0.22);
          border-radius: 10px;
          background: rgba(251,113,133,0.08);
          color: inherit;
          text-align: left;
          cursor: pointer;
          transition: 0.2s;
        }

        .urgent-item:hover {
          transform: translateY(-1px);
          border-color: rgba(251,113,133,0.45);
          background: rgba(251,113,133,0.13);
        }

        .urgent-item h4 { font-size: 13px; margin-bottom: 4px; }
        .urgent-item span { color: #94a3b8; font-size: 12px; }
        .urgent-item strong {
          flex-shrink: 0;
          color: #fb7185;
          font-size: 12px;
        }

        .empty-state {
          color: #94a3b8;
          font-size: 13px;
          padding: 14px;
          border: 1px dashed rgba(255,255,255,0.12);
          border-radius: 10px;
        }

        @media (max-width: 1024px) {
          .content { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
