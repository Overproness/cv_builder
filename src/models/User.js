import mongoose from "mongoose";

const TokenRequestSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    type: { type: String }, // 'tailor', 'cover-letter', 'parse', 'add', 'questions'
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
  },
  { _id: false },
);

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
      maxlength: [60, "Name cannot be more than 60 characters"],
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
    },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // API key mode: "managed" = envelope-encrypted key stored here,
    //               "proxy"   = user's self-hosted proxy holds the real key
    apiKeyMode: { type: String, enum: ["managed", "proxy"], default: "managed" },

    // Managed mode — envelope encryption (per-user DEK + MASTER_KEY)
    encryptedApiKey: { type: String, default: "" },
    encryptedDek: { type: String, default: "" },
    keyLast4: { type: String, default: "" },

    // Proxy mode — encrypted proxy secret + URL
    proxyUrl: { type: String, default: "" },
    encryptedProxySecret: { type: String, default: "" },
    encryptedProxySecretDek: { type: String, default: "" },

    // Legacy: single-key AES encrypted with NEXTAUTH_SECRET derivative.
    // Kept for zero-downtime migration; lazily re-encrypted on first use.
    geminiApiKey: { type: String, default: "" },
    // Cover letter / profile settings
    settings: {
      displayName: { type: String, default: "" },
      phone: { type: String, default: "" },
      coverLetterEmail: { type: String, default: "" },
      coverLetterWordCount: { type: Number, default: 250 },
      // Rate limiting: 'free' = free tier (15 RPM), 'custom' = user-defined RPM
      rateLimitTier: {
        type: String,
        enum: ["free", "custom"],
        default: "free",
      },
      customRateLimit: { type: Number, default: 15, min: 1, max: 3600 },
    },
    // Token usage tracking
    tokenUsage: {
      totalInputTokens: { type: Number, default: 0 },
      totalOutputTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
      totalCost: { type: Number, default: 0 },
      requests: { type: [TokenRequestSchema], default: [] },
    },
  },
  { timestamps: true },
);

// In dev, clear cached model so schema changes (like new fields) are picked up
if (process.env.NODE_ENV !== "production" && mongoose.models.User) {
  delete mongoose.models.User;
}

export default mongoose.models.User || mongoose.model("User", UserSchema);
