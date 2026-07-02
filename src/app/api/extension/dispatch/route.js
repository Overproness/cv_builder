import dbConnect from "@/lib/dbConnect";
import { extensionAuthErrorStatus, getExtensionUser } from "@/lib/extensionAuth";
import {
  processExtensionJob,
  processFakeExtensionJob,
} from "@/lib/extensionJobProcessor";
import { getUserApiKeyById } from "@/lib/tokenUtils";
import CV from "@/models/CV";
import ExtensionJob from "@/models/ExtensionJob";
import User from "@/models/User";
import { after, NextResponse } from "next/server";

const MAX_JOB_DESCRIPTION_LENGTH = 20000;
const MIN_JOB_DESCRIPTION_LENGTH = 50;
// Mirrors the free-tier constant the web /tailor page paces itself against
// (src/app/tailor/page.js) — enforced server-side here since the extension
// has no equivalent client-side pacing UI.
const FREE_TIER_RPM = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const DETECTION_METHODS = [
  "linkedin",
  "indeed",
  "greenhouse",
  "lever",
  "workday",
  "generic_heuristic",
  "manual_paste",
];

export async function POST(request) {
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    masterCVId,
    jobDescription: rawJobDescription,
    company = "",
    position = "",
    sourceUrl = "",
    detectionMethod,
    wantCoverLetter = false,
  } = body;

  if (!DETECTION_METHODS.includes(detectionMethod)) {
    return NextResponse.json(
      { error: "Invalid or missing detectionMethod" },
      { status: 400 },
    );
  }

  const jobDescription = (rawJobDescription || "").trim().slice(0, MAX_JOB_DESCRIPTION_LENGTH);
  if (jobDescription.length < MIN_JOB_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      {
        error: "Job description is too short — please provide the full posting.",
        code: "JOB_DESCRIPTION_TOO_SHORT",
      },
      { status: 400 },
    );
  }

  // Resolve the Master CV to tailor from.
  let cv;
  if (masterCVId) {
    cv = await CV.findOne({ _id: masterCVId, userId });
    if (!cv) {
      return NextResponse.json(
        { error: "Master CV not found", code: "CV_NOT_FOUND" },
        { status: 404 },
      );
    }
  } else {
    cv = await CV.findOne({ userId }, {}, { sort: { updatedAt: -1 } });
    if (!cv) {
      return NextResponse.json(
        {
          error: "You need to create a Master CV first.",
          code: "NO_MASTER_CV",
          deepLink: "/cv",
        },
        { status: 422 },
      );
    }
  }

  // Fail fast if the user has no usable API key/proxy configured, before
  // spending a job slot on a guaranteed failure.
  try {
    await getUserApiKeyById(userId);
  } catch (e) {
    if (e.message === "API_KEY_MISSING") {
      return NextResponse.json(
        {
          error: "Add your Gemini API key in Settings before generating.",
          code: "API_KEY_MISSING",
          deepLink: "/settings",
        },
        { status: 422 },
      );
    }
    throw e;
  }

  // Server-side rate limit, keyed off the same settings the web /tailor
  // page already respects (User.settings.rateLimitTier/customRateLimit).
  const user = await User.findById(userId)
    .select("settings.rateLimitTier settings.customRateLimit")
    .lean();
  const rpm =
    user?.settings?.rateLimitTier === "custom"
      ? Number(user.settings.customRateLimit) || FREE_TIER_RPM
      : FREE_TIER_RPM;

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentJobCount = await ExtensionJob.countDocuments({
    userId,
    createdAt: { $gt: windowStart },
  });
  if (recentJobCount >= rpm) {
    return NextResponse.json(
      {
        error: "You're generating resumes too quickly — please wait a moment.",
        code: "RATE_LIMITED",
        retryAfterMs: RATE_LIMIT_WINDOW_MS,
      },
      { status: 429 },
    );
  }

  const job = await ExtensionJob.create({
    userId,
    status: "queued",
    kind: wantCoverLetter ? "resume_and_cover_letter" : "resume_only",
    masterCVId: cv._id,
    masterCVSnapshot: cv.toObject ? cv.toObject() : cv,
    jobDescription,
    company,
    position,
    sourceUrl,
    detectionMethod,
    wantCoverLetter: Boolean(wantCoverLetter),
    initiatedAt: new Date(),
  });

  // Dev-only fast path so the extension's full dispatch/poll/badge/download
  // UI can be exercised in seconds without spending Gemini quota. Hard-gated
  // to non-production regardless of what the client sends.
  const { searchParams } = new URL(request.url);
  const useFakeMode =
    process.env.NODE_ENV !== "production" && searchParams.get("fake") === "true";

  after(() =>
    useFakeMode
      ? processFakeExtensionJob(job._id)
      : processExtensionJob(job._id),
  );

  return NextResponse.json(
    { jobId: String(job._id), status: job.status, initiatedAt: job.initiatedAt },
    { status: 202 },
  );
}
