export const ACCESS_SCOPES = {
  ALL: "all",
  BRANCH: "branch",
  DEPARTMENT: "department",
  ASSIGNED: "assigned",
};

export const ACCESS_SCOPE_OPTIONS = [
  { value: ACCESS_SCOPES.ALL, label: "Toda la empresa" },
  { value: ACCESS_SCOPES.BRANCH, label: "Sucursales asignadas" },
  { value: ACCESS_SCOPES.DEPARTMENT, label: "Su departamento" },
  { value: ACCESS_SCOPES.ASSIGNED, label: "Solo asignados" },
];

export const DEFAULT_ACCESS_SCOPES = {
  admin: {
    incidents: ACCESS_SCOPES.ALL,
    maintenance: ACCESS_SCOPES.ALL,
    inventory: ACCESS_SCOPES.ALL,
  },
  direccion: {
    incidents: ACCESS_SCOPES.ALL,
    maintenance: ACCESS_SCOPES.ALL,
    inventory: ACCESS_SCOPES.ALL,
  },
  gerencia: {
    incidents: ACCESS_SCOPES.BRANCH,
    maintenance: ACCESS_SCOPES.BRANCH,
    inventory: ACCESS_SCOPES.BRANCH,
  },
  departamento: {
    incidents: ACCESS_SCOPES.DEPARTMENT,
    maintenance: ACCESS_SCOPES.DEPARTMENT,
    inventory: ACCESS_SCOPES.DEPARTMENT,
  },
};

export const PERMISSION_GROUPS = [
  {
    key: "users",
    label: "Usuarios y seguridad",
    permissions: [
      { value: "USERS_MANAGE", label: "Administrar usuarios y permisos" },
    ],
  },
  {
    key: "incidents",
    label: "Incidencias",
    permissions: [
      { value: "INCIDENTS_VIEW", label: "Ver incidencias" },
      { value: "INCIDENTS_CREATE", label: "Crear incidencias" },
      { value: "INCIDENTS_UPDATE_STATUS", label: "Cambiar estado" },
      { value: "INCIDENTS_ASSIGN", label: "Asignar responsable" },
      { value: "INCIDENTS_COMMENT", label: "Comentar seguimiento/cierre" },
      { value: "INCIDENTS_CLOSE", label: "Cerrar incidencias" },
      { value: "INCIDENTS_VIEW_COMMENTS", label: "Ver comentarios privados" },
      { value: "INCIDENTS_EXPORT", label: "Exportar reportes" },
    ],
  },
  {
    key: "maintenance",
    label: "Mantenimientos",
    permissions: [
      { value: "MAINTENANCE_VIEW", label: "Ver mantenimientos" },
      { value: "MAINTENANCE_CREATE", label: "Programar mantenimientos" },
      { value: "MAINTENANCE_CONFIRM", label: "Confirmar/finalizar" },
      { value: "MAINTENANCE_COMMENT", label: "Comentar autorizacion" },
      { value: "MAINTENANCE_VIEW_COMMENTS", label: "Ver comentarios" },
      { value: "MAINTENANCE_EXPORT", label: "Exportar reportes" },
      { value: "MAINTENANCE_DELETE", label: "Eliminar mantenimientos" },
    ],
  },
  {
    key: "inventory",
    label: "Inventario",
    permissions: [
      { value: "INVENTORY_VIEW", label: "Ver inventario" },
      { value: "INVENTORY_CREATE", label: "Registrar equipos" },
      { value: "INVENTORY_UPDATE", label: "Actualizar equipos/facturas" },
      { value: "INVENTORY_DISPOSE", label: "Dar de baja equipos" },
      { value: "INVENTORY_EXPORT", label: "Exportar reportes" },
    ],
  },
  {
    key: "administration",
    label: "Administracion",
    permissions: [
      { value: "CATALOGS_MANAGE", label: "Administrar catalogos" },
      { value: "SETTINGS_MANAGE", label: "Configurar sistema" },
      { value: "ORGANIZATIONS_MANAGE", label: "Administrar empresas" },
    ],
  },
];

export const LEGACY_PERMISSION_LABELS = {
  CREATE_USERS: "Administrar usuarios",
  CREATE_INCIDENT: "Crear incidencias",
  VIEW_INCIDENTS_ALL: "Ver incidencias: toda la empresa",
  VIEW_INCIDENTS_DEPARTMENT: "Ver incidencias: departamento",
  VIEW_INCIDENTS_BRANCH: "Ver incidencias: sucursales",
  COMMENT_INCIDENT: "Comentar incidencias",
  VIEW_INCIDENT_COMMENTS: "Ver comentarios de incidencias",
  CREATE_MAINTENANCE: "Crear mantenimientos",
  CONFIRM_MAINTENANCE: "Confirmar mantenimientos",
  VIEW_MAINTENANCE_ALL: "Ver mantenimientos: toda la empresa",
  VIEW_MAINTENANCE_DEPARTMENT: "Ver mantenimientos: departamento",
  VIEW_MAINTENANCE_BRANCH: "Ver mantenimientos: sucursales",
  COMMENT_MAINTENANCE: "Comentar mantenimientos",
  VIEW_MAINTENANCE_COMMENTS: "Ver comentarios de mantenimiento",
  CREATE_INVENTORY: "Crear inventario",
  VIEW_INVENTORY_ALL: "Ver inventario: toda la empresa",
  VIEW_INVENTORY_DEPARTMENT: "Ver inventario: departamento",
  VIEW_INVENTORY_BRANCH: "Ver inventario: sucursales",
  DISPOSE_INVENTORY: "Dar de baja equipos",
  DELETE_MAINTENANCE: "Eliminar mantenimientos",
};

export const getDefaultAccessScopes = (role) => ({
  ...(DEFAULT_ACCESS_SCOPES[role] || DEFAULT_ACCESS_SCOPES.departamento),
});
