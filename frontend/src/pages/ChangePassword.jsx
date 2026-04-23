import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

function ChangePassword() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [status,   setStatus]   = useState("");
  const [message,  setMessage]  = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirm) {
      setStatus("error");
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setStatus("loading");

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.id, newPassword: password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Actualizar flag en localStorage
        const updatedUser = { ...user, mustChangePassword: false };
        localStorage.setItem("user", JSON.stringify(updatedUser));

        setStatus("done");
        setMessage(data.msg);
        setTimeout(() => navigate("/dashboard"), 1500);
      } else {
        setStatus("error");
        setMessage(data.msg);
      }
    } catch {
      setStatus("error");
      setMessage("Error de conexión con el servidor.");
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="icon">🔐</div>
        <h2>Bienvenido, {user.nombre || "usuario"}</h2>
        <p className="subtitle">
          Es tu primer acceso al sistema.<br />
          Por seguridad, debes establecer una contraseña personal.
        </p>

        {status === "done" ? (
          <div className="success-box">
            <p>✅ {message}</p>
            <p className="hint">Redirigiendo al dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <input
              type="password"
              required
              placeholder="Confirmar contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />

            {status === "error" && <p className="error">{message}</p>}

            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Guardando..." : "Establecer contraseña"}
            </button>
          </form>
        )}
      </div>

      <style>{`
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
          color: white;
        }

        .icon {
          font-size: 36px;
          text-align: center;
          margin-bottom: 8px;
        }

        h2 {
          text-align: center;
          margin-bottom: 5px;
          font-size: 20px;
        }

        .subtitle {
          text-align: center;
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 20px;
          line-height: 1.6;
        }

        form { display: flex; flex-direction: column; gap: 12px; }

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
          margin-top: 6px;
          padding: 12px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
        }

        button:hover { transform: translateY(-2px); }
        button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .success-box {
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.3);
          border-radius: 10px;
          padding: 14px;
          text-align: center;
          font-size: 14px;
          color: #86efac;
        }

        .hint { font-size: 12px; color: #94a3b8; margin-top: 6px; }
        .error { color: #ef4444; font-size: 12px; text-align: center; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default ChangePassword;
