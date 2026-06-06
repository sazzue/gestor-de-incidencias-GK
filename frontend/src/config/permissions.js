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
      { value: "SETTINGS_MANAGE", label: "Configurar empresa" },
      { value: "ORGANIZATIONS_MANAGE", label: "Administrar empresas", platformOnly: true },
    ],
  },
];

export const PLATFORM_ONLY_PERMISSIONS = ["ORGANIZATIONS_MANAGE"];

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

export const LEGACY_PERMISSION_ALIASES = {
  CREATE_USERS: "USERS_MANAGE",
  CREATE_INCIDENT: "INCIDENTS_CREATE",
  COMMENT_INCIDENT: "INCIDENTS_COMMENT",
  VIEW_INCIDENT_COMMENTS: "INCIDENTS_VIEW_COMMENTS",
  CREATE_MAINTENANCE: "MAINTENANCE_CREATE",
  CONFIRM_MAINTENANCE: "MAINTENANCE_CONFIRM",
  COMMENT_MAINTENANCE: "MAINTENANCE_COMMENT",
  VIEW_MAINTENANCE_COMMENTS: "MAINTENANCE_VIEW_COMMENTS",
  DELETE_MAINTENANCE: "MAINTENANCE_DELETE",
  CREATE_INVENTORY: "INVENTORY_CREATE",
  DISPOSE_INVENTORY: "INVENTORY_DISPOSE",
};

export const LEGACY_SCOPE_PERMISSIONS = {
  VIEW_INCIDENTS_ALL: { module: "incidents", scope: ACCESS_SCOPES.ALL, permission: "INCIDENTS_VIEW" },
  VIEW_INCIDENTS_BRANCH: { module: "incidents", scope: ACCESS_SCOPES.BRANCH, permission: "INCIDENTS_VIEW" },
  VIEW_INCIDENTS_DEPARTMENT: { module: "incidents", scope: ACCESS_SCOPES.DEPARTMENT, permission: "INCIDENTS_VIEW" },
  VIEW_MAINTENANCE_ALL: { module: "maintenance", scope: ACCESS_SCOPES.ALL, permission: "MAINTENANCE_VIEW" },
  VIEW_MAINTENANCE_BRANCH: { module: "maintenance", scope: ACCESS_SCOPES.BRANCH, permission: "MAINTENANCE_VIEW" },
  VIEW_MAINTENANCE_DEPARTMENT: { module: "maintenance", scope: ACCESS_SCOPES.DEPARTMENT, permission: "MAINTENANCE_VIEW" },
  VIEW_INVENTORY_ALL: { module: "inventory", scope: ACCESS_SCOPES.ALL, permission: "INVENTORY_VIEW" },
  VIEW_INVENTORY_BRANCH: { module: "inventory", scope: ACCESS_SCOPES.BRANCH, permission: "INVENTORY_VIEW" },
  VIEW_INVENTORY_DEPARTMENT: { module: "inventory", scope: ACCESS_SCOPES.DEPARTMENT, permission: "INVENTORY_VIEW" },
};

export const normalizePermissionsForForm = (permissions = []) => {
  const normalized = permissions.flatMap((permission) => {
    const cleanPermission = permission?.toString().trim();
    const scopePermission = LEGACY_SCOPE_PERMISSIONS[cleanPermission];

    if (scopePermission) return [scopePermission.permission];

    return [LEGACY_PERMISSION_ALIASES[cleanPermission] || cleanPermission].filter(Boolean);
  });

  return [...new Set(normalized.filter(Boolean))];
};

export const getAccessScopesForForm = (user) => {
  const scopes = {
    ...getDefaultAccessScopes(user?.role),
    ...(user?.accessScopes || {}),
  };

  (user?.permissions || []).forEach((permission) => {
    const scopePermission = LEGACY_SCOPE_PERMISSIONS[permission];
    if (scopePermission) {
      scopes[scopePermission.module] = scopePermission.scope;
    }
  });

  return scopes;
};

export const getDefaultAccessScopes = (role) => ({
  ...(DEFAULT_ACCESS_SCOPES[role] || DEFAULT_ACCESS_SCOPES.departamento),
});
