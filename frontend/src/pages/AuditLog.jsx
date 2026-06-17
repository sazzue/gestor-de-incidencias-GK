import { useCallback, useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

const ACTION_LABELS = {
  create: "Creacion",
  update: "Actualizacion",
  delete: "Eliminacion",
};

const MODULE_LABELS = {
  users: "Usuarios",
  incidents: "Incidencias",
  maintenance: "Mantenimientos",
  inventory: "Inventario",
  suppliers: "Proveedores",
  branches: "Sucursales",
  departments: "Departamentos",
  settings: "Configuracion",
  organizations: "Empresas",
  auth: "Seguridad",
  storage: "Almacenamiento",
};

const FIELD_LABELS = {
  nombre: "Nombre",
  name: "Nombre",
  username: "Nombre de usuario",
  email: "Correo electronico",
  role: "Rol",
  department: "Departamento",
  branch: "Sucursal",
  branches: "Sucursales",
  permissions: "Permisos",
  accessScopes: "Alcances de acceso",
  slaHours: "Tiempos SLA",
  slaWarningPercent: "Umbral de aviso SLA",
  title: "Titulo",
  description: "Descripcion",
  priority: "Prioridad",
  status: "Estado",
  assignedTo: "Responsable asignado",
  resolutionComment: "Comentario de resolucion",
  comment: "Comentario",
  text: "Comentario",
  date: "Fecha",
  scheduledDate: "Fecha programada",
  provider: "Proveedor",
  brand: "Marca",
  model: "Modelo",
  serialNumber: "Numero de serie",
  quantity: "Cantidad",
  price: "Precio",
  plan: "Plan",
  addOns: "Servicios adicionales",
  enabled: "Habilitado",
  smtpHost: "Servidor de correo",
  smtpPort: "Puerto de correo",
  smtpSecure: "Conexion segura",
  fromName: "Nombre del remitente",
  fromEmail: "Correo del remitente",
  incidents: "Incidencias",
  maintenance: "Mantenimientos",
  inventory: "Inventario",
};

const VALUE_LABELS = {
  true: "Si",
  false: "No",
  pendiente: "Pendiente",
  "en proceso": "En proceso",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Critica",
  admin: "Administrador",
  direccion: "Direccion",
  gerencia: "Gerencia",
  departamento: "Departamento",
  all: "Toda la empresa",
  branch: "Sucursales asignadas",
  assigned: "Solo registros asignados",
  active: "Activa",
  suspended: "Suspendida",
  trial: "Periodo de prueba",
  basic: "Basico",
  pro: "Profesional",
  enterprise: "Empresarial",
  USERS_MANAGE: "Administrar usuarios y permisos",
  AUDIT_VIEW: "Consultar la bitacora",
  SETTINGS_MANAGE: "Configurar la empresa",
  CATALOGS_MANAGE: "Administrar catalogos",
  INCIDENTS_VIEW: "Ver incidencias",
  INCIDENTS_CREATE: "Crear incidencias",
  INCIDENTS_UPDATE_STATUS: "Cambiar estado de incidencias",
  INCIDENTS_ASSIGN: "Asignar incidencias",
  INCIDENTS_COMMENT: "Comentar incidencias",
  INCIDENTS_CLOSE: "Cerrar incidencias",
  INTERNAL_TASKS_VIEW: "Ver tareas internas",
  INTERNAL_TASKS_CREATE: "Crear tareas internas",
  MAINTENANCE_VIEW: "Ver mantenimientos",
  MAINTENANCE_CREATE: "Crear mantenimientos",
  INVENTORY_VIEW: "Ver inventario",
  INVENTORY_CREATE: "Crear inventario",
};

const humanizeKey = (key) => FIELD_LABELS[key] || key
  .replace(/([a-z])([A-Z])/g, "$1 $2")
  .replace(/_/g, " ")
  .replace(/^./, (letter) => letter.toUpperCase());

const humanizeValue = (value, key = "") => {
  if (value === null || value === undefined || value === "") return "Sin valor";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "Ninguno";
    return value.map((item) => humanizeValue(item, key)).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([nestedKey, nestedValue]) => `${humanizeKey(nestedKey)}: ${humanizeValue(nestedValue, nestedKey)}`)
      .join("; ");
  }

  const cleanValue = String(value);
  if (/^[a-f\d]{24}$/i.test(cleanValue)) return "Registro seleccionado";
  if (/^\d{4}-\d{2}-\d{2}T/.test(cleanValue)) {
    const date = new Date(cleanValue);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString("es-MX");
  }
  return VALUE_LABELS[cleanValue] || VALUE_LABELS[cleanValue.toLowerCase()] || cleanValue;
};

const getChangeDetails = (item) => {
  const changes = Object.entries(item.changes || {});

  if (changes.length === 0) {
    if (item.action === "delete") return ["El usuario elimino este registro."];
    return ["La operacion se completo sin datos adicionales."];
  }

  return changes.map(([key, value]) => {
    const verb = item.action === "create" ? "Registro" : "Cambio";
    return `${verb} ${humanizeKey(key).toLowerCase()}: ${humanizeValue(value, key)}.`;
  });
};

function AuditLog() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ module: "", action: "", actor: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAudit = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      Object.entries(filters).forEach(([key, value]) => {
        if (value.trim()) params.set(key, value.trim());
      });

      const response = await fetch(`${API_URL}/api/audit?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.msg || "No se pudo cargar la bitacora");
      setItems(Array.isArray(data.items) ? data.items : []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAudit(1);
  }, [loadAudit]);

  return (
    <main className="audit-page">
      <header className="audit-header">
        <div>
          <p className="audit-kicker">Seguridad y trazabilidad</p>
          <h1>Bitacora de auditoria</h1>
          <p>Consulta las acciones realizadas dentro de la empresa.</p>
        </div>
        <span className="audit-total">{pagination.total} registros</span>
      </header>

      <section className="audit-filters">
        <input
          value={filters.actor}
          onChange={(event) => setFilters((current) => ({ ...current, actor: event.target.value }))}
          placeholder="Buscar usuario o correo"
        />
        <select
          value={filters.module}
          onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value }))}
        >
          <option value="">Todos los modulos</option>
          {Object.entries(MODULE_LABELS).map(([module, label]) => (
            <option value={module} key={module}>{label}</option>
          ))}
        </select>
        <select
          value={filters.action}
          onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
        >
          <option value="">Todas las acciones</option>
          <option value="create">Creacion</option>
          <option value="update">Actualizacion</option>
          <option value="delete">Eliminacion</option>
        </select>
      </section>

      {error && <div className="audit-error">{error}</div>}

      <section className="audit-card">
        {loading ? (
          <p className="audit-empty">Cargando movimientos...</p>
        ) : items.length === 0 ? (
          <p className="audit-empty">No hay movimientos con estos filtros.</p>
        ) : (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Accion</th>
                  <th>Modulo</th>
                  <th>Recurso</th>
                  <th>Cambios</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id}>
                    <td>{new Date(item.createdAt).toLocaleString("es-MX")}</td>
                    <td>
                      <strong>{item.actor?.name || "Usuario"}</strong>
                      <span>{item.actor?.email}</span>
                    </td>
                    <td><b className={`audit-action ${item.action}`}>{ACTION_LABELS[item.action] || item.action}</b></td>
                    <td>{MODULE_LABELS[item.module] || item.module}</td>
                    <td>{item.resourceId ? "Registro identificado" : "Registro general"}</td>
                    <td>
                      <details>
                        <summary>Ver detalle</summary>
                        <ul className="audit-change-list">
                          {getChangeDetails(item).map((detail, index) => (
                            <li key={`${item._id}-${index}`}>{detail}</li>
                          ))}
                        </ul>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="audit-pagination">
        <button disabled={pagination.page <= 1 || loading} onClick={() => loadAudit(pagination.page - 1)}>
          Anterior
        </button>
        <span>Pagina {pagination.page} de {pagination.pages}</span>
        <button disabled={pagination.page >= pagination.pages || loading} onClick={() => loadAudit(pagination.page + 1)}>
          Siguiente
        </button>
      </footer>

      <style>{`
        .audit-page { padding: clamp(18px, 4vw, 40px); min-height: 100vh; color: var(--app-text); }
        .audit-header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 24px; }
        .audit-header h1 { color: var(--app-title); margin: 4px 0 8px; }
        .audit-header p { margin: 0; opacity: .72; }
        .audit-kicker { color: var(--app-accent); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
        .audit-total { padding: 8px 12px; border-radius: 999px; background: color-mix(in srgb, var(--app-accent) 15%, transparent); color: var(--app-accent); white-space: nowrap; }
        .audit-filters { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .audit-filters input, .audit-filters select { min-width: 0; padding: 11px 12px; border-radius: 9px; border: 1px solid rgba(255,255,255,.12); background: var(--app-input); color: var(--app-text); }
        .audit-card { background: var(--app-card); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; overflow: hidden; box-shadow: 0 14px 34px rgba(0,0,0,.18); }
        .audit-table-wrap { overflow-x: auto; }
        .audit-table { width: 100%; border-collapse: collapse; min-width: 920px; }
        .audit-table th, .audit-table td { padding: 13px 14px; text-align: left; border-bottom: 1px solid rgba(255,255,255,.07); vertical-align: top; font-size: 13px; }
        .audit-table th { color: var(--app-title); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
        .audit-table td span { display: block; opacity: .62; font-size: 11px; margin-top: 3px; }
        .audit-action { display: inline-block; padding: 5px 8px; border-radius: 999px; font-size: 11px; }
        .audit-action.create { background: rgba(34,197,94,.15); color: #4ade80; }
        .audit-action.update { background: rgba(59,130,246,.15); color: #60a5fa; }
        .audit-action.delete { background: rgba(239,68,68,.15); color: #f87171; }
        details summary { cursor: pointer; color: var(--app-accent); }
        .audit-change-list { max-width: 430px; max-height: 240px; overflow: auto; margin: 8px 0 0; padding: 10px 10px 10px 28px; border-radius: 8px; background: rgba(0,0,0,.18); color: var(--app-text); line-height: 1.45; }
        .audit-change-list li + li { margin-top: 7px; }
        .audit-empty, .audit-error { padding: 24px; text-align: center; }
        .audit-error { color: #f87171; background: rgba(239,68,68,.1); border-radius: 10px; margin-bottom: 14px; }
        .audit-pagination { display: flex; justify-content: center; align-items: center; gap: 14px; margin-top: 18px; }
        .audit-pagination button { padding: 9px 14px; border: 0; border-radius: 8px; background: var(--app-accent); color: white; cursor: pointer; }
        .audit-pagination button:disabled { opacity: .35; cursor: not-allowed; }
        @media (max-width: 720px) {
          .audit-header { flex-direction: column; }
          .audit-filters { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}

export default AuditLog;
