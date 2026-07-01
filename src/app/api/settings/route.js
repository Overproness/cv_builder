import { auth } from "@/auth";
import { encryptEnvelope, maskApiKey } from "@/lib/apiKeyUtils";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { NextResponse } from "next/server";

const UNAUTHORIZED_RESPONSE = NextResponse.json(
  { error: "Unauthorized" },
  { status: 401 },
);

// GET - Fetch current user's profile settings
export async function GET() {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED_RESPONSE;

    const user = await User.findById(String(session.user.id)).select(
      "name email settings apiKeyMode keyLast4 encryptedApiKey geminiApiKey proxyUrl tokenUsage",
    );
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const hasKey =
      !!(user.encryptedApiKey || user.geminiApiKey);
    const hasProxy = !!(user.proxyUrl && user.encryptedProxySecret);

    return NextResponse.json({
      name: user.name,
      email: user.email,
      settings: user.settings || {},
      apiKeyMode: user.apiKeyMode || "managed",
      hasApiKey: hasKey,
      keyLast4: user.keyLast4 || "",
      hasProxy,
      proxyUrl: user.proxyUrl || "",
      tokenUsage: user.tokenUsage || {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        requests: [],
      },
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

// PATCH - Update user's profile settings
export async function PATCH(request) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED_RESPONSE;

    const body = await request.json();
    const {
      displayName,
      phone,
      coverLetterEmail,
      coverLetterWordCount,
      rateLimitTier,
      customRateLimit,
      // API key fields
      apiKeyMode,
      geminiApiKey,   // plaintext key for managed mode
      proxyUrl,
      proxySecret,    // plaintext proxy secret
    } = body;

    const update = {};

    if (displayName !== undefined) update["settings.displayName"] = displayName;
    if (phone !== undefined) update["settings.phone"] = phone;
    if (coverLetterEmail !== undefined)
      update["settings.coverLetterEmail"] = coverLetterEmail;
    if (coverLetterWordCount !== undefined)
      update["settings.coverLetterWordCount"] = Number(coverLetterWordCount);
    if (rateLimitTier !== undefined)
      update["settings.rateLimitTier"] = rateLimitTier;
    if (customRateLimit !== undefined)
      update["settings.customRateLimit"] = Math.max(
        1,
        Math.min(3600, Number(customRateLimit)),
      );

    // Mode switch: clear the other mode's data
    if (apiKeyMode !== undefined) {
      update.apiKeyMode = apiKeyMode;
      if (apiKeyMode === "managed") {
        update.proxyUrl = "";
        update.encryptedProxySecret = "";
        update.encryptedProxySecretDek = "";
      } else if (apiKeyMode === "proxy") {
        update.encryptedApiKey = "";
        update.encryptedDek = "";
        update.keyLast4 = "";
        update.geminiApiKey = "";
      }
    }

    // Managed key: encrypt with envelope
    if (geminiApiKey !== undefined) {
      if (geminiApiKey) {
        const { encryptedApiKey, encryptedDek, keyLast4 } =
          encryptEnvelope(geminiApiKey);
        update.encryptedApiKey = encryptedApiKey;
        update.encryptedDek = encryptedDek;
        update.keyLast4 = keyLast4;
        update.geminiApiKey = ""; // clear any legacy value
      } else {
        // Removing the key
        update.encryptedApiKey = "";
        update.encryptedDek = "";
        update.keyLast4 = "";
        update.geminiApiKey = "";
      }
    }

    // Proxy fields
    if (proxyUrl !== undefined) {
      update.proxyUrl = proxyUrl;
    }
    if (proxySecret !== undefined) {
      if (proxySecret) {
        const { encryptedApiKey, encryptedDek } = encryptEnvelope(proxySecret);
        update.encryptedProxySecret = encryptedApiKey;
        update.encryptedProxySecretDek = encryptedDek;
      } else {
        update.encryptedProxySecret = "";
        update.encryptedProxySecretDek = "";
      }
    }

    const user = await User.findByIdAndUpdate(
      String(session.user.id),
      { $set: update },
      { new: true, runValidators: false },
    ).select(
      "name email settings apiKeyMode keyLast4 encryptedApiKey geminiApiKey proxyUrl tokenUsage",
    );

    const hasKey = !!(user.encryptedApiKey || user.geminiApiKey);
    const hasProxy = !!(user.proxyUrl && user.encryptedProxySecret);

    return NextResponse.json({
      message: "Settings saved",
      name: user.name,
      email: user.email,
      settings: user.settings || {},
      apiKeyMode: user.apiKeyMode || "managed",
      hasApiKey: hasKey,
      keyLast4: user.keyLast4 || "",
      hasProxy,
      proxyUrl: user.proxyUrl || "",
      tokenUsage: user.tokenUsage || {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        requests: [],
      },
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
