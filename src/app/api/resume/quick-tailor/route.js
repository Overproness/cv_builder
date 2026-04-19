import { quickTailorKeywords } from "@/lib/gemini";
import { generateLatex } from "@/lib/latex";
import { getUserApiKey, recordTokenUsage } from "@/lib/tokenUtils";
import { NextResponse } from "next/server";

// POST - Quick-tailor a primary resume by only updating keywords/skills
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

    const { tailoredCV, jobDescription, position } = await request.json();

    if (!tailoredCV) {
      return NextResponse.json(
        { error: "Existing tailored CV is required" },
        { status: 400 },
      );
    }

    if (!jobDescription || jobDescription.trim().length === 0) {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 },
      );
    }

    const { data: updatedCV, tokenUsage } = await quickTailorKeywords(
      tailoredCV,
      jobDescription,
      apiKey,
      position,
    );

    await recordTokenUsage(userId, "quick-tailor", tokenUsage);

    const latex = generateLatex(updatedCV);

    return NextResponse.json({
      message: "Keywords updated successfully",
      tailoredCV: updatedCV,
      latex,
      tokenUsage,
    });
  } catch (error) {
    console.error("Error quick-tailoring resume:", error);
    return NextResponse.json(
      { error: error.message || "Failed to quick-tailor resume" },
      { status: 500 },
    );
  }
}
