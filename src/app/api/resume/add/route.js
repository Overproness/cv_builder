import { addToExistingCV } from "@/lib/gemini";
import { getUserApiKey, recordTokenUsage } from "@/lib/tokenUtils";
import { NextResponse } from "next/server";

// POST - Add new experience or projects to existing CV
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
          {
            error:
              "Please add your Gemini API key in Settings before generating.",
          },
          { status: 403 },
        );
      throw e;
    }

    const {
      existingCV,
      newContent,
      contentType = "auto",
    } = await request.json();

    if (!existingCV) {
      return NextResponse.json(
        { error: "Existing CV is required" },
        { status: 400 },
      );
    }

    if (!newContent || newContent.trim().length === 0) {
      return NextResponse.json(
        { error: "New content to add is required" },
        { status: 400 },
      );
    }

    // Add the new content to the existing CV
    const { data: updatedCV, tokenUsage } = await addToExistingCV(
      existingCV,
      newContent,
      contentType,
      apiKey,
    );

    await recordTokenUsage(userId, "add", tokenUsage);

    return NextResponse.json({
      message: "Content added to CV successfully",
      updatedCV,
      tokenUsage,
    });
  } catch (error) {
    console.error("Error adding content to CV:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add content to CV" },
      { status: 500 },
    );
  }
}
