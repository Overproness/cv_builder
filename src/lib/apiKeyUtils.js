import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getMasterKey() {
  const hex = process.env.MASTER_KEY || "";
  if (!hex || hex.length !== 64) {
    throw new Error("MASTER_KEY must be a 64-character hex string (32 bytes). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  }
  return Buffer.from(hex, "hex");
}

function aesGcmEncrypt(plainBuffer, keyBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function aesGcmDecrypt(encryptedString, keyBuffer) {
  const [ivHex, tagHex, dataHex] = encryptedString.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

// ---------------------------------------------------------------------------
// Envelope encryption: per-user DEK encrypted by MASTER_KEY
// ---------------------------------------------------------------------------

export function encryptEnvelope(plainKey) {
  if (!plainKey) return { encryptedApiKey: "", encryptedDek: "", keyLast4: "" };
  const masterKey = getMasterKey();
  const dek = crypto.randomBytes(32);
  const encryptedApiKey = aesGcmEncrypt(Buffer.from(plainKey, "utf8"), dek);
  const encryptedDek = aesGcmEncrypt(dek, masterKey);
  const keyLast4 = plainKey.slice(-4);
  return { encryptedApiKey, encryptedDek, keyLast4 };
}

export function decryptEnvelope(encryptedApiKey, encryptedDek) {
  if (!encryptedApiKey || !encryptedDek) return "";
  const masterKey = getMasterKey();
  const dek = aesGcmDecrypt(encryptedDek, masterKey);
  return aesGcmDecrypt(encryptedApiKey, dek).toString("utf8");
}

// ---------------------------------------------------------------------------
// Legacy path — kept only for zero-downtime migration of existing rows
// Uses SHA256(NEXTAUTH_SECRET) as key (the old scheme)
// ---------------------------------------------------------------------------

function getLegacyKey() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
  return crypto.createHash("sha256").update(secret).digest();
}

export function decryptLegacyApiKey(encryptedKey) {
  if (!encryptedKey || !encryptedKey.includes(":")) return "";
  const key = getLegacyKey();
  const [ivHex, tagHex, encrypted] = encryptedKey.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function maskApiKey(plainKey) {
  if (!plainKey || plainKey.length < 8) return "****";
  return plainKey.slice(0, 4) + "****" + plainKey.slice(-4);
}
