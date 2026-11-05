import Sidebar from "./Sidebar";
import { useSystemSettings } from "../hooks/useSystemSettings";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

function Layout({ children }) {
  useSystemSettings();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  const [refreshEvaluation, setRefreshEvaluation] = useState(0);
  const responseOptions = [
    "Cumplimiento total · 100%",
    "Cumplimiento mayoritario · 75%",
    "Cumplimiento parcial · 50%",
    "Cumplimiento insuficiente · 0%",
    "No iniciado / nulo · 0%",
  ];

  const criteria = [
    { id: "urgent", title: "Respuesta de solicitudes urgentes", weight: 50, description: "Resuelve de inmediato solicitudes que afectan ventas u operación." },
    { id: "application", title: "Respuestas en aplicación", weight: 20, description: "Actualiza el estatus de cada solicitud." },
    { id: "followup", title: "Seguimiento de problema", weight: 15, description: "Da seguimiento a cada incidencia hasta cerrarla." },
    { id: "maintenance", title: "Mantenimientos preventivos", weight: 5, description: "Realiza limpieza y revisión de equipos en tiempo y forma." },
    { id: "service", title: "Actitud de servicio", weight: 5, description: "Trato amable, atento y paciente con el personal." },
    { id: "communication", title: "Comunicación clara", weight: 5, description: "Explica la solución y los pasos con claridad." },
  ];

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("token");
    try {
      if (!token || jwtDecode(token).role !== "gerencia") { setEvaluation({ eligible: false }); return; }
    } catch { setEvaluation({ eligible: false }); return; }
    const checkStatus = () => fetch(`${import.meta.env.VITE_API_URL}/api/evaluations/monthly/status`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (response) => {
      if (!response.ok) throw new Error("No se pudo consultar la evaluacion mensual.");
      return response.json();
    }).then((data) => { if (active) setEvaluation({ eligible: true, ...data }); })
      .catch(() => { if (active) setEvaluation({ eligible: false }); });
    checkStatus();
    const interval = setInterval(checkStatus, 60_000);
    return () => { active = false; clearInterval(interval); };
  }, [refreshEvaluation]);

  const skipKey = evaluation?.month ? `monthly-evaluation-skipped:${evaluation.month}` : "";
  const skipped = skipKey && sessionStorage.getItem(skipKey) === "1";
  const showEvaluation = evaluation?.eligible && !evaluation.submitted && (evaluation.locked || !skipped);

  const submitEvaluation = async (event) => {
    event.preventDefault();
    setSaving(true);
    setEvaluationError("");
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/evaluations/monthly`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ answers: criteria.map(({ id }) => ({ criterion: id, rating: Number(answers[id]), comment: answers[`${id}-comment`] || "" })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "No se pudo guardar la evaluacion.");
      setEvaluation((current) => current ? { ...current, submitted: true, score: data.score } : current);
      setRefreshEvaluation((value) => value + 1);
    } catch (error) { setEvaluationError(error.message); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsSidebarOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="app-layout">
        <button
          className="mobile-menu-btn"
          type="button"
          aria-label="Abrir menu"
          onClick={() => setIsSidebarOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        {isSidebarOpen && (
          <button
            className="sidebar-backdrop"
            type="button"
            aria-label="Cerrar menu"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <Sidebar
          isOpen={isSidebarOpen}
          onNavigate={() => setIsSidebarOpen(false)}
        />
        <main className="app-main">
          {children}
        </main>
      </div>

      {evaluation?.eligible && !evaluation.submitted && skipped && !evaluation.locked && (
        <button className="evaluation-reminder" onClick={() => { sessionStorage.removeItem(skipKey); setRefreshEvaluation((value) => value + 1); }}>
          Evaluacion mensual pendiente
        </button>
      )}
      {showEvaluation && (
        <div className="evaluation-backdrop">
          <section className="evaluation-dialog" role="dialog" aria-modal="true" aria-labelledby="evaluation-title">
            <header><span className="evaluation-month">Mes evaluado: {new Date(`${evaluation.month}-01T12:00:00Z`).toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" })}</span><h1 id="evaluation-title">Desempeño del departamento de Sistemas</h1>
              <p>Califica el servicio recibido este mes según tu experiencia en tu sucursal.</p>
            </header>
            <form onSubmit={submitEvaluation}>
              {criteria.map((item) => (
                <fieldset key={item.id} className="evaluation-item">
                  <legend>{item.title} <span>{item.weight}%</span></legend>
                  <p>{item.description}</p>
                  <div className="rating-options" role="radiogroup" aria-label={item.title}>
                  {responseOptions.map((label, index) => {
                    const score = index + 1;
                    return <label key={score}>
                      <input required type="radio" name={item.id} value={score} checked={Number(answers[item.id]) === score} onChange={() => setAnswers((old) => ({ ...old, [item.id]: score }))} />
                      <span>{label}</span>
                    </label>;
                  })}
                  </div>
                  <input className="evaluation-comment" maxLength={500} placeholder="Comentario opcional" value={answers[`${item.id}-comment`] || ""} onChange={(event) => setAnswers((old) => ({ ...old, [`${item.id}-comment`]: event.target.value }))} />
                </fieldset>
              ))}
              {evaluationError && <p className="evaluation-error" role="alert">{evaluationError}</p>}
              <footer><small>Calificacion ponderada: la respuesta a solicitudes urgentes representa la mitad del resultado.</small>
                <div>{!evaluation.locked && <button type="button" className="evaluation-skip" onClick={() => { sessionStorage.setItem(skipKey, "1"); setEvaluation({ ...evaluation }); }}>Omitir por ahora</button>}
                  <button className="evaluation-submit" disabled={saving}>{saving ? "Guardando…" : "Enviar evaluacion"}</button></div>
              </footer>
            </form>
          </section>
        </div>
      )}

      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          background: var(--app-bg);
          color: var(--app-text);
          font-family: 'Inter', sans-serif;
        }

        .app-layout {
          display: flex;
          min-height: 100vh;
          background: var(--app-bg);
          color: var(--app-text);
          font-family: 'Inter', sans-serif;
        }

        .app-main {
          flex: 1;
          overflow-y: auto;
          min-width: 0;
        }

        .evaluation-backdrop { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center; padding: 20px; background: rgba(2,6,23,.84); backdrop-filter: blur(8px); }
        .evaluation-dialog { width: min(760px, 100%); max-height: min(92vh, 900px); overflow-y: auto; padding: 28px; border: 1px solid rgba(148,163,184,.22); border-radius: 18px; background: #111827; color: #e2e8f0; box-shadow: 0 24px 90px rgba(0,0,0,.55); }
        .evaluation-dialog header span { color: #60a5fa; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
        .evaluation-dialog header .evaluation-month { display: inline-flex; margin-bottom: 8px; padding: 6px 10px; border-radius: 999px; background: rgba(59,130,246,.14); }
        .evaluation-dialog h1 { margin: 8px 0; color: white; font-size: 24px; }
        .evaluation-dialog header p, .evaluation-item p { color: #aab7ca; font-size: 14px; }
        .evaluation-item { min-width: 0; margin: 18px 0; padding: 14px; border: 1px solid rgba(148,163,184,.2); border-radius: 12px; }
        .evaluation-item legend { padding: 0 6px; color: white; font-weight: 700; }
        .evaluation-item legend span { color: #60a5fa; margin-left: 5px; }
        .rating-options { display: flex; gap: 8px; margin: 12px 0; flex-wrap: wrap; }
        .rating-options label { cursor: pointer; }
        .rating-options input { position: absolute; opacity: 0; }
        .rating-options label span { display: block; min-width: 50px; padding: 8px; text-align: center; border: 1px solid #475569; border-radius: 8px; }
        .rating-options input:checked + span { color: white; border-color: #3b82f6; background: #1d4ed8; }
        .rating-options input:focus-visible + span { outline: 2px solid white; }
        .evaluation-comment { width: 100%; padding: 9px 11px; border: 1px solid #334155; border-radius: 8px; background: #020617; color: white; }
        .evaluation-dialog footer { display: flex; gap: 14px; align-items: center; justify-content: space-between; margin-top: 20px; }
        .evaluation-dialog footer small { color: #94a3b8; }
        .evaluation-dialog footer div { display: flex; gap: 9px; flex-shrink: 0; }
        .evaluation-submit, .evaluation-skip { padding: 10px 14px; border: 0; border-radius: 9px; cursor: pointer; font-weight: 700; }
        .evaluation-submit { color: white; background: #2563eb; }
        .evaluation-submit:disabled { opacity: .65; cursor: wait; }
        .evaluation-skip { color: #cbd5e1; background: #334155; }
        .evaluation-error { color: #fca5a5; }
        .evaluation-reminder { position: fixed; right: 18px; bottom: 18px; z-index: 1500; padding: 12px 16px; border: 1px solid #3b82f6; border-radius: 10px; background: #172554; color: white; cursor: pointer; }
        @media (max-width: 600px) { .evaluation-dialog { padding: 20px 15px; } .evaluation-dialog h1 { font-size: 20px; } .evaluation-dialog footer { align-items: stretch; flex-direction: column; } .evaluation-dialog footer div { justify-content: flex-end; } }

        .mobile-menu-btn,
        .sidebar-backdrop {
          display: none;
        }

        @media (max-width: 768px) {
          .app-layout {
            display: block;
            min-height: 100vh;
          }

          .app-main {
            min-height: 100vh;
            padding-top: 58px;
          }

          .mobile-menu-btn {
            position: fixed;
            top: 12px;
            left: 12px;
            z-index: 1000;
            width: 42px;
            height: 42px;
            display: inline-flex;
            flex-direction: column;
            justify-content: center;
            gap: 5px;
            padding: 0 10px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.12);
            background: color-mix(in srgb, var(--app-card) 88%, transparent);
            color: var(--app-title);
            box-shadow: 0 10px 30px rgba(0,0,0,0.28);
            backdrop-filter: blur(12px);
            cursor: pointer;
          }

          .mobile-menu-btn span {
            display: block;
            width: 100%;
            height: 2px;
            border-radius: 999px;
            background: var(--app-title);
          }

          .sidebar-backdrop {
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: block;
            border: none;
            background: rgba(2,6,23,0.58);
            backdrop-filter: blur(2px);
            cursor: pointer;
          }
        }
      `}</style>
    </>
  );
}

export default Layout;
