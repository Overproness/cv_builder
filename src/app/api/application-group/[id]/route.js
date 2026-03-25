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

// GET - Fetch a single application group with its linked documents
export async function GET(request, { params }) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);
    const { id } = await params;

    const group = await ApplicationGroup.findOne({ _id: id, userId }).lean();
    if (!group)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Fetch linked documents
    let resume = null;
    let coverLetter = null;

    if (group.resumeId) {
      resume = await Resume.findOne({
        _id: group.resumeId,
        userId,
      }).lean();
    }
    if (group.coverLetterId) {
      coverLetter = await CoverLetter.findOne({
        _id: group.coverLetterId,
        userId,
      }).lean();
    }

    return NextResponse.json({ ...group, resume, coverLetter });
  } catch (error) {
    console.error("Error fetching application group:", error);
    return NextResponse.json(
      { error: "Failed to fetch application group" },
      { status: 500 },
    );
  }
}

// DELETE - Delete application group (and optionally linked docs)
export async function DELETE(request, { params }) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);
    const { id } = await params;

    const group = await ApplicationGroup.findOne({ _id: id, userId });
    if (!group)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Remove group references from linked documents
    if (group.resumeId) {
      await Resume.findOneAndUpdate(
        { _id: group.resumeId, userId },
        { applicationGroupId: null },
      );
    }
    if (group.coverLetterId) {
      await CoverLetter.findOneAndUpdate(
        { _id: group.coverLetterId, userId },
        { applicationGroupId: null },
      );
    }

    await ApplicationGroup.findOneAndDelete({ _id: id, userId });

    return NextResponse.json({ message: "Application group deleted" });
  } catch (error) {
    console.error("Error deleting application group:", error);
    return NextResponse.json(
      { error: "Failed to delete application group" },
      { status: 500 },
    );
  }
}
