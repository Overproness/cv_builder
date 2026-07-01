import posthog from "posthog-js";

let initialized = false;

// Session replay masks every input by default (covers the login password
// field and the CV/job-description textareas, the only genuinely sensitive
// inputs in this app) and only samples a fraction of sessions to bound the
// recorder's overhead.
export function initPostHog() {
  if (initialized || typeof window === "undefined") return posthog;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return posthog;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // captured manually, see PostHogPageView.jsx
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: true,
      sampleRate: 0.25,
    },
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.debug();
    },
  });

  initialized = true;
  return posthog;
}

export function isPostHogReady() {
  return initialized;
}

export default posthog;
