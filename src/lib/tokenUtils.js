import { auth } from "@/auth";
import { decryptApiKey } from "@/lib/apiKeyUtils";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

/**
 * Get the authenticated user's decrypted Gemini API key.
 * Returns { apiKey, userId } or throws.
 */
export async function getUserApiKey() {
  await dbConnect();
  const session = await auth();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  const userId = String(session.user.id);
  const user = await User.findById(userId).select("geminiApiKey").lean();
  if (!user) throw new Error("USER_NOT_FOUND");
  if (!user.geminiApiKey) {
    throw new Error("API_KEY_MISSING");
  }
  const apiKey = decryptApiKey(user.geminiApiKey);
  if (!apiKey) throw new Error("API_KEY_MISSING");
  return { apiKey, userId };
}

/**
 * Record token usage for a user after an AI call.
 */
export async function recordTokenUsage(userId, type, tokenUsage) {
  if (!tokenUsage || !userId) return;
  await dbConnect();
  await User.findByIdAndUpdate(userId, {
    $inc: {
      "tokenUsage.totalInputTokens": tokenUsage.inputTokens,
      "tokenUsage.totalOutputTokens": tokenUsage.outputTokens,
      "tokenUsage.totalTokens": tokenUsage.totalTokens,
      "tokenUsage.totalCost": tokenUsage.cost,
    },
    $push: {
      "tokenUsage.requests": {
        $each: [
          {
            timestamp: new Date(),
            type,
            inputTokens: tokenUsage.inputTokens,
            outputTokens: tokenUsage.outputTokens,
            totalTokens: tokenUsage.totalTokens,
            cost: tokenUsage.cost,
          },
        ],
        $slice: -100, // keep last 100 requests
      },
    },
  });
}
