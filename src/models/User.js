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
    // Encrypted Gemini API key (user brings their own)
    geminiApiKey: { type: String, default: "" },
    // Cover letter / profile settings
    settings: {
      displayName: { type: String, default: "" },
      phone: { type: String, default: "" },
      coverLetterEmail: { type: String, default: "" },
      coverLetterWordCount: { type: Number, default: 250 },
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
