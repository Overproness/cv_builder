import { tailorCVForJob } from "@/lib/gemini";
import { generateLatex } from "@/lib/latex";
import { estimatePageUsage } from "@/lib/layoutEstimation";
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
          {
            error:
              "Please add your Gemini API key in Settings before generating.",
          },
          { status: 403 },
        );
      throw e;
    }

    const { masterCV, jobDescription, position } = await request.json();

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

    // Tailor the CV for the job (includes validation loops for page fit & heading width)
    const { data: tailoredCV, tokenUsage } = await tailorCVForJob(
      masterCV,
      jobDescription,
      apiKey,
      position || "",
    );

    // Record token usage
    await recordTokenUsage(userId, "tailor", tokenUsage);

    // tailorCVForJob validates the final content against the one-page estimator.
    // Do not trim selected entries here: doing so made otherwise-valid resumes
    // noticeably sparse after the AI had filled the page.
    const latex = generateLatex(tailoredCV);

    // Estimate page usage for the frontend
    const pageEstimate = estimatePageUsage(tailoredCV);

    return NextResponse.json({
      message: "Resume tailored successfully",
      tailoredCV,
      latex,
      tokenUsage,
      pageEstimate,
    });
  } catch (error) {
    console.error("Error tailoring resume:", error);
    return NextResponse.json(
      { error: error.message || "Failed to tailor resume" },
      { status: 500 },
    );
  }
}
