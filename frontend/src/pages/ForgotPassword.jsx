import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

function ForgotPassword() {
  const [email,   setEmail]   = useState("");
  const [status,  setStatus]  = useState(""); // "loading" | "done" | "error"
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res  = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.msg);
      setStatus("done");
    } catch {
      setMessage("Error de conexión con el servidor.");
      setStatus("error");
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>🔑 Recuperar contraseña</h2>
        <p className="subtitle">
          Ingresa tu correo y te enviaremos un enlace para restablecerla.
        </p>

        {status === "done" ? (
          <div className="success-box">
            <p>{message}</p>
            <p className="hint">Revisa también tu carpeta de spam.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              required
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {status === "error" && <p className="error">{message}</p>}

            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        )}

        <p className="back">
          <a onClick={() => navigate("/login")}>← Volver al login</a>
        </p>
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

        h2 {
          text-align: center;
          margin-bottom: 5px;
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

        .hint {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 6px;
        }

        .error {
          color: #ef4444;
          font-size: 12px;
          text-align: center;
        }

        .back {
          text-align: center;
          margin-top: 16px;
          font-size: 13px;
        }

        .back a {
          color: #60a5fa;
          cursor: pointer;
          text-decoration: none;
        }

        .back a:hover { text-decoration: underline; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default ForgotPassword;
