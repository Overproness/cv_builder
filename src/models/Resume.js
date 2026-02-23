import mongoose from "mongoose";

const ResumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    masterCVId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CV",
      default: null,
    },
    title: {
      type: String,
      default: "Untitled Resume",
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
    latex: {
      type: String,
      default: "",
    },
    tailoredCV: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.models.Resume ||
  mongoose.model("Resume", ResumeSchema, "resumes");
