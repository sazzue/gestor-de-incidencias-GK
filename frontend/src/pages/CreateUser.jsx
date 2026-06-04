import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { ROLES } from "../config/roles";
import { exportPdfReport } from "../utils/pdfReport";

const API_URL = import.meta.env.VITE_API_URL;

const USER_PERMISSIONS = [
  { value: "CREATE_USERS", label: "Crear usuarios" },
  { value: "CREATE_INCIDENT", label: "Crear solicitud" },
  { value: "VIEW_INCIDENTS_ALL", label: "Ver incidencias: todas" },
  { value: "VIEW_INCIDENTS_DEPARTMENT", label: "Ver incidencias: departamento" },
  { value: "VIEW_INCIDENTS_BRANCH", label: "Ver incidencias: sucursales" },
  { value: "COMMENT_INCIDENT", label: "Comentar cierre de incidencias" },
  { value: "VIEW_INCIDENT_COMMENTS", label: "Ver comentarios de incidencias" },
  { value: "CREATE_MAINTENANCE", label: "Crear mantenimientos" },
  { value: "CONFIRM_MAINTENANCE", label: "Confirmar mantenimientos" },
  { value: "VIEW_MAINTENANCE_ALL", label: "Ver mantenimientos: todos" },
  { value: "VIEW_MAINTENANCE_DEPARTMENT", label: "Ver mantenimientos: departamento" },
  { value: "VIEW_MAINTENANCE_BRANCH", label: "Ver mantenimientos: sucursales" },
  { value: "COMMENT_MAINTENANCE", label: "Comentar autorizacion de mantenimiento" },
  { value: "VIEW_MAINTENANCE_COMMENTS", label: "Ver comentarios de mantenimiento" },
  { value: "CREATE_INVENTORY", label: "Crear inventario" },
  { value: "VIEW_INVENTORY_ALL", label: "Ver inventario: todo" },
  { value: "VIEW_INVENTORY_DEPARTMENT", label: "Ver inventario: departamento" },
  { value: "VIEW_INVENTORY_BRANCH", label: "Ver inventario: sucursales" },
  { value: "DISPOSE_INVENTORY", label: "Dar de baja equipos" },
];

const EMPTY_FORM = {
  nombre: "",
  username: "",
  email: "",
  password: "",
  role: "",
  department: "",
  branches: [],
  permissions: [],
};

function CreateUser() {
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const currentUser = token ? jwtDecode(token) : null;
  const headers = { Authorization: `Bearer ${token}` };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleListItem = (items, item) =>
    items.includes(item) ? items.filter((value) => value !== item) : [...items, item];

  const togglePermission = (list, permission) => toggleListItem(list, permission);

  const getRolePermissions = (roleName) =>
    roleName === "admin" && Array.isArray(ROLES[roleName]) ? ROLES[roleName] : [];

  const getUserBranches = (user) => {
    if (Array.isArray(user?.branches) && user.branches.length > 0) {
      return user.branches.map((item) => item?._id || item).filter(Boolean);
    }

    const singleBranch = user?.branch?._id || user?.branch;
    return singleBranch ? [singleBranch] : [];
  };

  const fetchJson = async (path) => {
    const res = await fetch(`${API_URL}${path}`, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || `Error ${res.status}`);
    return data;
  };

  const fetchData = async () => {
    try {
      const [rolesData, departmentsData, branchesData, usersData] = await Promise.all([
        fetchJson("/api/roles"),
        fetchJson("/api/departments"),
        fetchJson("/api/branches"),
        fetchJson("/api/users"),
      ]);

      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
      setBranches(Array.isArray(branchesData) ? branchesData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error) {
      setMessage({ type: "error", title: "No se pudieron cargar los datos", detail: error.message });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      console.error("Error actualizando sesion:", error);
    }
  };

  const resetForm = () => setForm(EMPTY_FORM);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (!form.nombre.trim() || !form.email.trim() || !form.password || !form.role) {
      setMessage({
        type: "error",
        title: "Faltan campos obligatorios",
        detail: "Nombre, email, contrasena y rol son obligatorios.",
      });
      return;
    }

    if (form.role === "departamento" && !form.department) {
      setMessage({
        type: "error",
        title: "Falta departamento",
        detail: "Para el rol departamento debes seleccionar un departamento.",
      });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          nombre: form.nombre,
          username: form.username,
          email: form.email,
          password: form.password,
          role: form.role,
          department: form.department,
          branches: form.branches,
          permissions: form.permissions,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudo crear el usuario", detail: data.error || `Error ${res.status}` });
        return;
      }

      setUsers((prev) => [data, ...prev]);
      resetForm();
      await refreshSession();
      setMessage({ type: "success", title: "Usuario creado correctamente", detail: `${data.nombre} ya puede iniciar sesion.` });
    } catch (error) {
      setMessage({ type: "error", title: "Error de conexion", detail: error.message });
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete?._id) return;

    const res = await fetch(`${API_URL}/api/users/${userToDelete._id}`, { method: "DELETE", headers });
    const data = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", title: data.msg || "No se pudo eliminar el usuario", detail: data.error || `Error ${res.status}` });
      return;
    }

    setUsers((prev) => prev.filter((user) => user?._id !== userToDelete._id));
    setUserToDelete(null);
    await refreshSession();
  };

  const openEditModal = (user) => {
    setEditingUser({
      ...user,
      branches: getUserBranches(user),
      permissions: Array.isArray(user?.permissions) ? user.permissions : [],
    });
  };

  const updateEditingUser = (field, value) => {
    setEditingUser((prev) => ({ ...prev, [field]: value }));
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
      branch: editingUser.branches?.[0] || null,
      branches: editingUser.branches || [],
      permissions: editingUser.role === "admin" ? [] : editingUser.permissions || [],
    };

    const res = await fetch(`${API_URL}/api/users/${editingUser._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", title: data.msg || "No se pudo actualizar el usuario", detail: data.error || `Error ${res.status}` });
      return;
    }

    setUsers((prev) => prev.map((user) => (user?._id === data?._id ? data : user)));
    setEditingUser(null);
    await refreshSession();
    setMessage({ type: "success", title: "Usuario actualizado correctamente", detail: "Los cambios ya quedaron guardados." });
  };

  const exportUsersPdf = () => {
    if (users.length === 0) { alert("No hay usuarios para exportar"); return; }

    exportPdfReport({
      title: "Reporte de usuarios",
      subtitle: "Usuarios, roles y permisos de la empresa",
      summary: [
        { label: "Total", value: users.length },
        { label: "Admins", value: users.filter((user) => user.role === "admin").length },
        { label: "Departamentos", value: departments.length },
        { label: "Sucursales", value: branches.length },
      ],
      columns: [
        { key: "name", label: "Nombre" },
        { key: "email", label: "Email" },
        { key: "username", label: "Usuario" },
        { key: "role", label: "Rol" },
        { key: "department", label: "Departamento" },
        { key: "branches", label: "Sucursales" },
        { key: "permissions", label: "Permisos directos" },
      ],
      rows: users.map((user) => ({
        name: user.nombre,
        email: user.email,
        username: user.username || "",
        role: user.role,
        department: user.department || "",
        branches: (user.branches || [])
          .map((branch) => branch?.name || branch)
          .join(", "),
        permissions: (user.permissions || []).length,
      })),
    });
  };

  if (currentUser?.role !== "admin" && !currentUser?.permissions?.includes("CREATE_USERS")) {
    return (
      <div className="users-page">
        <div className="empty-panel">
          <h3>Sin acceso</h3>
          <p>No tienes permisos para crear usuarios.</p>
        </div>
      </div>
    );
  }

  const renderBranchCheckboxes = (selected, onChange) => (
    <div className="option-grid">
      {branches.map((branch) => (
        <label key={branch._id} className="option-row">
          <input
            type="checkbox"
            checked={selected.includes(branch._id)}
            onChange={() => onChange(toggleListItem(selected, branch._id))}
          />
          <span>{branch.name}</span>
        </label>
      ))}
    </div>
  );

  const renderPermissionCheckboxes = ({ selected, roleName, onChange }) => (
    <div className="permissions-grid">
      {USER_PERMISSIONS.map((permission) => {
        const inherited = roleName === "admin" && getRolePermissions(roleName).includes(permission.value);
        const checked = inherited || selected.includes(permission.value);

        return (
          <label key={permission.value} className="option-row">
            <input
              type="checkbox"
              checked={checked}
              disabled={inherited}
              onChange={() => onChange(togglePermission(selected, permission.value))}
            />
            <span>{permission.label}</span>
            {inherited && <small>Rol</small>}
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>Crear usuarios, asignar sucursales y configurar permisos.</p>
        </div>
        <div className="header-actions">
          <button className="ghost-btn" onClick={exportUsersPdf}>Exportar PDF</button>
          <button className="ghost-btn" onClick={() => navigate("/catalogs")}>Catalogos</button>
          <button className="ghost-btn" onClick={() => navigate("/dashboard")}>Volver</button>
        </div>
      </div>

      {message && (
        <div className={`notice ${message.type}`}>
          <b>{message.title}</b>
          <span>{message.detail}</span>
        </div>
      )}

      <div className="users-layout">
        <form className="panel user-form" onSubmit={handleSubmit}>
          <div className="panel-title">
            <div>
              <h2>Nuevo usuario</h2>
              <p>Datos de acceso y alcance operativo.</p>
            </div>
          </div>

          <div className="field-grid">
            <label>
              Nombre
              <input value={form.nombre} onChange={(e) => updateForm("nombre", e.target.value)} placeholder="Nombre completo" />
            </label>
            <label>
              Usuario
              <input value={form.username} onChange={(e) => updateForm("username", e.target.value)} placeholder="usuario" />
            </label>
            <label>
              Email
              <input value={form.email} onChange={(e) => updateForm("email", e.target.value)} placeholder="correo@empresa.com" />
            </label>
            <label>
              Contrasena
              <input type="password" value={form.password} onChange={(e) => updateForm("password", e.target.value)} placeholder="Temporal" />
            </label>
            <label>
              Rol
              <select value={form.role} onChange={(e) => updateForm("role", e.target.value)}>
                <option value="">Selecciona rol</option>
                {roles.map((roleItem) => <option key={roleItem._id || roleItem.name} value={roleItem.name}>{roleItem.name}</option>)}
              </select>
            </label>
            {form.role === "departamento" && (
              <label>
                Departamento
                <select value={form.department} onChange={(e) => updateForm("department", e.target.value)}>
                  <option value="">Selecciona departamento</option>
                  {departments.map((department) => <option key={department._id} value={department.name}>{department.name}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="form-section">
            <div>
              <h3>Sucursales asignadas</h3>
              <p>Define en que sucursales puede operar el usuario.</p>
            </div>
            {renderBranchCheckboxes(form.branches, (next) => updateForm("branches", next))}
          </div>

          <div className="form-section">
            <div>
              <h3>Permisos</h3>
              <p>El rol admin hereda todos los permisos automaticamente.</p>
            </div>
            {renderPermissionCheckboxes({
              selected: form.permissions,
              roleName: form.role,
              onChange: (next) => updateForm("permissions", next),
            })}
          </div>

          <button className="primary-btn" type="submit">Crear usuario</button>
        </form>

        <section className="panel users-panel">
          <div className="panel-title">
            <div>
              <h2>Usuarios registrados</h2>
              <p>{users.length} usuarios activos en esta empresa.</p>
            </div>
          </div>

          <div className="users-table">
            {users.map((user) => (
              <div className="user-row" key={user._id}>
                <div className="avatar">{user.nombre?.[0]?.toUpperCase() || "?"}</div>
                <div className="user-main">
                  <b>{user.nombre}</b>
                  <span>{user.username ? `${user.username} | ${user.email}` : user.email}</span>
                  <small>{(user.permissions || []).length} permisos directos</small>
                </div>
                <span className="role-pill">{user.role}</span>
                <div className="row-actions">
                  <button onClick={() => openEditModal(user)}>Editar</button>
                  <button className="danger" onClick={() => setUserToDelete(user)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {userToDelete && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Eliminar usuario</h3>
            <p>Estas seguro de eliminar a <b>{userToDelete.nombre}</b>?</p>
            <div className="modal-actions">
              <button className="danger-btn" onClick={confirmDelete}>Eliminar</button>
              <button className="ghost-btn" onClick={() => setUserToDelete(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-box wide">
            <h3>Editar usuario</h3>
            <div className="field-grid">
              <label>
                Nombre
                <input value={editingUser.nombre || ""} onChange={(e) => updateEditingUser("nombre", e.target.value)} />
              </label>
              <label>
                Usuario
                <input value={editingUser.username || ""} onChange={(e) => updateEditingUser("username", e.target.value)} />
              </label>
              <label>
                Email
                <input value={editingUser.email || ""} onChange={(e) => updateEditingUser("email", e.target.value)} />
              </label>
              <label>
                Rol
                <select value={editingUser.role || ""} onChange={(e) => updateEditingUser("role", e.target.value)}>
                  <option value="">Selecciona rol</option>
                  {roles.map((roleItem) => <option key={roleItem._id || roleItem.name} value={roleItem.name}>{roleItem.name}</option>)}
                </select>
              </label>
              {editingUser.role === "departamento" && (
                <label>
                  Departamento
                  <select value={editingUser.department || ""} onChange={(e) => updateEditingUser("department", e.target.value)}>
                    <option value="">Selecciona departamento</option>
                    {departments.map((department) => <option key={department._id} value={department.name}>{department.name}</option>)}
                  </select>
                </label>
              )}
            </div>

            <div className="form-section">
              <h3>Sucursales</h3>
              {renderBranchCheckboxes(editingUser.branches || [], (next) => updateEditingUser("branches", next))}
            </div>

            <div className="form-section">
              <h3>Permisos</h3>
              {renderPermissionCheckboxes({
                selected: editingUser.permissions || [],
                roleName: editingUser.role,
                onChange: (next) => updateEditingUser("permissions", next),
              })}
            </div>

            <div className="modal-actions">
              <button className="primary-btn" onClick={handleUpdateUser}>Guardar</button>
              <button className="ghost-btn" onClick={() => setEditingUser(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .users-page { min-height: 100vh; padding: 28px; color: var(--app-text); background: var(--app-bg); }
        .page-header { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 20px; }
        .page-header h1 { color: var(--app-title); font-size: 24px; margin: 0; }
        .page-header p, .panel-title p, .form-section p { margin: 4px 0 0; color: var(--app-text); opacity: 0.7; font-size: 13px; }
        .header-actions { display: flex; gap: 10px; }
        .users-layout { display: grid; grid-template-columns: minmax(360px, 440px) minmax(0, 1fr); gap: 18px; align-items: start; }
        .panel { border: 1px solid rgba(255,255,255,0.08); background: color-mix(in srgb, var(--app-card) 88%, transparent); border-radius: 8px; padding: 18px; }
        .panel-title { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
        .panel-title h2, .form-section h3, .modal-box h3 { color: var(--app-title); font-size: 16px; margin: 0; }
        .field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--app-text); }
        input, select { min-width: 0; padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: var(--app-input); color: var(--app-text); outline: none; }
        input:focus, select:focus { border-color: var(--app-accent); }
        .form-section { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
        .option-grid, .permissions-grid { display: grid; gap: 8px; max-height: 190px; overflow: auto; padding: 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; background: var(--app-input); }
        .permissions-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .option-row { flex-direction: row; align-items: center; gap: 8px; color: var(--app-text); opacity: 0.86; }
        .option-row input { width: auto; accent-color: var(--app-accent); }
        .option-row small { margin-left: auto; color: var(--app-accent); font-weight: 700; }
        .primary-btn, .ghost-btn, .danger-btn, .row-actions button { border: none; border-radius: 8px; padding: 10px 12px; cursor: pointer; font-weight: 600; }
        .primary-btn { width: 100%; margin-top: 16px; background: var(--app-accent); color: white; }
        .ghost-btn { background: transparent; color: var(--app-text); border: 1px solid rgba(255,255,255,0.14); }
        .danger-btn, .row-actions .danger { background: rgba(239,68,68,0.16); color: #fca5a5; }
        .notice { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; padding: 12px 14px; border-radius: 8px; border: 1px solid transparent; font-size: 13px; }
        .notice.success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: #86efac; }
        .notice.error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
        .notice span { color: var(--app-text); }
        .users-table { display: flex; flex-direction: column; gap: 8px; }
        .user-row { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto auto; gap: 12px; align-items: center; padding: 12px; border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; background: rgba(255,255,255,0.03); }
        .avatar { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--app-accent); color: white; font-weight: 800; }
        .user-main { display: flex; flex-direction: column; min-width: 0; }
        .user-main b { color: var(--app-title); }
        .user-main span, .user-main small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; opacity: 0.72; }
        .role-pill { padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.08); font-size: 12px; text-transform: capitalize; }
        .row-actions { display: flex; gap: 8px; }
        .row-actions button { background: rgba(255,255,255,0.08); color: var(--app-text); font-size: 12px; }
        .modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.68); display: flex; align-items: center; justify-content: center; padding: 18px; }
        .modal-box { width: min(440px, 100%); max-height: 92vh; overflow: auto; border: 1px solid rgba(255,255,255,0.1); background: var(--app-card); border-radius: 8px; padding: 20px; }
        .modal-box.wide { width: min(760px, 100%); }
        .modal-actions { display: flex; gap: 10px; margin-top: 16px; }
        .modal-actions .primary-btn { margin-top: 0; }
        .empty-panel { max-width: 420px; border: 1px solid rgba(255,255,255,0.08); background: var(--app-card); border-radius: 8px; padding: 20px; }
        @media (max-width: 1050px) { .users-layout { grid-template-columns: 1fr; } }
        @media (max-width: 720px) {
          .users-page { padding: 16px; }
          .page-header, .header-actions, .modal-actions { flex-direction: column; align-items: stretch; }
          .field-grid, .permissions-grid { grid-template-columns: 1fr; }
          .user-row { grid-template-columns: 40px minmax(0, 1fr); }
          .role-pill, .row-actions { grid-column: 2; }
        }
      `}</style>
    </div>
  );
}

export default CreateUser;
