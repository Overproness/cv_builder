import dbConnect from "@/lib/dbConnect";
import { extensionAuthErrorStatus, getExtensionUser } from "@/lib/extensionAuth";
import ExtensionJob from "@/models/ExtensionJob";
import { NextResponse } from "next/server";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// GET - Job history for the extension's popup, newest first. Powers the
// "time generation was initiated" display via each job's initiatedAt.
// Keyset (createdAt-descending) pagination rather than skip/limit, since
// this collection can grow large per user over time.
export async function GET(request) {
  await dbConnect();

  let userId;
  try {
    ({ userId } = await getExtensionUser(request));
  } catch (e) {
    return NextResponse.json(
      { error: "Unauthorized", code: e.message },
      { status: extensionAuthErrorStatus(e) },
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT),
  );
  const cursor = searchParams.get("cursor");

  const query = { userId };
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      query.createdAt = { $lt: cursorDate };
    }
  }

  const jobs = await ExtensionJob.find(query)
    .select("-pdfData -masterCVSnapshot -tailoredCV -latex -coverLetterContent")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const nextCursor =
    jobs.length === limit ? jobs[jobs.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: String(j._id),
      status: j.status,
      kind: j.kind,
      company: j.company,
      position: j.position,
      wantCoverLetter: j.wantCoverLetter,
      detectionMethod: j.detectionMethod,
      initiatedAt: j.initiatedAt,
      completedAt: j.completedAt,
      error: j.error,
      errorStage: j.errorStage,
      pdfSizeBytes: j.pdfSizeBytes,
      resumeId: j.resumeId,
      coverLetterId: j.coverLetterId,
      applicationGroupId: j.applicationGroupId,
    })),
    nextCursor,
  });
}
