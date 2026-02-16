import { addToExistingCV } from "@/lib/gemini";
import { NextResponse } from "next/server";

// POST - Add new experience or projects to existing CV
export async function POST(request) {
  try {
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
    const updatedCV = await addToExistingCV(
      existingCV,
      newContent,
      contentType,
    );

    return NextResponse.json({
      message: "Content added to CV successfully",
      updatedCV,
    });
  } catch (error) {
    console.error("Error adding content to CV:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add content to CV" },
      { status: 500 },
    );
  }
}
