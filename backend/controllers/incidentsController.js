const Incident = require("../models/incident");
const User = require("../models/User");
const { ACCESS_SCOPES, PERMISSIONS } = require("../config/permissions");
const { hasPermission } = require("../utils/permissions");
const { assertStorageWithinPlanLimit, assertWithinPlanLimit } = require("../utils/planLimits");
const { deleteIncidentFile, getIncidentFileUrl, isR2Configured, uploadIncidentFile } = require("../utils/r2Storage");
const { notifyNewRecord } = require("../utils/notifications");

const MAX_ATTACHMENTS_PER_INCIDENT = 10;
const MAX_TOTAL_ATTACHMENT_SIZE = 30 * 1024 * 1024;
const DEFAULT_R2_STORAGE_LIMIT_GB = 9;
const RESOLVED_STATUS = "resuelto";
const VALID_PRIORITIES = new Set(["baja", "media", "alta", "critica"]);

const getTotalAttachmentSize = (attachments = []) =>
  attachments.reduce((total, attachment) => total + (attachment.size || 0), 0);

const getStorageLimitBytes = () => {
  const limitGb = Number(process.env.R2_STORAGE_LIMIT_GB || DEFAULT_R2_STORAGE_LIMIT_GB);
  const safeLimitGb = Number.isFinite(limitGb) && limitGb > 0 ? limitGb : DEFAULT_R2_STORAGE_LIMIT_GB;

  return safeLimitGb * 1024 * 1024 * 1024;
};

const formatGb = (bytes) => (bytes / 1024 / 1024 / 1024).toFixed(2);

const getCurrentAttachmentStorageBytes = async (organization = null) => {
  const [result] = await Incident.aggregate([
    { $match: { organization } },
    { $unwind: "$attachments" },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$attachments.size", 0] } } } },
  ]);

  return result?.total || 0;
};

const getOrganizationFilter = (req) => {
  if (!req.user?.organization) return {};

  return { organization: req.user.organization };
};

const getAttachmentErrorStatus = (error) => {
  if (
    error.message?.includes("maximo") ||
    error.message?.includes("Selecciona") ||
    error.message?.includes("permite") ||
    error.message?.includes("limite gratuito") ||
    error.code === "PLAN_LIMIT_EXCEEDED"
  ) {
    return error.status || 400;
  }

  if (error.message?.includes("Cloudflare R2 no esta configurado")) {
    return 503;
  }

  return 500;
};

const canViewIncident = (user, incident) => {
  if (!hasPermission(user, PERMISSIONS.INCIDENTS_VIEW)) return false;

  if (hasPermission(user, "VIEW_INCIDENTS_ALL")) return true;

  if (
    user?.accessScopes?.incidents === ACCESS_SCOPES.ASSIGNED &&
    incident?.assignedTo &&
    String(incident.assignedTo?._id || incident.assignedTo) === String(user?.id)
  ) {
    return true;
  }

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

const canViewIncidentComments = (user) =>
  hasPermission(user, "VIEW_INCIDENT_COMMENTS");

const canCommentIncident = (user, incident) => {
  if (!hasPermission(user, "COMMENT_INCIDENT")) return false;
  return canViewIncident(user, incident);
};

const canUseIncidentScope = (user, incident) => {
  const scope = user?.accessScopes?.incidents;

  if (scope === ACCESS_SCOPES.ALL) return true;

  if (scope === ACCESS_SCOPES.BRANCH) {
    return getAssignedBranchIds(user).includes(String(incident.branch?._id || incident.branch));
  }

  if (scope === ACCESS_SCOPES.DEPARTMENT) {
    const userDepartment = user?.department?.toLowerCase().trim();
    const incidentDepartment = incident?.department?.toLowerCase().trim();
    return Boolean(userDepartment && incidentDepartment === userDepartment);
  }

  if (scope === ACCESS_SCOPES.ASSIGNED) {
    return String(incident.assignedTo?._id || incident.assignedTo || "") === String(user?.id);
  }

  return false;
};

const getAssignedBranchIds = (user) => {
  const branches = Array.isArray(user?.branches) ? user.branches : [];
  const ids = branches.length > 0 ? branches : user?.branch ? [user.branch] : [];

  return ids.map((branch) => String(branch?._id || branch)).filter(Boolean);
};

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAssignableUserFilter = (user) => {
  const scope = user?.accessScopes?.incidents;

  if (scope === ACCESS_SCOPES.ALL) {
    return {};
  }

  if (scope === ACCESS_SCOPES.BRANCH) {
    const branchIds = getAssignedBranchIds(user);
    if (branchIds.length === 0) return null;

    return {
      $or: [
        { branch: { $in: branchIds } },
        { branches: { $in: branchIds } },
      ],
    };
  }

  if (scope === ACCESS_SCOPES.DEPARTMENT) {
    const department = user?.department?.toString().trim();
    if (!department) return null;

    return { department: new RegExp(`^${escapeRegExp(department)}$`, "i") };
  }

  if (scope === ACCESS_SCOPES.ASSIGNED) {
    return { _id: user?.id };
  }

  return null;
};

const canAssignIncident = (user, incident) => {
  if (!hasPermission(user, PERMISSIONS.INCIDENTS_ASSIGN)) return false;
  return canUseIncidentScope(user, incident);
};

const addActivity = (incident, { type, message, userId }) => {
  incident.activityLog.push({
    type,
    message,
    createdBy: userId || null,
    createdAt: new Date(),
  });
};

const hideIncidentCommentIfNeeded = (incident, user) => {
  if (!incident || canViewIncidentComments(user)) return incident;

  const output = typeof incident.toObject === "function" ? incident.toObject() : { ...incident };
  delete output.resolutionComment;
  return output;
};

const uploadFilesForIncident = async ({ incident, files, userId, organization }) => {
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

  const storageLimit = getStorageLimitBytes();
  const currentStorage = await getCurrentAttachmentStorageBytes(organization);

  if (currentStorage + incomingSize > storageLimit) {
    throw new Error(
      `La carga supera el limite gratuito configurado de R2 (${formatGb(storageLimit)} GB). Uso actual aproximado: ${formatGb(currentStorage)} GB.`
    );
  }

  await assertWithinPlanLimit({
    organization,
    metric: "files",
    increment: incomingCount,
  });

  await assertStorageWithinPlanLimit({
    organization,
    incrementBytes: incomingSize,
  });

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
    if (!hasPermission(req.user, PERMISSIONS.INCIDENTS_VIEW)) {
      return res.status(403).json({ msg: "No tienes permisos para ver incidencias" });
    }

    const department = req.user?.department;
    const branch = req.user?.branch;
    const branches = Array.isArray(req.user?.branches) ? req.user.branches : [];
    let query = null;

    if (hasPermission(req.user, "VIEW_INCIDENTS_ALL")) {
      query = getOrganizationFilter(req);
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

      filters.push({ assignedTo: req.user.id });

      if (filters.length === 0) {
        return res.status(403).json({ msg: "No tienes permisos para ver incidencias" });
      }

      const permissionQuery = filters.length === 1 ? filters[0] : { $or: filters };
      query = {
        ...getOrganizationFilter(req),
        ...permissionQuery,
      };
    }

    const incidents = await Incident.find(query)
      .populate("createdBy", "nombre email")
      .populate("assignedTo", "nombre email role department")
      .populate("resolutionComment.createdBy", "nombre email")
      .populate("branch", "name")
      .sort({ createdAt: -1 });

    res.json(incidents.map((incident) => hideIncidentCommentIfNeeded(incident, req.user)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener incidencias" });
  }
};

const getAssignableUsers = async (req, res) => {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INCIDENTS_ASSIGN)) {
      return res.status(403).json({ msg: "No autorizado para ver responsables" });
    }

    const assignableFilter = getAssignableUserFilter(req.user);

    if (!assignableFilter) {
      return res.json([]);
    }

    const users = await User.find({
      ...getOrganizationFilter(req),
      role: { $in: ["admin", "direccion", "gerencia", "departamento"] },
      ...assignableFilter,
    })
      .select("nombre email role department branch branches")
      .populate("branch", "name")
      .populate("branches", "name")
      .sort({ nombre: 1, email: 1 });

    res.json(users);
  } catch (error) {
    console.error("ERROR GET ASSIGNEES:", error);
    res.status(500).json({ msg: "Error al obtener responsables" });
  }
};

const getIncidentById = async (req, res) => {
  try {
    const incident = await Incident.findOne({
      _id: req.params.id,
      ...getOrganizationFilter(req),
    })
      .populate("createdBy", "nombre email")
      .populate("assignedTo", "nombre email role department")
      .populate("resolutionComment.createdBy", "nombre email")
      .populate("branch", "name")
      .populate("attachments.uploadedBy", "nombre email")
      .populate("comments.createdBy", "nombre email")
      .populate("activityLog.createdBy", "nombre email");

    if (!incident) {
      return res.status(404).json({ msg: "Incidencia no encontrada" });
    }

    if (!canViewIncident(req.user, incident)) {
      return res.status(403).json({ msg: "No autorizado para ver esta incidencia" });
    }

    res.json(hideIncidentCommentIfNeeded(incident, req.user));
  } catch (error) {
    console.error("ERROR GET INCIDENT:", error);
    res.status(500).json({ msg: "Error al obtener incidencia" });
  }
};

const createIncident = async (req, res) => {
  try {
    const { title, description, branch, department, priority = "media" } = req.body;

    if (!hasPermission(req.user, "CREATE_INCIDENT")) {
      return res.status(403).json({
        msg: "No tienes permisos para crear incidencias",
      });
    }

    if (!title || !description || !branch || !department) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    const normalizedPriority = priority.toString().toLowerCase().trim();

    if (!VALID_PRIORITIES.has(normalizedPriority)) {
      return res.status(400).json({ msg: "Prioridad no valida" });
    }

    await assertWithinPlanLimit({
      organization: req.user.organization,
      metric: "incidents",
      increment: 1,
    });

    const incident = await Incident.create({
      title,
      description,
      organization: req.user.organization || null,
      branch,
      department: department.toLowerCase().trim(),
      priority: normalizedPriority,
      createdBy: req.user.id,
      activityLog: [{
        type: "created",
        message: "Ticket creado",
        createdBy: req.user.id,
        createdAt: new Date(),
      }],
    });

    try {
      const attachments = await uploadFilesForIncident({
        incident,
        files: req.files,
        userId: req.user.id,
        organization: req.user.organization || null,
      });

      if (attachments.length > 0) {
        incident.attachments.push(...attachments);
        await incident.save();
      }
    } catch (uploadError) {
      await Incident.findByIdAndDelete(incident._id);
      throw uploadError;
    }

    const populatedIncident = await Incident.findById(incident._id)
      .populate("createdBy", "nombre email")
      .populate("resolutionComment.createdBy", "nombre email")
      .populate("branch", "name");

    await notifyNewRecord({
      type: "incident",
      record: populatedIncident || incident,
      organization: req.user.organization || null,
    });

    res.status(201).json(populatedIncident || incident);
  } catch (error) {
    console.error("ERROR CREATE INCIDENT:", error);
    const status = getAttachmentErrorStatus(error);

    res.status(status).json({
      msg: "Error al crear incidencia",
      error: error.message
    });
  }
};

const addAttachments = async (req, res) => {
  try {
    const incident = await Incident.findOne({
      _id: req.params.id,
      ...getOrganizationFilter(req),
    });

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
      organization: req.user.organization || null,
    });

    if (attachments.length === 0) {
      return res.status(400).json({ msg: "Selecciona al menos un archivo" });
    }

    incident.attachments.push(...attachments);
    addActivity(incident, {
      type: "attachments",
      message: `${attachments.length} archivo(s) agregado(s)`,
      userId: req.user.id,
    });
    await incident.save();

    res.status(201).json(incident);
  } catch (error) {
    console.error("ERROR ADD ATTACHMENTS:", error);
    const status = getAttachmentErrorStatus(error);

    res.status(status).json({
      msg: "Error al cargar archivos",
      error: error.message,
    });
  }
};

const addComment = async (req, res) => {
  try {
    const text = req.body.text?.toString().trim();

    if (!text) {
      return res.status(400).json({ msg: "Comentario requerido" });
    }

    const incident = await Incident.findOne({
      _id: req.params.id,
      ...getOrganizationFilter(req),
    });

    if (!incident) {
      return res.status(404).json({ msg: "Incidencia no encontrada" });
    }

    if (!canCommentIncident(req.user, incident)) {
      return res.status(403).json({ msg: "No autorizado para comentar esta incidencia" });
    }

    incident.comments.push({
      text,
      createdBy: req.user.id,
      createdAt: new Date(),
    });
    addActivity(incident, {
      type: "comment",
      message: "Comentario de seguimiento agregado",
      userId: req.user.id,
    });
    await incident.save();

    const updated = await Incident.findById(incident._id)
      .populate("createdBy", "nombre email")
      .populate("assignedTo", "nombre email role department")
      .populate("resolutionComment.createdBy", "nombre email")
      .populate("branch", "name")
      .populate("attachments.uploadedBy", "nombre email")
      .populate("comments.createdBy", "nombre email")
      .populate("activityLog.createdBy", "nombre email");

    res.status(201).json(hideIncidentCommentIfNeeded(updated, req.user));
  } catch (error) {
    console.error("ERROR ADD COMMENT:", error);
    res.status(500).json({ msg: "Error al agregar comentario", error: error.message });
  }
};

const assignIncident = async (req, res) => {
  try {
    const assignedTo = req.body.assignedTo || null;
    const incident = await Incident.findOne({
      _id: req.params.id,
      ...getOrganizationFilter(req),
    });

    if (!incident) {
      return res.status(404).json({ msg: "Incidencia no encontrada" });
    }

    if (!canAssignIncident(req.user, incident)) {
      return res.status(403).json({ msg: "No autorizado para asignar esta incidencia" });
    }

    let assignedUser = null;

    if (assignedTo) {
      assignedUser = await User.findOne({
        _id: assignedTo,
        ...getOrganizationFilter(req),
        ...getAssignableUserFilter(req.user),
      }).select("nombre email");

      if (!assignedUser) {
        return res.status(404).json({ msg: "Responsable no encontrado" });
      }
    }

    incident.assignedTo = assignedUser?._id || null;
    addActivity(incident, {
      type: "assignment",
      message: assignedUser
        ? `Responsable asignado: ${assignedUser.nombre || assignedUser.email}`
        : "Responsable removido",
      userId: req.user.id,
    });
    await incident.save();

    const updated = await Incident.findById(incident._id)
      .populate("createdBy", "nombre email")
      .populate("assignedTo", "nombre email role department")
      .populate("resolutionComment.createdBy", "nombre email")
      .populate("branch", "name")
      .populate("attachments.uploadedBy", "nombre email")
      .populate("comments.createdBy", "nombre email")
      .populate("activityLog.createdBy", "nombre email");

    res.json(hideIncidentCommentIfNeeded(updated, req.user));
  } catch (error) {
    console.error("ERROR ASSIGN INCIDENT:", error);
    res.status(500).json({ msg: "Error al asignar incidencia", error: error.message });
  }
};

const getAttachmentDownloadUrl = async (req, res) => {
  try {
    const incident = await Incident.findOne({
      _id: req.params.id,
      ...getOrganizationFilter(req),
    });

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
    const { status, comment } = req.body;

    if (!status) {
      return res.status(400).json({ msg: "Status requerido" });
    }

    const incident = await Incident.findOne({
      _id: req.params.id,
      ...getOrganizationFilter(req),
    });

    if (!incident) {
      return res.status(404).json({ msg: "Incidencia no encontrada" });
    }

    if (incident.status === RESOLVED_STATUS && status !== RESOLVED_STATUS) {
      return res.status(400).json({
        msg: "La incidencia ya esta resuelta y no puede cambiar de estatus",
      });
    }

    const isResolving = status === RESOLVED_STATUS && incident.status !== RESOLVED_STATUS;
    const normalizedComment = comment?.toString().trim();

    if (isResolving) {
      if (!hasPermission(req.user, PERMISSIONS.INCIDENTS_CLOSE)) {
        return res.status(403).json({ msg: "No tienes permisos para cerrar incidencias" });
      }
    } else if (!hasPermission(req.user, PERMISSIONS.INCIDENTS_UPDATE_STATUS)) {
      return res.status(403).json({ msg: "No tienes permisos para cambiar el estatus" });
    }

    if (!canUseIncidentScope(req.user, incident)) {
      return res.status(403).json({ msg: "No autorizado para cambiar este estatus" });
    }

    if (isResolving && normalizedComment) {
      if (!canCommentIncident(req.user, incident)) {
        return res.status(403).json({ msg: "No tienes permisos para comentar el cierre" });
      }

      if (incident.resolutionComment?.text) {
        return res.status(400).json({ msg: "El comentario de cierre ya no se puede modificar" });
      }

      incident.resolutionComment = {
        text: normalizedComment,
        createdBy: req.user.id,
        createdAt: new Date(),
      };
      addActivity(incident, {
        type: "resolution-comment",
        message: "Comentario de cierre agregado",
        userId: req.user.id,
      });
    }

    if (incident.status !== status) {
      addActivity(incident, {
        type: "status",
        message: `Estado cambiado a ${status.replace("_", " ")}`,
        userId: req.user.id,
      });
    }

    incident.status = status;
    incident.resolvedAt = status === RESOLVED_STATUS ? (incident.resolvedAt || new Date()) : null;
    await incident.save();
    await incident.populate("resolutionComment.createdBy", "nombre email");
    await incident.populate("activityLog.createdBy", "nombre email");
    return res.json(hideIncidentCommentIfNeeded(incident, req.user));
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
  addComment,
  assignIncident,
  getIncidents,
  getAssignableUsers,
  getIncidentById,
  getAttachmentDownloadUrl,
  createIncident,
  updateStatus,
};
