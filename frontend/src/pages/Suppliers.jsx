import { useCallback, useEffect, useMemo, useState } from "react";
import { ACCESS_SCOPES, hasPermission } from "../config/permissions";
import { useAuthUser } from "../hooks/useAuthUser";

const API_URL = import.meta.env.VITE_API_URL;

const initialForm = {
  name: "",
  address: "",
  phone: "",
};

function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [message, setMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const token = localStorage.getItem("token");
  const user = useAuthUser();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const canView = hasPermission(user, "SUPPLIERS_VIEW");
  const canCreate = hasPermission(user, "SUPPLIERS_CREATE");
  const canUpdate = hasPermission(user, "SUPPLIERS_UPDATE");
  const canDelete = hasPermission(user, "SUPPLIERS_DELETE");
  const canAccessPage = canView || canCreate || canUpdate || canDelete;
  const inventoryScope = user?.accessScopes?.inventory || ACCESS_SCOPES.DEPARTMENT;
  const userDepartment = user?.department?.toString().trim().toLowerCase() || "";

  const userBranchIds = useMemo(() => {
    const assigned = Array.isArray(user?.branches) ? user.branches : [];
    const ids = assigned.length > 0 ? assigned : user?.branch ? [user.branch] : [];
    return ids.map((branch) => branch?._id || branch).filter(Boolean);
  }, [user]);

  const automaticScopeLabel = useMemo(() => {
    if (inventoryScope === ACCESS_SCOPES.ALL) return "Toda la empresa";
    if (inventoryScope === ACCESS_SCOPES.BRANCH) {
      const count = userBranchIds.length;
      return count === 1 ? "Sucursal asignada" : `${count} sucursales asignadas`;
    }
    return userDepartment ? `Departamento: ${userDepartment}` : "Su departamento";
  }, [inventoryScope, userBranchIds.length, userDepartment]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateEditForm = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/suppliers`, { headers });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudieron cargar los proveedores" });
        setSuppliers([]);
        return;
      }

      setSuppliers(Array.isArray(data) ? data : []);
    } catch {
      setMessage({ type: "error", title: "Error de conexion", detail: "No se pudo conectar con el servidor." });
    }
  }, [headers]);

  useEffect(() => {
    if (!token || !canAccessPage) return;
    fetchSuppliers();
  }, [token, canAccessPage, fetchSuppliers]);

  const createSupplier = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (!form.name.trim()) {
      setMessage({
        type: "error",
        title: "Faltan campos obligatorios",
        detail: "El nombre del proveedor es obligatorio.",
      });
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch(`${API_URL}/api/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudo crear el proveedor", detail: data.error });
        return;
      }

      setSuppliers((current) => [data, ...current].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(initialForm);
      setMessage({ type: "success", title: "Proveedor creado", detail: "El proveedor quedo disponible para inventario." });
    } catch {
      setMessage({ type: "error", title: "Error de conexion", detail: "No se pudo conectar con el servidor." });
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (supplier) => {
    setEditingSupplier(supplier);
    setEditForm({
      name: supplier.name || "",
      address: supplier.address || "",
      phone: supplier.phone || "",
    });
  };

  const updateSupplier = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (!editForm.name.trim()) {
      setMessage({
        type: "error",
        title: "Faltan campos obligatorios",
        detail: "El nombre del proveedor es obligatorio.",
      });
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch(`${API_URL}/api/suppliers/${editingSupplier._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudo modificar el proveedor", detail: data.error });
        return;
      }

      setSuppliers((current) => current.map((supplier) => (supplier._id === data._id ? data : supplier)));
      setEditingSupplier(null);
      setEditForm(initialForm);
      setMessage({ type: "success", title: "Proveedor actualizado" });
    } catch {
      setMessage({ type: "error", title: "Error de conexion", detail: "No se pudo conectar con el servidor." });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSupplier = async (supplier) => {
    if (!confirm(`Borrar proveedor "${supplier.name}"?`)) return;
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/suppliers/${supplier._id}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", title: data.msg || "No se pudo borrar el proveedor", detail: data.error });
        return;
      }

      setSuppliers((current) => current.filter((item) => item._id !== supplier._id));
      setMessage({ type: "success", title: "Proveedor eliminado" });
    } catch {
      setMessage({ type: "error", title: "Error de conexion", detail: "No se pudo conectar con el servidor." });
    }
  };

  const formatSupplierScope = (supplier) => {
    if (supplier.scope === ACCESS_SCOPES.ALL) {
      return { title: "Toda la empresa", detail: "Disponible para todos" };
    }

    if (supplier.scope === ACCESS_SCOPES.BRANCH) {
      const names = Array.isArray(supplier.branches) && supplier.branches.length > 0
        ? supplier.branches.map((branch) => branch.name || branch).join(", ")
        : supplier.branch?.name || "Sucursales asignadas";

      return { title: names, detail: "Alcance por sucursal" };
    }

    return {
      title: supplier.department || "Sin departamento",
      detail: "Alcance por departamento",
    };
  };

  if (!canAccessPage) {
    return (
      <div className="suppliers-page">
        <div className="empty-state">No tienes permisos para ver proveedores.</div>
      </div>
    );
  }

  return (
    <div className="suppliers-page">
      <div className="page-header">
        <div>
          <h1>Proveedores</h1>
          <p>Administra proveedores disponibles para compras e inventario.</p>
        </div>
      </div>

      {message && (
        <div className={`notice ${message.type}`}>
          <b>{message.title}</b>
          {message.detail && <span>{message.detail}</span>}
        </div>
      )}

      {canCreate && (
        <form className="supplier-form" onSubmit={createSupplier}>
          <div className="form-title">
            <h2>Crear proveedor</h2>
            <span>Alcance automatico: {automaticScopeLabel}</span>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre</label>
              <input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Nombre comercial o razon social" />
            </div>
            <div className="form-group">
              <label>Telefono opcional</label>
              <input value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} placeholder="Telefono de contacto" />
            </div>
            <div className="form-group wide">
              <label>Direccion opcional</label>
              <input value={form.address} onChange={(e) => updateForm("address", e.target.value)} placeholder="Calle, colonia, ciudad o referencia" />
            </div>
          </div>
          <button className="btn-submit" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar proveedor"}</button>
        </form>
      )}

      <div className="supplier-table">
        <div className="supplier-table-head">
          <span>Proveedor</span>
          <span>Contacto</span>
          <span>Alcance</span>
          <span>Acciones</span>
        </div>
        {suppliers.length === 0 ? (
          <div className="empty-state">No hay proveedores para mostrar.</div>
        ) : (
          suppliers.map((supplier) => (
            <div className="supplier-row" key={supplier._id}>
              <div className="supplier-main">
                <strong>{supplier.name}</strong>
                <span>{supplier.address || "Sin direccion registrada"}</span>
              </div>
              <div className="supplier-contact">
                <span>{supplier.phone || "Sin telefono"}</span>
              </div>
              <div className="supplier-scope">
                <strong>{formatSupplierScope(supplier).title}</strong>
                <span>{formatSupplierScope(supplier).detail}</span>
              </div>
              <div className="row-actions">
                {canUpdate && <button type="button" onClick={() => openEdit(supplier)}>Modificar</button>}
                {canDelete && <button type="button" className="danger-btn" onClick={() => deleteSupplier(supplier)}>Borrar</button>}
              </div>
            </div>
          ))
        )}
      </div>

      {editingSupplier && (
        <div className="modal">
          <form className="modal-content" onSubmit={updateSupplier}>
            <h3>Modificar proveedor</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre</label>
                <input value={editForm.name} onChange={(e) => updateEditForm("name", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Telefono opcional</label>
                <input value={editForm.phone} onChange={(e) => updateEditForm("phone", e.target.value)} />
              </div>
              <div className="form-group wide">
                <label>Direccion opcional</label>
                <input value={editForm.address} onChange={(e) => updateEditForm("address", e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="submit" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar cambios"}</button>
              <button type="button" onClick={() => { setEditingSupplier(null); setEditForm(initialForm); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .suppliers-page { min-height: 100vh; padding: 28px; color: var(--app-text); background: var(--app-bg); }
        .page-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; }
        .page-header h1, .form-title h2, .modal-content h3 { color: var(--app-title); margin: 0; }
        .page-header h1 { font-size: 24px; }
        .page-header p { margin: 4px 0 0; opacity: 0.7; font-size: 13px; }
        .supplier-form, .supplier-table { border: 1px solid rgba(255,255,255,0.08); background: color-mix(in srgb, var(--app-card) 88%, transparent); border-radius: 8px; }
        .supplier-form { padding: 18px; margin-bottom: 18px; }
        .form-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .form-title h2 { font-size: 16px; }
        .form-title span { color: #93c5fd; font-size: 12px; border: 1px solid rgba(147,197,253,0.24); border-radius: 999px; padding: 5px 9px; background: rgba(59,130,246,0.1); }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
        .form-group { display: flex; flex-direction: column; gap: 7px; }
        .form-group.wide { grid-column: 1 / -1; }
        .form-group label { color: #94a3b8; font-size: 13px; }
        input, select { min-width: 0; padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: var(--app-input); color: var(--app-text); outline: none; font: inherit; }
        input:focus, select:focus { border-color: var(--app-accent); }
        .btn-submit, .row-actions button, .modal-actions button { border: none; border-radius: 8px; padding: 10px 12px; cursor: pointer; font-weight: 600; background: var(--app-accent); color: white; }
        .btn-submit { margin-top: 16px; }
        .btn-submit:disabled, .modal-actions button:disabled { opacity: 0.65; cursor: not-allowed; }
        .supplier-table { overflow: hidden; }
        .supplier-table-head, .supplier-row { display: grid; grid-template-columns: minmax(240px, 1.3fr) minmax(150px, 0.8fr) minmax(180px, 1fr) minmax(170px, 0.8fr); gap: 16px; align-items: center; padding: 14px 18px; }
        .supplier-table-head { color: #93c5fd; font-size: 12px; font-weight: 700; text-transform: uppercase; background: rgba(15,23,42,0.65); border-bottom: 1px solid rgba(148,163,184,0.14); }
        .supplier-row { border-bottom: 1px solid rgba(148,163,184,0.1); }
        .supplier-row:last-child { border-bottom: none; }
        .supplier-main, .supplier-contact, .supplier-scope { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .supplier-main strong, .supplier-scope strong { color: var(--app-title); overflow-wrap: anywhere; }
        .supplier-main span, .supplier-contact span, .supplier-scope span { color: #cbd5e1; font-size: 12px; overflow-wrap: anywhere; }
        .row-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        .row-actions .danger-btn { background: rgba(239,68,68,0.16); color: #fca5a5; }
        .empty-state { border: 1px dashed rgba(255,255,255,0.16); background: rgba(255,255,255,0.04); border-radius: 8px; padding: 18px; color: #94a3b8; }
        .supplier-table .empty-state { margin: 18px; }
        .notice { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; padding: 12px 14px; border-radius: 8px; border: 1px solid transparent; font-size: 13px; }
        .notice.success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: #86efac; }
        .notice.error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
        .notice span { color: #cbd5e1; }
        .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.65); display: flex; justify-content: center; align-items: center; z-index: 999; padding: 18px; }
        .modal-content { width: min(760px, 100%); background: #1e293b; border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
        .modal-actions button:last-child { background: transparent; color: var(--app-text); border: 1px solid rgba(255,255,255,0.14); }
        @media (max-width: 900px) {
          .supplier-table-head { display: none; }
          .supplier-row { grid-template-columns: 1fr; gap: 12px; }
          .row-actions { justify-content: flex-start; }
        }
        @media (max-width: 560px) {
          .suppliers-page { padding: 16px; }
          .modal-actions { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

export default Suppliers;
