import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptApiKey(plainKey) {
  if (!plainKey) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

export function decryptApiKey(encryptedKey) {
  if (!encryptedKey || !encryptedKey.includes(":")) return "";
  const key = getEncryptionKey();
  const [ivHex, tagHex, encrypted] = encryptedKey.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function maskApiKey(plainKey) {
  if (!plainKey || plainKey.length < 8) return "****";
  return plainKey.slice(0, 4) + "****" + plainKey.slice(-4);
}
