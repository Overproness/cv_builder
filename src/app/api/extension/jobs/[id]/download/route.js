import dbConnect from "@/lib/dbConnect";
import { extensionAuthErrorStatus, getExtensionUser } from "@/lib/extensionAuth";
import ExtensionJob from "@/models/ExtensionJob";
import { NextResponse } from "next/server";

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// GET ?type=pdf|coverletter - Fetch the finished output for a completed job.
// type=pdf streams the compiled PDF bytes (same response shape as the
// existing /api/resume/pdf). type=coverletter returns the plain-text
// content as JSON — there is no cover-letter PDF in v1, matching the fact
// that the web app itself never generates one either.
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
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "pdf";

  const job = await ExtensionJob.findOne({
    _id: id,
    userId,
    status: "complete",
  });

  if (!job) {
    return NextResponse.json(
      { error: "Job not found or not yet complete" },
      { status: 404 },
    );
  }

  if (type === "coverletter") {
    return NextResponse.json({ content: job.coverLetterContent || "" });
  }

  if (!job.pdfData) {
    return NextResponse.json({ error: "PDF not available for this job" }, { status: 404 });
  }

  const filename =
    [slugify(job.company), slugify(job.position), "resume"]
      .filter(Boolean)
      .join("-") || "resume";

  return new NextResponse(job.pdfData, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
    },
  });
}
