import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

const API_URL = import.meta.env.VITE_API_URL;

function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const navigate = useNavigate();

  const validate = () => {
    if (!email || !password) {
      setError("Todos los campos son obligatorios");
      return false;
    }
    if (!email.includes("@")) {
      setError("Correo inválido");
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
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.msg || "Error al iniciar sesión");
        return;
      }

      // Guardar token y datos del usuario
      localStorage.setItem("token", data.token);
      localStorage.setItem("user",  JSON.stringify(data.user));

      // 🔐 Si es primer inicio de sesión, forzar cambio de contraseña
      if (data.user.mustChangePassword) {
        navigate("/change-password");
        return;
      }

      setTimeout(() => navigate("/dashboard"), 300);

    } catch (err) {
      console.error(err);
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <img src={logo} alt="Logo" className="logo" />
        <h2>🔐 Iniciar sesión</h2>
        <p className="subtitle">Accede al sistema de incidencias</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>

        {/* 🔑 Link de recuperación */}
        <p className="forgot">
          <a href="/forgot-password">¿Olvidaste tu contraseña?</a>
        </p>
      </div>

      <style>{`
        .logo {
          width: 80px;
          margin: 0 auto 10px;
          display: block;
          filter: drop-shadow(0 5px 10px rgba(0,0,0,0.5));
        }

        .container {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: radial-gradient(circle at top, #0f172a, #020617);
          font-family: 'Inter', sans-serif;
        }

        .card {
          width: 100%;
          max-width: 400px;
          padding: 35px;
          border-radius: 16px;
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          animation: fadeIn 0.6s ease;
        }

        h2 {
          text-align: center;
          margin-bottom: 5px;
          color: white;
        }

        .subtitle {
          text-align: center;
          font-size: 13px;
          color: #94a3b8;
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
          background: #020617;
          color: white;
          outline: none;
          transition: 0.2s;
        }

        input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.3);
        }

        button {
          margin-top: 10px;
          padding: 12px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
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

        /* 🔑 Olvidé contraseña */
        .forgot {
          text-align: center;
          margin-top: 16px;
          font-size: 13px;
        }

        .forgot a {
          color: #60a5fa;
          text-decoration: none;
          transition: color 0.2s;
        }

        .forgot a:hover {
          color: #93c5fd;
          text-decoration: underline;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 500px) {
          .card { padding: 25px; }
        }
      `}</style>
    </div>
  );
}

export default Login;
