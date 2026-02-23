import { generateCoverLetter } from "@/lib/gemini";
import { NextResponse } from "next/server";

// POST - Generate a cover letter body using AI
export async function POST(request) {
  try {
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

    const content = await generateCoverLetter(
      masterCV,
      jobDescription,
      company,
      position,
      wordCount ?? 250,
    );

    return NextResponse.json({
      message: "Cover letter generated successfully",
      content,
    });
  } catch (error) {
    console.error("Error generating cover letter:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate cover letter" },
      { status: 500 },
    );
  }
}
