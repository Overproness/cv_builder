import { parseRawTextToCV } from "@/lib/gemini";
import { getUserApiKey, recordTokenUsage } from "@/lib/tokenUtils";
import { NextResponse } from "next/server";

// POST - Parse raw text using Gemini AI
export async function POST(request) {
  try {
    let apiKey, userId;
    try {
      ({ apiKey, userId } = await getUserApiKey());
    } catch (e) {
      if (e.message === "UNAUTHORIZED")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (e.message === "API_KEY_MISSING")
        return NextResponse.json(
          { error: "Please add your Gemini API key in Settings before generating." },
          { status: 403 },
        );
      throw e;
    }

    const { rawText } = await request.json();

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: "Raw text is required" },
        { status: 400 },
      );
    }

    const { data: parsedCV, tokenUsage } = await parseRawTextToCV(rawText, apiKey);

    await recordTokenUsage(userId, "parse", tokenUsage);

    return NextResponse.json({
      message: "CV parsed successfully",
      cv: parsedCV,
      tokenUsage,
    });
  } catch (error) {
    console.error("Error parsing CV:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse CV" },
      { status: 500 },
    );
  }
}
