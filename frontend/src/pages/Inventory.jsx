import { useCallback, useEffect, useMemo, useState } from "react";
import { ACCESS_SCOPES, hasPermission } from "../config/permissions";
import { useAuthUser } from "../hooks/useAuthUser";
import { exportPdfReport } from "../utils/pdfReport";

const API_URL = import.meta.env.VITE_API_URL;

const initialForm = {
  model: "",
  brand: "",
  serialNumber: "",
  provider: "",
  responsible: "",
  branch: "",
  department: "",
  invoice: null,
};

const emptyCatalogs = { article: [], brand: [], responsible: [] };

function CatalogInput({ id, label, value, options, placeholder, onChange, onSave, saving }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className="catalog-input">
        <input
          id={id}
          list={`${id}-options`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="catalog-add"
          onClick={onSave}
          disabled={saving || !value.trim()}
          title="Guardar esta opcion para usarla despues"
          aria-label={`Guardar ${label.toLowerCase()}`}
        >
          {saving ? "..." : "+"}
        </button>
      </div>
      <datalist id={`${id}-options`}>
        {options.map((option) => <option key={option} value={option} />)}
      </datalist>
    </div>
  );
}

function Inventory() {
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [catalogs, setCatalogs] = useState(emptyCatalogs);
  const [savingCatalog, setSavingCatalog] = useState("");
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
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [isUpdatingItem, setIsUpdatingItem] = useState(false);

  const token = localStorage.getItem("token");
  const user = useAuthUser();

  const canViewAll = hasPermission(user, "VIEW_INVENTORY_ALL");
  const canViewDepartment = hasPermission(user, "VIEW_INVENTORY_DEPARTMENT");
  const canCreate = hasPermission(user, "CREATE_INVENTORY");
  const canUpdate = hasPermission(user, "INVENTORY_UPDATE");
  const canDispose = hasPermission(user, "DISPOSE_INVENTORY");
  const canExport = hasPermission(user, "INVENTORY_EXPORT");
  const canView = canViewAll || canViewDepartment || hasPermission(user, "VIEW_INVENTORY_BRANCH") || canCreate || canUpdate || canDispose;
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

  const getSupplierOptions = useCallback((branchId, departmentName) => suppliers
    .filter((supplier) => {
      if (supplier.scope === ACCESS_SCOPES.ALL) return true;

      if (supplier.scope === ACCESS_SCOPES.BRANCH) {
        const supplierBranchIds = [
          supplier.branch?._id || supplier.branch,
          ...(Array.isArray(supplier.branches) ? supplier.branches.map((branch) => branch?._id || branch) : []),
        ].filter(Boolean);
        return !branchId || supplierBranchIds.includes(branchId);
      }

      if (supplier.scope === ACCESS_SCOPES.DEPARTMENT) {
        return !departmentName || supplier.department === departmentName;
      }

      if (branchId && (supplier.branch?._id || supplier.branch) !== branchId) return false;
      if (departmentName && supplier.department !== departmentName) return false;
      return true;
    })
    .map((supplier) => ({
      value: supplier._id,
      label: supplier.name,
      detail: [supplier.branch?.name, supplier.department].filter(Boolean).join(" / "),
    })), [suppliers]);

  const createSupplierOptions = useMemo(
    () => getSupplierOptions(form.branch, form.department),
    [form.branch, form.department, getSupplierOptions]
  );

  const editSupplierOptions = useMemo(() => {
    const options = getSupplierOptions(editForm.branch, editForm.department);
    const legacyProvider = editingItem?.provider;
    if (editingItem && legacyProvider && !editingItem.supplier?._id) {
      options.unshift({
        value: legacyProvider,
        label: legacyProvider,
        detail: "Proveedor registrado previamente",
      });
    }

    return options;
  }, [editForm.branch, editForm.department, editingItem, getSupplierOptions]);

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
    return { total, activos, bajas };
  }, [filteredItems]);

  const exportInventoryPdf = () => {
    if (!canExport) { alert("No tienes permisos para exportar inventario"); return; }
    if (filteredItems.length === 0) { alert("No hay articulos para exportar"); return; }

    exportPdfReport({
      title: "Reporte de inventario",
      subtitle: "Articulos registrados y asignados por sucursal",
      summary: [
        { label: "Total", value: inventoryStats.total },
        { label: "Activos", value: inventoryStats.activos },
        { label: "Bajas", value: inventoryStats.bajas },
      ],
      columns: [
        { key: "article", label: "Articulo" },
        { key: "category", label: "Categoria / marca" },
        { key: "code", label: "Codigo" },
        { key: "branch", label: "Sucursal" },
        { key: "department", label: "Departamento" },
        { key: "provider", label: "Proveedor" },
        { key: "responsible", label: "Responsable / ubicacion" },
        { key: "status", label: "Estado" },
      ],
      rows: filteredItems.map((item) => ({
        article: item.model || "Sin articulo",
        category: item.brand || "Sin categoria",
        code: item.serialNumber,
        branch: item.branch?.name || "Sin sucursal",
        department: item.department || "Sin departamento",
        provider: item.provider,
        responsible: item.responsible || "Sin responsable",
        status: item.status,
      })),
    });
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateEditForm = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const addCatalogOption = useCallback((type, value) => {
    const cleanValue = value?.trim();
    if (!cleanValue) return;

    setCatalogs((current) => {
      const exists = current[type].some((option) => option.toLowerCase() === cleanValue.toLowerCase());
      if (exists) return current;
      return {
        ...current,
        [type]: [...current[type], cleanValue].sort((a, b) => a.localeCompare(b, "es")),
      };
    });
  }, []);

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

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/suppliers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch {
      setSuppliers([]);
    }
  };

  const fetchCatalogs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/inventory-catalogs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCatalogs(res.ok ? { ...emptyCatalogs, ...data } : emptyCatalogs);
    } catch {
      setCatalogs(emptyCatalogs);
    }
  };

  const saveCatalogOption = async (type, value) => {
    const cleanValue = value?.trim();
    if (!cleanValue) return;

    try {
      setSavingCatalog(type);
      const res = await fetch(`${API_URL}/api/inventory-catalogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, value: cleanValue }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          title: "No se pudo guardar la opcion",
          detail: data.msg || `Error ${res.status}`,
        });
        return;
      }

      addCatalogOption(type, data.value || cleanValue);
      setMessage({
        type: "success",
        title: "Opcion guardada",
        detail: `${data.value || cleanValue} ya se puede seleccionar en futuros registros.`,
      });
    } catch {
      setMessage({
        type: "error",
        title: "Error de conexion",
        detail: "No se pudo guardar la opcion del catalogo.",
      });
    } finally {
      setSavingCatalog("");
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchBranches();
    fetchDepartments();
    fetchSuppliers();
    fetchCatalogs();
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

    if (!form.model.trim() || !form.brand.trim() || !form.branch || !form.department) {
      setMessage({
        type: "error",
        title: "Faltan campos obligatorios",
        detail: "Articulo, categoria o marca, sucursal y departamento son obligatorios.",
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
          title: data.msg || "No se pudo registrar el articulo",
          detail: data.error || `Error ${res.status}`,
        });
        return;
      }

      setItems((current) => [data, ...current]);
      addCatalogOption("article", data.model);
      addCatalogOption("brand", data.brand);
      addCatalogOption("responsible", data.responsible);
      setForm({ ...initialForm, department: isDepartmentLocked ? userDepartment : "" });
      setMessage({
        type: "success",
        title: "Articulo registrado",
        detail: "El articulo quedo agregado al inventario.",
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
        alert(data.msg || "No se pudo abrir el comprobante");
        return;
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      alert("No se pudo generar el enlace del comprobante");
    }
  };

  const submitInvoice = async () => {
    if (!invoiceFile) {
      setMessage({
        type: "error",
        title: "Comprobante requerido",
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
          title: data.msg || "No se pudo cargar el comprobante",
          detail: data.error || `Error ${res.status}`,
        });
        return;
      }

      setItems((current) => current.map((item) => (item._id === data._id ? data : item)));
      setInvoiceItem(null);
      setInvoiceFile(null);
      setMessage({
        type: "success",
        title: "Comprobante cargado",
        detail: "El comprobante quedo vinculado al articulo.",
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

  const openEditItem = (item) => {
    setEditingItem(item);
    setEditForm({
      model: item.model || "",
      brand: item.brand || "",
      serialNumber: item.serialNumber || "",
      provider: item.supplier?._id || item.provider || "",
      responsible: item.responsible || "",
      branch: item.branch?._id || item.branch || "",
      department: item.department || "",
      invoice: null,
    });
  };

  const submitUpdateItem = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (!editingItem?._id) return;

    if (!editForm.model.trim() || !editForm.brand.trim() || !editForm.branch || !editForm.department) {
      setMessage({
        type: "error",
        title: "Faltan campos obligatorios",
        detail: "Articulo, categoria o marca, sucursal y departamento son obligatorios.",
      });
      return;
    }

    try {
      setIsUpdatingItem(true);
      const res = await fetch(`${API_URL}/api/inventory/${editingItem._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          model: editForm.model,
          brand: editForm.brand,
          serialNumber: editForm.serialNumber,
          provider: editForm.provider,
          responsible: editForm.responsible,
          branch: editForm.branch,
          department: editForm.department,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          title: data.msg || "No se pudo actualizar el articulo",
          detail: data.error || `Error ${res.status}`,
        });
        return;
      }

      setItems((current) => current.map((item) => (item._id === data._id ? data : item)));
      addCatalogOption("article", data.model);
      addCatalogOption("brand", data.brand);
      addCatalogOption("responsible", data.responsible);
      setEditingItem(null);
      setEditForm(initialForm);
      setMessage({
        type: "success",
        title: "Articulo actualizado",
        detail: "Los datos del articulo quedaron guardados.",
      });
    } catch {
      setMessage({
        type: "error",
        title: "Error de conexion",
        detail: "No se pudo conectar con el servidor.",
      });
    } finally {
      setIsUpdatingItem(false);
    }
  };

  const submitDispose = async () => {
    if (!disposeReason.trim()) {
      setMessage({
        type: "error",
        title: "Motivo requerido",
        detail: "Escribe el motivo de baja del articulo.",
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
        title: "Articulo dado de baja",
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
          <p>Articulos, activos y recursos asignados por sucursal</p>
        </div>
        {canExport && (
          <button className="export-btn" onClick={exportInventoryPdf}>Exportar PDF</button>
        )}
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
      </div>

      {canCreate && (
        <form className="inventory-form" onSubmit={createItem}>
          <div className="form-title">
            <h2>Registrar articulo</h2>
          </div>

          <div className="form-grid">
            <CatalogInput
              id="inventory-article"
              label="Articulo *"
              value={form.model}
              options={catalogs.article}
              placeholder="Escribe o selecciona un articulo"
              onChange={(value) => updateForm("model", value)}
              onSave={() => saveCatalogOption("article", form.model)}
              saving={savingCatalog === "article"}
            />
            <CatalogInput
              id="inventory-brand"
              label="Categoria / marca *"
              value={form.brand}
              options={catalogs.brand}
              placeholder="Escribe o selecciona una marca"
              onChange={(value) => updateForm("brand", value)}
              onSave={() => saveCatalogOption("brand", form.brand)}
              saving={savingCatalog === "brand"}
            />
            <div className="form-group">
              <label>Codigo / serie (opcional)</label>
              <input value={form.serialNumber} onChange={(e) => updateForm("serialNumber", e.target.value)} placeholder="Se genera S/N automaticamente" />
            </div>
            <div className="form-group">
              <label>Proveedor (opcional)</label>
              <select value={form.provider} onChange={(e) => updateForm("provider", e.target.value)}>
                <option value="">Seleccionar proveedor</option>
                {createSupplierOptions.map((supplier) => (
                  <option key={supplier.value} value={supplier.value}>
                    {supplier.detail ? `${supplier.label} - ${supplier.detail}` : supplier.label}
                  </option>
                ))}
              </select>
            </div>
            <CatalogInput
              id="inventory-responsible"
              label="Responsable / ubicacion (opcional)"
              value={form.responsible}
              options={catalogs.responsible}
              placeholder="Escribe o selecciona un responsable"
              onChange={(value) => updateForm("responsible", value)}
              onSave={() => saveCatalogOption("responsible", form.responsible)}
              saving={savingCatalog === "responsible"}
            />
            <div className="form-group">
              <label>Sucursal *</label>
              <select value={form.branch} onChange={(e) => { updateForm("branch", e.target.value); updateForm("provider", ""); }}>
                <option value="">Seleccionar sucursal</option>
                {formBranches.map((branch) => (
                  <option key={branch._id} value={branch._id}>{branch.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Departamento *</label>
              <select
                value={form.department}
                onChange={(e) => { updateForm("department", e.target.value); updateForm("provider", ""); }}
                disabled={isDepartmentLocked}
              >
                <option value="">Seleccionar departamento</option>
                {availableDepartments.map((department) => (
                  <option key={department._id} value={department.name?.toLowerCase()}>{department.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group wide">
              <label>Comprobante</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => updateForm("invoice", e.target.files?.[0] || null)}
              />
              <span>Comprobante, recibo o evidencia en PDF o imagen, maximo 8 MB.</span>
            </div>
          </div>

          <button className="btn-submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar articulo"}
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
          <div className="empty-state">No hay articulos para mostrar.</div>
        ) : (
          <div className="inventory-table">
            <div className="inventory-table-head">
              <span>Articulo</span>
              <span>Ubicacion</span>
              <span>Responsable</span>
              <span>Estado</span>
              <span>Acciones</span>
            </div>
            {filteredItems.map((item) => (
              <div className="inventory-row" key={item._id}>
                <div className="item-identity">
                  <strong>{item.model || "Sin articulo"}</strong>
                  <span>{item.brand || "Sin categoria"} · {item.serialNumber || "Sin codigo"}</span>
                  <small>Proveedor: {item.provider || "Sin proveedor"}</small>
                </div>
                <div className="location-cell">
                  <strong>{item.branch?.name || "Sin sucursal"}</strong>
                  <span>{item.department || "Sin departamento"}</span>
                  <small>Alta: {new Date(item.createdAt).toLocaleDateString("es-MX")}</small>
                </div>
                <div className="responsible-cell">
                  <span>{item.responsible || "Sin responsable"}</span>
                  {item.invoice?.key && <small>Comprobante cargado</small>}
                </div>
                <div className="status-cell">
                  <b className={`status ${item.status}`}>{item.status}</b>
                  {item.status === "baja" && (
                    <small>{item.disposalReason || "Sin motivo de baja"}</small>
                  )}
                </div>
                <div className="card-actions">
                  {item.invoice?.key && (
                    <button type="button" onClick={() => downloadInvoice(item)}>Comprobante</button>
                  )}
                  {canUpdate && item.status === "activo" && (
                    <button type="button" onClick={() => openEditItem(item)}>
                      Editar
                    </button>
                  )}
                  {canUpdate && (
                    <button type="button" onClick={() => { setInvoiceItem(item); setInvoiceFile(null); }}>
                      {item.invoice?.key ? "Reemplazar comprobante" : "Subir comprobante"}
                    </button>
                  )}
                  {canDispose && item.status === "activo" && (
                    <button type="button" className="danger-btn" onClick={() => setDisposeItem(item)}>
                      Dar de baja
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {disposeItem && (
        <div className="modal">
          <div className="modal-content">
            <h3>Dar de baja articulo</h3>
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
            <h3>{invoiceItem.invoice?.key ? "Reemplazar comprobante" : "Subir comprobante"}</h3>
            <p>{invoiceItem.brand} {invoiceItem.model} - {invoiceItem.serialNumber}</p>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
            />
            <span>PDF o imagen, maximo 8 MB.</span>
            <div className="modal-actions">
              <button type="button" disabled={isUploadingInvoice} onClick={submitInvoice}>
                {isUploadingInvoice ? "Cargando..." : "Guardar comprobante"}
              </button>
              <button type="button" onClick={() => { setInvoiceItem(null); setInvoiceFile(null); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="modal">
          <form className="modal-content wide" onSubmit={submitUpdateItem}>
            <h3>Editar articulo</h3>
            <p>{editingItem.brand} {editingItem.model} - {editingItem.serialNumber}</p>
            <div className="form-grid">
              <CatalogInput
                id="edit-inventory-article"
                label="Articulo *"
                value={editForm.model}
                options={catalogs.article}
                onChange={(value) => updateEditForm("model", value)}
                onSave={() => saveCatalogOption("article", editForm.model)}
                saving={savingCatalog === "article"}
              />
              <CatalogInput
                id="edit-inventory-brand"
                label="Categoria / marca *"
                value={editForm.brand}
                options={catalogs.brand}
                onChange={(value) => updateEditForm("brand", value)}
                onSave={() => saveCatalogOption("brand", editForm.brand)}
                saving={savingCatalog === "brand"}
              />
              <div className="form-group">
                <label>Codigo / serie (opcional)</label>
                <input value={editForm.serialNumber} onChange={(e) => updateEditForm("serialNumber", e.target.value)} placeholder="Se genera S/N automaticamente" />
              </div>
              <div className="form-group">
                <label>Proveedor (opcional)</label>
                <select value={editForm.provider} onChange={(e) => updateEditForm("provider", e.target.value)}>
                  <option value="">Seleccionar proveedor</option>
                  {editSupplierOptions.map((supplier) => (
                    <option key={supplier.value} value={supplier.value}>
                      {supplier.detail ? `${supplier.label} - ${supplier.detail}` : supplier.label}
                    </option>
                  ))}
                </select>
              </div>
              <CatalogInput
                id="edit-inventory-responsible"
                label="Responsable / ubicacion (opcional)"
                value={editForm.responsible}
                options={catalogs.responsible}
                onChange={(value) => updateEditForm("responsible", value)}
                onSave={() => saveCatalogOption("responsible", editForm.responsible)}
                saving={savingCatalog === "responsible"}
              />
              <div className="form-group">
                <label>Sucursal *</label>
                <select value={editForm.branch} onChange={(e) => { updateEditForm("branch", e.target.value); updateEditForm("provider", ""); }}>
                  <option value="">Seleccionar sucursal</option>
                  {formBranches.map((branch) => (
                    <option key={branch._id} value={branch._id}>{branch.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Departamento *</label>
                <select
                  value={editForm.department}
                  onChange={(e) => { updateEditForm("department", e.target.value); updateEditForm("provider", ""); }}
                  disabled={isDepartmentLocked}
                >
                  <option value="">Seleccionar departamento</option>
                  {availableDepartments.map((department) => (
                    <option key={department._id} value={department.name?.toLowerCase()}>{department.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="submit" disabled={isUpdatingItem}>
                {isUpdatingItem ? "Guardando..." : "Guardar cambios"}
              </button>
              <button type="button" onClick={() => { setEditingItem(null); setEditForm(initialForm); }}>
                Cancelar
              </button>
            </div>
          </form>
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

        .catalog-input {
          display: flex;
          align-items: stretch;
        }

        .catalog-input input {
          flex: 1;
          min-width: 0;
        }

        .catalog-input input {
          border-radius: 8px 0 0 8px;
        }

        .catalog-add {
          width: 42px;
          border: 1px solid #2563eb;
          border-left: 0;
          border-radius: 0 8px 8px 0;
          background: #2563eb;
          color: #fff;
          font-size: 20px;
          font-weight: 700;
          cursor: pointer;
        }

        .catalog-add:disabled {
          cursor: not-allowed;
          opacity: 0.5;
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
          min-width: 0;
        }

        .inventory-table {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          overflow: hidden;
          min-width: 0;
        }

        .inventory-table-head,
        .inventory-row {
          display: grid;
          grid-template-columns: minmax(220px, 1.4fr) minmax(170px, 1fr) minmax(160px, 1fr) minmax(110px, 0.7fr) minmax(220px, 1.1fr);
          gap: 16px;
          align-items: center;
          padding: 14px 18px;
        }

        .inventory-table-head {
          color: #93c5fd;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0;
          background: rgba(15,23,42,0.65);
          border-bottom: 1px solid rgba(148,163,184,0.14);
        }

        .inventory-row {
          border-bottom: 1px solid rgba(148,163,184,0.1);
        }

        .inventory-row:last-child {
          border-bottom: none;
        }

        .item-identity,
        .location-cell,
        .responsible-cell,
        .status-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .item-identity strong,
        .location-cell strong {
          color: #f8fafc;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .item-identity span,
        .location-cell span,
        .responsible-cell span {
          color: #cbd5e1;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .item-identity small,
        .location-cell small,
        .responsible-cell small,
        .status-cell small {
          color: #64748b;
          font-size: 12px;
          overflow-wrap: anywhere;
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

        .card-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
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

        .modal-content.wide {
          width: min(760px, 100%);
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

        @media (max-width: 1050px) {
          .inventory-table-head {
            display: none;
          }

          .inventory-row {
            grid-template-columns: 1fr;
            gap: 12px;
            align-items: stretch;
          }

          .card-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}

export default Inventory;
