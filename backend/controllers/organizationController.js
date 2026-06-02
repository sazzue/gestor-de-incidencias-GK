const Organization = require("../models/Organization");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { getOrganizationPlanSummary } = require("../utils/planLimits");

const buildSlug = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const attachPlanSummaries = async (organizations) => {
  const list = Array.isArray(organizations) ? organizations : [organizations];
  const summaries = await Promise.all(
    list.map(async (organization) => {
      const payload = organization.toObject ? organization.toObject() : organization;
      const planSummary = await getOrganizationPlanSummary(payload);

      return {
        ...payload,
        ...planSummary,
      };
    })
  );

  return Array.isArray(organizations) ? summaries : summaries[0];
};

const createOrganization = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const slug = buildSlug(req.body.slug || name);
    const plan = req.body.plan || "basic";
    const status = req.body.status || "active";
    const ownerUser = req.body.ownerUser || null;
    const owner = req.body.owner || null;

    if (!name || !slug) {
      return res.status(400).json({ msg: "Nombre y slug son obligatorios" });
    }

    if (owner && (!owner.nombre || !owner.email || !owner.password)) {
      return res.status(400).json({ msg: "Datos incompletos del administrador de la empresa" });
    }

    const organization = await Organization.create({
      name,
      slug,
      plan,
      status,
      ownerUser,
    });

    if (ownerUser) {
      await User.findByIdAndUpdate(ownerUser, { organization: organization._id });
    }

    if (owner) {
      const hashedPassword = await bcrypt.hash(owner.password, 10);
      const user = await User.create({
        nombre: owner.nombre.trim(),
        email: owner.email.toLowerCase().trim(),
        username: owner.username?.toLowerCase().trim() || undefined,
        password: hashedPassword,
        role: "admin",
        organization: organization._id,
        mustChangePassword: true,
      });

      organization.ownerUser = user._id;
      await organization.save();
    }

    const populated = await Organization.findById(organization._id)
      .populate("ownerUser", "nombre email");

    res.status(201).json(await attachPlanSummaries(populated));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ msg: "La empresa ya existe" });
    }

    res.status(500).json({ msg: "Error al crear empresa", error: error.message });
  }
};

const updateOrganization = async (req, res) => {
  try {
    const payload = {};

    ["name", "plan", "status"].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        payload[field] = typeof req.body[field] === "string"
          ? req.body[field].trim()
          : req.body[field];
      }
    });

    if (req.body.slug) {
      payload.slug = buildSlug(req.body.slug);
    }

    const organization = await Organization.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    ).populate("ownerUser", "nombre email");

    if (!organization) {
      return res.status(404).json({ msg: "Empresa no encontrada" });
    }

    res.json(await attachPlanSummaries(organization));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ msg: "La empresa ya existe" });
    }

    res.status(500).json({ msg: "Error al actualizar empresa", error: error.message });
  }
};

const getOrganizations = async (req, res) => {
  try {
    const organizations = await Organization.find()
      .populate("ownerUser", "nombre email")
      .sort({ createdAt: -1 });

    res.json(await attachPlanSummaries(organizations));
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener empresas", error: error.message });
  }
};

module.exports = {
  createOrganization,
  getOrganizations,
  updateOrganization,
};
