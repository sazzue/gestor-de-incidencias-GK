import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;
const SETTINGS_CACHE_KEY = "systemSettings";

export const DEFAULT_SETTINGS = {
  systemName: "Gestor de reportes",
  systemTitle: "Sistema de Gestión de Incidencias",
  systemDescription: "Este sistema permite registrar, gestionar y dar seguimiento a incidencias dentro de la organización.",
  developer: "Ing. Saúl Rubalcava",
  contactEmail: "sistemas@grupokampai.mx",
  version: "1.0.0",
  usageInfo: "Crear incidencias desde el dashboard\nAsignar departamento\nActualizar estatus\nVisualizar reportes",
  rolesInfo: "Admin: Control total\nDirección: Supervisión\nGerencia: Seguimiento y cierre\nDepartamento: Gestión de incidencias",
  departmentsInfo: "Sistemas\nMantenimiento\nCostos\nMarketing",
  textColor: "#e2e8f0",
  titleColor: "#ffffff",
  backgroundColor: "#0b1220",
  cardColor: "#111827",
  inputColor: "#020617",
  accentColor: "#3b82f6",
  loginImageUrl: "",
  sidebarImageUrl: "",
};

export const applySystemTheme = (settings = DEFAULT_SETTINGS) => {
  const root = document.documentElement;
  root.style.setProperty("--app-bg", settings.backgroundColor || DEFAULT_SETTINGS.backgroundColor);
  root.style.setProperty("--app-text", settings.textColor || DEFAULT_SETTINGS.textColor);
  root.style.setProperty("--app-title", settings.titleColor || DEFAULT_SETTINGS.titleColor);
  root.style.setProperty("--app-card", settings.cardColor || DEFAULT_SETTINGS.cardColor);
  root.style.setProperty("--app-input", settings.inputColor || DEFAULT_SETTINGS.inputColor);
  root.style.setProperty("--app-accent", settings.accentColor || DEFAULT_SETTINGS.accentColor);
};

const normalizeSettings = (settings) => ({ ...DEFAULT_SETTINGS, ...(settings || {}) });

const getSettingsTime = (settings) => {
  const value = settings?.updatedAt || settings?.createdAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

export const getCachedSystemSettings = () => {
  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
    return cached ? normalizeSettings(JSON.parse(cached)) : null;
  } catch (error) {
    return null;
  }
};

export const cacheSystemSettings = (settings) => {
  const nextSettings = normalizeSettings(settings);
  localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(nextSettings));
  applySystemTheme(nextSettings);
  return nextSettings;
};

export function useSystemSettings() {
  const [settings, setSettings] = useState(() => getCachedSystemSettings() || DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) return;

      const cachedSettings = getCachedSystemSettings();
      const serverSettings = normalizeSettings(data);
      const nextSettings =
        cachedSettings && getSettingsTime(cachedSettings) > getSettingsTime(serverSettings)
          ? cachedSettings
          : serverSettings;

      cacheSystemSettings(nextSettings);
      setSettings(nextSettings);
    } catch (error) {
      const cachedSettings = getCachedSystemSettings();
      const nextSettings = cachedSettings || DEFAULT_SETTINGS;
      setSettings(nextSettings);
      applySystemTheme(nextSettings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applySystemTheme(settings);
    fetchSettings();
    const handleSettingsUpdated = (event) => {
      if (event.detail) {
        const nextSettings = cacheSystemSettings(event.detail);
        setSettings(nextSettings);
        return;
      }

      fetchSettings();
    };
    window.addEventListener("system-settings-updated", handleSettingsUpdated);
    return () => window.removeEventListener("system-settings-updated", handleSettingsUpdated);
  }, []);

  return { settings, setSettings, loading, refreshSettings: fetchSettings };
}
