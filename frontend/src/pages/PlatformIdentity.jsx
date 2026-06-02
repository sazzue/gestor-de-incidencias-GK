import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_SETTINGS, cacheSystemSettings, useSystemSettings } from "../hooks/useSystemSettings";
import { useAuthUser } from "../hooks/useAuthUser";

const API_URL = import.meta.env.VITE_API_URL;

const identityFields = [
  { name: "systemName", label: "Nombre en sidebar", type: "text" },
  { name: "systemTitle", label: "Titulo del sistema", type: "text" },
  { name: "systemDescription", label: "Descripcion del sistema", type: "textarea" },
  { name: "developer", label: "Desarrollador", type: "text" },
  { name: "contactEmail", label: "Contacto", type: "email" },
  { name: "version", label: "Version", type: "text" },
];

const informationFields = [
  { name: "usageInfo", label: "Modo de uso" },
  { name: "rolesInfo", label: "Roles del sistema" },
  { name: "departmentsInfo", label: "Departamentos" },
];

const pickIdentity = (settings) => (
  [...identityFields, ...informationFields].reduce(
    (payload, field) => ({ ...payload, [field.name]: settings[field.name] }),
    {}
  )
);

function PlatformIdentity() {
  const navigate = useNavigate();
  const { settings } = useSystemSettings();
  const user = useAuthUser();
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [message, setMessage] = useState(null);
  const token = localStorage.getItem("token");

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const uploadLoginImage = async (file) => {
    if (!file) return;

    setMessage(null);

    if (!file.type.startsWith("image/")) {
      setMessage({
        type: "error",
        title: "Archivo invalido",
        detail: "Selecciona una imagen valida.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch(`${API_URL}/api/settings/image/loginImageUrl`, {
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
      title: "Imagen de login actualizada",
      detail: "La imagen se aplicara de forma general al login.",
    });
  };

  const saveIdentity = async () => {
    setMessage(null);

    if (!form.systemName?.trim() || !form.version?.trim()) {
      setMessage({
        type: "error",
        title: "Faltan campos obligatorios",
        detail: "Nombre del sistema y version son obligatorios.",
      });
      return;
    }

    const res = await fetch(`${API_URL}/api/settings/identity`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(pickIdentity(form)),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage({
        type: "error",
        title: data.msg || "No se pudo guardar la identidad",
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
      title: "Identidad guardada",
      detail: "Los cambios globales quedaron protegidos para super admin.",
    });
  };

  if (!user?.isPlatformAdmin) {
    return (
      <div style={{ minHeight: "100vh", padding: 28, color: "var(--app-text)", background: "var(--app-bg)" }}>
        <h2 style={{ color: "var(--app-title)", marginBottom: 8 }}>Sin acceso</h2>
        <p>Solo el super admin puede modificar la identidad global del sistema.</p>
      </div>
    );
  }

  return (
    <div className="identity-page">
      <div className="page-header">
        <div>
          <h1>Identidad del sistema</h1>
          <p>Control global reservado para el super admin.</p>
        </div>
        <button className="btn-back" onClick={() => navigate("/dashboard")}>
          Volver
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
          {identityFields.map((field) => (
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
          <h3>Vista previa</h3>
          <div className="preview">
            <span>v{form.version}</span>
            <h4>{form.systemName}</h4>
            <strong>{form.systemTitle}</strong>
            <p>{form.systemDescription}</p>
            <small>{form.developer} | {form.contactEmail}</small>
          </div>
        </section>

        <section className="panel wide">
          <h3>Imagen general de login</h3>
          <div className="image-picker">
            <div className="image-preview">
              {form.loginImageUrl ? <img src={form.loginImageUrl} alt="Login" /> : <span>Sin imagen personalizada</span>}
            </div>
            <label className="file-button">
              Seleccionar imagen
              <input
                type="file"
                accept="image/*"
                onChange={(e) => uploadLoginImage(e.target.files?.[0])}
              />
            </label>
          </div>
        </section>

        <section className="panel wide">
          <h3>Informacion del sistema</h3>
          <div className="textarea-grid">
            {informationFields.map((field) => (
              <div className="form-group" key={field.name}>
                <label>{field.label}</label>
                <textarea
                  rows="6"
                  value={form[field.name] || ""}
                  onChange={(e) => updateField(field.name, e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="actions-bar">
        <button className="btn-submit" onClick={saveIdentity}>
          Guardar identidad
        </button>
      </div>

      <style>{`
        .identity-page { padding: 28px; min-height: 100vh; color: var(--app-text); background: var(--app-bg); }
        .page-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 24px; }
        .page-header h1 { color: var(--app-title); font-size: 24px; margin: 0; }
        .page-header p { color: var(--app-text); opacity: 0.7; font-size: 13px; margin-top: 4px; }
        .settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
        .panel { background: var(--app-card); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px; }
        .panel.wide { grid-column: 1 / -1; }
        .panel h3 { color: var(--app-title); font-size: 16px; margin-bottom: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; text-align: left; }
        .form-group label { font-size: 12px; color: var(--app-text); opacity: 0.75; }
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
        .preview { min-height: 100%; background: var(--app-bg); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 18px; text-align: left; }
        .preview span, .preview small { color: var(--app-text); opacity: 0.7; font-size: 12px; }
        .preview h4 { color: var(--app-title); margin: 10px 0 8px; }
        .preview strong { display: block; color: var(--app-title); margin-bottom: 8px; }
        .preview p { color: var(--app-text); font-size: 13px; line-height: 1.5; margin-bottom: 12px; }
        .textarea-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .image-picker { display: grid; grid-template-columns: minmax(220px, 360px) 180px; gap: 14px; align-items: end; text-align: left; }
        .image-preview {
          height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed rgba(255,255,255,0.18);
          border-radius: 8px;
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
        .btn-submit, .btn-back {
          padding: 10px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-submit { border: none; background: var(--app-accent); color: white; font-weight: 600; }
        .btn-back { border: 1px solid rgba(255,255,255,0.12); background: transparent; color: var(--app-text); }
        .notice { display: flex; flex-direction: column; gap: 4px; margin-bottom: 18px; padding: 12px 14px; border-radius: 8px; font-size: 13px; border: 1px solid transparent; text-align: left; }
        .notice.success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: #86efac; }
        .notice.error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
        .notice span { color: var(--app-text); }
        @media (max-width: 900px) {
          .settings-grid, .textarea-grid { grid-template-columns: 1fr; }
          .image-picker { grid-template-columns: 1fr; }
          .actions-bar { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

export default PlatformIdentity;
