const ROLES = require("../config/roles");

const normalizePermissions = (permissions = []) => {
  return [...new Set(permissions.filter(Boolean))];
};

const getPermissionsForUser = async (user) => {
  const rolePermissions =
    user.role === ROLES.ADMIN && Array.isArray(ROLES[user.role])
      ? ROLES[user.role]
      : [];
  const userPermissions = Array.isArray(user.permissions) ? user.permissions : [];

  return normalizePermissions([
    ...rolePermissions,
    ...userPermissions
  ]);
};

const hasPermission = (user, permission) => {
  if (user?.role === ROLES.ADMIN) {
    return true;
  }

  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
};

module.exports = {
  getPermissionsForUser,
  hasPermission,
  normalizePermissions
};
