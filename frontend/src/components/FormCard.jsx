function FormCard({ title, children, onBack }) {
  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>

        {/* HEADER */}
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>

          {onBack && (
            <button style={styles.backBtn} onClick={onBack}>
              ← Volver
            </button>
          )}
        </div>

        {/* CONTENT */}
        <div style={styles.form}>
          {children}
        </div>

      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#020617",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
  },

  wrapper: {
    width: "100%",
    maxWidth: "480px",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },

  title: {
    color: "#e2e8f0",
    fontSize: "22px",
    fontWeight: "600",
  },

  backBtn: {
    background: "transparent",
    border: "1px solid #1e293b",
    color: "#94a3b8",
    padding: "6px 12px",
    borderRadius: "6px",
    cursor: "pointer",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    background: "#0f172a",
    padding: "25px",
    borderRadius: "14px",
    border: "1px solid #1e293b",
    boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
  },
};

export default FormCard;