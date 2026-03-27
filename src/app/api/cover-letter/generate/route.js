import { generateCoverLetter } from "@/lib/gemini";
import { getUserApiKey, recordTokenUsage } from "@/lib/tokenUtils";
import { NextResponse } from "next/server";

// POST - Generate a cover letter body using AI
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

    const { masterCV, jobDescription, company, position, wordCount } =
      await request.json();

    if (!masterCV) {
      return NextResponse.json(
        { error: "Master CV is required" },
        { status: 400 },
      );
    }

    if (!jobDescription || jobDescription.trim().length === 0) {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 },
      );
    }

    const { data: content, tokenUsage } = await generateCoverLetter(
      masterCV,
      jobDescription,
      company,
      position,
      wordCount ?? 250,
      apiKey,
    );

    await recordTokenUsage(userId, "cover-letter", tokenUsage);

    return NextResponse.json({
      message: "Cover letter generated successfully",
      content,
      tokenUsage,
    });
  } catch (error) {
    console.error("Error generating cover letter:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate cover letter" },
      { status: 500 },
    );
  }
}
