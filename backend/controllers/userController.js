const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Role = require("../models/Role");
const { getAccessScopesForUser, hasPermission, normalizePermissions } = require("../utils/permissions");
const { assertWithinPlanLimit } = require("../utils/planLimits");
const { getPlatformAdminEmails, isPlatformAdminEmail } = require("../utils/platformAdmin");
const { ACCESS_SCOPES, DEFAULT_ACCESS_SCOPES } = require("../config/permissions");
const { PLATFORM_ONLY_PERMISSIONS } = require("../config/permissions");

const canManageUsers = (req, res) => {
  if (!req.user) {
    res.status(401).json({ msg: "No autenticado" });
    return false;
  }

  if (!hasPermission(req.user, "CREATE_USERS")) {
    res.status(403).json({ msg: "No autorizado" });
    return false;
  }

  return true;
};

const normalizeUserInput = (body, actor) => {
  const role = body.role?.trim();
  const department = body.department?.trim().toLowerCase();
  const branch = typeof body.branch === "object" ? body.branch?._id || null : body.branch || null;
  const username = body.username?.toLowerCase().trim();
  const branches = Array.isArray(body.branches)
    ? body.branches
        .map((item) => (typeof item === "object" ? item?._id : item))
        .filter(Boolean)
    : branch
      ? [branch]
      : [];
  const defaultScopes = DEFAULT_ACCESS_SCOPES[role] || DEFAULT_ACCESS_SCOPES.departamento;
  const inputScopes = body.accessScopes && typeof body.accessScopes === "object" ? body.accessScopes : {};
  const normalizeScope = (moduleName) => {
    const value = inputScopes[moduleName];
    return Object.values(ACCESS_SCOPES).includes(value) ? value : defaultScopes[moduleName];
  };

  const normalizedPermissions = normalizePermissions(Array.isArray(body.permissions) ? body.permissions : []);
  const canAssignPlatformPermissions = isPlatformAdminEmail(actor?.email);

  return {
    nombre: body.nombre?.trim(),
    username: username || undefined,
    email: body.email?.toLowerCase().trim(),
    password: body.password,
    role,
    department: role === "departamento" ? department : null,
    branch,
    branches,
    permissions: canAssignPlatformPermissions
      ? normalizedPermissions
      : normalizedPermissions.filter((permission) => !PLATFORM_ONLY_PERMISSIONS.includes(permission)),
    accessScopes: {
      incidents: normalizeScope("incidents"),
      maintenance: normalizeScope("maintenance"),
      inventory: normalizeScope("inventory"),
    },
  };
};

const getOrganizationFilter = (req) => {
  if (!req.user?.organization) return {};

  return { organization: req.user.organization };
};

const canManagePlatformUser = (req, res, user) => {
  if (!isPlatformAdminEmail(user?.email)) return true;

  if (isPlatformAdminEmail(req.user?.email)) return true;

  res.status(403).json({
    msg: "No puedes modificar al super admin del sistema",
  });
  return false;
};

const serializeUserForManagement = (user) => {
  const output = user.toObject();
  const branches = Array.isArray(output.branches) ? output.branches : [];
  const branchId = output.branch?._id || output.branch;
  const hasSingleBranchInList = branchId &&
    branches.some((branch) => String(branch?._id || branch) === String(branchId));

  return {
    ...output,
    branches: branchId && !hasSingleBranchInList
      ? [output.branch, ...branches].filter(Boolean)
      : branches,
    accessScopes: getAccessScopesForUser(user),
  };
};

const deleteUser = async (req, res) => {
  try {
    if (!canManageUsers(req, res)) return;

    const user = await User.findOne({
      _id: req.params.id,
      ...getOrganizationFilter(req),
    });

    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    if (!canManagePlatformUser(req, res, user)) return;

    await user.deleteOne();

    res.json({ msg: "Usuario eliminado" });
  } catch (error) {
    res.status(500).json({ msg: "Error al eliminar usuario", error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    if (!canManageUsers(req, res)) return;

    const currentUser = await User.findOne({
      _id: req.params.id,
      ...getOrganizationFilter(req),
    });

    if (!currentUser) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    if (!canManagePlatformUser(req, res, currentUser)) return;

    const input = normalizeUserInput(req.body, req.user);

    if (!input.nombre || !input.email || !input.role) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    if (input.role === "departamento" && !input.department) {
      return res.status(400).json({ msg: "El departamento es obligatorio para este rol" });
    }

    const duplicate = await User.findOne({
      _id: { $ne: req.params.id },
      ...getOrganizationFilter(req),
      $or: [
        { email: input.email },
        ...(input.username ? [{ username: input.username }] : [])
      ]
    });

    if (duplicate) {
      return res.status(400).json({
        msg: duplicate.email === input.email
          ? "El correo ya esta registrado"
          : "El nombre de usuario ya existe"
      });
    }

    const update = {
      nombre: input.nombre,
      email: input.email,
      role: input.role,
      department: input.department,
      branch: input.branch,
      branches: input.branches,
      permissions: input.permissions,
      accessScopes: input.accessScopes,
    };
    const unset = {};

    if (input.username) {
      update.username = input.username;
    } else {
      unset.username = "";
    }

    if (input.password && input.password.trim() !== "") {
      update.password = await bcrypt.hash(input.password, 10);
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        ...getOrganizationFilter(req),
      },
      { $set: update, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true }
    )
      .select("-password")
      .populate("branch", "name")
      .populate("branches", "name");

    if (!updatedUser) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    res.json(serializeUserForManagement(updatedUser));
  } catch (error) {
    console.error("ERROR UPDATE USER:", error);
    res.status(500).json({ msg: "Error al actualizar usuario", error: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    if (!canManageUsers(req, res)) return;

    const query = {
      ...getOrganizationFilter(req),
      ...(isPlatformAdminEmail(req.user?.email)
        ? {}
        : { email: { $nin: getPlatformAdminEmails() } }),
    };

    const users = await User.find(query)
      .select("-password")
      .populate("branch", "name")
      .populate("branches", "name");
    res.json(users.map(serializeUserForManagement));
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener usuarios", error: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    if (!canManageUsers(req, res)) return;

    const input = normalizeUserInput(req.body, req.user);

    if (!input.nombre || !input.email || !input.password || !input.role) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    if (isPlatformAdminEmail(input.email) && !isPlatformAdminEmail(req.user?.email)) {
      return res.status(403).json({
        msg: "No puedes crear usuarios con un correo reservado de super admin",
      });
    }

    if (!isPlatformAdminEmail(input.email)) {
      await assertWithinPlanLimit({
        organization: req.user.organization,
        metric: "users",
        increment: 1,
      });
    }

    const roleExists = await Role.findOne({ name: input.role });
    if (!roleExists) {
      return res.status(400).json({ msg: "Rol no valido" });
    }

    if (input.role === "departamento" && !input.department) {
      return res.status(400).json({ msg: "El departamento es obligatorio para este rol" });
    }

    const userExists = await User.findOne({
      email: input.email,
      ...getOrganizationFilter(req),
    });
    if (userExists) {
      return res.status(400).json({ msg: "El usuario ya existe" });
    }

    if (input.username) {
      const usernameExists = await User.findOne({
        username: input.username,
        ...getOrganizationFilter(req),
      });
      if (usernameExists) {
        return res.status(400).json({ msg: "El nombre de usuario ya existe" });
      }
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);
    const userPayload = {
      nombre: input.nombre,
      email: input.email,
      password: hashedPassword,
      organization: req.user.organization || null,
      role: input.role,
      department: input.department,
      branch: input.branch,
      branches: input.branches,
      permissions: input.permissions,
      accessScopes: input.accessScopes,
    };

    if (input.username) {
      userPayload.username = input.username;
    }

    const user = await User.create(userPayload);

    const createdUser = await User.findById(user._id)
      .select("-password")
      .populate("branch", "name")
      .populate("branches", "name");

    res.status(201).json(serializeUserForManagement(createdUser));
  } catch (error) {
    if (error.code === "PLAN_LIMIT_EXCEEDED") {
      return res.status(error.status || 403).json({ msg: error.message });
    }

    console.error("ERROR CREATE USER:", error);
    res.status(500).json({ msg: "Error al crear usuario", error: error.message });
  }
};

module.exports = {
  createUser,
  getUsers,
  deleteUser,
  updateUser,
};
