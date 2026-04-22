const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Role = require("../models/Role");

// 🗑 DELETE
const deleteUser = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ msg: "No autorizado" });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ msg: "Usuario eliminado" });

  } catch (error) {
    res.status(500).json({ msg: "Error al eliminar usuario" });
  }
};

// ✏️ ACTUALIZAR USUARIO
const updateUser = async (req, res) => {
  try {
    const { nombre, email, password, role, department } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    // 🧹 NORMALIZAR
    const nombreTrim = nombre?.trim();
    const emailNormalized = email?.toLowerCase().trim();
    const departmentTrim = department?.trim().toLowerCase();

    // 🔥 VALIDACIÓN POR ROL
    if (role === "departamento" && !departmentTrim) {
      return res.status(400).json({
        msg: "El departamento es obligatorio para este rol",
      });
    }

    // actualizar campos
    user.nombre = nombreTrim || user.nombre;
    user.email = emailNormalized || user.email;
    user.role = role || user.role;

    // 🔥 department como STRING consistente
    user.department =
      (role || user.role) === "departamento"
        ? departmentTrim
        : null;

    // 🔐 si viene contraseña nueva
    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await user.save();

    res.json(updatedUser);

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al actualizar usuario" });
  }
};

// 📥 GET USERS
const getUsers = async (req, res) => {
  try {
    // 🔒 solo admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ msg: "No autorizado" });
    }

    const users = await User.find().select("-password");
    res.json(users);

  } catch (error) {
    res.status(500).json({ msg: "Error al obtener usuarios" });
  }
};

// ➕ CREAR USUARIO
const createUser = async (req, res) => {
  try {
    // 🔒 seguridad
    if (!req.user) {
      return res.status(401).json({ msg: "No autenticado" });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({ msg: "No autorizado" });
    }

    let { nombre, email, password, role, department } = req.body;

    // 🧹 NORMALIZAR
    const nombreTrim = nombre?.trim();
    const emailNormalized = email?.toLowerCase().trim();
    const departmentTrim = department?.trim().toLowerCase();

    // ✅ VALIDACIONES BÁSICAS
    if (!nombreTrim || !emailNormalized || !password || !role) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    // 🔍 VALIDAR ROL (DINÁMICO DESDE DB)
    const roleExists = await Role.findOne({ name: role });
    if (!roleExists) {
      return res.status(400).json({ msg: "Rol no válido" });
    }

    // 🔥 VALIDACIÓN POR ROL
    if (role === "departamento" && !departmentTrim) {
      return res.status(400).json({
        msg: "El departamento es obligatorio para este rol",
      });
    }

    // 🔍 EVITAR DUPLICADOS
    const userExists = await User.findOne({ email: emailNormalized });
    if (userExists) {
      return res.status(400).json({ msg: "El usuario ya existe" });
    }

    // 🔐 HASH PASSWORD
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 🚀 CREACIÓN FINAL
    const user = await User.create({
      nombre: nombreTrim,
      email: emailNormalized,
      password: hashedPassword,
      role,
      department: role === "departamento" ? departmentTrim : null, // 🔥 STRING limpio
    });

    res.status(201).json(user);

  } catch (error) {
    console.error("ERROR CREATE USER:", error);
    res.status(500).json({ msg: "Error al crear usuario" });
  }
};

module.exports = {
  createUser,
  getUsers,
  deleteUser,
  updateUser,
};