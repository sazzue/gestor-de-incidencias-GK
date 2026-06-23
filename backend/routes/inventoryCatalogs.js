const express = require("express");
const router = express.Router();

const InventoryCatalog = require("../models/InventoryCatalog");
const InventoryItem = require("../models/InventoryItem");
const auth = require("../middleware/authMiddleware");
const { hasPermission } = require("../utils/permissions");
const { normalizeCatalogValue } = require("../utils/inventory");

const catalogFields = {
  article: "model",
  brand: "brand",
  responsible: "responsible",
};

const canViewCatalogs = (user) => [
  "VIEW_INVENTORY_ALL",
  "VIEW_INVENTORY_DEPARTMENT",
  "VIEW_INVENTORY_BRANCH",
  "CREATE_INVENTORY",
  "INVENTORY_EDIT",
  "INVENTORY_UPDATE",
].some((permission) => hasPermission(user, permission));

router.get("/", auth, async (req, res) => {
  try {
    if (!canViewCatalogs(req.user)) {
      return res.status(403).json({ msg: "No tienes permisos para ver los catalogos de inventario" });
    }

    const organization = req.user.organization || null;
    const saved = await InventoryCatalog.find({ organization }).lean();
    const existingValues = await Promise.all(
      Object.entries(catalogFields).map(async ([type, field]) => ({
        type,
        values: await InventoryItem.distinct(field, { organization }),
      }))
    );

    const catalogs = { article: [], brand: [], responsible: [] };
    const addValue = (type, value) => {
      const cleanValue = value?.toString().trim();
      const normalizedValue = normalizeCatalogValue(cleanValue);
      if (!normalizedValue) return;
      if (catalogs[type].some((entry) => normalizeCatalogValue(entry) === normalizedValue)) return;
      catalogs[type].push(cleanValue);
    };

    saved.forEach((entry) => addValue(entry.type, entry.value));
    existingValues.forEach(({ type, values }) => values.forEach((value) => addValue(type, value)));
    Object.values(catalogs).forEach((values) => values.sort((a, b) => a.localeCompare(b, "es")));

    res.json(catalogs);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener catalogos de inventario", error: error.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    if (
      !hasPermission(req.user, "CREATE_INVENTORY") &&
      !hasPermission(req.user, "INVENTORY_EDIT") &&
      !hasPermission(req.user, "INVENTORY_UPDATE")
    ) {
      return res.status(403).json({ msg: "No tienes permisos para guardar opciones de inventario" });
    }

    const type = req.body.type?.toString().trim();
    const value = req.body.value?.toString().trim().replace(/\s+/g, " ");
    const normalizedValue = normalizeCatalogValue(value);

    if (!catalogFields[type] || !normalizedValue) {
      return res.status(400).json({ msg: "Tipo y valor de catalogo validos son obligatorios" });
    }

    const entry = await InventoryCatalog.findOneAndUpdate(
      { organization: req.user.organization || null, type, normalizedValue },
      { $setOnInsert: { value } },
      { new: true, upsert: true }
    );

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ msg: "Error al guardar opcion de inventario", error: error.message });
  }
});

module.exports = router;
