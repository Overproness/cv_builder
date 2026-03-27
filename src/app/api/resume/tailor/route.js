import { tailorCVForJob } from "@/lib/gemini";
import { generateLatex } from "@/lib/latex";
import { getUserApiKey, recordTokenUsage } from "@/lib/tokenUtils";
import { NextResponse } from "next/server";

// POST - Generate tailored resume from Master CV + Job Description
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

    const { masterCV, jobDescription } = await request.json();

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

    // Tailor the CV for the job
    const { data: tailoredCV, tokenUsage } = await tailorCVForJob(masterCV, jobDescription, apiKey);

    // Record token usage
    await recordTokenUsage(userId, "tailor", tokenUsage);

    // Enforce strict 1-page limits on the tailored CV before generating LaTeX
    // Cap experience to 3 entries with max 3 bullet points each
    if (tailoredCV.experience) {
      tailoredCV.experience = tailoredCV.experience.slice(0, 3).map((exp) => ({
        ...exp,
        points: (exp.points || []).slice(0, 3),
      }));
    }
    // Cap projects to 3 entries with max 3 bullet points each
    if (tailoredCV.projects) {
      tailoredCV.projects = tailoredCV.projects.slice(0, 3).map((proj) => ({
        ...proj,
        points: (proj.points || []).slice(0, 3),
      }));
    }
    // Cap education to 2 entries
    if (tailoredCV.education) {
      tailoredCV.education = tailoredCV.education.slice(0, 2);
    }

    // Generate LaTeX from the tailored CV
    const latex = generateLatex(tailoredCV);

    return NextResponse.json({
      message: "Resume tailored successfully",
      tailoredCV,
      latex,
      tokenUsage,
    });
  } catch (error) {
    console.error("Error tailoring resume:", error);
    return NextResponse.json(
      { error: error.message || "Failed to tailor resume" },
      { status: 500 },
    );
  }
}
