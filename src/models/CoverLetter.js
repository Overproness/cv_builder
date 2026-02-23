import mongoose from "mongoose";

const CoverLetterSchema = new mongoose.Schema(
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
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      default: null,
    },
    title: {
      type: String,
      default: "Untitled Cover Letter",
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
    content: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

export default mongoose.models.CoverLetter ||
  mongoose.model("CoverLetter", CoverLetterSchema, "cover_letters");
