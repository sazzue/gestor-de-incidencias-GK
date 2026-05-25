const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Role = require("../models/Role");
const { hasPermission, normalizePermissions } = require("../utils/permissions");

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

const normalizeUserInput = (body) => {
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

  return {
    nombre: body.nombre?.trim(),
    username: username || undefined,
    email: body.email?.toLowerCase().trim(),
    password: body.password,
    role,
    department: role === "departamento" ? department : null,
    branch,
    branches,
    permissions: normalizePermissions(Array.isArray(body.permissions) ? body.permissions : []),
  };
};

const deleteUser = async (req, res) => {
  try {
    if (!canManageUsers(req, res)) return;

    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: "Usuario eliminado" });
  } catch (error) {
    res.status(500).json({ msg: "Error al eliminar usuario", error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    if (!canManageUsers(req, res)) return;

    const input = normalizeUserInput(req.body);

    if (!input.nombre || !input.email || !input.role) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    if (input.role === "departamento" && !input.department) {
      return res.status(400).json({ msg: "El departamento es obligatorio para este rol" });
    }

    const duplicate = await User.findOne({
      _id: { $ne: req.params.id },
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

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true }
    )
      .select("-password")
      .populate("branch", "name")
      .populate("branches", "name");

    if (!updatedUser) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("ERROR UPDATE USER:", error);
    res.status(500).json({ msg: "Error al actualizar usuario", error: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    if (!canManageUsers(req, res)) return;

    const users = await User.find()
      .select("-password")
      .populate("branch", "name")
      .populate("branches", "name");
    res.json(users);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener usuarios", error: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    if (!canManageUsers(req, res)) return;

    const input = normalizeUserInput(req.body);

    if (!input.nombre || !input.email || !input.password || !input.role) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    const roleExists = await Role.findOne({ name: input.role });
    if (!roleExists) {
      return res.status(400).json({ msg: "Rol no valido" });
    }

    if (input.role === "departamento" && !input.department) {
      return res.status(400).json({ msg: "El departamento es obligatorio para este rol" });
    }

    const userExists = await User.findOne({ email: input.email });
    if (userExists) {
      return res.status(400).json({ msg: "El usuario ya existe" });
    }

    if (input.username) {
      const usernameExists = await User.findOne({ username: input.username });
      if (usernameExists) {
        return res.status(400).json({ msg: "El nombre de usuario ya existe" });
      }
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);
    const userPayload = {
      nombre: input.nombre,
      email: input.email,
      password: hashedPassword,
      role: input.role,
      department: input.department,
      branch: input.branch,
      branches: input.branches,
      permissions: input.permissions,
    };

    if (input.username) {
      userPayload.username = input.username;
    }

    const user = await User.create(userPayload);

    const createdUser = await User.findById(user._id)
      .select("-password")
      .populate("branch", "name")
      .populate("branches", "name");

    res.status(201).json(createdUser);
  } catch (error) {
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
