import mongoose from "mongoose";

// Async job-tracking table for extension-originated resume/cover-letter
// generation. Created at dispatch time and processed in the background via
// next/server's after() (see src/lib/extensionJobProcessor.js) so the
// extension gets an immediate response and polls this record for progress.
const ExtensionJobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "compiling", "complete", "failed"],
      default: "queued",
      index: true,
    },
    kind: {
      type: String,
      enum: ["resume_only", "resume_and_cover_letter"],
      required: true,
    },

    // Input snapshot — captured at dispatch time so the job is self-contained
    // and reproducible even if the user edits their Master CV afterward.
    masterCVId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CV",
      required: true,
    },
    masterCVSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    jobDescription: { type: String, required: true },
    company: { type: String, default: "" },
    position: { type: String, default: "" },
    sourceUrl: { type: String, default: "" },
    detectionMethod: {
      type: String,
      enum: [
        "linkedin",
        "indeed",
        "greenhouse",
        "lever",
        "workday",
        "generic_heuristic",
        "manual_paste",
      ],
      required: true,
    },
    wantCoverLetter: { type: Boolean, default: false },

    // Progress + timing
    initiatedAt: { type: Date, default: Date.now, required: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    progressMessage: { type: String, default: "" },

    // Results — populated on success
    tailoredCV: { type: mongoose.Schema.Types.Mixed, default: null },
    latex: { type: String, default: null },
    pageEstimate: { type: mongoose.Schema.Types.Mixed, default: null },
    coverLetterContent: { type: String, default: null },
    // Compiled PDF bytes, stored directly on this doc — see plan for why
    // this lives here rather than on Resume/GridFS/S3. Always excluded via
    // .select('-pdfData') on list/status queries.
    pdfData: { type: Buffer, default: null },
    pdfSizeBytes: { type: Number, default: null },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      default: null,
    },
    coverLetterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoverLetter",
      default: null,
    },
    applicationGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApplicationGroup",
      default: null,
    },

    // Failure info
    error: { type: String, default: null },
    errorStage: {
      type: String,
      enum: ["tailor", "cover_letter", "latex_compile", "unknown", null],
      default: null,
    },
    tokenUsage: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

ExtensionJobSchema.index({ userId: 1, createdAt: -1 });
ExtensionJobSchema.index({ status: 1, createdAt: 1 });
ExtensionJobSchema.index({ userId: 1, status: 1 });

export default mongoose.models.ExtensionJob ||
  mongoose.model("ExtensionJob", ExtensionJobSchema, "extension_jobs");
