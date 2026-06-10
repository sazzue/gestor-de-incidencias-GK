const test = require("node:test");
const assert = require("node:assert/strict");

const { getInventorySerialNumber, normalizeCatalogValue } = require("../utils/inventory");

test("conserva el numero de serie capturado", () => {
  assert.equal(getInventorySerialNumber("  ABC-123  "), "ABC-123");
});

test("genera un S/N unico cuando no se captura una serie", () => {
  const first = getInventorySerialNumber("");
  const second = getInventorySerialNumber();

  assert.match(first, /^S\/N-[A-F0-9]{8}$/);
  assert.match(second, /^S\/N-[A-F0-9]{8}$/);
  assert.notEqual(first, second);
});

test("normaliza valores del catalogo para evitar duplicados", () => {
  assert.equal(normalizeCatalogValue("  Recursos   Humanos "), "recursos humanos");
});
