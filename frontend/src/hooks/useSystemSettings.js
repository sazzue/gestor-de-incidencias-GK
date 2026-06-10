import { useCallback, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

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
  loginTitle: "Iniciar sesion",
  loginSubtitle: "Accede a {systemName}",
  loginOrganizationPlaceholder: "Empresa",
  loginUserPlaceholder: "Correo o usuario",
  loginPasswordPlaceholder: "Contrasena",
  loginButtonText: "Entrar",
  loginLoadingText: "Ingresando...",
  loginForgotPasswordText: "Olvidaste tu contrasena?",
  loginBackgroundColor: "#0b1220",
  loginCardColor: "#111827",
  loginTextColor: "#e2e8f0",
  loginTitleColor: "#ffffff",
  loginInputColor: "#020617",
  loginAccentColor: "#3b82f6",
  sidebarImageUrl: "",
  slaHours: {
    baja: 168,
    media: 72,
    alta: 24,
    critica: 4,
  },
  slaWarningPercent: 25,
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

const getSettingsCacheKey = () => {
  const token = localStorage.getItem("token");
  if (!token) return `${SETTINGS_CACHE_KEY}:public`;

  try {
    const user = jwtDecode(token);
    return `${SETTINGS_CACHE_KEY}:${user.organization || user.organizationSlug || "public"}`;
  } catch {
    return `${SETTINGS_CACHE_KEY}:public`;
  }
};

export const getCachedSystemSettings = () => {
  try {
    const token = localStorage.getItem("token");
    const cached = localStorage.getItem(getSettingsCacheKey()) || (!token ? localStorage.getItem(SETTINGS_CACHE_KEY) : null);
    return cached ? normalizeSettings(JSON.parse(cached)) : null;
  } catch {
    return null;
  }
};

export const cacheSystemSettings = (settings) => {
  const nextSettings = normalizeSettings(settings);
  localStorage.setItem(getSettingsCacheKey(), JSON.stringify(nextSettings));
  applySystemTheme(nextSettings);
  return nextSettings;
};

export function useSystemSettings() {
  const [settings, setSettings] = useState(() => getCachedSystemSettings() || DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const endpoint = token ? "/api/settings/current" : "/api/settings";
      const res = await fetch(`${API_URL}${endpoint}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();

      if (!res.ok) return;

      const serverSettings = normalizeSettings(data);

      cacheSystemSettings(serverSettings);
      setSettings(serverSettings);
    } catch {
      const cachedSettings = getCachedSystemSettings();
      const nextSettings = cachedSettings || DEFAULT_SETTINGS;
      setSettings(nextSettings);
      applySystemTheme(nextSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    applySystemTheme(settings);
  }, [settings]);

  useEffect(() => {
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
    return () => {
      window.removeEventListener("system-settings-updated", handleSettingsUpdated);
    };
  }, [fetchSettings]);

  return { settings, setSettings, loading, refreshSettings: fetchSettings };
}
