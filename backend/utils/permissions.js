const ROLES = require("../config/roles");
const {
  DEFAULT_ACCESS_SCOPES,
  LEGACY_BY_PERMISSION,
  LEGACY_PERMISSION_ALIASES,
  PERMISSIONS,
  VIEW_SCOPE_LEGACY,
} = require("../config/permissions");

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
  const rolePermissions = Array.isArray(ROLES[user?.role]) ? ROLES[user.role] : [];
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const accessScopes = getAccessScopesForUser(user);
  const normalized = normalizePermissions([
    ...rolePermissions,
    ...userPermissions,
  ]);

  return expandLegacyPermissions(normalized, accessScopes);
};

const hasPermission = (user, permission) => {
  if (user?.role === ROLES.ADMIN) {
    return true;
  }

  const normalizedPermission = LEGACY_PERMISSION_ALIASES[permission] || permission;
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];

  return permissions.includes(permission) || permissions.includes(normalizedPermission);
};

module.exports = {
  expandLegacyPermissions,
  getAccessScopesForUser,
  getPermissionsForUser,
  hasPermission,
  normalizePermissions,
};
