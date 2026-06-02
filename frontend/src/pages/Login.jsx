import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { useSystemSettings } from "../hooks/useSystemSettings";

const API_URL = import.meta.env.VITE_API_URL;

function Login() {
  const [identifier, setIdentifier] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState(() => localStorage.getItem("organizationSlug") || "default");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { settings } = useSystemSettings();

  const navigate = useNavigate();

  const validate = () => {
    if (!identifier || !password) {
      setError("Todos los campos son obligatorios");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validate()) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, username: identifier, password, organizationSlug }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.msg || "Error al iniciar sesion");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("organizationSlug", organizationSlug);

      if (data.user.mustChangePassword) {
        navigate("/change-password");
        return;
      }

      setTimeout(() => navigate("/dashboard"), 300);
    } catch (err) {
      console.error(err);
      setError("Error de conexion con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <img src={settings.loginImageUrl || logo} alt="Logo" className="logo" />
        <h2>Iniciar sesion</h2>
        <p className="subtitle">Accede a {settings.systemName}</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Empresa"
            value={organizationSlug}
            onChange={(e) => setOrganizationSlug(e.target.value.toLowerCase().trim())}
          />

          <input
            type="text"
            placeholder="Correo o usuario"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />

          <input
            type="password"
            placeholder="Contrasena"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>

        <p className="forgot">
          <a href="/forgot-password">Olvidaste tu contrasena?</a>
        </p>
      </div>

      <style>{`
        .logo {
          width: 80px;
          max-height: 90px;
          margin: 0 auto 10px;
          display: block;
          object-fit: contain;
          filter: drop-shadow(0 5px 10px rgba(0,0,0,0.5));
        }

        .container {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: var(--app-bg);
          font-family: 'Inter', sans-serif;
          padding: 20px;
        }

        .card {
          width: 100%;
          max-width: 400px;
          padding: 35px;
          border-radius: 16px;
          background: var(--app-card);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          animation: fadeIn 0.6s ease;
        }

        h2 {
          text-align: center;
          margin-bottom: 5px;
          color: var(--app-title);
        }

        .subtitle {
          text-align: center;
          font-size: 13px;
          color: var(--app-text);
          margin-bottom: 20px;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        input {
          padding: 12px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          background: var(--app-input);
          color: var(--app-text);
          outline: none;
          transition: 0.2s;
        }

        input:focus {
          border-color: var(--app-accent);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 30%, transparent);
        }

        button {
          margin-top: 10px;
          padding: 12px;
          border-radius: 10px;
          border: none;
          background: var(--app-accent);
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
        }

        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .error {
          color: #ef4444;
          font-size: 12px;
          text-align: center;
        }

        .forgot {
          text-align: center;
          margin-top: 16px;
          font-size: 13px;
        }

        .forgot a {
          color: var(--app-accent);
          text-decoration: none;
          transition: color 0.2s;
        }

        .forgot a:hover {
          color: var(--app-title);
          text-decoration: underline;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 500px) {
          .card { padding: 25px; }
        }
      `}</style>
    </div>
  );
}

export default Login;
