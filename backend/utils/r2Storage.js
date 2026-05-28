const { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");
const path = require("path");

const isR2Configured = () =>
  Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );

const getR2Endpoint = () => {
  const accountId = process.env.R2_ACCOUNT_ID.trim();
  return `https://${accountId}.r2.cloudflarestorage.com`;
};

const getR2Client = () => {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 no esta configurado");
  }

  return new S3Client({
    region: "auto",
    endpoint: getR2Endpoint(),
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
    },
  });
};

const sanitizeFileName = (fileName) =>
  path
    .basename(fileName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

const buildObjectKey = ({ incidentId, originalName }) => {
  const extension = path.extname(originalName || "").toLowerCase();
  const safeName = sanitizeFileName(originalName || `archivo${extension}`);
  const random = crypto.randomBytes(8).toString("hex");

  return `incidents/${incidentId}/${Date.now()}-${random}-${safeName}`;
};

const buildInventoryObjectKey = ({ inventoryId, originalName }) => {
  const extension = path.extname(originalName || "").toLowerCase();
  const safeName = sanitizeFileName(originalName || `factura${extension}`);
  const random = crypto.randomBytes(8).toString("hex");

  return `inventory/${inventoryId}/${Date.now()}-${random}-${safeName}`;
};

const uploadIncidentFile = async ({ incidentId, file, uploadedBy }) => {
  const key = buildObjectKey({ incidentId, originalName: file.originalname });

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME.trim(),
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: sanitizeFileName(file.originalname),
        uploadedBy: String(uploadedBy || ""),
      },
    })
  );

  return {
    key,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    uploadedBy,
    uploadedAt: new Date(),
  };
};

const getIncidentFileUrl = ({ key, expiresIn = 300 }) =>
  getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME.trim(),
      Key: key,
    }),
    { expiresIn }
  );

const uploadInventoryInvoice = async ({ inventoryId, file, uploadedBy }) => {
  const key = buildInventoryObjectKey({ inventoryId, originalName: file.originalname });

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME.trim(),
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: sanitizeFileName(file.originalname),
        uploadedBy: String(uploadedBy || ""),
      },
    })
  );

  return {
    key,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    uploadedBy,
    uploadedAt: new Date(),
  };
};

const getInventoryInvoiceUrl = ({ key, expiresIn = 300 }) =>
  getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME.trim(),
      Key: key,
    }),
    { expiresIn }
  );

const deleteIncidentFile = ({ key }) =>
  getR2Client().send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME.trim(),
      Key: key,
    })
  );

module.exports = {
  deleteIncidentFile,
  getInventoryInvoiceUrl,
  getIncidentFileUrl,
  isR2Configured,
  uploadIncidentFile,
  uploadInventoryInvoice,
};
