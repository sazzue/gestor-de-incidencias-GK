import { useEffect, useMemo, useState } from "react";
import { useAuthUser } from "../hooks/useAuthUser";
import { exportPdfReport } from "../utils/pdfReport";

const API_URL = import.meta.env.VITE_API_URL;

const initialForm = {
  model: "",
  brand: "",
  serialNumber: "",
  provider: "",
  responsible: "",
  price: "",
  branch: "",
  department: "",
  invoice: null,
};

function Inventory() {
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disposeItem, setDisposeItem] = useState(null);
  const [disposeReason, setDisposeReason] = useState("");
  const [invoiceItem, setInvoiceItem] = useState(null);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);

  const token = localStorage.getItem("token");
  const user = useAuthUser();

  const hasPermission = (permission) =>
    user?.role === "admin" || user?.permissions?.includes(permission);

  const canViewAll = user?.role === "direccion" || hasPermission("VIEW_INVENTORY_ALL");
  const canViewDepartment = hasPermission("VIEW_INVENTORY_DEPARTMENT");
  const canCreate = hasPermission("CREATE_INVENTORY");
  const canDispose = hasPermission("DISPOSE_INVENTORY");
  const canView = canViewAll || canViewDepartment || hasPermission("VIEW_INVENTORY_BRANCH") || canCreate || canDispose;
  const userDepartment = user?.department?.toString().trim().toLowerCase() || "";
  const isDepartmentLocked = !canViewAll && canViewDepartment && Boolean(userDepartment);

  const userBranchIds = useMemo(() => {
    const assigned = Array.isArray(user?.branches) ? user.branches : [];
    const ids = assigned.length > 0 ? assigned : user?.branch ? [user.branch] : [];
    return ids.map((branch) => branch?._id || branch).filter(Boolean);
  }, [user]);

  const formBranches = useMemo(() => {
    if (canViewAll || canViewDepartment) return branches;
    return branches.filter((branch) => userBranchIds.includes(branch._id));
  }, [branches, canViewAll, canViewDepartment, userBranchIds]);

  const filterBranches = useMemo(() => {
    if (canViewAll || canViewDepartment) return branches;
    return formBranches;
  }, [branches, canViewAll, canViewDepartment, formBranches]);

  const availableDepartments = useMemo(() => {
    if (isDepartmentLocked) {
      return departments.filter((department) => department.name?.toLowerCase() === userDepartment);
    }

    return departments;
  }, [departments, isDepartmentLocked, userDepartment]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterBranch && item.branch?._id !== filterBranch) return false;
      if (filterDepartment && item.department !== filterDepartment) return false;
      if (filterStatus && item.status !== filterStatus) return false;
      return true;
    });
  }, [items, filterBranch, filterDepartment, filterStatus]);

  const inventoryStats = useMemo(() => {
    const total = filteredItems.length;
    const activos = filteredItems.filter((item) => item.status === "activo").length;
    const bajas = filteredItems.filter((item) => item.status === "baja").length;
    const value = filteredItems
      .filter((item) => item.status === "activo")
      .reduce((sum, item) => sum + Number(item.price || 0), 0);

    return { total, activos, bajas, value };
  }, [filteredItems]);

  const formatCurrency = (value) =>
    Number(value || 0).toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });

  const exportInventoryPdf = () => {
    if (filteredItems.length === 0) { alert("No hay equipos para exportar"); return; }

    exportPdfReport({
      title: "Reporte de inventario",
      subtitle: "Equipos comprados y asignados por sucursal",
      summary: [
        { label: "Total", value: inventoryStats.total },
        { label: "Activos", value: inventoryStats.activos },
        { label: "Bajas", value: inventoryStats.bajas },
        { label: "Valor activo", value: formatCurrency(inventoryStats.value) },
      ],
      columns: [
        { key: "equipment", label: "Equipo" },
        { key: "serialNumber", label: "Serie" },
        { key: "branch", label: "Sucursal" },
        { key: "department", label: "Departamento" },
        { key: "provider", label: "Proveedor" },
        { key: "responsible", label: "Responsable" },
        { key: "price", label: "Precio" },
        { key: "status", label: "Estado" },
      ],
      rows: filteredItems.map((item) => ({
        equipment: `${item.brand || ""} ${item.model || ""}`.trim(),
        serialNumber: item.serialNumber,
        branch: item.branch?.name || "Sin sucursal",
        department: item.department || "Sin departamento",
        provider: item.provider,
        responsible: item.responsible || "Sin responsable",
        price: formatCurrency(item.price),
        status: item.status,
      })),
    });
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          title: data.msg || "No se pudo cargar el inventario",
          detail: data.error || `Error ${res.status}`,
        });
        setItems([]);
        return;
      }

      setItems(Array.isArray(data) ? data : []);
    } catch {
      setMessage({
        type: "error",
        title: "Error de conexion",
        detail: "No se pudo conectar con el servidor.",
      });
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_URL}/api/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBranches(Array.isArray(data) ? data : []);
    } catch {
      setBranches([]);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      setDepartments([]);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchBranches();
    fetchDepartments();
    fetchInventory();
  }, [token]);

  useEffect(() => {
    if (isDepartmentLocked) {
      updateForm("department", userDepartment);
      setFilterDepartment(userDepartment);
    }
  }, [isDepartmentLocked, userDepartment]);

  const createItem = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (!form.model || !form.brand || !form.serialNumber || !form.provider || !form.responsible || !form.price || !form.branch || !form.department) {
      setMessage({
        type: "error",
        title: "Faltan campos obligatorios",
        detail: "Modelo, marca, numero de serie, proveedor, responsable, precio, sucursal y departamento son obligatorios.",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append("model", form.model);
      formData.append("brand", form.brand);
      formData.append("serialNumber", form.serialNumber);
      formData.append("provider", form.provider);
      formData.append("responsible", form.responsible);
      formData.append("price", form.price);
      formData.append("branch", form.branch);
      formData.append("department", form.department);
      if (form.invoice) formData.append("invoice", form.invoice);

      const res = await fetch(`${API_URL}/api/inventory`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          title: data.msg || "No se pudo registrar el equipo",
          detail: data.error || `Error ${res.status}`,
        });
        return;
      }

      setItems((current) => [data, ...current]);
      setForm({ ...initialForm, department: isDepartmentLocked ? userDepartment : "" });
      setMessage({
        type: "success",
        title: "Equipo registrado",
        detail: "El equipo quedo agregado al inventario.",
      });
    } catch {
      setMessage({
        type: "error",
        title: "Error de conexion",
        detail: "No se pudo conectar con el servidor.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadInvoice = async (item) => {
    try {
      const res = await fetch(`${API_URL}/api/inventory/${item._id}/invoice`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.msg || "No se pudo abrir la factura");
        return;
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      alert("No se pudo generar el enlace de factura");
    }
  };

  const submitInvoice = async () => {
    if (!invoiceFile) {
      setMessage({
        type: "error",
        title: "Factura requerida",
        detail: "Selecciona un archivo PDF o imagen.",
      });
      return;
    }

    try {
      setIsUploadingInvoice(true);
      const formData = new FormData();
      formData.append("invoice", invoiceFile);

      const res = await fetch(`${API_URL}/api/inventory/${invoiceItem._id}/invoice`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          title: data.msg || "No se pudo cargar la factura",
          detail: data.error || `Error ${res.status}`,
        });
        return;
      }

      setItems((current) => current.map((item) => (item._id === data._id ? data : item)));
      setInvoiceItem(null);
      setInvoiceFile(null);
      setMessage({
        type: "success",
        title: "Factura cargada",
        detail: "La factura quedo vinculada al equipo.",
      });
    } catch {
      setMessage({
        type: "error",
        title: "Error de conexion",
        detail: "No se pudo conectar con el servidor.",
      });
    } finally {
      setIsUploadingInvoice(false);
    }
  };

  const submitDispose = async () => {
    if (!disposeReason.trim()) {
      setMessage({
        type: "error",
        title: "Motivo requerido",
        detail: "Escribe el motivo de baja del equipo.",
      });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/inventory/${disposeItem._id}/dispose`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: disposeReason }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          title: data.msg || "No se pudo dar de baja",
          detail: data.error || `Error ${res.status}`,
        });
        return;
      }

      setItems((current) => current.map((item) => (item._id === data._id ? data : item)));
      setDisposeItem(null);
      setDisposeReason("");
      setMessage({
        type: "success",
        title: "Equipo dado de baja",
        detail: "El inventario fue actualizado.",
      });
    } catch {
      setMessage({
        type: "error",
        title: "Error de conexion",
        detail: "No se pudo conectar con el servidor.",
      });
    }
  };

  if (!canView) {
    return (
      <div className="inventory-page">
        <div className="empty-state">No tienes permisos para ver inventario.</div>
      </div>
    );
  }

  return (
    <div className="inventory-page">
      <div className="page-header">
        <div>
          <h1>Inventario</h1>
          <p>Equipos comprados y asignados por sucursal</p>
        </div>
        <button className="export-btn" onClick={exportInventoryPdf}>Exportar PDF</button>
      </div>

      {message && (
        <div className={`notice ${message.type}`}>
          <b>{message.title}</b>
          <span>{message.detail}</span>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total</span>
          <strong>{inventoryStats.total}</strong>
        </div>
        <div className="stat-card active">
          <span>Activos</span>
          <strong>{inventoryStats.activos}</strong>
        </div>
        <div className="stat-card danger">
          <span>Bajas</span>
          <strong>{inventoryStats.bajas}</strong>
        </div>
        <div className="stat-card value">
          <span>Valor activo</span>
          <strong>{formatCurrency(inventoryStats.value)}</strong>
        </div>
      </div>

      {canCreate && (
        <form className="inventory-form" onSubmit={createItem}>
          <div className="form-title">
            <h2>Registrar equipo</h2>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Modelo</label>
              <input value={form.model} onChange={(e) => updateForm("model", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Marca</label>
              <input value={form.brand} onChange={(e) => updateForm("brand", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Numero de serie</label>
              <input value={form.serialNumber} onChange={(e) => updateForm("serialNumber", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Proveedor</label>
              <input value={form.provider} onChange={(e) => updateForm("provider", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Responsable</label>
              <input value={form.responsible} onChange={(e) => updateForm("responsible", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Precio</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => updateForm("price", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Sucursal</label>
              <select value={form.branch} onChange={(e) => updateForm("branch", e.target.value)}>
                <option value="">Seleccionar sucursal</option>
                {formBranches.map((branch) => (
                  <option key={branch._id} value={branch._id}>{branch.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Departamento</label>
              <select
                value={form.department}
                onChange={(e) => updateForm("department", e.target.value)}
                disabled={isDepartmentLocked}
              >
                <option value="">Seleccionar departamento</option>
                {availableDepartments.map((department) => (
                  <option key={department._id} value={department.name?.toLowerCase()}>{department.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group wide">
              <label>Factura</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => updateForm("invoice", e.target.files?.[0] || null)}
              />
              <span>PDF o imagen, maximo 8 MB.</span>
            </div>
          </div>

          <button className="btn-submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar equipo"}
          </button>
        </form>
      )}

      <div className="toolbar">
        <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {filterBranches.map((branch) => (
            <option key={branch._id} value={branch._id}>{branch.name}</option>
          ))}
        </select>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          disabled={isDepartmentLocked}
        >
          <option value="">Todos los departamentos</option>
          {availableDepartments.map((department) => (
            <option key={department._id} value={department.name?.toLowerCase()}>{department.name}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="baja">Bajas</option>
        </select>
      </div>

      <div className="inventory-grid">
        {filteredItems.length === 0 ? (
          <div className="empty-state">No hay equipos para mostrar.</div>
        ) : (
          filteredItems.map((item) => (
            <div className="item-card" key={item._id}>
              <div className="item-top">
                <div>
                  <h3>{item.brand} {item.model}</h3>
                  <span>{item.serialNumber}</span>
                </div>
                <b className={`status ${item.status}`}>{item.status}</b>
              </div>

              <div className="item-meta">
                <span>Sucursal: {item.branch?.name || "Sin sucursal"}</span>
                <span>Departamento: {item.department || "Sin departamento"}</span>
                <span>Proveedor: {item.provider}</span>
                <span>Responsable: {item.responsible || "Sin responsable"}</span>
                <span>Precio: {formatCurrency(item.price)}</span>
                <span>Compra: {new Date(item.createdAt).toLocaleDateString("es-MX")}</span>
              </div>

              {item.status === "baja" && (
                <div className="disposal-box">
                  <b>Motivo de baja</b>
                  <span>{item.disposalReason}</span>
                  {item.disposedAt && (
                    <small>{new Date(item.disposedAt).toLocaleDateString("es-MX")}</small>
                  )}
                </div>
              )}

              <div className="card-actions">
                {item.invoice?.key && (
                  <button type="button" onClick={() => downloadInvoice(item)}>Factura</button>
                )}
                {canCreate && (
                  <button type="button" onClick={() => { setInvoiceItem(item); setInvoiceFile(null); }}>
                    {item.invoice?.key ? "Reemplazar factura" : "Subir factura"}
                  </button>
                )}
                {canDispose && item.status === "activo" && (
                  <button type="button" className="danger-btn" onClick={() => setDisposeItem(item)}>
                    Dar de baja
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {disposeItem && (
        <div className="modal">
          <div className="modal-content">
            <h3>Dar de baja equipo</h3>
            <p>{disposeItem.brand} {disposeItem.model} - {disposeItem.serialNumber}</p>
            <textarea
              rows={4}
              placeholder="Motivo de baja"
              value={disposeReason}
              onChange={(e) => setDisposeReason(e.target.value)}
            />
            <div className="modal-actions">
              <button type="button" onClick={submitDispose}>Confirmar baja</button>
              <button type="button" onClick={() => { setDisposeItem(null); setDisposeReason(""); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {invoiceItem && (
        <div className="modal">
          <div className="modal-content">
            <h3>{invoiceItem.invoice?.key ? "Reemplazar factura" : "Subir factura"}</h3>
            <p>{invoiceItem.brand} {invoiceItem.model} - {invoiceItem.serialNumber}</p>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
            />
            <span>PDF o imagen, maximo 8 MB.</span>
            <div className="modal-actions">
              <button type="button" disabled={isUploadingInvoice} onClick={submitInvoice}>
                {isUploadingInvoice ? "Cargando..." : "Guardar factura"}
              </button>
              <button type="button" onClick={() => { setInvoiceItem(null); setInvoiceFile(null); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .inventory-page {
          padding: 28px;
          min-height: 100vh;
          color: #fff;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .page-header h1 { font-size: 22px; }
        .page-header p { color: #94a3b8; font-size: 13px; margin-top: 4px; }

        .notice {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 14px;
          margin-bottom: 16px;
          border-radius: 8px;
          font-size: 13px;
          border: 1px solid transparent;
        }

        .notice.success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: #86efac; }
        .notice.error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
        .notice span { color: #cbd5e1; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          padding: 16px;
        }

        .stat-card span {
          display: block;
          color: #94a3b8;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .stat-card strong { font-size: 24px; }
        .stat-card.active strong { color: #22c55e; }
        .stat-card.danger strong { color: #f87171; }
        .stat-card.value strong { color: #93c5fd; font-size: 20px; }

        .inventory-form {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 18px;
        }

        .form-title h2 {
          font-size: 16px;
          margin-bottom: 16px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 14px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-group.wide {
          grid-column: 1 / -1;
        }

        .form-group label {
          color: #94a3b8;
          font-size: 13px;
        }

        .form-group input,
        .form-group select,
        .form-group textarea,
        .toolbar select,
        .modal-content textarea,
        .modal-content input {
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid #1e293b;
          background: var(--app-input);
          color: #e2e8f0;
          font: inherit;
        }

        .form-group span {
          color: #64748b;
          font-size: 12px;
        }

        .btn-submit {
          margin-top: 16px;
          padding: 11px 16px;
          border: none;
          border-radius: 8px;
          background: #3b82f6;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-submit:disabled { opacity: 0.65; cursor: not-allowed; }

        .export-btn {
          padding: 10px 14px;
          border: none;
          border-radius: 8px;
          background: #22c55e;
          color: white;
          font-weight: 700;
          cursor: pointer;
        }

        .toolbar {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .toolbar select {
          min-width: 220px;
        }

        .inventory-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
          gap: 16px;
        }

        .item-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          padding: 16px;
          min-width: 0;
        }

        .item-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .item-top h3 {
          font-size: 15px;
          overflow-wrap: anywhere;
        }

        .item-top span {
          color: #94a3b8;
          font-size: 12px;
        }

        .status {
          align-self: flex-start;
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 11px;
          text-transform: capitalize;
        }

        .status.activo { background: rgba(34,197,94,0.15); color: #22c55e; }
        .status.baja { background: rgba(239,68,68,0.15); color: #f87171; }

        .item-meta {
          display: flex;
          flex-direction: column;
          gap: 5px;
          color: #cbd5e1;
          font-size: 12px;
        }

        .disposal-box {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 12px;
          padding: 10px;
          border-radius: 8px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.18);
          font-size: 12px;
          color: #fecaca;
        }

        .disposal-box small { color: #94a3b8; }

        .card-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .card-actions button,
        .modal-actions button {
          padding: 8px 11px;
          border-radius: 7px;
          border: 1px solid rgba(96,165,250,0.35);
          background: rgba(96,165,250,0.1);
          color: #bfdbfe;
          cursor: pointer;
        }

        .card-actions .danger-btn,
        .modal-actions button:first-child {
          border-color: rgba(239,68,68,0.35);
          background: rgba(239,68,68,0.12);
          color: #fca5a5;
        }

        .empty-state {
          background: rgba(255,255,255,0.04);
          border: 1px dashed rgba(255,255,255,0.16);
          border-radius: 8px;
          padding: 18px;
          color: #94a3b8;
          grid-column: 1 / -1;
        }

        .modal {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.65);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 999;
          padding: 18px;
        }

        .modal-content {
          width: min(440px, 100%);
          background: #1e293b;
          border-radius: 8px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .modal-content h3 { font-size: 17px; }
        .modal-content p { color: #cbd5e1; font-size: 13px; }
        .modal-content span { color: #94a3b8; font-size: 12px; }

        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }

        @media (max-width: 700px) {
          .inventory-page { padding: 16px; }
          .toolbar select { width: 100%; }
          .modal-actions { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

export default Inventory;
