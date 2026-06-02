import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const API_URL = import.meta.env.VITE_API_URL;

function Catalogs() {
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [message, setMessage] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const currentUser = token ? jwtDecode(token) : null;
  const headers = { Authorization: `Bearer ${token}` };

  const refreshSession = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, { headers });
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

  const fetchCatalogs = async () => {
    try {
      const [departmentsRes, branchesRes] = await Promise.all([
        fetch(`${API_URL}/api/departments`, { headers }),
        fetch(`${API_URL}/api/branches`, { headers }),
      ]);
      const [departmentsData, branchesData] = await Promise.all([
        departmentsRes.json(),
        branchesRes.json(),
      ]);

      setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
      setBranches(Array.isArray(branchesData) ? branchesData : []);
    } catch {
      setMessage({ type: "error", title: "No se pudieron cargar los catalogos" });
    }
  };

  useEffect(() => {
    fetchCatalogs();
  }, []);

  const createDepartment = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (!newDepartment.trim()) {
      setMessage({ type: "error", title: "El nombre del departamento es obligatorio" });
      return;
    }

    const res = await fetch(`${API_URL}/api/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name: newDepartment, permissions: [] }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", title: data.msg || "No se pudo crear el departamento", detail: data.error });
      return;
    }

    setDepartments((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewDepartment("");
    await refreshSession();
    setMessage({ type: "success", title: "Departamento creado" });
  };

  const deleteDepartment = async (department) => {
    if (!confirm(`Eliminar departamento "${department.name}"?`)) return;
    const res = await fetch(`${API_URL}/api/departments/${department._id}`, { method: "DELETE", headers });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", title: data.msg || "No se pudo eliminar el departamento", detail: data.error });
      return;
    }

    setDepartments((prev) => prev.filter((item) => item._id !== department._id));
    await refreshSession();
  };

  const createBranch = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (!newBranch.trim()) {
      setMessage({ type: "error", title: "El nombre de la sucursal es obligatorio" });
      return;
    }

    const res = await fetch(`${API_URL}/api/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name: newBranch }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", title: data.msg || "No se pudo crear la sucursal", detail: data.error });
      return;
    }

    setBranches((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewBranch("");
    await refreshSession();
    setMessage({ type: "success", title: "Sucursal creada" });
  };

  const deleteBranch = async (branch) => {
    if (!confirm(`Eliminar sucursal "${branch.name}"?`)) return;
    const res = await fetch(`${API_URL}/api/branches/${branch._id}`, { method: "DELETE", headers });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", title: data.msg || "No se pudo eliminar la sucursal", detail: data.error });
      return;
    }

    setBranches((prev) => prev.filter((item) => item._id !== branch._id));
    await refreshSession();
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="catalogs-page">
        <div className="panel">
          <h2>Sin acceso</h2>
          <p>Solo administradores pueden gestionar catalogos.</p>
        </div>
      </div>
    );
  }

  const renderList = (items, onDelete) => (
    <div className="catalog-list">
      {items.map((item) => (
        <div className="catalog-row" key={item._id}>
          <b>{item.name}</b>
          <button onClick={() => onDelete(item)}>Eliminar</button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="catalogs-page">
      <div className="page-header">
        <div>
          <h1>Catalogos</h1>
          <p>Administra departamentos y sucursales de la empresa.</p>
        </div>
        <button className="ghost-btn" onClick={() => navigate("/users")}>Volver a usuarios</button>
      </div>

      {message && (
        <div className={`notice ${message.type}`}>
          <b>{message.title}</b>
          {message.detail && <span>{message.detail}</span>}
        </div>
      )}

      <div className="catalog-grid">
        <section className="panel">
          <div className="panel-title">
            <h2>Departamentos</h2>
            <span>{departments.length}</span>
          </div>
          <form onSubmit={createDepartment} className="create-row">
            <input value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} placeholder="ej. sistemas" />
            <button type="submit">Crear</button>
          </form>
          {renderList(departments, deleteDepartment)}
        </section>

        <section className="panel">
          <div className="panel-title">
            <h2>Sucursales</h2>
            <span>{branches.length}</span>
          </div>
          <form onSubmit={createBranch} className="create-row">
            <input value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder="ej. monterrey" />
            <button type="submit">Crear</button>
          </form>
          {renderList(branches, deleteBranch)}
        </section>
      </div>

      <style>{`
        .catalogs-page { min-height: 100vh; padding: 28px; color: var(--app-text); background: var(--app-bg); }
        .page-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; }
        .page-header h1, .panel h2 { color: var(--app-title); margin: 0; }
        .page-header h1 { font-size: 24px; }
        .page-header p { margin: 4px 0 0; opacity: 0.7; font-size: 13px; }
        .catalog-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
        .panel { border: 1px solid rgba(255,255,255,0.08); background: color-mix(in srgb, var(--app-card) 88%, transparent); border-radius: 8px; padding: 18px; }
        .panel-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .panel-title span { padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,0.08); font-size: 12px; }
        .create-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; margin-bottom: 14px; }
        input { min-width: 0; padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: var(--app-input); color: var(--app-text); outline: none; }
        input:focus { border-color: var(--app-accent); }
        button, .ghost-btn { border: none; border-radius: 8px; padding: 10px 12px; cursor: pointer; font-weight: 600; background: var(--app-accent); color: white; }
        .ghost-btn { background: transparent; color: var(--app-text); border: 1px solid rgba(255,255,255,0.14); }
        .catalog-list { display: flex; flex-direction: column; gap: 8px; }
        .catalog-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 12px; border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; background: rgba(255,255,255,0.03); }
        .catalog-row b { color: var(--app-title); text-transform: capitalize; }
        .catalog-row button { background: rgba(239,68,68,0.16); color: #fca5a5; }
        .notice { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; padding: 12px 14px; border-radius: 8px; border: 1px solid transparent; font-size: 13px; }
        .notice.success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: #86efac; }
        .notice.error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
        @media (max-width: 820px) { .catalog-grid { grid-template-columns: 1fr; } .page-header { flex-direction: column; align-items: stretch; } }
        @media (max-width: 560px) { .catalogs-page { padding: 16px; } .create-row { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

export default Catalogs;
