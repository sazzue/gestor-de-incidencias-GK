import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_SETTINGS, applySystemTheme, cacheSystemSettings, useSystemSettings } from "../hooks/useSystemSettings";
import { useAuthUser } from "../hooks/useAuthUser";

const API_URL = import.meta.env.VITE_API_URL;

const colors = [
  { name: "backgroundColor", label: "Color de fondo" },
  { name: "textColor", label: "Color de texto" },
  { name: "titleColor", label: "Color de titulos" },
  { name: "cardColor", label: "Color de paneles" },
  { name: "inputColor", label: "Color de campos" },
  { name: "accentColor", label: "Color principal" },
];

const appearanceFields = [
  "backgroundColor",
  "textColor",
  "titleColor",
  "cardColor",
  "inputColor",
  "accentColor",
  "sidebarImageUrl",
];

const toColorInputValue = (value, fallback) => (
  /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : fallback
);

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 MB";
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const pickAppearance = (settings) =>
  appearanceFields.reduce((payload, field) => ({ ...payload, [field]: settings[field] }), {});

function SystemSettings() {
  const navigate = useNavigate();
  const { settings } = useSystemSettings();
  const user = useAuthUser();
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [message, setMessage] = useState(null);
  const [storage, setStorage] = useState(null);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const token = localStorage.getItem("token");
  const isAdmin = user?.role === "admin";

  const storageTitle = useMemo(() => {
    const company = user?.organizationName || user?.organizationSlug;
    return company ? `Respaldo de ${company}` : "Respaldo de empresa";
  }, [user]);

  useEffect(() => {
    if (!isDirty) {
      setForm(settings);
    }
  }, [isDirty, settings]);

  const updateField = (field, value) => {
    const next = { ...form, [field]: value };
    setIsDirty(true);
    setForm(next);
    applySystemTheme(next);
  };

  const resetDefaults = () => {
    const next = { ...form, ...pickAppearance(DEFAULT_SETTINGS) };
    setIsDirty(true);
    setForm(next);
    applySystemTheme(next);
  };

  const fetchStorageUsage = useCallback(async () => {
    if (!token || !isAdmin) return;

    try {
      const res = await fetch(`${API_URL}/api/storage/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setStorage(data);
    } catch {
      setStorage(null);
    }
  }, [isAdmin, token]);

  useEffect(() => {
    fetchStorageUsage();
  }, [fetchStorageUsage]);

  const downloadBackup = async () => {
    setMessage(null);

    try {
      setIsDownloadingBackup(true);
      const res = await fetch(`${API_URL}/api/storage/backup.zip`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({
          type: "error",
          title: data.msg || "No se pudo generar el respaldo",
          detail: data.error || `Error ${res.status}`,
        });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `respaldo-empresa-${date}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      await fetchStorageUsage();
      setMessage({
        type: "success",
        title: "Respaldo generado",
        detail: "El ZIP contiene solo informacion de esta empresa.",
      });
    } catch {
      setMessage({
        type: "error",
        title: "Error de conexion",
        detail: "No se pudo generar el respaldo.",
      });
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const uploadImage = async (field, file) => {
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
    setIsDirty(false);
    setForm(nextSettings);
    cacheSystemSettings(nextSettings);
    window.dispatchEvent(new CustomEvent("system-settings-updated", { detail: nextSettings }));
    setMessage({
      type: "success",
      title: "Imagen actualizada",
      detail: "La imagen se guardo para esta empresa.",
    });
  };

  const saveSettings = async () => {
    setMessage(null);

    const res = await fetch(`${API_URL}/api/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(pickAppearance(form)),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage({
        type: "error",
        title: data.msg || "No se pudo guardar la apariencia",
        detail: data.error || `Error ${res.status}`,
      });
      return;
    }

    const nextSettings = { ...DEFAULT_SETTINGS, ...data };
    setIsDirty(false);
    setForm(nextSettings);
    cacheSystemSettings(nextSettings);
    window.dispatchEvent(new CustomEvent("system-settings-updated", { detail: nextSettings }));
    setMessage({
      type: "success",
      title: "Apariencia guardada",
      detail: "Los cambios aplican solo para esta empresa.",
    });
  };

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", padding: 28, color: "var(--app-text)", background: "var(--app-bg)" }}>
        <h2 style={{ color: "var(--app-title)", marginBottom: 8 }}>Sin acceso</h2>
        <p>Solo un administrador puede modificar la apariencia de la empresa.</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1>Configuracion</h1>
          <p>Apariencia, imagenes y respaldo privado de la empresa.</p>
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
        </section>

        <section className="panel">
          <h3>Vista previa</h3>
          <div className="preview">
            <h4>{form.systemTitle}</h4>
            <p>{form.systemDescription}</p>
            <input value="Campo de ejemplo" readOnly />
            <button type="button">Boton principal</button>
          </div>
        </section>

        <section className="panel wide">
          <h3>Imagenes</h3>
          <div className="image-grid single">
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
          <div className="storage-header">
            <div>
              <h3>{storageTitle}</h3>
              <p>El calculo y el ZIP usan solamente archivos de esta empresa.</p>
            </div>
            <button className="btn-cancel" onClick={fetchStorageUsage}>
              Actualizar uso
            </button>
          </div>

          <div className="storage-grid">
            <div className="storage-stat">
              <span>Uso actual</span>
              <strong>{formatBytes(storage?.usageBytes)}</strong>
            </div>
            <div className="storage-stat">
              <span>Limite configurado</span>
              <strong>{formatBytes(storage?.limitBytes)}</strong>
            </div>
            <div className="storage-stat">
              <span>Documentos</span>
              <strong>{storage?.documentsCount ?? 0}</strong>
            </div>
            <div className="storage-stat">
              <span>Uso</span>
              <strong>{Number(storage?.usagePercent || 0).toFixed(1)}%</strong>
            </div>
          </div>

          <div className="storage-bar">
            <span style={{ width: `${Math.min(Number(storage?.usagePercent || 0), 100)}%` }} />
          </div>

          <div className="storage-actions">
            <p>
              Incidencias: {storage?.incidentFilesCount ?? 0} archivos | Inventario: {storage?.inventoryInvoicesCount ?? 0} facturas
            </p>
            <button
              className="btn-submit"
              disabled={!storage?.isAtLimit || isDownloadingBackup}
              onClick={downloadBackup}
            >
              {isDownloadingBackup ? "Generando ZIP..." : "Descargar respaldo ZIP"}
            </button>
          </div>

          {!storage?.isAtLimit && (
            <p className="storage-note">
              El boton se habilita cuando esta empresa llegue al limite definido en R2_STORAGE_LIMIT_GB.
            </p>
          )}
        </section>
      </div>

      <div className="actions-bar">
        <button className="btn-cancel" onClick={resetDefaults}>
          Usar valores base
        </button>
        <button className="btn-submit" onClick={saveSettings}>
          Guardar apariencia
        </button>
      </div>

      <style>{`
        .settings-page { padding: 28px; min-height: 100vh; color: var(--app-text); background: var(--app-bg); }
        .page-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 24px; }
        .page-header h1 { color: var(--app-title); font-size: 24px; margin: 0; }
        .page-header p { color: var(--app-text); opacity: 0.7; font-size: 13px; margin-top: 4px; }
        .settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
        .panel { background: var(--app-card); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px; }
        .panel.wide { grid-column: 1 / -1; }
        .panel h3 { color: var(--app-title); font-size: 16px; margin-bottom: 16px; }
        input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          background: var(--app-input);
          color: var(--app-text);
          outline: none;
        }
        input:focus { border-color: var(--app-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 28%, transparent); }
        .color-row { display: grid; grid-template-columns: 1fr 52px 140px; gap: 10px; align-items: center; margin-bottom: 12px; text-align: left; }
        .color-row label { font-size: 12px; color: var(--app-text); opacity: 0.75; }
        .color-row input[type="color"] { padding: 2px; height: 38px; }
        .preview { min-height: 100%; background: var(--app-bg); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 18px; text-align: left; }
        .preview h4 { color: var(--app-title); margin-bottom: 8px; }
        .preview p { color: var(--app-text); font-size: 13px; line-height: 1.5; margin-bottom: 12px; }
        .preview button { margin-top: 12px; padding: 10px 14px; border: none; border-radius: 8px; background: var(--app-accent); color: white; font-weight: 600; }
        .storage-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 16px; text-align: left; }
        .storage-header p, .storage-actions p, .storage-note { color: var(--app-text); opacity: 0.7; font-size: 13px; margin: 0; }
        .storage-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .storage-stat { border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px; background: rgba(255,255,255,0.03); text-align: left; }
        .storage-stat span { display: block; color: var(--app-text); opacity: 0.65; font-size: 12px; margin-bottom: 6px; }
        .storage-stat strong { color: var(--app-title); font-size: 20px; }
        .storage-bar { height: 10px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,0.08); margin: 16px 0; }
        .storage-bar span { display: block; height: 100%; background: var(--app-accent); }
        .storage-actions { display: flex; justify-content: space-between; align-items: center; gap: 14px; }
        .storage-actions .btn-submit { width: auto; }
        .btn-submit:disabled { opacity: 0.55; cursor: not-allowed; }
        .storage-note { margin-top: 12px; text-align: left; }
        .image-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .image-grid.single { grid-template-columns: minmax(280px, 420px); }
        .image-picker { display: flex; flex-direction: column; gap: 10px; text-align: left; }
        .image-picker > label { font-size: 12px; color: var(--app-text); opacity: 0.75; }
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
          .settings-grid, .image-grid, .storage-grid { grid-template-columns: 1fr; }
          .color-row { grid-template-columns: 1fr; }
          .actions-bar, .storage-actions, .storage-header { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

export default SystemSettings;
