const crypto = require("crypto");

const getKey = () => {
  const secret = process.env.MAIL_SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("MAIL_SETTINGS_ENCRYPTION_KEY o JWT_SECRET requerido para cifrar secretos");
  }

  return crypto.createHash("sha256").update(secret).digest();
};

const encryptSecret = (value) => {
  if (!value) return "";

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
};

const decryptSecret = (value) => {
  if (!value) return "";

  const [iv, tag, encrypted] = value.split(".");

  if (!iv || !tag || !encrypted) return "";

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

module.exports = {
  decryptSecret,
  encryptSecret,
};
