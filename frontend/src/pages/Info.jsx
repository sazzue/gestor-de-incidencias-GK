import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../hooks/useSystemSettings";

const API_URL = import.meta.env.VITE_API_URL;

const lines = (value = "") => value.split("\n").map((item) => item.trim()).filter(Boolean);

function Info() {
  const [identity, setIdentity] = useState(null);

  useEffect(() => {
    const fetchIdentity = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/settings/identity`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await res.json();

        if (res.ok) {
          setIdentity({ ...DEFAULT_SETTINGS, ...data });
        }
      } catch {
        setIdentity(DEFAULT_SETTINGS);
      }
    };

    fetchIdentity();
  }, []);

  const systemInfo = identity || {};

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Informacion del Sistema</h1>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2>Nombre</h2>
          <p>{systemInfo.systemTitle || ""}</p>
        </div>

        <div style={styles.card}>
          <h2>Desarrollador</h2>
          <p>{systemInfo.developer || ""}</p>
        </div>

        <div style={styles.card}>
          <h2>Descripcion</h2>
          <p>{systemInfo.systemDescription || ""}</p>
        </div>

        <div style={styles.card}>
          <h2>Modo de uso</h2>
          <ul>
            {lines(systemInfo.usageInfo).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div style={styles.card}>
          <h2>Roles del sistema</h2>
          <ul>
            {lines(systemInfo.rolesInfo).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div style={styles.card}>
          <h2>Departamentos</h2>
          <ul>
            {lines(systemInfo.departmentsInfo).map((item) => <li key={item}><b>{item}</b></li>)}
          </ul>
        </div>

        <div style={styles.card}>
          <h2>Contacto</h2>
          <p>{systemInfo.contactEmail || ""}</p>
        </div>

        <div style={styles.card}>
          <h2>Version</h2>
          <p>{systemInfo.version ? `v${systemInfo.version}` : ""}</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "clamp(15px, 4vw, 40px)",
    background: "var(--app-bg)",
    minHeight: "100vh",
    color: "var(--app-text)",
    textAlign: "left",
  },

  title: {
    textAlign: "center",
    marginBottom: "30px",
    fontSize: "clamp(20px, 4vw, 32px)",
    color: "var(--app-title)",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  },

  card: {
    background: "var(--app-card)",
    padding: "20px",
    borderRadius: "12px",
    backdropFilter: "blur(10px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    transition: "0.3s",
  },
};

export default Info;
