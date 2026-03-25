import { answerApplicationQuestions } from "@/lib/gemini";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
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

    const answers = await answerApplicationQuestions(
      masterCV,
      jobDescription || "",
      questions,
      companyInfo || "",
    );

    return NextResponse.json({
      message: "Questions answered successfully",
      answers,
    });
  } catch (error) {
    console.error("Error answering questions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to answer questions" },
      { status: 500 },
    );
  }
}
