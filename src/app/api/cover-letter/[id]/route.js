import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import CoverLetter from "@/models/CoverLetter";
import { NextResponse } from "next/server";

const UNAUTHORIZED = NextResponse.json(
  { error: "Unauthorized" },
  { status: 401 },
);

// GET - Fetch a single cover letter
export async function GET(request, { params }) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);
    const { id } = await params;

    const coverLetter = await CoverLetter.findOne({ _id: id, userId }).lean();
    if (!coverLetter)
      return NextResponse.json(
        { error: "Cover letter not found" },
        { status: 404 },
      );

    return NextResponse.json(coverLetter);
  } catch (error) {
    console.error("Error fetching cover letter:", error);
    return NextResponse.json(
      { error: "Failed to fetch cover letter" },
      { status: 500 },
    );
  }
}

// PATCH - Update content/title of a cover letter
export async function PATCH(request, { params }) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);
    const { id } = await params;

    const body = await request.json();
    const { content, title } = body;

    const updated = await CoverLetter.findOneAndUpdate(
      { _id: id, userId },
      {
        ...(content !== undefined && { content }),
        ...(title !== undefined && { title }),
      },
      { new: true },
    );

    if (!updated)
      return NextResponse.json(
        { error: "Cover letter not found" },
        { status: 404 },
      );
    return NextResponse.json({ message: "Cover letter updated" });
  } catch (error) {
    console.error("Error updating cover letter:", error);
    return NextResponse.json(
      { error: "Failed to update cover letter" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a cover letter
export async function DELETE(request, { params }) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);
    const { id } = await params;

    const result = await CoverLetter.findOneAndDelete({ _id: id, userId });
    if (!result)
      return NextResponse.json(
        { error: "Cover letter not found" },
        { status: 404 },
      );

    return NextResponse.json({ message: "Cover letter deleted" });
  } catch (error) {
    console.error("Error deleting cover letter:", error);
    return NextResponse.json(
      { error: "Failed to delete cover letter" },
      { status: 500 },
    );
  }
}
