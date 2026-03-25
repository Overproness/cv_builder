import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import ApplicationGroup from "@/models/ApplicationGroup";
import CoverLetter from "@/models/CoverLetter";
import Resume from "@/models/Resume";
import { NextResponse } from "next/server";

const UNAUTHORIZED = NextResponse.json(
  { error: "Unauthorized" },
  { status: 401 },
);

// GET - List all application groups (with optional search)
export async function GET(request) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();

    let query = { userId };

    if (search) {
      const regex = new RegExp(search, "i");
      query = {
        userId,
        $or: [
          { title: regex },
          { company: regex },
          { position: regex },
          { jobDescription: regex },
          { companyInfo: regex },
          { "questions.question": regex },
          { "questions.answer": regex },
        ],
      };
    }

    const groups = await ApplicationGroup.find(query)
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json(groups);
  } catch (error) {
    console.error("Error fetching application groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch application groups" },
      { status: 500 },
    );
  }
}

// POST - Create a new application group (and update linked docs)
export async function POST(request) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);

    const body = await request.json();
    const {
      title,
      company,
      position,
      jobDescription,
      companyInfo,
      questions,
      resumeId,
      coverLetterId,
    } = body;

    const group = await ApplicationGroup.create({
      userId,
      title:
        title ||
        (company && position
          ? `${position} at ${company}`
          : "Application"),
      company: company || "",
      position: position || "",
      jobDescription: jobDescription || "",
      companyInfo: companyInfo || "",
      questions: questions || [],
      resumeId: resumeId || null,
      coverLetterId: coverLetterId || null,
    });

    // Update linked documents with the group reference
    const groupId = group._id;
    if (resumeId) {
      await Resume.findOneAndUpdate(
        { _id: resumeId, userId },
        { applicationGroupId: groupId },
      );
    }
    if (coverLetterId) {
      await CoverLetter.findOneAndUpdate(
        { _id: coverLetterId, userId },
        { applicationGroupId: groupId },
      );
    }

    return NextResponse.json({
      message: "Application group saved",
      id: groupId.toString(),
    });
  } catch (error) {
    console.error("Error saving application group:", error);
    return NextResponse.json(
      { error: "Failed to save application group" },
      { status: 500 },
    );
  }
}
