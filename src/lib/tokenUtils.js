import { auth } from "@/auth";
import {
  decryptEnvelope,
  decryptLegacyApiKey,
  encryptEnvelope,
} from "@/lib/apiKeyUtils";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

/**
 * Returns the authenticated user's AI credentials.
 *
 * For managed mode: returns { apiKey: "<plaintext>", userId }
 * For proxy mode:   returns { apiKey: { isProxy: true, proxyUrl, proxySecret }, userId }
 *
 * Throws "UNAUTHORIZED", "USER_NOT_FOUND", or "API_KEY_MISSING".
 */
export async function getUserApiKey() {
  await dbConnect();
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const userId = String(session.user.id);
  const user = await User.findById(userId)
    .select(
      "apiKeyMode encryptedApiKey encryptedDek geminiApiKey proxyUrl encryptedProxySecret encryptedProxySecretDek"
    )
    .lean();

  if (!user) throw new Error("USER_NOT_FOUND");

  if (user.apiKeyMode === "proxy") {
    if (!user.proxyUrl || !user.encryptedProxySecret || !user.encryptedProxySecretDek) {
      throw new Error("API_KEY_MISSING");
    }
    const proxySecret = decryptEnvelope(
      user.encryptedProxySecret,
      user.encryptedProxySecretDek
    );
    if (!proxySecret) throw new Error("API_KEY_MISSING");
    return { apiKey: { isProxy: true, proxyUrl: user.proxyUrl, proxySecret }, userId };
  }

  // Managed mode — new envelope path
  if (user.encryptedDek) {
    const apiKey = decryptEnvelope(user.encryptedApiKey, user.encryptedDek);
    if (!apiKey) throw new Error("API_KEY_MISSING");
    return { apiKey, userId };
  }

  // Legacy path: decrypt with old scheme, then lazily re-encrypt with envelope
  if (user.geminiApiKey) {
    const apiKey = decryptLegacyApiKey(user.geminiApiKey);
    if (!apiKey) throw new Error("API_KEY_MISSING");
    // Fire-and-forget re-encryption — don't block the request
    reEncryptLegacyKey(userId, apiKey).catch(() => {});
    return { apiKey, userId };
  }

  throw new Error("API_KEY_MISSING");
}

/**
 * Silently upgrades a user's legacy-encrypted key to envelope encryption.
 * Clears the old geminiApiKey field once the new fields are saved.
 */
async function reEncryptLegacyKey(userId, plainKey) {
  const { encryptedApiKey, encryptedDek, keyLast4 } = encryptEnvelope(plainKey);
  await User.findByIdAndUpdate(userId, {
    $set: { encryptedApiKey, encryptedDek, keyLast4, geminiApiKey: "" },
  });
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
        $slice: -100,
      },
    },
  });
}
