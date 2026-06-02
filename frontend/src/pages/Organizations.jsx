import { useEffect, useMemo, useState } from "react";
import { useAuthUser } from "../hooks/useAuthUser";

const API_URL = import.meta.env.VITE_API_URL;

const EMPTY_FORM = {
  name: "",
  slug: "",
  plan: "basic",
  status: "active",
  ownerName: "",
  ownerEmail: "",
  ownerUsername: "",
  ownerPassword: "",
};

const buildSlug = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 MB";
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatLimit = (value, formatter = (item) => item) =>
  value === null || value === undefined ? "Ilimitado" : formatter(value);

const usagePercent = (used, limit) => {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
};

const formatMoney = (value = 0) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);

const readApiResponse = async (res) => {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 120);
    throw new Error(
      preview.startsWith("<!DOCTYPE")
        ? "El servidor devolvio HTML en lugar de JSON. Revisa que el backend este desplegado y que VITE_API_URL apunte al backend correcto."
        : `Respuesta invalida del servidor: ${preview || "sin contenido"}`
    );
  }
};

function Organizations() {
  const user = useAuthUser();
  const [organizations, setOrganizations] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const token = localStorage.getItem("token");
  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/organizations`, { headers });
      const data = await readApiResponse(res);

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudieron cargar empresas" });
        return;
      }

      setOrganizations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando empresas:", error);
      setMessage({ type: "error", title: error.message || "Error de conexion" });
    } finally {
      setLoading(false);
    }
  };

  const renderMetric = (organization, metric, label, formatter) => {
    const used = organization.usage?.[metric] || 0;
    const limit = organization.limits?.[metric];
    const percent = usagePercent(used, limit);

    return (
      <div className="metric">
        <div className="metric-line">
          <span>{label}</span>
          <b>{formatter ? formatter(used) : used} / {formatLimit(limit, formatter)}</b>
        </div>
        <div className="meter">
          <span style={{ width: `${limit ? percent : 100}%` }} className={percent >= 90 ? "danger" : percent >= 75 ? "warn" : ""} />
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!user?.isPlatformAdmin) {
      setLoading(false);
      return;
    }

    loadOrganizations();
  }, [user?.isPlatformAdmin]);

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "name" && !prev.slug) {
        next.slug = buildSlug(value);
      }

      if (field === "slug") {
        next.slug = buildSlug(value);
      }

      return next;
    });
  };

  const createOrganization = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (!form.name || !form.slug) {
      setMessage({ type: "error", title: "Nombre y slug son obligatorios" });
      return;
    }

    try {
      setSaving(true);
      const owner = form.ownerName || form.ownerEmail || form.ownerPassword
        ? {
            nombre: form.ownerName,
            email: form.ownerEmail,
            username: form.ownerUsername,
            password: form.ownerPassword,
          }
        : null;

      const res = await fetch(`${API_URL}/api/organizations`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          plan: form.plan,
          status: form.status,
          owner,
        }),
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudo crear la empresa" });
        return;
      }

      setForm(EMPTY_FORM);
      setMessage({ type: "success", title: "Empresa creada correctamente" });
      await loadOrganizations();
    } catch (error) {
      console.error("Error creando empresa:", error);
      setMessage({ type: "error", title: error.message || "Error de conexion" });
    } finally {
      setSaving(false);
    }
  };

  const updateOrganization = async (organization, field, value) => {
    try {
      const res = await fetch(`${API_URL}/api/organizations/${organization._id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ [field]: value }),
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudo actualizar la empresa" });
        return;
      }

      setOrganizations((prev) => prev.map((item) => item._id === data._id ? data : item));
      setMessage({ type: "success", title: "Empresa actualizada" });
    } catch (error) {
      console.error("Error actualizando empresa:", error);
      setMessage({ type: "error", title: error.message || "Error de conexion" });
    }
  };

  const updateAddOns = async (organization, patch) => {
    const nextAddOns = {
      extraUsers: 0,
      extraBranches: 0,
      extraStorageGb: 0,
      implementation: false,
      training: false,
      ...(organization.addOns || {}),
      ...patch,
    };

    await updateOrganization(organization, "addOns", nextAddOns);
  };

  if (!user?.isPlatformAdmin) {
    return (
      <div style={{ minHeight: "100vh", padding: 28, color: "var(--app-text)", background: "var(--app-bg)" }}>
        <h2 style={{ color: "var(--app-title)", marginBottom: 8 }}>Sin acceso</h2>
        <p>Solo el super admin del sistema puede acceder a esta seccion.</p>
      </div>
    );
  }

  return (
    <div className="organizations-page">
      <div className="page-header">
        <div>
          <h1>Empresas</h1>
          <p>Administra los tenants del sistema</p>
        </div>
      </div>

      {message && (
        <div className={`notice ${message.type}`}>
          <b>{message.title}</b>
        </div>
      )}

      <section className="panel">
        <h2>Nueva empresa</h2>
        <form onSubmit={createOrganization} className="company-form">
          <input placeholder="Nombre de empresa" value={form.name} onChange={(e) => updateField("name", e.target.value)} />
          <input placeholder="slug-de-empresa" value={form.slug} onChange={(e) => updateField("slug", e.target.value)} />
          <select value={form.plan} onChange={(e) => updateField("plan", e.target.value)}>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select value={form.status} onChange={(e) => updateField("status", e.target.value)}>
            <option value="active">Activa</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspendida</option>
          </select>
          <input placeholder="Nombre del admin" value={form.ownerName} onChange={(e) => updateField("ownerName", e.target.value)} />
          <input placeholder="correo@empresa.com" value={form.ownerEmail} onChange={(e) => updateField("ownerEmail", e.target.value)} />
          <input placeholder="usuario admin" value={form.ownerUsername} onChange={(e) => updateField("ownerUsername", e.target.value)} />
          <input type="password" placeholder="Contrasena temporal" value={form.ownerPassword} onChange={(e) => updateField("ownerPassword", e.target.value)} />
          <button type="submit" disabled={saving}>{saving ? "Creando..." : "Crear empresa"}</button>
        </form>
      </section>

      <section className="table-panel">
        <div className="table-header">
          <h2>Empresas registradas</h2>
          <span>{organizations.length} empresas</span>
        </div>

        {loading ? (
          <p className="empty">Cargando empresas...</p>
        ) : organizations.length === 0 ? (
          <p className="empty">No hay empresas registradas.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Slug</th>
                  <th>Admin</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Adicionales</th>
                  <th>Uso</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((organization) => (
                  <tr key={organization._id}>
                    <td>{organization.name}</td>
                    <td><code>{organization.slug}</code></td>
                    <td>{organization.ownerUser?.email || "Sin admin"}</td>
                    <td>
                      <select value={organization.plan} onChange={(e) => updateOrganization(organization, "plan", e.target.value)}>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </td>
                    <td>
                      <select value={organization.status} onChange={(e) => updateOrganization(organization, "status", e.target.value)}>
                        <option value="active">Activa</option>
                        <option value="trial">Trial</option>
                        <option value="suspended">Suspendida</option>
                      </select>
                    </td>
                    <td>
                      <div className="addons-panel">
                        <label>
                          Usuarios extra
                          <input
                            type="number"
                            min="0"
                            value={organization.addOns?.extraUsers || 0}
                            onChange={(e) => updateAddOns(organization, { extraUsers: Number(e.target.value || 0) })}
                          />
                          <small>{formatMoney(organization.addOnPrices?.extraUsers || 99)} / mes c/u</small>
                        </label>
                        <label>
                          Sucursales extra
                          <input
                            type="number"
                            min="0"
                            value={organization.addOns?.extraBranches || 0}
                            onChange={(e) => updateAddOns(organization, { extraBranches: Number(e.target.value || 0) })}
                          />
                          <small>{formatMoney(organization.addOnPrices?.extraBranches || 199)} / mes c/u</small>
                        </label>
                        <label>
                          GB extra
                          <input
                            type="number"
                            min="0"
                            value={organization.addOns?.extraStorageGb || 0}
                            onChange={(e) => updateAddOns(organization, { extraStorageGb: Number(e.target.value || 0) })}
                          />
                          <small>{formatMoney(organization.addOnPrices?.extraStorageGb || 149)} / mes c/u</small>
                        </label>
                        <label className="inline-check">
                          <input
                            type="checkbox"
                            checked={Boolean(organization.addOns?.implementation)}
                            onChange={(e) => updateAddOns(organization, { implementation: e.target.checked })}
                          />
                          Implementacion
                          <small>{formatMoney(organization.addOnPrices?.implementation?.min || 2500)} - {formatMoney(organization.addOnPrices?.implementation?.max || 8000)}</small>
                        </label>
                        <label className="inline-check">
                          <input
                            type="checkbox"
                            checked={Boolean(organization.addOns?.training)}
                            onChange={(e) => updateAddOns(organization, { training: e.target.checked })}
                          />
                          Capacitacion
                          <small>{formatMoney(organization.addOnPrices?.training?.min || 1500)} - {formatMoney(organization.addOnPrices?.training?.max || 3000)}</small>
                        </label>
                        <div className="addon-total">
                          Extra mensual: <b>{formatMoney(organization.addOnMonthlyTotal || 0)}</b>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="metrics-grid">
                        {renderMetric(organization, "users", "Usuarios")}
                        {renderMetric(organization, "branches", "Sucursales")}
                        {renderMetric(organization, "incidents", "Incidencias")}
                        {renderMetric(organization, "files", "Archivos")}
                        {renderMetric(organization, "storageBytes", "Almacenamiento", formatBytes)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style>{`
        .organizations-page {
          min-height: 100vh;
          padding: 28px;
          background: var(--app-bg);
          color: var(--app-text);
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .page-header h1,
        .panel h2,
        .table-header h2 {
          color: var(--app-title);
          margin: 0;
        }

        .page-header h1 { font-size: 24px; }
        .page-header p { margin-top: 4px; font-size: 13px; opacity: 0.72; }

        .notice {
          margin-bottom: 16px;
          padding: 12px 14px;
          border-radius: 8px;
          border: 1px solid transparent;
          font-size: 13px;
        }
        .notice.success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: #86efac; }
        .notice.error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5; }

        .panel,
        .table-panel {
          border: 1px solid rgba(255,255,255,0.08);
          background: color-mix(in srgb, var(--app-card) 88%, transparent);
          border-radius: 8px;
          padding: 18px;
          margin-bottom: 18px;
        }

        .company-form {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        input,
        select {
          min-width: 0;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: var(--app-input);
          color: var(--app-text);
          outline: none;
        }

        input:focus,
        select:focus {
          border-color: var(--app-accent);
        }

        button {
          padding: 10px 12px;
          border: none;
          border-radius: 8px;
          background: var(--app-accent);
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .table-header span,
        .empty {
          font-size: 13px;
          opacity: 0.7;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1320px;
        }

        th,
        td {
          padding: 11px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          text-align: left;
          font-size: 13px;
        }

        th {
          color: var(--app-title);
          font-weight: 600;
        }

        code {
          color: var(--app-accent);
          font-size: 12px;
        }

        td select {
          min-width: 130px;
          padding: 8px 10px;
        }

        .addons-panel {
          display: grid;
          grid-template-columns: repeat(2, minmax(130px, 1fr));
          gap: 8px 10px;
          min-width: 330px;
        }

        .addons-panel label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 11px;
          color: var(--app-text);
          opacity: 0.82;
        }

        .addons-panel input[type="number"] {
          width: 100%;
          min-width: 0;
          padding: 8px 9px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: var(--app-input);
          color: var(--app-text);
        }

        .addons-panel small {
          color: var(--app-text);
          opacity: 0.58;
          font-size: 10px;
        }

        .inline-check {
          flex-direction: row !important;
          align-items: center;
          flex-wrap: wrap;
        }

        .inline-check input {
          width: auto;
          accent-color: var(--app-accent);
        }

        .inline-check small {
          width: 100%;
          padding-left: 21px;
        }

        .addon-total {
          grid-column: 1 / -1;
          padding: 8px 10px;
          border-radius: 8px;
          background: rgba(255,255,255,0.06);
          color: var(--app-text);
          font-size: 12px;
        }

        .addon-total b {
          color: var(--app-title);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(150px, 1fr));
          gap: 8px 12px;
          min-width: 360px;
        }

        .metric {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .metric-line {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 12px;
        }

        .metric-line span {
          opacity: 0.75;
        }

        .metric-line b {
          color: var(--app-title);
          font-weight: 600;
          white-space: nowrap;
        }

        .meter {
          width: 100%;
          height: 6px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255,255,255,0.1);
        }

        .meter span {
          display: block;
          height: 100%;
          min-width: 5px;
          border-radius: inherit;
          background: #22c55e;
        }

        .meter span.warn { background: #f59e0b; }
        .meter span.danger { background: #ef4444; }

        @media (max-width: 1100px) {
          .company-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 640px) {
          .organizations-page { padding: 16px; }
          .company-form { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

export default Organizations;
