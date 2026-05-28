import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { ROLES } from "../config/roles";

const API_URL = import.meta.env.VITE_API_URL;
const USER_PERMISSIONS = [
  { value: "CREATE_USERS", label: "Crear usuarios" },
  { value: "CREATE_INCIDENT", label: "Crear solicitud" },
  { value: "VIEW_INCIDENTS_ALL", label: "Ver incidencias: todas" },
  { value: "VIEW_INCIDENTS_DEPARTMENT", label: "Ver incidencias: su departamento" },
  { value: "VIEW_INCIDENTS_BRANCH", label: "Ver incidencias: sus sucursales" },
  { value: "CREATE_MAINTENANCE", label: "Crear mantenimientos" },
  { value: "CONFIRM_MAINTENANCE", label: "Confirmar mantenimientos" },
  { value: "VIEW_MAINTENANCE_ALL", label: "Ver mantenimientos: todos" },
  { value: "VIEW_MAINTENANCE_DEPARTMENT", label: "Ver mantenimientos: su departamento" },
  { value: "VIEW_MAINTENANCE_BRANCH", label: "Ver mantenimientos: sus sucursales" },
  { value: "CREATE_INVENTORY", label: "Crear equipos de inventario" },
  { value: "VIEW_INVENTORY_ALL", label: "Ver inventario: todo" },
  { value: "VIEW_INVENTORY_BRANCH", label: "Ver inventario: sus sucursales" },
  { value: "DISPOSE_INVENTORY", label: "Dar de baja equipos" },
];

function CreateUser() {
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);

  const [nombre, setNombre] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [message, setMessage] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editPermissions, setEditPermissions] = useState([]);
  const [editBranches, setEditBranches] = useState([]);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const currentUser = token ? jwtDecode(token) : null;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API_URL}/api/roles`, { headers })
      .then((r) => r.json()).then((d) => setRoles(Array.isArray(d) ? d : [])).catch(() => setRoles([]));

    fetchDepartments();

    fetchBranches();

    fetchUsers();
  }, []);

  const fetchDepartments = () => {
    fetch(`${API_URL}/api/departments`, { headers })
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d) ? d : []))
      .catch(() => setDepartments([]));
  };

  const fetchBranches = () => {
    fetch(`${API_URL}/api/branches`, { headers })
      .then((r) => r.json())
      .then((d) => setBranches(Array.isArray(d) ? d : []))
      .catch(() => setBranches([]));
  };

  const fetchUsers = () => {
    fetch(`${API_URL}/api/users`, { headers })
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  };

  const refreshSession = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();

      if (!res.ok) return;

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("auth-updated"));
      window.dispatchEvent(new Event("auth-refresh"));
    } catch (error) {
      console.error("Error actualizando sesión:", error);
    }
  };

  const togglePermission = (permissions, permission) => {
    return permissions.includes(permission)
      ? permissions.filter((item) => item !== permission)
      : [...permissions, permission];
  };

  const toggleListItem = (items, item) => {
    return items.includes(item)
      ? items.filter((value) => value !== item)
      : [...items, item];
  };

  const getUserBranches = (user) => {
    if (Array.isArray(user?.branches) && user.branches.length > 0) {
      return user.branches
        .map((item) => item?._id || item)
        .filter(Boolean);
    }

    const singleBranch = user?.branch?._id || user?.branch;
    return singleBranch ? [singleBranch] : [];
  };

  const getRolePermissions = (roleName) => {
    return roleName === "admin" && Array.isArray(ROLES[roleName])
      ? ROLES[roleName]
      : [];
  };

  const getEffectivePermissions = (user) => {
    if (user?.role === "admin") {
      return getRolePermissions(user.role);
    }

    return Array.isArray(user?.permissions) ? user.permissions : [];
  };

  const openEditModal = (user) => {
    const directPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
    setEditingUser({ ...user, permissions: directPermissions });
    setEditPermissions(directPermissions);
    setEditBranches(getUserBranches(user));
    setShowEditModal(true);
  };

  const handleCreateDepartment = async () => {
    setMessage(null);
    if (!newDepartment.trim()) {
      setMessage({
        type: "error",
        title: "Falta nombre del departamento",
        detail: "El campo Nuevo departamento es obligatorio."
      });
      return;
    }

    const res = await fetch(`${API_URL}/api/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        name: newDepartment,
        permissions: []
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({
        type: "error",
        title: data.msg || "No se pudo crear el departamento",
        detail: data.error || `Error ${res.status}`
      });
      return;
    }
    setDepartments((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewDepartment("");
    await refreshSession();
    setMessage({
      type: "success",
      title: "Departamento creado correctamente",
      detail: `Se agregó ${data.name}.`
    });
  };

  const handleDeleteDepartment = async (item) => {
    if (!confirm(`Eliminar departamento "${item.name}"?`)) return;
    const res = await fetch(`${API_URL}/api/departments/${item._id}`, {
      method: "DELETE",
      headers,
    });
    const data = await res.json();
    if (!res.ok) return alert(data.msg || "Error");
    setDepartments((prev) => prev.filter((d) => d._id !== item._id));
    await refreshSession();
  };

  const handleCreateBranch = async () => {
    setMessage(null);
    if (!newBranch.trim()) {
      setMessage({
        type: "error",
        title: "Falta nombre de la sucursal",
        detail: "El campo Nueva sucursal es obligatorio."
      });
      return;
    }

    const res = await fetch(`${API_URL}/api/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name: newBranch }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({
        type: "error",
        title: data.msg || "No se pudo crear la sucursal",
        detail: data.error || `Error ${res.status}`
      });
      return;
    }
    setBranches((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewBranch("");
    await refreshSession();
    setMessage({
      type: "success",
      title: "Sucursal creada correctamente",
      detail: `Se agregó ${data.name}.`
    });
  };

  const handleDeleteBranch = async (item) => {
    if (!confirm(`Eliminar sucursal "${item.name}"?`)) return;

    const res = await fetch(`${API_URL}/api/branches/${item._id}`, {
      method: "DELETE",
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({
        type: "error",
        title: data.msg || "No se pudo eliminar la sucursal",
        detail: data.error || `Error ${res.status}`
      });
      return;
    }
    setBranches((prev) => prev.filter((b) => b._id !== item._id));
    setSelectedBranches((prev) => prev.filter((id) => id !== item._id));
    setEditBranches((prev) => prev.filter((id) => id !== item._id));
    fetchUsers();
    await refreshSession();
    setMessage({
      type: "success",
      title: "Sucursal eliminada correctamente",
      detail: `${item.name} ya no aparece en las listas de selección.`
    });
  };

  const handleSubmit = async () => {
    setMessage(null);
    if (!nombre.trim() || !email.trim() || !password || !role) {
      setMessage({
        type: "error",
        title: "Faltan campos obligatorios",
        detail: "Nombre, email, contraseña y rol son obligatorios."
      });
      return;
    }

    if (role === "departamento" && !department) {
      setMessage({
        type: "error",
        title: "Falta departamento",
        detail: "Para el rol departamento debes seleccionar un departamento."
      });
      return;
    }

    const res = await fetch(`${API_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ nombre, username, email, password, role, department, branches: selectedBranches, permissions }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({
        type: "error",
        title: data.msg || "No se pudo crear el usuario",
        detail: data.error || `Error ${res.status}`
      });
      return;
    }
    setUsers((prev) => [data, ...prev]);
    setNombre(""); setUsername(""); setEmail(""); setPassword(""); setRole(""); setDepartment(""); setSelectedBranches([]); setPermissions([]);
    await refreshSession();
    setMessage({
      type: "success",
      title: "Usuario creado correctamente",
      detail: `${data.nombre} ya puede iniciar sesión.`
    });
  };

  const confirmDelete = async () => {
    if (!userToDelete?._id) return;
    const res = await fetch(`${API_URL}/api/users/${userToDelete._id}`, { method: "DELETE", headers });
    const data = await res.json();
    if (!res.ok) {
      setMessage({
        type: "error",
        title: data.msg || "No se pudo eliminar el usuario",
        detail: data.error || `Error ${res.status}`
      });
      return;
    }
    setUsers((prev) => prev.filter((u) => u?._id !== userToDelete._id));
    setUserToDelete(null);
    setShowDeleteModal(false);
    await refreshSession();
  };

  const handleUpdateUser = async () => {
    if (!editingUser?._id) return;
    setMessage(null);
    const payload = {
      nombre: editingUser.nombre || "",
      username: editingUser.username || "",
      email: editingUser.email || "",
      role: editingUser.role || "",
      department: editingUser.department || "",
      branch: editBranches[0] || null,
      branches: editBranches,
      permissions:
        editingUser.role === "admin"
          ? []
          : editPermissions,
    };

    const res = await fetch(`${API_URL}/api/users/${editingUser._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({
        type: "error",
        title: data.msg || "No se pudo actualizar el usuario",
        detail: data.error || `Error ${res.status}`
      });
      return;
    }
    setUsers((prev) => prev.map((u) => (u?._id === data?._id ? data : u)));
    fetchUsers();
    setEditingUser(null);
    setEditPermissions([]);
    setEditBranches([]);
    setShowEditModal(false);
    await refreshSession();
    setMessage({
      type: "success",
      title: "Usuario actualizado correctamente",
      detail: "Los permisos se actualizarán automáticamente en la sesión activa."
    });
  };

  if (
    currentUser?.role !== "admin" &&
    !currentUser?.permissions?.includes("CREATE_USERS")
  ) {
    return (
      <div className="page">
        <div className="form-card">
          <h3>Sin acceso</h3>
          <p>No tienes permisos para crear usuarios.</p>
        </div>
      </div>
    );
  }

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

      {message && (
        <div className={`notice ${message.type}`}>
          <b>{message.title}</b>
          <span>{message.detail}</span>
        </div>
      )}

      <div className="layout-two-col">

        {/* FORMULARIO */}
        <div className="form-card">
          <h3>Crear usuario</h3>

          <div className="form-group">
            <label>Nombre</label>
            <input placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Usuario</label>
            <input placeholder="usuario" value={username} onChange={(e) => setUsername(e.target.value)} />
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

          <div className="form-group">
            <label>Sucursales asignadas</label>
            <div className="checkbox-grid">
              {branches.map((b, i) => (
                <label key={b?._id || i} className="check-row">
                  <input
                    type="checkbox"
                    checked={selectedBranches.includes(b?._id)}
                    onChange={() =>
                      setSelectedBranches((prev) => toggleListItem(prev, b?._id))
                    }
                  />
                  {b?.name}
                </label>
              ))}
            </div>
          </div>

          <div className="permissions-list">
            <label>Permisos del usuario</label>
            {USER_PERMISSIONS.map((permission) => (
              <label key={permission.value} className="check-row">
                <input
                  type="checkbox"
                  checked={permissions.includes(permission.value)}
                  onChange={() =>
                    setPermissions((prev) => togglePermission(prev, permission.value))
                  }
                />
                {permission.label}
              </label>
            ))}
          </div>

          <button className="btn-submit" onClick={handleSubmit}>Crear usuario</button>

          <div className="department-admin">
            <h3>Departamentos</h3>
            <div className="form-group">
              <label>Nuevo departamento</label>
              <input
                placeholder="ej. compras"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
              />
            </div>

            <button className="btn-submit" onClick={handleCreateDepartment}>
              Crear departamento
            </button>

            <div className="departments-list">
              {departments.map((item, i) => (
                <div className="department-row" key={item?._id || i}>
                  <div>
                    <b>{item?.name}</b>
                  </div>
                  <button className="btn-icon delete" onClick={() => handleDeleteDepartment(item)}>
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="department-admin">
            <h3>Sucursales</h3>
            <div className="form-group">
              <label>Nueva sucursal</label>
              <input
                placeholder="ej. monterrey"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
              />
            </div>

            <button className="btn-submit" onClick={handleCreateBranch}>
              Crear sucursal
            </button>

            <div className="departments-list">
              {branches.map((item, i) => (
                <div className="department-row" key={item?._id || i}>
                  <div>
                    <b>{item?.name}</b>
                  </div>
                  <button className="btn-icon delete" onClick={() => handleDeleteBranch(item)}>
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
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
                    <p>{u?.username ? `${u.username} | ${u.email}` : u?.email}</p>
                    <small className="permission-summary">
                      {(u?.permissions || []).length} permisos directos
                    </small>
                  </div>
                </div>
                <div className="user-actions">
                  <span className="role-badge">{u?.role}</span>
                  <button className="btn-icon edit" onClick={() => openEditModal(u)}>✏</button>
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
              <label>Usuario</label>
              <input value={editingUser.username || ""} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={editingUser.email || ""} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Rol</label>
              <select value={editingUser.role || ""} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}>
                <option value="">Selecciona rol</option>
                {roles.map((r, i) => (
                  <option key={r?._id || i} value={r?.name}>{r?.name}</option>
                ))}
              </select>
            </div>
            {editingUser.role === "departamento" && (
              <div className="form-group">
                <label>Departamento</label>
                <select
                  value={editingUser.department || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                >
                  <option value="">Seleccionar departamento</option>
                  {departments.map((d, i) => (
                    <option key={d?._id || i} value={d?.name}>{d?.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Sucursales asignadas</label>
              <div className="checkbox-grid">
                {branches.map((b, i) => (
                  <label key={b?._id || i} className="check-row">
                    <input
                      type="checkbox"
                      checked={editBranches.includes(b?._id)}
                      onChange={() =>
                        setEditBranches((prev) => toggleListItem(prev, b?._id))
                      }
                    />
                    {b?.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="permissions-list">
              <label>
                Permisos del usuario
                {editingUser.role === "admin" && (
                  <span className="hint-text">El rol admin siempre tiene todos los permisos.</span>
                )}
              </label>
              {USER_PERMISSIONS.map((permission) => (
                <label key={permission.value} className="check-row">
                  <input
                    type="checkbox"
                    checked={
                      editingUser.role === "admin"
                        ? getEffectivePermissions(editingUser).includes(permission.value)
                        : editPermissions.includes(permission.value)
                    }
                    disabled={
                      editingUser.role === "admin" &&
                      getRolePermissions(editingUser.role).includes(permission.value)
                    }
                    onChange={() =>
                      setEditPermissions((prev) => togglePermission(prev, permission.value))
                    }
                  />
                  {permission.label}
                  {editingUser.role === "admin" &&
                    getRolePermissions(editingUser.role).includes(permission.value) && (
                    <span className="inherited-tag">Rol</span>
                  )}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-submit" onClick={handleUpdateUser}>Guardar</button>
              <button className="btn-cancel" onClick={() => { setShowEditModal(false); setEditingUser(null); setEditPermissions([]); setEditBranches([]); }}>Cancelar</button>
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

        .notice {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 18px;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 13px;
          border: 1px solid transparent;
        }
        .notice.success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: #86efac; }
        .notice.error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
        .notice span { color: #cbd5e1; }

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
          background: var(--app-input);
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

        .department-admin {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .permissions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }

        .permissions-list.compact {
          margin: 8px 0 0;
          gap: 6px;
        }

        .checkbox-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          max-height: 150px;
          overflow: auto;
          padding: 10px;
          border: 1px solid #1e293b;
          border-radius: 8px;
          background: var(--app-input);
        }

        .check-row {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #94a3b8;
          font-size: 12px;
        }

        .check-row input {
          width: auto;
          accent-color: #3b82f6;
        }

        .hint-text {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 11px;
          font-weight: 400;
        }

        .check-row input:disabled {
          cursor: not-allowed;
          opacity: 0.75;
        }

        .inherited-tag {
          margin-left: auto;
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(59,130,246,0.16);
          color: #93c5fd;
          font-size: 10px;
          font-weight: 600;
        }

        .departments-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 16px;
        }

        .department-row {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
        }

        .department-row b {
          color: #e2e8f0;
          font-size: 13px;
          text-transform: capitalize;
        }

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
        .permission-summary {
          display: block;
          margin-top: 3px;
          color: #60a5fa;
          font-size: 11px;
        }

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
