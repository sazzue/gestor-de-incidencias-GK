const Incident = require("../models/incident");
const { hasPermission } = require("../utils/permissions");
const { deleteIncidentFile, getIncidentFileUrl, isR2Configured, uploadIncidentFile } = require("../utils/r2Storage");

const MAX_ATTACHMENTS_PER_INCIDENT = 10;
const MAX_TOTAL_ATTACHMENT_SIZE = 30 * 1024 * 1024;

const getTotalAttachmentSize = (attachments = []) =>
  attachments.reduce((total, attachment) => total + (attachment.size || 0), 0);

const canViewIncident = (user, incident) => {
  if (hasPermission(user, "VIEW_INCIDENTS_ALL")) return true;

  if (hasPermission(user, "VIEW_INCIDENTS_DEPARTMENT")) {
    const userDepartment = user?.department?.toLowerCase().trim();
    const incidentDepartment = incident?.department?.toLowerCase().trim();

    if (userDepartment && incidentDepartment === userDepartment) return true;
  }

  if (hasPermission(user, "VIEW_INCIDENTS_BRANCH")) {
    const branchIds = Array.isArray(user?.branches) && user.branches.length > 0
      ? user.branches.map(String)
      : user?.branch
        ? [String(user.branch)]
        : [];

    if (branchIds.includes(String(incident.branch?._id || incident.branch))) return true;
  }

  return false;
};

const uploadFilesForIncident = async ({ incident, files, userId }) => {
  if (!files || files.length === 0) return [];

  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 no esta configurado");
  }

  const currentCount = incident.attachments?.length || 0;
  const incomingCount = files.length;
  const currentSize = getTotalAttachmentSize(incident.attachments);
  const incomingSize = files.reduce((total, file) => total + (file.size || 0), 0);

  if (currentCount + incomingCount > MAX_ATTACHMENTS_PER_INCIDENT) {
    throw new Error(`Cada incidencia permite maximo ${MAX_ATTACHMENTS_PER_INCIDENT} archivos`);
  }

  if (currentSize + incomingSize > MAX_TOTAL_ATTACHMENT_SIZE) {
    throw new Error("Cada incidencia permite maximo 30 MB en archivos adjuntos");
  }

  const uploaded = [];

  try {
    for (const file of files) {
      uploaded.push(await uploadIncidentFile({ incidentId: incident._id, file, uploadedBy: userId }));
    }
  } catch (error) {
    await Promise.allSettled(uploaded.map((attachment) => deleteIncidentFile({ key: attachment.key })));
    throw error;
  }

  return uploaded;
};

const getIncidents = async (req, res) => {
  try {
    const department = req.user?.department;
    const branch = req.user?.branch;
    const branches = Array.isArray(req.user?.branches) ? req.user.branches : [];
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
        const branchIds = branches.length > 0 ? branches : branch ? [branch] : [];

        if (branchIds.length === 0) {
          return res.status(400).json({ msg: "Sucursal requerida" });
        }

        filters.push({ branch: { $in: branchIds } });
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

    try {
      const attachments = await uploadFilesForIncident({
        incident,
        files: req.files,
        userId: req.user.id,
      });

      if (attachments.length > 0) {
        incident.attachments.push(...attachments);
        await incident.save();
      }
    } catch (uploadError) {
      await Incident.findByIdAndDelete(incident._id);
      throw uploadError;
    }

    res.status(201).json(incident);
  } catch (error) {
    console.error("ERROR CREATE INCIDENT:", error);

    res.status(500).json({
      msg: "Error al crear incidencia",
      error: error.message
    });
  }
};

const addAttachments = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ msg: "Incidencia no encontrada" });
    }

    if (!canViewIncident(req.user, incident)) {
      return res.status(403).json({ msg: "No autorizado para modificar esta incidencia" });
    }

    const attachments = await uploadFilesForIncident({
      incident,
      files: req.files,
      userId: req.user.id,
    });

    if (attachments.length === 0) {
      return res.status(400).json({ msg: "Selecciona al menos un archivo" });
    }

    incident.attachments.push(...attachments);
    await incident.save();

    res.status(201).json(incident);
  } catch (error) {
    console.error("ERROR ADD ATTACHMENTS:", error);
    res.status(500).json({
      msg: "Error al cargar archivos",
      error: error.message,
    });
  }
};

const getAttachmentDownloadUrl = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ msg: "Incidencia no encontrada" });
    }

    if (!canViewIncident(req.user, incident)) {
      return res.status(403).json({ msg: "No autorizado para ver este archivo" });
    }

    const attachment = incident.attachments.id(req.params.attachmentId);

    if (!attachment) {
      return res.status(404).json({ msg: "Archivo no encontrado" });
    }

    const url = await getIncidentFileUrl({ key: attachment.key });

    res.json({
      url,
      expiresIn: 300,
      fileName: attachment.originalName,
    });
  } catch (error) {
    console.error("ERROR DOWNLOAD ATTACHMENT:", error);
    res.status(500).json({
      msg: "Error al generar enlace de descarga",
      error: error.message,
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
  addAttachments,
  getIncidents,
  getAttachmentDownloadUrl,
  createIncident,
  updateStatus,
};
