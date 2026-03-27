import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { decryptApiKey, encryptApiKey, maskApiKey } from "@/lib/apiKeyUtils";
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
      "name email settings geminiApiKey tokenUsage",
    );
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Mask the API key for display
    let maskedApiKey = "";
    if (user.geminiApiKey) {
      const plain = decryptApiKey(user.geminiApiKey);
      maskedApiKey = maskApiKey(plain);
    }

    return NextResponse.json({
      name: user.name,
      email: user.email,
      settings: user.settings || {},
      hasApiKey: !!user.geminiApiKey,
      maskedApiKey,
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
      geminiApiKey,
    } = body;

    const update = {};
    if (displayName !== undefined) update["settings.displayName"] = displayName;
    if (phone !== undefined) update["settings.phone"] = phone;
    if (coverLetterEmail !== undefined)
      update["settings.coverLetterEmail"] = coverLetterEmail;
    if (coverLetterWordCount !== undefined)
      update["settings.coverLetterWordCount"] = Number(coverLetterWordCount);
    if (geminiApiKey !== undefined) {
      update.geminiApiKey = geminiApiKey ? encryptApiKey(geminiApiKey) : "";
    }

    const user = await User.findByIdAndUpdate(
      String(session.user.id),
      { $set: update },
      { new: true, runValidators: false },
    ).select("name email settings geminiApiKey tokenUsage");

    let maskedApiKey = "";
    if (user.geminiApiKey) {
      const plain = decryptApiKey(user.geminiApiKey);
      maskedApiKey = maskApiKey(plain);
    }

    return NextResponse.json({
      message: "Settings saved",
      name: user.name,
      email: user.email,
      settings: user.settings || {},
      hasApiKey: !!user.geminiApiKey,
      maskedApiKey,
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
