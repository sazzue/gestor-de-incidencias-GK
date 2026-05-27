import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";

const API_URL = import.meta.env.VITE_API_URL;

function CreateIncidencia() {
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = useAuthUser();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resBranches, resDepartments] = await Promise.all([
        fetch(`${API_URL}/api/branches`),
        fetch(`${API_URL}/api/departments`),
      ]);

      setBranches(await resBranches.json());
      setDepartments(await resDepartments.json());
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  };

  const handleSubmit = async () => {
    setMessage(null);
    setIsSubmitting(true);

    if (!title || !description || !branch || !department) {
      setMessage({
        type: "error",
        title: "Faltan campos obligatorios",
        detail: "Titulo, descripcion, departamento y sucursal son obligatorios.",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("branch", branch);
      formData.append("department", department);
      attachments.forEach((file) => formData.append("attachments", file));

      const res = await fetch(`${API_URL}/api/incidents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          title: data.msg || "No se pudo crear la solicitud",
          detail: data.error || `Error ${res.status}`,
        });
        return;
      }

      setMessage({
        type: "success",
        title: "Solicitud creada correctamente",
        detail: "La incidencia ya quedo registrada.",
      });
      setTitle("");
      setDescription("");
      setBranch("");
      setDepartment("");
      setAttachments([]);
    } catch (error) {
      console.error("Error conexion:", error);
      setMessage({
        type: "error",
        title: "Error de conexion",
        detail: "No se pudo conectar con el servidor.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (
    !user ||
    (user.role !== "admin" && !user.permissions?.includes("CREATE_INCIDENT"))
  ) {
    return (
      <div className="page center">
        <div className="form-card">
          <h2>Sin acceso</h2>
          <p>No tienes permisos para crear solicitudes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Crear solicitud</h1>
          <p>Registra una nueva incidencia</p>
        </div>
        <button className="btn-back" onClick={() => navigate("/incidents")}>
          Volver
        </button>
      </div>

      <div className="form-card">
        {message && (
          <div className={`notice ${message.type}`}>
            <b>{message.title}</b>
            <span>{message.detail}</span>
          </div>
        )}

        <div className="form-group">
          <label>Titulo</label>
          <input
            placeholder="Ej. Falla en sistema de computo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Departamento</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">Seleccionar departamento</option>
            {departments.map((dep) => (
              <option key={dep._id} value={dep.name.toLowerCase()}>{dep.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Descripcion</label>
          <textarea
            placeholder="Describe el problema con detalle..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        <div className="form-group">
          <label>Sucursal</label>
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">Seleccionar sucursal</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Archivos adjuntos</label>
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.csv"
            onChange={(e) => setAttachments(Array.from(e.target.files || []))}
          />
          {attachments.length > 0 && (
            <div className="file-list">
              {attachments.map((file) => (
                <span key={`${file.name}-${file.size}`}>{file.name}</span>
              ))}
            </div>
          )}
          <span className="file-hint">Maximo 5 MB por archivo, 10 archivos y 30 MB por incidencia.</span>
        </div>

        <button className="btn-submit" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Enviando..." : "Enviar solicitud"}
        </button>
      </div>

      <style>{`
        .page {
          padding: 28px;
          min-height: 100vh;
          color: #fff;
        }

        .page.center {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .page-header h1 { font-size: 22px; }
        .page-header p { font-size: 13px; color: #64748b; margin-top: 4px; }

        .btn-back {
          padding: 9px 16px;
          border-radius: 8px;
          border: 1px solid #1e293b;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          font-size: 14px;
          transition: 0.2s;
        }
        .btn-back:hover { border-color: #3b82f6; color: white; }

        .form-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          padding: 28px;
          max-width: 560px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .notice {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 13px;
          border: 1px solid transparent;
        }
        .notice.success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: #86efac; }
        .notice.error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
        .notice span { color: #cbd5e1; }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 500;
          color: #94a3b8;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #1e293b;
          background: var(--app-input);
          color: #e2e8f0;
          font-size: 14px;
          transition: 0.2s;
          font-family: inherit;
          resize: vertical;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
        }

        .file-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
          color: #cbd5e1;
          font-size: 12px;
        }

        .file-hint {
          color: #64748b;
          font-size: 12px;
        }

        .btn-submit {
          padding: 12px;
          border-radius: 8px;
          border: none;
          background: #3b82f6;
          color: white;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
          margin-top: 4px;
        }
        .btn-submit:hover { background: #2563eb; transform: translateY(-1px); }
        .btn-submit:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }

        @media (max-width: 600px) {
          .page { padding: 16px; }
          .form-card { padding: 20px; }
        }
      `}</style>
    </div>
  );
}

export default CreateIncidencia;
