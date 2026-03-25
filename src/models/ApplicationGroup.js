import mongoose from "mongoose";

const ApplicationGroupSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "Untitled Application",
    },
    company: {
      type: String,
      default: "",
    },
    position: {
      type: String,
      default: "",
    },
    jobDescription: {
      type: String,
      default: "",
    },
    companyInfo: {
      type: String,
      default: "",
    },
    // Questions asked by the employer and AI-generated answers
    questions: [
      {
        question: { type: String, default: "" },
        answer: { type: String, default: "" },
      },
    ],
    // References to linked documents
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
  },
  { timestamps: true },
);

export default mongoose.models.ApplicationGroup ||
  mongoose.model(
    "ApplicationGroup",
    ApplicationGroupSchema,
    "application_groups",
  );
