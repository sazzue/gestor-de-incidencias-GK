import Navbar from "../components/Navbar.jsx";
function Info() {
  return (
    <>
      <Navbar />

      <div style={styles.container}>
        <h1 style={styles.title}>📘 Información del Sistema</h1>

        <div style={styles.grid}>
          <div style={styles.card}>
            <h2>📌 Nombre</h2>
            <p>Sistema de Gestión de Incidencias</p>
          </div>

          <div style={styles.card}>
            <h2>👨‍💻 Desarrollador</h2>
            <p>Ing. Saúl Rubalcava</p>
          </div>

          <div style={styles.card}>
            <h2>📖 Descripción</h2>
            <p>
              Este sistema permite registrar, gestionar y dar seguimiento a incidencias
              dentro de la organización, facilitando la comunicación entre departamentos.
            </p>
          </div>

          <div style={styles.card}>
            <h2>⚙️ Modo de uso</h2>
            <ul>
              <li>Crear incidencias desde el dashboard</li>
              <li>Asignar departamento</li>
              <li>Actualizar estatus</li>
              <li>Visualizar reportes</li>
            </ul>
          </div>

          <div style={styles.card}>
            <h2>🔐 Roles del sistema</h2>
            <ul>
              <li><b>Admin:</b> Control total</li>
              <li><b>Dirección:</b> Supervisión</li>
              <li><b>Gerencia:</b> Seguimiento y cierre</li>
              <li><b>Departamento:</b> Gestión de incidencias</li>
            </ul>
          </div>

          <div style={styles.card}>
            <h2>🏢 Departamentos </h2>
            <ul>
              <li><b>Sistemas</b></li>
              <li><b>Mantenimiento</b></li>
              <li><b>Costos</b></li>
              <li><b>Marketing</b></li>
            </ul>
          </div>

          <div style={styles.card}>
            <h2>📬 Contacto</h2>
            <p>sistemas@grupokampai.mx</p>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    padding: "clamp(15px, 4vw, 40px)", // 🔥 responsive automático
    background: "#0f172a",
    minHeight: "100vh",
    color: "#fff"
  },

  title: {
    textAlign: "center",
    marginBottom: "30px",
    fontSize: "clamp(20px, 4vw, 32px)" // 🔥 escala según pantalla
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", // 🔥 magia responsive
    gap: "20px"
  },

  card: {
    background: "rgba(255,255,255,0.05)",
    padding: "20px",
    borderRadius: "15px",
    backdropFilter: "blur(10px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    transition: "0.3s"
  }
};

export default Info;