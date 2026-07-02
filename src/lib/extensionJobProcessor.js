import dbConnect from "@/lib/dbConnect";
import { generateCoverLetter, tailorCVForJob } from "@/lib/gemini";
import { generateLatex } from "@/lib/latex";
import { compileLatexToPdf } from "@/lib/latexCompileClient";
import { estimatePageUsage } from "@/lib/layoutEstimation";
import { logServerError } from "@/lib/serverLogger";
import { getUserApiKeyById, recordTokenUsage } from "@/lib/tokenUtils";
import ApplicationGroup from "@/models/ApplicationGroup";
import CoverLetter from "@/models/CoverLetter";
import ExtensionJob from "@/models/ExtensionJob";
import Resume from "@/models/Resume";
import User from "@/models/User";

function sumTokenUsages(usages) {
  const totals = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 };
  for (const usage of usages) {
    if (!usage) continue;
    totals.inputTokens += usage.inputTokens || 0;
    totals.outputTokens += usage.outputTokens || 0;
    totals.totalTokens += usage.totalTokens || 0;
    totals.cost += usage.cost || 0;
  }
  return totals;
}

function userSafeErrorMessage(stage) {
  switch (stage) {
    case "tailor":
      return "We couldn't generate your resume — the AI service returned an error. Please try again.";
    case "cover_letter":
      return "We couldn't generate your cover letter — the AI service returned an error. Please try again.";
    case "latex_compile":
      return "Your resume content was generated but PDF formatting failed. Please try again.";
    default:
      return "Something went wrong while generating your documents. Please try again.";
  }
}

/**
 * Auto-creates Resume / CoverLetter / ApplicationGroup records and writes
 * the final result onto the job doc, mirroring the exact field shapes
 * POST /api/resume and /api/cover-letter already accept — so extension
 * output shows up in the existing /documents page with no new UI there.
 * Shared by both the real and fake (dev-only) job pipelines below.
 */
async function persistJobResults(
  job,
  { tailoredCV, latex, pageEstimate, coverLetterContent, pdfBuffer, tokenUsage },
) {
  const title =
    job.position && job.company
      ? `${job.position} at ${job.company}`
      : job.position || job.company || "Tailored Resume";

  const resume = await Resume.create({
    userId: job.userId,
    masterCVId: job.masterCVId,
    title,
    company: job.company || "",
    position: job.position || "",
    jobDescription: job.jobDescription,
    latex,
    tailoredCV,
  });

  let coverLetter = null;
  if (job.wantCoverLetter && coverLetterContent) {
    coverLetter = await CoverLetter.create({
      userId: job.userId,
      masterCVId: job.masterCVId,
      resumeId: resume._id,
      title,
      company: job.company || "",
      position: job.position || "",
      jobDescription: job.jobDescription,
      content: coverLetterContent,
    });
  }

  const group = await ApplicationGroup.create({
    userId: job.userId,
    title,
    company: job.company || "",
    position: job.position || "",
    jobDescription: job.jobDescription,
    resumeId: resume._id,
    coverLetterId: coverLetter?._id || null,
  });

  await Resume.updateOne(
    { _id: resume._id },
    { $set: { applicationGroupId: group._id } },
  );
  if (coverLetter) {
    await CoverLetter.updateOne(
      { _id: coverLetter._id },
      { $set: { applicationGroupId: group._id } },
    );
  }

  job.status = "complete";
  job.completedAt = new Date();
  job.tailoredCV = tailoredCV;
  job.latex = latex;
  job.pageEstimate = pageEstimate;
  job.coverLetterContent = coverLetterContent;
  job.pdfData = pdfBuffer;
  job.pdfSizeBytes = pdfBuffer.length;
  job.resumeId = resume._id;
  job.coverLetterId = coverLetter?._id || null;
  job.applicationGroupId = group._id;
  job.tokenUsage = tokenUsage;
  job.progressMessage = "Done";
  await job.save();
}

/**
 * Runs the full extension generation pipeline for one ExtensionJob: tailor
 * -> (optional cover letter) -> compile -> auto-save -> mark complete. Not a
 * route handler — invoked from inside next/server's after() by
 * POST /api/extension/dispatch so the client gets an immediate response
 * while this keeps running.
 *
 * v1 simplification: if cover-letter generation fails after tailoring
 * succeeded, the whole job is marked failed rather than partially complete
 * — the product framing is a single "resume+cover-letter combo" deliverable.
 */
export async function processExtensionJob(jobId) {
  await dbConnect();
  const job = await ExtensionJob.findById(jobId);
  if (!job) return;

  let stage = "tailor";
  try {
    job.status = "processing";
    job.startedAt = new Date();
    job.progressMessage = "Tailoring resume...";
    await job.save();

    const { apiKey } = await getUserApiKeyById(String(job.userId));

    const { data: tailoredCV, tokenUsage: tailorUsage } =
      await tailorCVForJob(
        job.masterCVSnapshot,
        job.jobDescription,
        apiKey,
        job.position || "",
      );

    const latex = generateLatex(tailoredCV);
    const pageEstimate = estimatePageUsage(tailoredCV);

    let coverLetterContent = null;
    let coverLetterUsage = null;
    if (job.wantCoverLetter) {
      stage = "cover_letter";
      job.progressMessage = "Generating cover letter...";
      await job.save();

      const user = await User.findById(job.userId)
        .select("settings.coverLetterWordCount")
        .lean();
      const wordCount = user?.settings?.coverLetterWordCount || 250;

      const { data, tokenUsage } = await generateCoverLetter(
        job.masterCVSnapshot,
        job.jobDescription,
        job.company || "",
        job.position || "",
        wordCount,
        apiKey,
      );
      coverLetterContent = data;
      coverLetterUsage = tokenUsage;
    }

    stage = "latex_compile";
    job.status = "compiling";
    job.progressMessage = "Compiling PDF...";
    await job.save();

    const pdfBuffer = await compileLatexToPdf(latex);

    // Everything past this point is bookkeeping, not generation — reclassify
    // so a DB hiccup here doesn't get mislabeled as a compile failure.
    stage = "unknown";

    const totalTokenUsage = sumTokenUsages([tailorUsage, coverLetterUsage]);
    await recordTokenUsage(job.userId, "extension-tailor", totalTokenUsage);

    await persistJobResults(job, {
      tailoredCV,
      latex,
      pageEstimate,
      coverLetterContent,
      pdfBuffer,
      tokenUsage: totalTokenUsage,
    });
  } catch (error) {
    logServerError("Extension job failed:", error, {
      event: "extension_job_failed",
      userId: String(job.userId),
      jobId: String(job._id),
    });
    job.status = "failed";
    job.completedAt = new Date();
    job.error = userSafeErrorMessage(stage);
    job.errorStage = stage;
    await job.save();
  }
}

// ---------------------------------------------------------------------------
// Dev-only fake pipeline — lets the extension's full dispatch/poll/badge/
// download UI be exercised in a couple of seconds without spending Gemini
// quota or waiting on the real ~10-25s pipeline. Wired up behind
// POST /api/extension/dispatch?fake=true, which itself is hard-gated to
// non-production. Guarded here too as defense in depth.
// ---------------------------------------------------------------------------

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Builds a small, byte-accurate, valid one-page PDF with no external deps. */
function buildFixturePdfBuffer(label) {
  const text = `Sample Tailored Resume - Fake Mode (${label})`.slice(0, 90);
  const contentStream = `BT /F1 18 Tf 72 720 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

export async function processFakeExtensionJob(jobId) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Fake extension job mode is not available in production.");
  }

  await dbConnect();
  const job = await ExtensionJob.findById(jobId);
  if (!job) return;

  try {
    job.status = "processing";
    job.startedAt = new Date();
    job.progressMessage = "Tailoring resume... (fake mode)";
    await job.save();
    await delay(800);

    // No AI call in fake mode — pass the master CV straight through so
    // generateLatex()/estimatePageUsage() still run against real shapes.
    const tailoredCV = job.masterCVSnapshot;
    const latex = generateLatex(tailoredCV);
    const pageEstimate = estimatePageUsage(tailoredCV);

    let coverLetterContent = null;
    if (job.wantCoverLetter) {
      job.progressMessage = "Generating cover letter... (fake mode)";
      await job.save();
      await delay(400);
      coverLetterContent = `Dear Hiring Manager,\n\nThis is a fixture cover letter generated in fake mode for the "${job.position || "Untitled"}" role at "${job.company || "Untitled"}". No AI call was made.\n\nSincerely,\nFake Mode`;
    }

    job.status = "compiling";
    job.progressMessage = "Compiling PDF... (fake mode)";
    await job.save();
    await delay(400);

    const pdfBuffer = buildFixturePdfBuffer(job.position || job.company || "Job");

    await persistJobResults(job, {
      tailoredCV,
      latex,
      pageEstimate,
      coverLetterContent,
      pdfBuffer,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
    });
  } catch (error) {
    logServerError("Fake extension job failed:", error, {
      event: "extension_job_failed",
      userId: String(job.userId),
      jobId: String(job._id),
    });
    job.status = "failed";
    job.completedAt = new Date();
    job.error = "Fake mode job failed unexpectedly.";
    job.errorStage = "unknown";
    await job.save();
  }
}
