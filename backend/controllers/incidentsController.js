const Incident = require("../models/incident");
const ROLES = require("../config/roles");


const getIncidents = async (req, res) => {
  try {
    const role = req.user?.role;
    const department = req.user?.department;

    console.log("REQ.USER:", req.user);
    console.log("DEPARTMENT:", department);

    let query = {};

    // 👑 admin / gerencia / direccion ven todo
    if (["admin", "gerencia", "direccion"].includes(role)) {
      query = {};
    }

    // 🧑‍💼 departamento solo ve lo suyo
    else if (role === "departamento") {
      if (!department) {
        return res.status(400).json({ msg: "Department requerido" });
      }

      query = {
  department: Array.isArray(department)
    ? { $in: department }
    : department
};
    }
    const incidents = await Incident.find(query)
      .populate("createdBy", "nombre email") // usuario
      .populate("branch", "name") // sucursal
      .sort({ createdAt: -1 });

    res.json(incidents);

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener incidencias" });
  }
};


// ➕ CREAR
const createIncident = async (req, res) => {
  try {
    const { title, description, branch, department } = req.body;

    const role = req.user.role;

    // 🔒 SOLO admin, gerencia y direccion pueden crear
    if (!["admin", "gerencia", "direccion"].includes(role)) {
      return res.status(403).json({
        msg: "No tienes permisos para crear incidencias",
      });
    }

    const incident = await Incident.create({
      title,
      description,
      branch,
      department: department.toLowerCase().trim(),
      createdBy: req.user.id,
    });

    res.status(201).json(incident);

  } catch (error) {
    console.error("ERROR CREATE INCIDENT:", error);

    res.status(500).json({
      msg: "Error al crear incidencia",
      error: error.message
    });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { role, department } = req.user;

    if (!status) {
      return res.status(400).json({ msg: "Status requerido" });
    }

    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ msg: "Incidencia no encontrada" });
    }

    // 🔥 ADMIN / GERENCIA / DIRECCION → TODO
    if (["admin", "gerencia", "direccion"].includes(role)) {
      incident.status = status;
      await incident.save();
      return res.json(incident);
    }

    // 🔥 DEPARTAMENTO → SOLO SU ÁREA
    if (
      role === "departamento" &&
      incident.department &&
      department &&
      incident.department.toLowerCase().trim() ===
        department.toLowerCase().trim()
    ) {
      incident.status = status;
      await incident.save();
      return res.json(incident);
    }

    // 🚫 NO AUTORIZADO
    return res.status(403).json({
      msg: "No autorizado para cambiar este estatus",
    });

  } catch (error) {
    console.error("ERROR UPDATE STATUS:", error);

    res.status(500).json({
      msg: "Error al actualizar estatus",
      error: error.message
    });
  }
};

module.exports = {
  getIncidents,
  createIncident,
  updateStatus,
};