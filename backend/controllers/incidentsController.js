const Incident = require("../models/incident");
const { hasPermission } = require("../utils/permissions");

const getIncidents = async (req, res) => {
  try {
    const department = req.user?.department;
    const branch = req.user?.branch;
    let query = null;

    if (hasPermission(req.user, "VIEW_INCIDENTS_ALL")) {
      query = {};
    } else {
      const filters = [];

      if (hasPermission(req.user, "VIEW_INCIDENTS_DEPARTMENT")) {
        if (!department) {
          return res.status(400).json({ msg: "Departamento requerido" });
        }

        filters.push({
          department: Array.isArray(department) ? { $in: department } : department
        });
      }

      if (hasPermission(req.user, "VIEW_INCIDENTS_BRANCH")) {
        if (!branch) {
          return res.status(400).json({ msg: "Sucursal requerida" });
        }

        filters.push({ branch });
      }

      if (filters.length === 0) {
        return res.status(403).json({ msg: "No tienes permisos para ver incidencias" });
      }

      query = filters.length === 1 ? filters[0] : { $or: filters };
    }

    const incidents = await Incident.find(query)
      .populate("createdBy", "nombre email")
      .populate("branch", "name")
      .sort({ createdAt: -1 });

    res.json(incidents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener incidencias" });
  }
};

const createIncident = async (req, res) => {
  try {
    const { title, description, branch, department } = req.body;

    if (!hasPermission(req.user, "CREATE_INCIDENT")) {
      return res.status(403).json({
        msg: "No tienes permisos para crear incidencias",
      });
    }

    if (!title || !description || !branch || !department) {
      return res.status(400).json({ msg: "Datos incompletos" });
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
    const { department } = req.user;

    if (!status) {
      return res.status(400).json({ msg: "Status requerido" });
    }

    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ msg: "Incidencia no encontrada" });
    }

    if (hasPermission(req.user, "VIEW_INCIDENTS_ALL")) {
      incident.status = status;
      await incident.save();
      return res.json(incident);
    }

    if (
      hasPermission(req.user, "VIEW_INCIDENTS_DEPARTMENT") &&
      incident.department &&
      department &&
      incident.department.toLowerCase().trim() === department.toLowerCase().trim()
    ) {
      incident.status = status;
      await incident.save();
      return res.json(incident);
    }

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
