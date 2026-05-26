import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_SETTINGS, applySystemTheme, cacheSystemSettings, useSystemSettings } from "../hooks/useSystemSettings";

const API_URL = import.meta.env.VITE_API_URL;

const fields = [
  { name: "systemName", label: "Nombre en sidebar", type: "text" },
  { name: "systemTitle", label: "Título del sistema", type: "text" },
  { name: "systemDescription", label: "Descripción del sistema", type: "textarea" },
  { name: "developer", label: "Desarrollador", type: "text" },
  { name: "contactEmail", label: "Contacto", type: "email" },
  { name: "version", label: "Versión", type: "text" },
];

const colors = [
  { name: "backgroundColor", label: "Color de fondo" },
  { name: "textColor", label: "Color de texto" },
  { name: "titleColor", label: "Color de títulos" },
  { name: "cardColor", label: "Color de tarjetas" },
  { name: "inputColor", label: "Color de cuadros de texto" },
  { name: "accentColor", label: "Color principal" },
];

const toColorInputValue = (value, fallback) => (
  /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : fallback
);

function SystemSettings() {
  const navigate = useNavigate();
  const { settings } = useSystemSettings();
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [message, setMessage] = useState(null);
  const token = localStorage.getItem("token");

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const updateField = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    applySystemTheme(next);
  };

  const resetDefaults = () => {
    setForm(DEFAULT_SETTINGS);
    applySystemTheme(DEFAULT_SETTINGS);
  };

  const uploadImage = async (field, file) => {
    if (!file) return;

    setMessage(null);

    if (!file.type.startsWith("image/")) {
      setMessage({
        type: "error",
        title: "Archivo inválido",
        detail: "Selecciona una imagen válida."
      });
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch(`${API_URL}/api/settings/image/${field}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage({
        type: "error",
        title: data.msg || "No se pudo subir la imagen",
        detail: data.error || `Error ${res.status}`,
      });
      return;
    }

    const nextSettings = { ...DEFAULT_SETTINGS, ...data };
    setForm(nextSettings);
    cacheSystemSettings(nextSettings);
    window.dispatchEvent(new CustomEvent("system-settings-updated", { detail: nextSettings }));
    setMessage({
      type: "success",
      title: "Imagen actualizada correctamente",
      detail: "La imagen ya se refleja en la sesión actual."
    });
  };

  const saveSettings = async () => {
    setMessage(null);

    if (!form.systemName?.trim() || !form.version?.trim()) {
      setMessage({
        type: "error",
        title: "Faltan campos obligatorios",
        detail: "Nombre del sistema y versión son obligatorios."
      });
      return;
    }

    const res = await fetch(`${API_URL}/api/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage({
        type: "error",
        title: data.msg || "No se pudo guardar la configuración",
        detail: data.error || `Error ${res.status}`,
      });
      return;
    }

    const nextSettings = { ...DEFAULT_SETTINGS, ...data };
    setForm(nextSettings);
    cacheSystemSettings(nextSettings);
    window.dispatchEvent(new CustomEvent("system-settings-updated", { detail: nextSettings }));
    setMessage({
      type: "success",
      title: "Configuración guardada correctamente",
      detail: "Los cambios se aplicaron en la sesión actual."
    });
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1>Configuración</h1>
          <p>Edita apariencia, versión e información del sistema.</p>
        </div>
        <button className="btn-back" onClick={() => navigate("/dashboard")}>
          ← Volver
        </button>
      </div>

      {message && (
        <div className={`notice ${message.type}`}>
          <b>{message.title}</b>
          <span>{message.detail}</span>
        </div>
      )}

      <div className="settings-grid">
        <section className="panel">
          <h3>Identidad</h3>
          {fields.map((field) => (
            <div className="form-group" key={field.name}>
              <label>{field.label}</label>
              {field.type === "textarea" ? (
                <textarea
                  rows="4"
                  value={form[field.name] || ""}
                  onChange={(e) => updateField(field.name, e.target.value)}
                />
              ) : (
                <input
                  type={field.type}
                  value={form[field.name] || ""}
                  onChange={(e) => updateField(field.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </section>

        <section className="panel">
          <h3>Apariencia</h3>
          {colors.map((field) => (
            <div className="color-row" key={field.name}>
              <label>{field.label}</label>
              <input
                type="color"
                value={toColorInputValue(form[field.name], DEFAULT_SETTINGS[field.name])}
                onChange={(e) => updateField(field.name, e.target.value)}
              />
              <input
                value={form[field.name] || ""}
                onChange={(e) => updateField(field.name, e.target.value)}
              />
            </div>
          ))}

          <div className="preview">
            <h4>{form.systemTitle}</h4>
            <p>{form.systemDescription}</p>
            <input value="Vista previa de cuadro de texto" readOnly />
          </div>
        </section>

        <section className="panel wide">
          <h3>Imágenes</h3>
          <div className="image-grid">
            <div className="image-picker">
              <label>Imagen de login</label>
              <div className="image-preview">
                {form.loginImageUrl ? <img src={form.loginImageUrl} alt="Login" /> : <span>Sin imagen personalizada</span>}
              </div>
              <label className="file-button">
                Seleccionar imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => uploadImage("loginImageUrl", e.target.files?.[0])}
                />
              </label>
              <button className="btn-cancel small" onClick={() => updateField("loginImageUrl", "")}>
                Quitar imagen
              </button>
            </div>

            <div className="image-picker">
              <label>Imagen de sidebar</label>
              <div className="image-preview">
                {form.sidebarImageUrl ? <img src={form.sidebarImageUrl} alt="Sidebar" /> : <span>Sin imagen personalizada</span>}
              </div>
              <label className="file-button">
                Seleccionar imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => uploadImage("sidebarImageUrl", e.target.files?.[0])}
                />
              </label>
              <button className="btn-cancel small" onClick={() => updateField("sidebarImageUrl", "")}>
                Quitar imagen
              </button>
            </div>
          </div>
        </section>

        <section className="panel wide">
          <h3>Información del sistema</h3>
          <div className="textarea-grid">
            <div className="form-group">
              <label>Modo de uso</label>
              <textarea rows="5" value={form.usageInfo || ""} onChange={(e) => updateField("usageInfo", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Roles del sistema</label>
              <textarea rows="5" value={form.rolesInfo || ""} onChange={(e) => updateField("rolesInfo", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Departamentos</label>
              <textarea rows="5" value={form.departmentsInfo || ""} onChange={(e) => updateField("departmentsInfo", e.target.value)} />
            </div>
          </div>
        </section>
      </div>

      <div className="actions-bar">
        <button className="btn-cancel" onClick={resetDefaults}>
          Usar valores base
        </button>
        <button className="btn-submit" onClick={saveSettings}>
          Guardar cambios
        </button>
      </div>

      <style>{`
        .settings-page { padding: 28px; min-height: 100vh; color: var(--app-text); background: var(--app-bg); }
        .page-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 24px; }
        .page-header h1 { color: var(--app-title); font-size: 24px; margin: 0; }
        .page-header p { color: var(--app-text); opacity: 0.7; font-size: 13px; margin-top: 4px; }
        .settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
        .panel { background: var(--app-card); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; }
        .panel.wide { grid-column: 1 / -1; }
        .panel h3 { color: var(--app-title); font-size: 16px; margin-bottom: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; text-align: left; }
        .form-group label, .color-row label { font-size: 12px; color: var(--app-text); opacity: 0.75; }
        input, textarea {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          background: var(--app-input);
          color: var(--app-text);
          outline: none;
        }
        textarea { resize: vertical; }
        input:focus, textarea:focus { border-color: var(--app-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 28%, transparent); }
        .color-row { display: grid; grid-template-columns: 1fr 52px 130px; gap: 10px; align-items: center; margin-bottom: 12px; text-align: left; }
        .color-row input[type="color"] { padding: 2px; height: 38px; }
        .preview { background: var(--app-bg); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 16px; margin-top: 16px; text-align: left; }
        .preview h4 { color: var(--app-title); margin-bottom: 8px; }
        .preview p { color: var(--app-text); font-size: 13px; line-height: 1.5; }
        .preview input { margin-top: 12px; }
        .textarea-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .image-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .image-picker { display: flex; flex-direction: column; gap: 10px; text-align: left; }
        .image-picker > label { font-size: 12px; color: var(--app-text); opacity: 0.75; }
        .image-preview {
          height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed rgba(255,255,255,0.18);
          border-radius: 10px;
          background: rgba(2,6,23,0.55);
          color: var(--app-text);
          overflow: hidden;
        }
        .image-preview img { width: 100%; height: 100%; object-fit: contain; }
        .file-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          border-radius: 8px;
          background: var(--app-accent);
          color: white !important;
          font-size: 14px !important;
          font-weight: 600;
          cursor: pointer;
          opacity: 1 !important;
        }
        .file-button input { display: none; }
        .actions-bar { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
        .btn-submit, .btn-cancel, .btn-back {
          padding: 10px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-submit { border: none; background: var(--app-accent); color: white; font-weight: 600; }
        .btn-cancel, .btn-back { border: 1px solid rgba(255,255,255,0.12); background: transparent; color: var(--app-text); }
        .btn-cancel.small { width: 100%; }
        .notice { display: flex; flex-direction: column; gap: 4px; margin-bottom: 18px; padding: 12px 14px; border-radius: 8px; font-size: 13px; border: 1px solid transparent; text-align: left; }
        .notice.success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: #86efac; }
        .notice.error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
        .notice span { color: var(--app-text); }
        @media (max-width: 900px) {
          .settings-grid, .textarea-grid, .image-grid { grid-template-columns: 1fr; }
          .color-row { grid-template-columns: 1fr; }
          .actions-bar { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

export default SystemSettings;
