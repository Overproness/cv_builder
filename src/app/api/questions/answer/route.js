import { answerApplicationQuestions } from "@/lib/gemini";
import { getUserApiKey, recordTokenUsage } from "@/lib/tokenUtils";
import { NextResponse } from "next/server";

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

    const { masterCV, jobDescription, questions, companyInfo } =
      await request.json();

    if (!masterCV) {
      return NextResponse.json(
        { error: "Master CV is required" },
        { status: 400 },
      );
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "At least one question is required" },
        { status: 400 },
      );
    }

    const { data: answers, tokenUsage } = await answerApplicationQuestions(
      masterCV,
      jobDescription || "",
      questions,
      companyInfo || "",
      apiKey,
    );

    await recordTokenUsage(userId, "questions", tokenUsage);

    return NextResponse.json({
      message: "Questions answered successfully",
      answers,
      tokenUsage,
    });
  } catch (error) {
    console.error("Error answering questions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to answer questions" },
      { status: 500 },
    );
  }
}
