import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  ACCESS_SCOPE_OPTIONS,
  PERMISSION_GROUPS,
  PLATFORM_ONLY_PERMISSIONS,
  getAccessScopesForForm,
  getDefaultAccessScopes,
  hasPermission,
  normalizePermissionsForForm,
} from "../config/permissions";
import { exportPdfReport } from "../utils/pdfReport";

const API_URL = import.meta.env.VITE_API_URL;
const BRANCH_SCOPE = "branch";

const EMPTY_FORM = {
  nombre: "",
  username: "",
  email: "",
  password: "",
  role: "",
  department: "",
  branches: [],
  permissions: [],
  accessScopes: getDefaultAccessScopes("departamento"),
};

function CreateUser() {
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const currentUser = token ? jwtDecode(token) : null;
  const headers = { Authorization: `Bearer ${token}` };
  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("es");
    if (!query) return users;

    return users.filter((user) => {
      const searchableValues = [
        user.nombre,
        user.username,
        user.email,
        user.role,
        user.department,
        ...(user.branches || []).map((branch) => branch?.name || branch),
      ];

      return searchableValues.some((value) =>
        String(value || "").toLocaleLowerCase("es").includes(query)
      );
    });
  }, [searchTerm, users]);
  const sanitizeAssignablePermissions = (permissions = []) =>
    permissions.filter((permission) => !PLATFORM_ONLY_PERMISSIONS.includes(permission));
  const usesBranchScope = (accessScopes = {}) =>
    ["incidents", "maintenance", "inventory"].some((key) => accessScopes?.[key] === BRANCH_SCOPE);
  const getSelectedBranchesForSave = (accessScopes, selectedBranches = []) =>
    usesBranchScope(accessScopes) ? selectedBranches : [];
  const getBranchScopeModules = (accessScopes = {}) => [
    accessScopes?.incidents === BRANCH_SCOPE ? "incidencias" : null,
    accessScopes?.maintenance === BRANCH_SCOPE ? "mantenimientos" : null,
    accessScopes?.inventory === BRANCH_SCOPE ? "inventario" : null,
  ].filter(Boolean);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateRole = (role) => {
    const accessScopes = getDefaultAccessScopes(role);

    setForm((prev) => ({
      ...prev,
      role,
      branches: usesBranchScope(accessScopes) ? prev.branches : [],
      accessScopes,
    }));
  };

  const toggleListItem = (items, item) =>
    items.includes(item) ? items.filter((value) => value !== item) : [...items, item];

  const togglePermission = (list, permission) => toggleListItem(list, permission);

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
          branches: getSelectedBranchesForSave(form.accessScopes, form.branches),
          permissions: sanitizeAssignablePermissions(form.permissions),
          accessScopes: form.accessScopes,
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
      permissions: sanitizeAssignablePermissions(normalizePermissionsForForm(user?.permissions)),
      accessScopes: getAccessScopesForForm(user),
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
      branch: getSelectedBranchesForSave(
        editingUser.accessScopes || getDefaultAccessScopes(editingUser.role),
        editingUser.branches || []
      )?.[0] || null,
      branches: getSelectedBranchesForSave(
        editingUser.accessScopes || getDefaultAccessScopes(editingUser.role),
        editingUser.branches || []
      ),
      permissions: sanitizeAssignablePermissions(editingUser.permissions || []),
      accessScopes: editingUser.accessScopes || getDefaultAccessScopes(editingUser.role),
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

  if (!hasPermission(currentUser, "CREATE_USERS")) {
    return (
      <div className="users-page">
        <div className="empty-panel">
          <h3>Sin acceso</h3>
          <p>No tienes permisos para crear usuarios.</p>
        </div>
      </div>
    );
  }

  const renderBranchCheckboxes = (selected, onChange, accessScopes) => {
    const activeModules = getBranchScopeModules(accessScopes);

    if (activeModules.length === 0) {
      return (
        <div className="scope-note">
          No necesitas seleccionar sucursales porque el alcance actual no usa "Sucursales asignadas".
        </div>
      );
    }

    return (
    <div className="branch-picker">
      <div className="branch-tools">
        <span>Aplica para: {activeModules.join(", ")}</span>
        <div>
          <button type="button" className="mini-btn" onClick={() => onChange(branches.map((branch) => branch._id))}>
            Seleccionar todas
          </button>
          <button type="button" className="mini-btn" onClick={() => onChange([])}>
            Limpiar
          </button>
        </div>
      </div>
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
    </div>
  );
  };

  const renderPermissionCheckboxes = ({ selected, onChange }) => (
    <div className="permission-modules">
      {PERMISSION_GROUPS.map((group) => {
        const visiblePermissions = group.permissions;

        if (visiblePermissions.length === 0) return null;

        return (
        <div className="permission-module" key={group.key}>
          <h4>{group.label}</h4>
          <div className="permissions-grid">
            {visiblePermissions.map((permission) => {
              const checked = selected.includes(permission.value);

              return (
                <label key={permission.value} className="option-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange(togglePermission(selected, permission.value))}
                  />
                  <span>{permission.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      );
      })}
    </div>
  );

  const renderAccessScopes = (accessScopes, onChange) => {
    const handleScopeChange = (key, value) => {
      const next = {
        ...(accessScopes || {}),
        [key]: value,
      };

      onChange(next);
    };

    return (
    <div className="scope-grid">
      {[
        { key: "incidents", label: "Incidencias" },
        { key: "maintenance", label: "Mantenimientos" },
        { key: "inventory", label: "Inventario" },
      ].map((scope) => (
        <label key={scope.key}>
          {scope.label}
          <select
            value={accessScopes?.[scope.key] || "department"}
            onChange={(event) => handleScopeChange(scope.key, event.target.value)}
          >
            {ACCESS_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
  };

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
              <select value={form.role} onChange={(e) => updateRole(e.target.value)}>
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
              <p>Solo aplica si algun modulo usa el alcance "Sucursales asignadas".</p>
            </div>
            {renderBranchCheckboxes(form.branches, (next) => updateForm("branches", next), form.accessScopes)}
          </div>

          <div className="form-section">
            <div>
              <h3>Alcance operativo</h3>
              <p>Define sobre que registros aplican los permisos de cada modulo.</p>
            </div>
            {renderAccessScopes(form.accessScopes, (next) => {
              updateForm("accessScopes", next);
              if (!usesBranchScope(next)) updateForm("branches", []);
            })}
          </div>

          <div className="form-section">
            <div>
              <h3>Permisos</h3>
              <p>Los permisos marcados aqui son los que tendra el usuario.</p>
            </div>
            {renderPermissionCheckboxes({
              selected: form.permissions,
              onChange: (next) => updateForm("permissions", next),
            })}
          </div>

          <button className="primary-btn" type="submit">Crear usuario</button>
        </form>

        <section className="panel users-panel">
          <div className="panel-title">
            <div>
              <h2>Usuarios registrados</h2>
              <p>
                {searchTerm.trim()
                  ? `${filteredUsers.length} de ${users.length} usuarios encontrados.`
                  : `${users.length} usuarios activos en esta empresa.`}
              </p>
            </div>
          </div>

          <div className="user-search">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre, usuario, correo, rol o sucursal"
              aria-label="Buscar usuarios"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm("")}>Limpiar</button>
            )}
          </div>

          <div className="users-table">
            {filteredUsers.map((user) => (
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
            {filteredUsers.length === 0 && (
              <div className="empty-search">
                No se encontraron usuarios que coincidan con "{searchTerm.trim()}".
              </div>
            )}
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
                <select
                  value={editingUser.role || ""}
                  onChange={(e) => {
                    const role = e.target.value;
                    const accessScopes = getDefaultAccessScopes(role);

                    setEditingUser((prev) => ({
                      ...prev,
                      role,
                      branches: usesBranchScope(accessScopes) ? prev.branches : [],
                      accessScopes,
                    }));
                  }}
                >
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
              {renderBranchCheckboxes(
                editingUser.branches || [],
                (next) => updateEditingUser("branches", next),
                editingUser.accessScopes || getDefaultAccessScopes(editingUser.role)
              )}
            </div>

            <div className="form-section">
              <h3>Alcance operativo</h3>
              {renderAccessScopes(
                editingUser.accessScopes || getDefaultAccessScopes(editingUser.role),
                (next) => {
                  updateEditingUser("accessScopes", next);
                  if (!usesBranchScope(next)) updateEditingUser("branches", []);
                }
              )}
            </div>

            <div className="form-section">
              <h3>Permisos</h3>
              {renderPermissionCheckboxes({
                selected: editingUser.permissions || [],
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
        .branch-picker { display: grid; gap: 8px; }
        .branch-tools {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          font-size: 12px;
          color: var(--app-text);
        }
        .branch-tools div { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .mini-btn {
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 8px;
          padding: 7px 9px;
          background: transparent;
          color: var(--app-text);
          cursor: pointer;
          font-weight: 700;
          font-size: 11px;
        }
        .scope-note {
          padding: 12px;
          border-radius: 8px;
          border: 1px dashed rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.03);
          color: var(--app-text);
          opacity: 0.76;
          font-size: 13px;
          line-height: 1.45;
        }
        .permission-modules { display: grid; gap: 12px; }
        .permission-module {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 12px;
          background: rgba(255,255,255,0.03);
        }
        .permission-module h4 {
          margin: 0 0 9px;
          color: var(--app-title);
          font-size: 13px;
        }
        .scope-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
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
        .user-search { position: relative; display: flex; gap: 8px; margin-bottom: 14px; }
        .user-search input { width: 100%; padding-right: 76px; }
        .user-search button { position: absolute; top: 50%; right: 8px; transform: translateY(-50%); border: 0; background: transparent; color: var(--app-accent); cursor: pointer; font-size: 12px; font-weight: 700; }
        .users-table { display: flex; flex-direction: column; gap: 8px; }
        .empty-search { padding: 24px 16px; border: 1px dashed rgba(255,255,255,0.12); border-radius: 8px; color: var(--app-text); opacity: 0.7; text-align: center; font-size: 13px; }
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
          .field-grid, .permissions-grid, .scope-grid { grid-template-columns: 1fr; }
          .user-row { grid-template-columns: 40px minmax(0, 1fr); }
          .role-pill, .row-actions { grid-column: 2; }
        }
      `}</style>
    </div>
  );
}

export default CreateUser;
