import { editCVWithAI } from "@/lib/gemini";
import { getUserApiKey, recordTokenUsage } from "@/lib/tokenUtils";
import { NextResponse } from "next/server";

// POST - Edit a Master CV using an AI prompt
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

    const { existingCV, editPrompt } = await request.json();

    if (!existingCV) {
      return NextResponse.json(
        { error: "Existing CV is required" },
        { status: 400 },
      );
    }

    if (!editPrompt || editPrompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Edit prompt is required" },
        { status: 400 },
      );
    }

    const { data: updatedCV, tokenUsage } = await editCVWithAI(
      existingCV,
      editPrompt,
      apiKey,
    );

    await recordTokenUsage(userId, "cv-edit", tokenUsage);

    return NextResponse.json({
      message: "CV updated successfully",
      updatedCV,
      tokenUsage,
    });
  } catch (error) {
    console.error("Error editing CV with AI:", error);
    return NextResponse.json(
      { error: error.message || "Failed to edit CV" },
      { status: 500 },
    );
  }
}
