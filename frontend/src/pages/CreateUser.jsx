import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

function CreateUser() {
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

  useEffect(() => {
    fetch(`${API_URL}/api/roles`, { headers })
      .then((r) => r.json()).then((d) => setRoles(Array.isArray(d) ? d : [])).catch(() => setRoles([]));

    fetch(`${API_URL}/api/departments`, { headers })
      .then((r) => r.json()).then((d) => setDepartments(Array.isArray(d) ? d : [])).catch(() => setDepartments([]));

    fetch(`${API_URL}/api/users`, { headers })
      .then((r) => r.json()).then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => setUsers([]));
  }, []);

  const handleSubmit = async () => {
    const res = await fetch(`${API_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ nombre, email, password, role, department }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.msg || "Error");
    setUsers((prev) => [data, ...prev]);
    setNombre(""); setEmail(""); setPassword(""); setRole(""); setDepartment("");
  };

  const confirmDelete = async () => {
    if (!userToDelete?._id) return;
    await fetch(`${API_URL}/api/users/${userToDelete._id}`, { method: "DELETE", headers });
    setUsers((prev) => prev.filter((u) => u?._id !== userToDelete._id));
    setUserToDelete(null);
    setShowDeleteModal(false);
  };

  const handleUpdateUser = async () => {
    if (!editingUser?._id) return;
    const res = await fetch(`${API_URL}/api/users/${editingUser._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(editingUser),
    });
    const data = await res.json();
    setUsers((prev) => prev.map((u) => (u?._id === data?._id ? data : u)));
    setEditingUser(null);
    setShowEditModal(false);
  };

  return (
    <div className="page">

      <div className="page-header">
        <div>
          <h1>👥 Usuarios</h1>
          <p>Gestión de usuarios del sistema</p>
        </div>
        <button className="btn-back" onClick={() => navigate("/dashboard")}>
          ← Volver
        </button>
      </div>

      <div className="layout-two-col">

        {/* FORMULARIO */}
        <div className="form-card">
          <h3>Crear usuario</h3>

          <div className="form-group">
            <label>Nombre</label>
            <input placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input placeholder="correo@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Selecciona rol</option>
              {roles.map((r, i) => (
                <option key={r?._id || i} value={r?.name}>{r?.name}</option>
              ))}
            </select>
          </div>

          {role === "departamento" && (
            <div className="form-group">
              <label>Departamento</label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="">Seleccionar departamento</option>
                {departments.map((d, i) => (
                  <option key={d?._id || i} value={d?.name}>{d?.name}</option>
                ))}
              </select>
            </div>
          )}

          <button className="btn-submit" onClick={handleSubmit}>Crear usuario</button>
        </div>

        {/* LISTA */}
        <div className="users-panel">
          <h3>Usuarios registrados <span className="count">{users.length}</span></h3>

          <div className="users-list">
            {users.map((u, i) => (
              <div className="user-card" key={u?._id || i}>
                <div className="user-info">
                  <div className="user-avatar">{u?.nombre?.[0]?.toUpperCase() || "?"}</div>
                  <div>
                    <b>{u?.nombre}</b>
                    <p>{u?.email}</p>
                  </div>
                </div>
                <div className="user-actions">
                  <span className="role-badge">{u?.role}</span>
                  <button className="btn-icon edit" onClick={() => { setEditingUser(u); setShowEditModal(true); }}>✏</button>
                  <button className="btn-icon delete" onClick={() => { setUserToDelete(u); setShowDeleteModal(true); }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL DELETE */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Eliminar usuario</h3>
            <p>¿Estás seguro de eliminar a <b>{userToDelete?.nombre}</b>?</p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={confirmDelete}>Eliminar</button>
              <button className="btn-cancel" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT */}
      {showEditModal && editingUser && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Editar usuario</h3>
            <div className="form-group">
              <label>Nombre</label>
              <input value={editingUser.nombre || ""} onChange={(e) => setEditingUser({ ...editingUser, nombre: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={editingUser.email || ""} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn-submit" onClick={handleUpdateUser}>Guardar</button>
              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .page { padding: 28px; min-height: 100vh; color: #fff; }

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

        .layout-two-col {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 24px;
          align-items: start;
        }

        .form-card, .users-panel {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 24px;
        }

        .form-card h3, .users-panel h3 {
          font-size: 15px;
          margin-bottom: 20px;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .count {
          background: rgba(59,130,246,0.2);
          color: #60a5fa;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
        }

        .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .form-group label { font-size: 12px; font-weight: 500; color: #94a3b8; }
        .form-group input,
        .form-group select {
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid #1e293b;
          background: #0b1220;
          color: #e2e8f0;
          font-size: 14px;
          transition: 0.2s;
        }
        .form-group input:focus,
        .form-group select:focus {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
        }

        .btn-submit {
          width: 100%;
          padding: 11px;
          border-radius: 8px;
          border: none;
          background: #3b82f6;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
        }
        .btn-submit:hover { background: #2563eb; }

        .users-list { display: flex; flex-direction: column; gap: 10px; }

        .user-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          padding: 12px 14px;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          transition: 0.2s;
        }
        .user-card:hover { background: rgba(255,255,255,0.06); }

        .user-info { display: flex; align-items: center; gap: 12px; }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
        }

        .user-info b { font-size: 14px; display: block; }
        .user-info p { font-size: 12px; color: #64748b; margin: 0; }

        .user-actions { display: flex; align-items: center; gap: 8px; }

        .role-badge {
          background: rgba(255,255,255,0.07);
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11px;
          color: #94a3b8;
          text-transform: capitalize;
        }

        .btn-icon {
          width: 30px;
          height: 30px;
          border-radius: 7px;
          border: none;
          cursor: pointer;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: 0.2s;
          margin: 0;
          padding: 0;
        }
        .btn-icon.edit { background: rgba(59,130,246,0.12); }
        .btn-icon.edit:hover { background: #3b82f6; }
        .btn-icon.delete { background: rgba(239,68,68,0.12); }
        .btn-icon.delete:hover { background: #ef4444; }

        /* MODALS */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0,0,0,0.65);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 999;
        }

        .modal-box {
          background: #0f172a;
          border: 1px solid #1e293b;
          padding: 28px;
          border-radius: 14px;
          width: 90%;
          max-width: 360px;
        }

        .modal-box h3 { font-size: 16px; margin-bottom: 14px; }
        .modal-box p { font-size: 14px; color: #94a3b8; margin-bottom: 20px; }

        .modal-actions { display: flex; gap: 10px; margin-top: 16px; }

        .btn-danger {
          flex: 1; padding: 10px; border: none; border-radius: 8px;
          background: #ef4444; color: white; cursor: pointer; font-size: 14px; font-weight: 600;
          transition: 0.2s;
        }
        .btn-danger:hover { background: #dc2626; }

        .btn-cancel {
          flex: 1; padding: 10px; border: 1px solid #1e293b; border-radius: 8px;
          background: transparent; color: #94a3b8; cursor: pointer; font-size: 14px;
          transition: 0.2s;
        }
        .btn-cancel:hover { border-color: #3b82f6; color: white; }

        @media (max-width: 900px) {
          .layout-two-col { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .page { padding: 16px; }
          .user-card { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}

export default CreateUser;
