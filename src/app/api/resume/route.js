import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Resume from "@/models/Resume";
import { NextResponse } from "next/server";

const UNAUTHORIZED = NextResponse.json(
  { error: "Unauthorized" },
  { status: 401 },
);

// GET - List all saved resumes for the user
export async function GET(request) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);

    const resumes = await Resume.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json(resumes);
  } catch (error) {
    console.error("Error fetching resumes:", error);
    return NextResponse.json(
      { error: "Failed to fetch resumes" },
      { status: 500 },
    );
  }
}

// POST - Save a new tailored resume
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
      latex,
      tailoredCV,
      masterCVId,
    } = body;

    if (!latex) {
      return NextResponse.json(
        { error: "LaTeX content is required" },
        { status: 400 },
      );
    }

    const resume = await Resume.create({
      userId,
      masterCVId: masterCVId || null,
      title:
        title ||
        (company && position ? `${position} at ${company}` : "Tailored Resume"),
      company: company || "",
      position: position || "",
      jobDescription: jobDescription || "",
      latex,
      tailoredCV: tailoredCV || null,
    });

    return NextResponse.json({
      message: "Resume saved",
      id: resume._id.toString(),
    });
  } catch (error) {
    console.error("Error saving resume:", error);
    return NextResponse.json(
      { error: "Failed to save resume" },
      { status: 500 },
    );
  }
}
