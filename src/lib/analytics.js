import posthog, { isPostHogReady } from "@/lib/posthogClient";

export const ANALYTICS_EVENTS = Object.freeze({
  SIGNUP_COMPLETED: "signup_completed",
  LOGIN_COMPLETED: "login_completed",

  CV_PARSE_STARTED: "cv_parse_started",
  CV_PARSE_COMPLETED: "cv_parse_completed",
  CV_PARSE_FAILED: "cv_parse_failed",
  MASTER_CV_SAVED: "master_cv_saved",

  TAILOR_STARTED: "tailor_started",
  TAILOR_COMPLETED: "tailor_completed",
  TAILOR_FAILED: "tailor_failed",

  COVER_LETTER_GENERATED: "cover_letter_generated",
  COVER_LETTER_GENERATE_FAILED: "cover_letter_generate_failed",

  PDF_COMPILE_STARTED: "pdf_compile_started",
  PDF_COMPILE_SUCCEEDED: "pdf_compile_succeeded",
  PDF_COMPILE_FAILED: "pdf_compile_failed",

  RESUME_DOWNLOADED: "resume_downloaded",
  COVER_LETTER_DOWNLOADED: "cover_letter_downloaded",

  APPLICATION_GROUP_CREATED: "application_group_created",
});

// Never pass raw CV text, job description text, or LaTeX source as
// properties here — only lengths/booleans/error messages.
export function trackEvent(name, properties) {
  if (typeof window === "undefined" || !isPostHogReady()) return;
  posthog.capture(name, properties);
}
