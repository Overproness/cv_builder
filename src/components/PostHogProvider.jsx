"use client";

import { useEffect } from "react";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import posthog, { initPostHog } from "@/lib/posthogClient";

export function PostHogProvider({ children }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
