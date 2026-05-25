const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {getUsers,createUser,deleteUser,updateUser} = require("../controllers/userController");


// 🔒 SOLO ADMIN
router.post(
  "/",
  authMiddleware,
  createUser
);

// 📥 OBTENER USUARIOS
router.get("/", authMiddleware, getUsers);

// 🗑 eliminar usuario
router.delete("/:id", authMiddleware, deleteUser);

// ✏ editar usuario
router.put("/:id", authMiddleware, updateUser);


module.exports = router;
