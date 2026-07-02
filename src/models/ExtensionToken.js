import mongoose from "mongoose";

// Refresh-token records for the Chrome extension, one per logged-in
// device/browser-profile pairing. Access tokens are stateless JWTs and are
// never stored server-side — this collection is only the persisted half of
// the token pair. Implements standard rotate-on-use refresh tokens with
// reuse (theft) detection via familyId.
const ExtensionTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // SHA-256 hex digest of the opaque refresh token. Only the hash is ever
    // stored, mirroring the "never store recoverable secrets" posture of
    // src/lib/apiKeyUtils.js, though this is one-way (no decryption needed).
    refreshTokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    // Stable across every rotation of this token; lets a reused
    // already-rotated token trigger revocation of the whole family.
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    rotatedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    deviceLabel: { type: String, default: "" },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: {
      type: String,
      enum: ["user_revoked", "rotation_reuse_detected", "expired", null],
      default: null,
    },
  },
  { timestamps: true },
);

ExtensionTokenSchema.index({ userId: 1, revokedAt: 1 });
// Generous GC-only TTL, well past normal expiry — not relied on for
// security, since revokedAt/expiresAt are checked explicitly in code.
ExtensionTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
);

export default mongoose.models.ExtensionToken ||
  mongoose.model("ExtensionToken", ExtensionTokenSchema, "extension_tokens");
