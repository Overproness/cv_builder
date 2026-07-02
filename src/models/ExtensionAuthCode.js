import mongoose from "mongoose";

// Short-lived, single-use authorization codes for the Chrome extension's
// OAuth-style browser handoff (chrome.identity.launchWebAuthFlow). Codes are
// stored in plaintext (unlike ExtensionToken's hashed refresh tokens) because
// they're single-use, 60-second-lived, unguessable random nonces — a
// fundamentally different risk profile than a durable credential.
const ExtensionAuthCodeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    redirectUri: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// TTL cleanup only — the token exchange route always re-validates
// expiresAt/used itself, so this index is not the enforcement mechanism.
ExtensionAuthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.ExtensionAuthCode ||
  mongoose.model(
    "ExtensionAuthCode",
    ExtensionAuthCodeSchema,
    "extension_auth_codes",
  );
