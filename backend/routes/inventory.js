const express = require("express");
const multer = require("multer");
const zlib = require("zlib");
const router = express.Router();

const InventoryItem = require("../models/InventoryItem");
const Supplier = require("../models/Supplier");
const auth = require("../middleware/authMiddleware");
const { ACCESS_SCOPES } = require("../config/permissions");
const { hasPermission } = require("../utils/permissions");
const { getInventorySerialNumber } = require("../utils/inventory");
const { assertStorageWithinPlanLimit, assertWithinPlanLimit } = require("../utils/planLimits");
const {
  getInventoryInvoiceUrl,
  isR2Configured,
  uploadInventoryInvoice,
} = require("../utils/r2Storage");

const allowedInvoiceTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const allowedImportTypes = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedInvoiceTypes.has(file.mimetype)) {
      return cb(new Error("Solo se permiten comprobantes en PDF o imagen"));
    }

    cb(null, true);
  },
});

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const isCsvName = file.originalname?.toLowerCase().endsWith(".csv");
    const isXlsxName = file.originalname?.toLowerCase().endsWith(".xlsx");
    if (!allowedImportTypes.has(file.mimetype) && !isCsvName && !isXlsxName) {
      return cb(new Error("Sube la plantilla en formato Excel (.xlsx)"));
    }

    cb(null, true);
  },
});

const handleUploadErrors = (err, req, res, next) => {
  if (!err) return next();

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ msg: "El comprobante debe pesar maximo 8 MB" });
  }

  return res.status(400).json({ msg: err.message || "Comprobante invalido" });
};

const getAssignedBranchIds = (user) => {
  const branches = Array.isArray(user.branches) ? user.branches : [];
  const ids = branches.length > 0 ? branches : user.branch ? [user.branch] : [];
  return ids.map((branch) => branch?.toString()).filter(Boolean);
};

const normalizeDepartment = (department) =>
  department?.toString().trim().toLowerCase();

const normalizeImportKey = (value) =>
  value?.toString().trim().toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_") || "";

const parsePositiveInteger = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
};

const escapeCsv = (value) => {
  const text = value?.toString() || "";
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const parseCsvRows = (content) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);

  return rows;
};

const getTemplateRows = () => [
  ["Articulo", "Categoria / marca", "Cantidad", "Codigo / serie", "Proveedor", "Responsable / ubicacion", "Sucursal", "Departamento"],
];

const crcTable = (() => {
  const table = [];
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const writeUInt16 = (value) => {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
};

const writeUInt32 = (value) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
};

const createZip = (files) => {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((file) => {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, "utf8");
    const crc = crc32(data);
    const localHeader = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(crc),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      name,
    ]);

    localParts.push(localHeader, data);
    centralParts.push(Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(crc),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(offset),
      name,
    ]));
    offset += localHeader.length + data.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(files.length),
    writeUInt16(files.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(offset),
    writeUInt16(0),
  ]);

  return Buffer.concat([...localParts, centralDirectory, end]);
};

const escapeXml = (value) =>
  value?.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;") || "";

const columnName = (index) => {
  let name = "";
  let value = index;
  while (value > 0) {
    const modulo = (value - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    value = Math.floor((value - modulo) / 26);
  }
  return name;
};

const createSheetXml = () => {
  const headers = getTemplateRows()[0];
  const headerCells = headers.map((header, index) =>
    `<c r="${columnName(index + 1)}5" t="inlineStr" s="3"><is><t>${escapeXml(header)}</t></is></c>`
  ).join("");
  const emptyRows = Array.from({ length: 200 }, (_, rowIndex) => {
    const rowNumber = rowIndex + 6;
    const cells = headers.map((_, colIndex) => {
      const style = colIndex === 2 ? 2 : 1;
      return `<c r="${columnName(colIndex + 1)}${rowNumber}" s="${style}"/>`;
    }).join("");
    return `<row r="${rowNumber}" ht="22" customHeight="1">${cells}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>
    <col min="1" max="1" width="26" customWidth="1"/>
    <col min="2" max="2" width="24" customWidth="1"/>
    <col min="3" max="3" width="13" customWidth="1"/>
    <col min="4" max="4" width="22" customWidth="1"/>
    <col min="5" max="5" width="24" customWidth="1"/>
    <col min="6" max="6" width="28" customWidth="1"/>
    <col min="7" max="7" width="24" customWidth="1"/>
    <col min="8" max="8" width="22" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1" ht="30" customHeight="1"><c r="A1" t="inlineStr" s="4"><is><t>Plantilla de inventario</t></is></c></row>
    <row r="2" ht="22" customHeight="1"><c r="A2" t="inlineStr" s="5"><is><t>Completa los campos obligatorios y carga este archivo en el sistema.</t></is></c></row>
    <row r="3"/>
    <row r="4"/>
    <row r="5" ht="24" customHeight="1">${headerCells}</row>
    ${emptyRows}
  </sheetData>
  <mergeCells count="2"><mergeCell ref="A1:H1"/><mergeCell ref="A2:H2"/></mergeCells>
  <autoFilter ref="A5:H205"/>
  <tableParts count="1"><tablePart r:id="rId1"/></tableParts>
</worksheet>`;
};

const createInventoryTemplateXlsx = () => createZip([
  {
    name: "[Content_Types].xml",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
  },
  {
    name: "_rels/.rels",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
  },
  {
    name: "docProps/core.xml",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Plantilla de inventario</dc:title>
  <dc:creator>Sistema de Gestion de Incidencias</dc:creator>
  <cp:lastModifiedBy>Sistema de Gestion de Incidencias</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`,
  },
  {
    name: "docProps/app.xml",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Excel</Application></Properties>`,
  },
  {
    name: "xl/workbook.xml",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Inventario" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
  },
  {
    name: "xl/_rels/workbook.xml.rels",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  },
  {
    name: "xl/worksheets/sheet1.xml",
    data: createSheetXml(),
  },
  {
    name: "xl/worksheets/_rels/sheet1.xml.rels",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>
</Relationships>`,
  },
  {
    name: "xl/tables/table1.xml",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="TablaInventario" displayName="TablaInventario" ref="A5:H205" totalsRowShown="0">
  <autoFilter ref="A5:H205"/>
  <tableColumns count="8">
    ${getTemplateRows()[0].map((header, index) => `<tableColumn id="${index + 1}" name="${escapeXml(header)}"/>`).join("")}
  </tableColumns>
  <tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
</table>`,
  },
  {
    name: "xl/styles.xml",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="18"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><sz val="11"/><color rgb="FF475569"/><name val="Calibri"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD8E1EF"/></left><right style="thin"><color rgb="FFD8E1EF"/></right><top style="thin"><color rgb="FFD8E1EF"/></top><bottom style="thin"><color rgb="FFD8E1EF"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="1" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
  },
]);

const unzipXlsxEntries = (buffer) => {
  const entries = {};
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;

  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error("Archivo Excel invalido");
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  let pointer = centralOffset;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) {
      throw new Error("Directorio de Excel invalido");
    }

    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.slice(pointer + 46, pointer + 46 + nameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);

    if (method === 0) {
      entries[name] = compressed;
    } else if (method === 8) {
      entries[name] = zlib.inflateRawSync(compressed);
    }

    pointer += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
};

const getXmlText = (entries, name) => entries[name]?.toString("utf8") || "";

const decodeXml = (value = "") =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const columnIndexFromCellRef = (ref = "") => {
  const letters = ref.replace(/\d+/g, "");
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
};

const getCellText = (cellXml, sharedStrings) => {
  const type = cellXml.match(/\st="([^"]+)"/)?.[1];
  const inline = cellXml.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/)?.[1];
  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];

  if (inline !== undefined) return decodeXml(inline).trim();
  if (type === "s" && value !== undefined) return sharedStrings[Number(value)] || "";
  return decodeXml(value || "").trim();
};

const parseSharedStrings = (xml) => {
  if (!xml) return [];
  return [...xml.matchAll(/<si[\s\S]*?<\/si>/g)].map(([item]) =>
    [...item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join("")
  );
};

const parseXlsxRows = (buffer) => {
  const entries = unzipXlsxEntries(buffer);
  const workbookRels = getXmlText(entries, "xl/_rels/workbook.xml.rels");
  const sheetTarget = workbookRels.match(/Type="[^"]+\/worksheet" Target="([^"]+)"/)?.[1] || "worksheets/sheet1.xml";
  const sheetPath = sheetTarget.startsWith("/") ? sheetTarget.slice(1) : `xl/${sheetTarget}`;
  const sheetXml = getXmlText(entries, sheetPath);
  const sharedStrings = parseSharedStrings(getXmlText(entries, "xl/sharedStrings.xml"));

  if (!sheetXml) {
    throw new Error("No se encontro la hoja de inventario");
  }

  return [...sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]
    .map(([, , rowXml]) => {
      const cells = [];
      [...rowXml.matchAll(/<c[^>]*r="([^"]+)"[^>]*>[\s\S]*?<\/c>/g)].forEach(([cellXml, ref]) => {
        cells[columnIndexFromCellRef(ref)] = getCellText(cellXml, sharedStrings);
      });
      return cells.map((value) => value || "");
    })
    .filter((row) => row.some((value) => value?.toString().trim()));
};

const canViewAllInventory = (user) =>
  hasPermission(user, "VIEW_INVENTORY_ALL");

const getInventoryQueryForUser = (user) => {
  const organization = user.organization || null;

  if (canViewAllInventory(user)) return { organization };

  if (hasPermission(user, "VIEW_INVENTORY_DEPARTMENT")) {
    const department = normalizeDepartment(user.department);
    if (!department) return null;
    return { organization, department };
  }

  if (
    hasPermission(user, "VIEW_INVENTORY_BRANCH") ||
    hasPermission(user, "CREATE_INVENTORY") ||
    hasPermission(user, "INVENTORY_UPDATE") ||
    hasPermission(user, "DISPOSE_INVENTORY")
  ) {
    const branchIds = getAssignedBranchIds(user);
    if (branchIds.length === 0) return null;
    return { organization, branch: { $in: branchIds } };
  }

  return null;
};

const canUseBranch = (user, branchId) => {
  if (canViewAllInventory(user)) return true;
  if (hasPermission(user, "VIEW_INVENTORY_DEPARTMENT")) return true;
  return getAssignedBranchIds(user).includes(branchId?.toString());
};

const canUseDepartment = (user, department) => {
  if (canViewAllInventory(user)) return true;
  if (!hasPermission(user, "VIEW_INVENTORY_DEPARTMENT")) return false;
  return normalizeDepartment(user.department) === normalizeDepartment(department);
};

const canAccessItem = (user, item) => {
  if (canViewAllInventory(user)) return true;
  if (
    hasPermission(user, "VIEW_INVENTORY_DEPARTMENT") &&
    canUseDepartment(user, item.department)
  ) {
    return true;
  }

  if (
    !(
      hasPermission(user, "VIEW_INVENTORY_BRANCH") ||
      hasPermission(user, "CREATE_INVENTORY") ||
      hasPermission(user, "INVENTORY_UPDATE") ||
      hasPermission(user, "DISPOSE_INVENTORY")
    )
  ) {
    return false;
  }

  const branchId = item.branch?._id || item.branch;
  return canUseBranch(user, branchId);
};

const getSupplierForInventory = async (user, provider) => {
  const providerValue = provider?.toString().trim();
  if (!providerValue) return { provider: "", supplier: null };

  if (!providerValue.match(/^[a-f\d]{24}$/i)) {
    return { provider: providerValue, supplier: null };
  }

  const supplier = await Supplier.findOne({
    _id: providerValue,
    organization: user.organization || null,
  });

  if (!supplier) return null;

  const supplierBranchIds = [
    supplier.branch,
    ...(Array.isArray(supplier.branches) ? supplier.branches : []),
  ].map((branch) => branch?._id?.toString() || branch?.toString()).filter(Boolean);
  const userCanUseSupplier =
    supplier.scope === ACCESS_SCOPES.ALL ||
    (supplier.scope === ACCESS_SCOPES.BRANCH && supplierBranchIds.some((branchId) => canUseBranch(user, branchId))) ||
    (supplier.scope === ACCESS_SCOPES.DEPARTMENT && canUseDepartment(user, supplier.department)) ||
    (!supplier.scope && (!supplier.branch || canUseBranch(user, supplier.branch)) && (!supplier.department || canUseDepartment(user, supplier.department)));

  if (!userCanUseSupplier) {
    return false;
  }

  return {
    provider: supplier.name,
    supplier: supplier._id,
    branch: supplier.branch,
    branches: supplier.branches || [],
    department: supplier.department,
    scope: supplier.scope || ACCESS_SCOPES.DEPARTMENT,
  };
};

const supplierMatchesInventorySelection = (supplierData, branch, department) => {
  if (!supplierData.supplier || supplierData.scope === ACCESS_SCOPES.ALL) return true;

  if (supplierData.scope === ACCESS_SCOPES.BRANCH) {
    const supplierBranchIds = [
      supplierData.branch,
      ...(Array.isArray(supplierData.branches) ? supplierData.branches : []),
    ].map((supplierBranch) => supplierBranch?._id?.toString() || supplierBranch?.toString()).filter(Boolean);

    return supplierBranchIds.includes(branch?.toString());
  }

  if (supplierData.scope === ACCESS_SCOPES.DEPARTMENT) {
    return normalizeDepartment(supplierData.department) === department;
  }

  const branchMatches = !supplierData.branch || supplierData.branch?.toString() === branch?.toString();
  const departmentMatches = !supplierData.department || normalizeDepartment(supplierData.department) === department;
  return branchMatches && departmentMatches;
};

const findBranchByName = async (user, name) => {
  const value = name?.toString().trim();
  if (!value) return null;

  const Branch = require("../models/branch");
  return Branch.findOne({
    organization: user.organization || null,
    name: new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  }).select("_id name");
};

const findDepartmentByName = async (user, name) => {
  const value = normalizeDepartment(name);
  if (!value) return null;

  const Department = require("../models/Department");
  const department = await Department.findOne({
    organization: user.organization || null,
    name: new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  }).select("name");

  return department?.name?.toLowerCase() || null;
};

const validateInventoryPayload = async (req, payload) => {
  const { model, brand, branch } = payload;
  const department = normalizeDepartment(payload.department);
  const supplierData = await getSupplierForInventory(req.user, payload.provider);

  if (supplierData === false) {
    return { error: { status: 403, msg: "No autorizado para usar este proveedor" } };
  }

  if (supplierData === null) {
    return { error: { status: 400, msg: "El proveedor seleccionado no existe" } };
  }

  if (!model?.trim() || !brand?.trim() || !branch || !department) {
    return {
      error: {
        status: 400,
        msg: "Datos incompletos",
        error: "Articulo, categoria o marca, sucursal y departamento son obligatorios",
      },
    };
  }

  if (
    supplierData.supplier &&
    !supplierMatchesInventorySelection(supplierData, branch, department)
  ) {
    return { error: { status: 400, msg: "El proveedor no pertenece a la sucursal y departamento seleccionados" } };
  }

  if (!canUseBranch(req.user, branch)) {
    return { error: { status: 403, msg: "No puedes registrar articulos para esta sucursal" } };
  }

  if (hasPermission(req.user, "VIEW_INVENTORY_DEPARTMENT") && !canUseDepartment(req.user, department)) {
    return { error: { status: 403, msg: "No puedes registrar articulos para otro departamento" } };
  }

  return { department, supplierData };
};

router.get("/", auth, async (req, res) => {
  try {
    const query = getInventoryQueryForUser(req.user);

    if (!query) {
      return res.status(403).json({ msg: "No tienes permisos para ver inventario" });
    }

    const items = await InventoryItem.find(query)
      .populate("branch", "name")
      .populate("supplier", "name address phone")
      .populate("createdBy", "nombre email")
      .populate("disposedBy", "nombre email")
      .sort({ createdAt: -1 });

    res.json(items);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener inventario", error: error.message });
  }
});

router.post("/", auth, upload.single("invoice"), handleUploadErrors, async (req, res) => {
  try {
    if (!hasPermission(req.user, "CREATE_INVENTORY")) {
      return res.status(403).json({ msg: "No tienes permisos para registrar articulos" });
    }

    const { model, brand, serialNumber, provider, responsible, branch } = req.body;
    const quantity = parsePositiveInteger(req.body.quantity, 1);
    const validation = await validateInventoryPayload(req, {
      model,
      brand,
      branch,
      department: req.body.department,
      provider,
    });

    if (validation.error) {
      return res.status(validation.error.status).json(validation.error);
    }

    const { department, supplierData } = validation;

    if (req.file && !isR2Configured()) {
      return res.status(503).json({ msg: "Cloudflare R2 no esta configurado para cargar comprobantes" });
    }

    if (req.file) {
      await assertWithinPlanLimit({
        organization: req.user.organization,
        metric: "files",
        increment: 1,
      });
      await assertStorageWithinPlanLimit({
        organization: req.user.organization,
        incrementBytes: req.file.size || 0,
      });
    }

    const item = await InventoryItem.create({
      organization: req.user.organization || null,
      model: model.trim(),
      brand: brand.trim(),
      serialNumber: getInventorySerialNumber(serialNumber),
      quantity,
      provider: supplierData?.provider || "",
      supplier: supplierData.supplier,
      responsible: responsible?.trim() || "",
      branch,
      department,
      createdBy: req.user.id,
      movements: [{
        type: "entrada",
        quantity,
        previousQuantity: 0,
        newQuantity: quantity,
        reason: "Alta inicial",
        createdBy: req.user.id,
        createdAt: new Date(),
      }],
    });

    if (req.file) {
      item.invoice = await uploadInventoryInvoice({
        inventoryId: item._id,
        file: req.file,
        uploadedBy: req.user.id,
      });
      await item.save();
    }

    const populated = await InventoryItem.findById(item._id)
      .populate("branch", "name")
      .populate("supplier", "name address phone")
      .populate("createdBy", "nombre email")
      .populate("disposedBy", "nombre email");

    res.status(201).json(populated);
  } catch (error) {
    if (error.code === "PLAN_LIMIT_EXCEEDED") {
      return res.status(error.status || 403).json({ msg: error.message });
    }

    if (error.code === 11000) {
      return res.status(400).json({ msg: "El numero de serie ya existe" });
    }

    res.status(500).json({ msg: "Error al registrar articulo", error: error.message });
  }
});

router.get("/template", auth, async (req, res) => {
  try {
    if (!hasPermission(req.user, "CREATE_INVENTORY")) {
      return res.status(403).json({ msg: "No tienes permisos para descargar la plantilla" });
    }

    const template = createInventoryTemplateXlsx();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=plantilla-inventario.xlsx");
    res.send(template);
  } catch (error) {
    res.status(500).json({ msg: "Error al generar plantilla", error: error.message });
  }
});

router.post("/import", auth, importUpload.single("file"), handleUploadErrors, async (req, res) => {
  try {
    if (!hasPermission(req.user, "CREATE_INVENTORY")) {
      return res.status(403).json({ msg: "No tienes permisos para importar inventario" });
    }

    if (!req.file) {
      return res.status(400).json({ msg: "Selecciona la plantilla de inventario" });
    }

    const isXlsx = req.file.originalname?.toLowerCase().endsWith(".xlsx") ||
      req.file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const rows = isXlsx
      ? parseXlsxRows(req.file.buffer)
      : parseCsvRows(req.file.buffer.toString("utf8").replace(/^\uFEFF/, ""));
    const headerRowIndex = rows.findIndex((row) => {
      const keys = row.map(normalizeImportKey);
      return keys.includes("articulo") && keys.includes("cantidad");
    });

    if (headerRowIndex < 0) {
      return res.status(400).json({ msg: "No se encontro la fila de encabezados de la plantilla" });
    }

    const headers = rows[headerRowIndex] || [];
    const dataRows = rows.slice(headerRowIndex + 1);
    const headerMap = headers.reduce((map, header, index) => {
      map[normalizeImportKey(header)] = index;
      return map;
    }, {});
    const getValue = (row, names) => {
      for (const name of names) {
        const index = headerMap[normalizeImportKey(name)];
        if (index !== undefined) return row[index]?.toString().trim() || "";
      }
      return "";
    };
    const errors = [];
    const created = [];

    for (let index = 0; index < dataRows.length; index += 1) {
      const row = dataRows[index];
      const rowNumber = headerRowIndex + index + 2;
      const branchName = getValue(row, ["Sucursal"]);
      const departmentName = getValue(row, ["Departamento"]);
      const branch = await findBranchByName(req.user, branchName);
      const department = await findDepartmentByName(req.user, departmentName);

      if (!branch) {
        errors.push({ row: rowNumber, msg: `Sucursal no encontrada: ${branchName || "vacia"}` });
        continue;
      }

      if (!department) {
        errors.push({ row: rowNumber, msg: `Departamento no encontrado: ${departmentName || "vacio"}` });
        continue;
      }

      const payload = {
        model: getValue(row, ["Articulo", "Artículo"]),
        brand: getValue(row, ["Categoria / marca", "Categoría / marca", "Categoria", "Marca"]),
        quantity: parsePositiveInteger(getValue(row, ["Cantidad"]), 1),
        serialNumber: getValue(row, ["Codigo / serie", "Código / serie", "Serie"]),
        provider: getValue(row, ["Proveedor"]),
        responsible: getValue(row, ["Responsable / ubicacion", "Responsable / ubicación", "Responsable"]),
        branch: branch._id,
        department,
      };
      const validation = await validateInventoryPayload(req, payload);

      if (validation.error) {
        errors.push({ row: rowNumber, msg: validation.error.error || validation.error.msg });
        continue;
      }

      try {
        const item = await InventoryItem.create({
          organization: req.user.organization || null,
          model: payload.model.trim(),
          brand: payload.brand.trim(),
          serialNumber: getInventorySerialNumber(payload.serialNumber),
          quantity: payload.quantity,
          provider: validation.supplierData?.provider || payload.provider || "",
          supplier: validation.supplierData?.supplier || null,
          responsible: payload.responsible?.trim() || "",
          branch: payload.branch,
          department: validation.department,
          createdBy: req.user.id,
          movements: [{
            type: "entrada",
            quantity: payload.quantity,
            previousQuantity: 0,
            newQuantity: payload.quantity,
            reason: "Importacion de inventario",
            createdBy: req.user.id,
            createdAt: new Date(),
          }],
        });
        created.push(item._id);
      } catch (error) {
        errors.push({
          row: rowNumber,
          msg: error.code === 11000 ? "El numero de serie ya existe" : error.message,
        });
      }
    }

    const items = await InventoryItem.find({ _id: { $in: created } })
      .populate("branch", "name")
      .populate("supplier", "name address phone")
      .populate("createdBy", "nombre email")
      .populate("disposedBy", "nombre email")
      .sort({ createdAt: -1 });

    res.status(errors.length > 0 && created.length === 0 ? 400 : 201).json({
      created: items,
      errors,
      summary: {
        created: created.length,
        errors: errors.length,
      },
    });
  } catch (error) {
    res.status(500).json({ msg: "Error al importar inventario", error: error.message });
  }
});

router.post("/:id/movements", auth, async (req, res) => {
  try {
    if (!hasPermission(req.user, "INVENTORY_UPDATE")) {
      return res.status(403).json({ msg: "No tienes permisos para mover existencias" });
    }

    const type = req.body.type === "salida" ? "salida" : "entrada";
    const quantity = parsePositiveInteger(req.body.quantity, 0);
    const reason = req.body.reason?.toString().trim() || "";

    if (quantity < 1) {
      return res.status(400).json({ msg: "La cantidad debe ser mayor a cero" });
    }

    if (!reason) {
      return res.status(400).json({ msg: "El motivo del movimiento es obligatorio" });
    }

    const item = await InventoryItem.findOne({
      _id: req.params.id,
      organization: req.user.organization || null,
    });

    if (!item) {
      return res.status(404).json({ msg: "Articulo no encontrado" });
    }

    if (!canAccessItem(req.user, item)) {
      return res.status(403).json({ msg: "No autorizado para mover este articulo" });
    }

    const previousQuantity = Number.isFinite(item.quantity) ? item.quantity : 1;
    const newQuantity = type === "entrada"
      ? previousQuantity + quantity
      : previousQuantity - quantity;

    if (newQuantity < 0) {
      return res.status(400).json({ msg: "La salida supera la cantidad disponible" });
    }

    item.quantity = newQuantity;
    item.movements.push({
      type,
      quantity,
      previousQuantity,
      newQuantity,
      reason,
      createdBy: req.user.id,
      createdAt: new Date(),
    });
    await item.save();

    const updated = await InventoryItem.findById(item._id)
      .populate("branch", "name")
      .populate("supplier", "name address phone")
      .populate("createdBy", "nombre email")
      .populate("disposedBy", "nombre email");

    res.json(updated);
  } catch (error) {
    res.status(500).json({ msg: "Error al mover existencias", error: error.message });
  }
});

router.put("/:id/invoice", auth, upload.single("invoice"), handleUploadErrors, async (req, res) => {
  try {
    if (!hasPermission(req.user, "INVENTORY_UPDATE")) {
      return res.status(403).json({ msg: "No tienes permisos para cargar comprobantes" });
    }

    if (!req.file) {
      return res.status(400).json({ msg: "El comprobante es obligatorio" });
    }

    if (!isR2Configured()) {
      return res.status(503).json({ msg: "Cloudflare R2 no esta configurado para cargar comprobantes" });
    }

    const item = await InventoryItem.findOne({
      _id: req.params.id,
      organization: req.user.organization || null,
    });

    if (!item) {
      return res.status(404).json({ msg: "Articulo no encontrado" });
    }

    if (!canAccessItem(req.user, item)) {
      return res.status(403).json({ msg: "No autorizado para cargar comprobante en este articulo" });
    }

    await assertWithinPlanLimit({
      organization: req.user.organization,
      metric: "files",
      increment: item.invoice?.key ? 0 : 1,
    });
    await assertStorageWithinPlanLimit({
      organization: req.user.organization,
      incrementBytes: Math.max(0, (req.file.size || 0) - (item.invoice?.size || 0)),
    });

    item.invoice = await uploadInventoryInvoice({
      inventoryId: item._id,
      file: req.file,
      uploadedBy: req.user.id,
    });
    await item.save();

    const updated = await InventoryItem.findById(item._id)
      .populate("branch", "name")
      .populate("supplier", "name address phone")
      .populate("createdBy", "nombre email")
      .populate("disposedBy", "nombre email");

    res.json(updated);
  } catch (error) {
    if (error.code === "PLAN_LIMIT_EXCEEDED") {
      return res.status(error.status || 403).json({ msg: error.message });
    }

    res.status(500).json({ msg: "Error al cargar comprobante", error: error.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    if (!hasPermission(req.user, "INVENTORY_UPDATE")) {
      return res.status(403).json({ msg: "No tienes permisos para actualizar articulos" });
    }

    const { model, brand, serialNumber, provider, responsible, branch } = req.body;
    const department = normalizeDepartment(req.body.department);
    const supplierData = await getSupplierForInventory(req.user, provider);

    if (supplierData === false) {
      return res.status(403).json({ msg: "No autorizado para usar este proveedor" });
    }

    if (supplierData === null) {
      return res.status(400).json({ msg: "El proveedor seleccionado no existe" });
    }

    if (!model?.trim() || !brand?.trim() || !branch || !department) {
      return res.status(400).json({
        msg: "Datos incompletos",
        error: "Articulo, categoria o marca, sucursal y departamento son obligatorios",
      });
    }

    if (
      supplierData.supplier &&
      !supplierMatchesInventorySelection(supplierData, branch, department)
    ) {
      return res.status(400).json({ msg: "El proveedor no pertenece a la sucursal y departamento seleccionados" });
    }

    const item = await InventoryItem.findOne({
      _id: req.params.id,
      organization: req.user.organization || null,
    });

    if (!item) {
      return res.status(404).json({ msg: "Articulo no encontrado" });
    }

    if (!canAccessItem(req.user, item)) {
      return res.status(403).json({ msg: "No autorizado para actualizar este articulo" });
    }

    if (!canUseBranch(req.user, branch)) {
      return res.status(403).json({ msg: "No puedes mover articulos a esta sucursal" });
    }

    if (hasPermission(req.user, "VIEW_INVENTORY_DEPARTMENT") && !canUseDepartment(req.user, department)) {
      return res.status(403).json({ msg: "No puedes mover articulos a otro departamento" });
    }

    item.model = model.trim();
    item.brand = brand.trim();
    item.serialNumber = getInventorySerialNumber(serialNumber);
    item.provider = supplierData?.provider || "";
    item.supplier = supplierData.supplier;
    item.responsible = responsible?.trim() || "";
    item.branch = branch;
    item.department = department;
    await item.save();

    const updated = await InventoryItem.findById(item._id)
      .populate("branch", "name")
      .populate("supplier", "name address phone")
      .populate("createdBy", "nombre email")
      .populate("disposedBy", "nombre email");

    res.json(updated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ msg: "El numero de serie ya existe" });
    }

    res.status(500).json({ msg: "Error al actualizar articulo", error: error.message });
  }
});

router.put("/:id/dispose", auth, async (req, res) => {
  try {
    if (!hasPermission(req.user, "DISPOSE_INVENTORY")) {
      return res.status(403).json({ msg: "No tienes permisos para dar de baja articulos" });
    }

    const reason = req.body.reason?.trim();

    if (!reason) {
      return res.status(400).json({ msg: "El motivo de baja es obligatorio" });
    }

    const item = await InventoryItem.findOne({
      _id: req.params.id,
      organization: req.user.organization || null,
    });

    if (!item) {
      return res.status(404).json({ msg: "Articulo no encontrado" });
    }

    if (!canAccessItem(req.user, item)) {
      return res.status(403).json({ msg: "No puedes dar de baja articulos de esta sucursal" });
    }

    if (item.status === "baja") {
      return res.status(400).json({ msg: "El articulo ya esta dado de baja" });
    }

    item.status = "baja";
    item.disposalReason = reason;
    item.disposedAt = new Date();
    item.disposedBy = req.user.id;
    if ((item.quantity || 0) > 0) {
      item.movements.push({
        type: "salida",
        quantity: item.quantity,
        previousQuantity: item.quantity,
        newQuantity: 0,
        reason: `Baja: ${reason}`,
        createdBy: req.user.id,
        createdAt: new Date(),
      });
      item.quantity = 0;
    }
    await item.save();

    const updated = await InventoryItem.findById(item._id)
      .populate("branch", "name")
      .populate("supplier", "name address phone")
      .populate("createdBy", "nombre email")
      .populate("disposedBy", "nombre email");

    res.json(updated);
  } catch (error) {
    res.status(500).json({ msg: "Error al dar de baja articulo", error: error.message });
  }
});

router.get("/:id/invoice", auth, async (req, res) => {
  try {
    const item = await InventoryItem.findOne({
      _id: req.params.id,
      organization: req.user.organization || null,
    });

    if (!item) {
      return res.status(404).json({ msg: "Articulo no encontrado" });
    }

    if (!canAccessItem(req.user, item)) {
      return res.status(403).json({ msg: "No autorizado para ver este comprobante" });
    }

    if (!item.invoice?.key) {
      return res.status(404).json({ msg: "Este articulo no tiene comprobante cargado" });
    }

    const url = await getInventoryInvoiceUrl({ key: item.invoice.key });

    res.json({
      url,
      expiresIn: 300,
      fileName: item.invoice.originalName,
    });
  } catch (error) {
    res.status(500).json({ msg: "Error al generar enlace de comprobante", error: error.message });
  }
});

module.exports = router;
