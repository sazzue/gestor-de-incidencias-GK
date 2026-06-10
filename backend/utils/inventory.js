const crypto = require("crypto");

const normalizeCatalogValue = (value) =>
  value?.toString().trim().replace(/\s+/g, " ").toLowerCase() || "";

const getInventorySerialNumber = (value) => {
  const serialNumber = value?.toString().trim();
  if (serialNumber) return serialNumber;

  return `S/N-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

module.exports = { getInventorySerialNumber, normalizeCatalogValue };
