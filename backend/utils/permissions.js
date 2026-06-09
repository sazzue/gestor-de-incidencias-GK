const {
  DEFAULT_ACCESS_SCOPES,
  LEGACY_BY_PERMISSION,
  LEGACY_PERMISSION_ALIASES,
  PLATFORM_ONLY_PERMISSIONS,
  PERMISSIONS,
  VIEW_SCOPE_LEGACY,
} = require("../config/permissions");
const { isPlatformAdminEmail } = require("./platformAdmin");

const normalizePermissions = (permissions = []) => {
  const items = Array.isArray(permissions) ? permissions : [];

  return [...new Set(items.filter(Boolean).map((permission) => {
    const cleanPermission = permission.toString().trim();
    return LEGACY_PERMISSION_ALIASES[cleanPermission] || cleanPermission;
  }))];
};

const getAccessScopesForUser = (user) => ({
  ...(DEFAULT_ACCESS_SCOPES[user?.role] || DEFAULT_ACCESS_SCOPES.departamento),
  ...(user?.accessScopes || {}),
});

const getLegacyPermissionsForScopes = (permissions, accessScopes) => {
  const legacy = [];

  if (permissions.includes(PERMISSIONS.INCIDENTS_VIEW)) {
    const scopePermission = VIEW_SCOPE_LEGACY.incidents[accessScopes.incidents];
    if (scopePermission) legacy.push(scopePermission);
  }

  if (permissions.includes(PERMISSIONS.MAINTENANCE_VIEW)) {
    const scopePermission = VIEW_SCOPE_LEGACY.maintenance[accessScopes.maintenance];
    if (scopePermission) legacy.push(scopePermission);
  }

  if (permissions.includes(PERMISSIONS.INVENTORY_VIEW)) {
    const scopePermission = VIEW_SCOPE_LEGACY.inventory[accessScopes.inventory];
    if (scopePermission) legacy.push(scopePermission);
  }

  return legacy;
};

const expandLegacyPermissions = (permissions, accessScopes) => {
  const legacy = permissions.flatMap((permission) => LEGACY_BY_PERMISSION[permission] || []);

  return normalizePermissions([
    ...permissions,
    ...legacy,
    ...getLegacyPermissionsForScopes(permissions, accessScopes),
  ]);
};

const getPermissionsForUser = async (user) => {
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const accessScopes = getAccessScopesForUser(user);
  const normalized = normalizePermissions(userPermissions);

  const expanded = expandLegacyPermissions(normalized, accessScopes);

  if (isPlatformAdminEmail(user?.email)) return expanded;

  return expanded.filter((permission) => !PLATFORM_ONLY_PERMISSIONS.includes(permission));
};

const hasPermission = (user, permission) => {
  const normalizedPermission = LEGACY_PERMISSION_ALIASES[permission] || permission;
  const permissions = normalizePermissions(Array.isArray(user?.permissions) ? user.permissions : []);

  if (PLATFORM_ONLY_PERMISSIONS.includes(normalizedPermission) && !isPlatformAdminEmail(user?.email)) {
    return false;
  }

  return permissions.includes(permission) || permissions.includes(normalizedPermission);
};

module.exports = {
  expandLegacyPermissions,
  getAccessScopesForUser,
  getPermissionsForUser,
  hasPermission,
  normalizePermissions,
};
