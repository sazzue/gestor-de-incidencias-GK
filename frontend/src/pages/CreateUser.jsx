import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FormCard from "../components/FormCard";

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

  const navigate = useNavigate();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // 🔹 ROLES
  useEffect(() => {
    fetch(`${API_URL}/api/roles`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((r) => r.json())
      .then((d) => setRoles(Array.isArray(d) ? d : []))
      .catch(() => setRoles([]));
  }, []);

  // 🔹 DEPARTAMENTOS
  useEffect(() => {
    fetch(`${API_URL}/api/departments`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d) ? d : []))
      .catch(() => setDepartments([]));
  }, []);

  // 🔹 USERS
  useEffect(() => {
    fetch(`${API_URL}/api/users`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  }, []);

  // CREATE
  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch(`${API_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ nombre, email, password, role, department }),
    });

    const data = await res.json();

    if (!res.ok) return alert(data.msg || "Error");

    setUsers((prev) => [data, ...prev]);

    setNombre("");
    setEmail("");
    setPassword("");
    setRole("");
    setDepartment("");
  };

  // DELETE
  const confirmDelete = async () => {
    if (!userToDelete?._id) return;

    await fetch(`${API_URL}/api/users/${userToDelete._id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    setUsers((prev) =>
      prev.filter((u) => u?._id !== userToDelete._id)
    );

    setUserToDelete(null);
    setShowDeleteModal(false);
  };

  // UPDATE
  const handleUpdateUser = async () => {
    if (!editingUser?._id) return;

    const res = await fetch(
      `${API_URL}/api/users/${editingUser._id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(editingUser),
      }
    );

    const data = await res.json();

    setUsers((prev) =>
      prev.map((u) => (u?._id === data?._id ? data : u))
    );

    setEditingUser(null);
    setShowEditModal(false);
  };

  return (
    <div className="create-user-page">

      <FormCard
        title="👥 Crear Usuario"
        onBack={() => navigate("/dashboard")}
      >

        <input
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Selecciona rol</option>
          {roles.map((r, i) => (
            <option key={r?._id || i} value={r?.name}>
              {r?.name}
            </option>
          ))}
        </select>

        {role === "departamento" && (
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">Departamento</option>
            {departments.map((d, i) => (
              <option key={d?._id || i} value={d?.name}>
                {d?.name}
              </option>
            ))}
          </select>
        )}

        <button onClick={handleSubmit}>
          Crear Usuario
        </button>

        {/* LISTA */}
        <div className="users-list">
          {users.map((u, i) => (
            <div className="user-card" key={u?._id || i}>
              <div>
                <b>{u?.nombre}</b>
                <p>{u?.email}</p>
              </div>

              <div className="actions">
                <span>{u?.role}</span>

                <button
                  onClick={() => {
                    setEditingUser(u);
                    setShowEditModal(true);
                  }}
                >
                  ✏
                </button>

                <button
                  onClick={() => {
                    setUserToDelete(u);
                    setShowDeleteModal(true);
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </FormCard>

      {/* MODAL DELETE */}
      {showDeleteModal && (
        <div className="modal">
          <div className="modal-box">
            <p>¿Eliminar usuario?</p>

            <button onClick={confirmDelete}>Eliminar</button>
            <button onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL EDIT */}
      {showEditModal && editingUser && (
        <div className="modal">
          <div className="modal-box">

            <input
              value={editingUser.nombre || ""}
              onChange={(e) =>
                setEditingUser({
                  ...editingUser,
                  nombre: e.target.value,
                })
              }
            />

            <input
              value={editingUser.email || ""}
              onChange={(e) =>
                setEditingUser({
                  ...editingUser,
                  email: e.target.value,
                })
              }
            />

            <button onClick={handleUpdateUser}>
              Guardar
            </button>

            <button onClick={() => setShowEditModal(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* CSS COMPLETO */}
      <style>{`
        .create-user-page {
          min-height: 100vh;
          background: #0b1220;
          display: flex;
          justify-content: center;
          padding: 20px;
        }

        input, select {
          width: 100%;
          padding: 10px;
          margin-top: 10px;
          border-radius: 8px;
          border: 1px solid #1e293b;
          background: #020617;
          color: white;
        }

        button {
          margin-top: 10px;
          padding: 10px;
          border: none;
          border-radius: 8px;
          background: #3b82f6;
          color: white;
          cursor: pointer;
        }

        .users-list {
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .user-card {
          background: #0f172a;
          padding: 10px;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .actions button {
          padding: 5px 8px;
          font-size: 14px;
        }

        .modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.6);
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .modal-box {
          background: #0f172a;
          padding: 20px;
          border-radius: 10px;
          width: 300px;
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .user-card {
            flex-direction: column;
            align-items: flex-start;
          }

          .create-user-page {
            padding: 10px;
          }
        }
      `}</style>

    </div>
  );
}

export default CreateUser;