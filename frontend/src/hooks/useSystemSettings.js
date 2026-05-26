import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

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
  cardColor: "rgba(255,255,255,0.05)",
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
  root.style.setProperty("--app-accent", settings.accentColor || DEFAULT_SETTINGS.accentColor);
};

export function useSystemSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      const data = await res.json();

      if (!res.ok) return;

      const nextSettings = { ...DEFAULT_SETTINGS, ...data };
      setSettings(nextSettings);
      applySystemTheme(nextSettings);
    } catch (error) {
      applySystemTheme(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    window.addEventListener("system-settings-updated", fetchSettings);
    return () => window.removeEventListener("system-settings-updated", fetchSettings);
  }, []);

  return { settings, setSettings, loading, refreshSettings: fetchSettings };
}
