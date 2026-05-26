import { useSystemSettings } from "../hooks/useSystemSettings";

const lines = (value = "") => value.split("\n").map((item) => item.trim()).filter(Boolean);

function Info() {
  const { settings } = useSystemSettings();

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Informacion del Sistema</h1>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2>Nombre</h2>
          <p>{settings.systemTitle}</p>
        </div>

        <div style={styles.card}>
          <h2>Desarrollador</h2>
          <p>{settings.developer}</p>
        </div>

        <div style={styles.card}>
          <h2>Descripcion</h2>
          <p>{settings.systemDescription}</p>
        </div>

        <div style={styles.card}>
          <h2>Modo de uso</h2>
          <ul>
            {lines(settings.usageInfo).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div style={styles.card}>
          <h2>Roles del sistema</h2>
          <ul>
            {lines(settings.rolesInfo).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div style={styles.card}>
          <h2>Departamentos</h2>
          <ul>
            {lines(settings.departmentsInfo).map((item) => <li key={item}><b>{item}</b></li>)}
          </ul>
        </div>

        <div style={styles.card}>
          <h2>Contacto</h2>
          <p>{settings.contactEmail}</p>
        </div>

        <div style={styles.card}>
          <h2>Version</h2>
          <p>v{settings.version}</p>
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
