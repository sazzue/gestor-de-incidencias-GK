import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;
function MonthlyEvaluationResults() {
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit",
  }).format(new Date()));
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadResults = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_URL}/api/evaluations/monthly/results?month=${encodeURIComponent(month)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || "No se pudieron cargar los resultados.");
        if (active) setReport(data);
      } catch (requestError) {
        if (active) { setReport(null); setError(requestError.message); }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadResults();
    return () => { active = false; };
  }, [month]);

  return (
    <section className="monthly-results">
      <header className="monthly-results-head">
        <div><p className="eyebrow">Sistemas</p><h1>Evaluaciones mensuales</h1><p>Consolidado de puntos de bono por sucursal y gerente.</p></div>
        <label>Mes <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      </header>
      {error && <p className="results-error" role="alert">{error}</p>}
      {loading && <p className="results-muted">Cargando resultados…</p>}
      {!loading && report && <>
        <div className="results-summary">
          <article><span>Puntos acumulados</span><strong>{report.totalPoints} / {report.possiblePoints}</strong></article>
          <article><span>Logro mensual promedio</span><strong>{report.attainment}%</strong></article>
          <article><span>Gerentes que respondieron</span><strong>{report.count} / {report.expectedCount}</strong></article>
          <article className={report.targetReached ? "goal-met" : "goal-pending"}><span>Meta de 100 puntos</span><strong>{report.targetReached ? "Alcanzada" : "No alcanzada"}</strong></article>
        </div>
        <p className="results-note">El total suma los puntos recibidos y considera también las evaluaciones pendientes. Cada sucursal muestra los gerentes elegibles, su estado y puntaje.</p>
        {report.branches.length === 0 ? <div className="results-empty">No hay sucursales registradas para esta empresa.</div> : (
          <div className="results-table-wrap"><table className="results-table">
            <thead><tr><th>Sucursal</th><th>Gerente elegible</th><th>Estado</th><th>Puntos</th></tr></thead>
            {report.branches.map((branch) => <tbody key={branch.id}>
              <tr className="branch-heading"><th colSpan="4">{branch.name} · {branch.status === "sin_gerente_elegible" ? "Sin gerente elegible" : branch.status === "respondida" ? "Respondida" : "Pendiente"}</th></tr>
              {branch.managers.length === 0 ? <tr><td>{branch.name}</td><td>—</td><td>Sin gerente elegible</td><td>—</td></tr> : branch.managers.map((manager) => (
                <tr key={manager.managerId}>
                  <td>{branch.name}</td><td>{manager.managerName}</td>
                  <td><span className={`response-state ${manager.status}`}>{manager.status === "respondida" ? "Respondió" : "Pendiente"}</span></td>
                  <td>{manager.score === null ? "—" : `${manager.score} / 100`}</td>
                </tr>
              ))}
              {branch.managers.length > 0 && <tr className="branch-total"><td colSpan="3">Total de sucursal ({branch.submittedCount}/{branch.expectedCount} respondidas)</td><td><strong>{branch.totalPoints} / {branch.possiblePoints}</strong></td></tr>}
            </tbody>)}
          </table></div>
        )}
      </>}
      <style>{`
        .monthly-results { max-width: 1320px; margin: 0 auto; padding: 32px; color: #e2e8f0; }
        .monthly-results-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
        .monthly-results h1 { color: white; font-size: 28px; margin: 3px 0 6px; }
        .monthly-results-head p, .results-muted, .results-note { color: #94a3b8; }
        .monthly-results .eyebrow { color: #60a5fa; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
        .monthly-results-head label { display: flex; align-items: center; gap: 9px; color: #cbd5e1; }
        .monthly-results input { padding: 9px 11px; border: 1px solid #334155; border-radius: 8px; background: #111827; color: white; }
        .results-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
        .results-summary article { display: flex; flex-direction: column; gap: 8px; padding: 18px; border: 1px solid #263449; border-radius: 12px; background: #111827; }
        .results-summary article span { color: #94a3b8; font-size: 13px; }
        .results-summary article strong { color: white; font-size: 22px; }
        .results-summary .goal-met { border-color: rgba(34,197,94,.4); } .results-summary .goal-met strong { color: #86efac; }
        .results-summary .goal-pending { border-color: rgba(245,158,11,.35); } .results-summary .goal-pending strong { color: #fbbf24; }
        .results-note { margin: 0 0 18px; font-size: 13px; }
        .results-table-wrap { overflow: auto; border: 1px solid #263449; border-radius: 12px; }
        .results-table { width: 100%; border-collapse: collapse; background: #111827; font-size: 13px; }
        .results-table th, .results-table td { padding: 12px; text-align: left; border-bottom: 1px solid #263449; white-space: nowrap; }
        .results-table th { color: #bfdbfe; background: #172554; font-size: 12px; }
        .results-table .branch-heading th { padding-top: 16px; background: #1e293b; color: #fff; font-size: 14px; }
        .results-table .branch-total td { background: rgba(30,41,59,.65); font-weight: 700; }
        .response-state { font-weight: 700; text-transform: capitalize; }
        .response-state.respondida { color: #86efac; } .response-state.pendiente { color: #fbbf24; }
        .results-table td { color: #cbd5e1; }
        .results-table tbody tr:last-child td { border-bottom: 0; }
        .results-empty { padding: 24px; border: 1px dashed #475569; border-radius: 12px; color: #94a3b8; text-align: center; }
        .results-error { padding: 12px; color: #fecaca; background: rgba(127,29,29,.3); border-radius: 8px; }
        @media (max-width: 900px) { .results-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 600px) { .monthly-results { padding: 20px 14px; } .monthly-results-head { align-items: stretch; flex-direction: column; } .results-summary { grid-template-columns: 1fr 1fr; gap: 8px; } .results-summary article { padding: 13px; } .results-summary article strong { font-size: 18px; } }
      `}</style>
    </section>
  );
}

export default MonthlyEvaluationResults;
