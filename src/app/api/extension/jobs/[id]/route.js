import dbConnect from "@/lib/dbConnect";
import { extensionAuthErrorStatus, getExtensionUser } from "@/lib/extensionAuth";
import ExtensionJob from "@/models/ExtensionJob";
import { NextResponse } from "next/server";

// GET - Poll a single job's status. Excludes the heavy payload fields
// (pdfData, masterCVSnapshot, tailoredCV) — polling only needs progress.
export async function GET(request, { params }) {
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

  const { id } = await params;
  const job = await ExtensionJob.findOne({ _id: id, userId })
    .select("-pdfData -masterCVSnapshot -tailoredCV")
    .lean();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: String(job._id),
    status: job.status,
    progressMessage: job.progressMessage,
    kind: job.kind,
    company: job.company,
    position: job.position,
    wantCoverLetter: job.wantCoverLetter,
    initiatedAt: job.initiatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    error: job.error,
    errorStage: job.errorStage,
    resumeId: job.resumeId,
    coverLetterId: job.coverLetterId,
    applicationGroupId: job.applicationGroupId,
    pdfSizeBytes: job.pdfSizeBytes,
  });
}
