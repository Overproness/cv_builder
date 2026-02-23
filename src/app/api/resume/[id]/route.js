import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Resume from "@/models/Resume";
import { NextResponse } from "next/server";

const UNAUTHORIZED = NextResponse.json(
  { error: "Unauthorized" },
  { status: 401 },
);

// GET - Fetch a single saved resume
export async function GET(request, { params }) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);
    const { id } = await params;

    const resume = await Resume.findOne({ _id: id, userId }).lean();
    if (!resume)
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });

    return NextResponse.json(resume);
  } catch (error) {
    console.error("Error fetching resume:", error);
    return NextResponse.json(
      { error: "Failed to fetch resume" },
      { status: 500 },
    );
  }
}

// PATCH - Update latex/title of saved resume
export async function PATCH(request, { params }) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);
    const { id } = await params;

    const body = await request.json();
    const { latex, title } = body;

    const updated = await Resume.findOneAndUpdate(
      { _id: id, userId },
      {
        ...(latex !== undefined && { latex }),
        ...(title !== undefined && { title }),
      },
      { new: true },
    );

    if (!updated)
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    return NextResponse.json({ message: "Resume updated" });
  } catch (error) {
    console.error("Error updating resume:", error);
    return NextResponse.json(
      { error: "Failed to update resume" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a saved resume
export async function DELETE(request, { params }) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);
    const { id } = await params;

    const result = await Resume.findOneAndDelete({ _id: id, userId });
    if (!result)
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });

    return NextResponse.json({ message: "Resume deleted" });
  } catch (error) {
    console.error("Error deleting resume:", error);
    return NextResponse.json(
      { error: "Failed to delete resume" },
      { status: 500 },
    );
  }
}
