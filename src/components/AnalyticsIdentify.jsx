"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import posthog from "@/lib/posthogClient";

// Merges pre-login anonymous activity into the real user the moment a
// session appears, and resets to a fresh anonymous identity on sign-out
// (important on shared devices).
export function AnalyticsIdentify() {
  const { data: session, status } = useSession();
  const identifiedRef = useRef(false);

  useEffect(() => {
    const userId = session?.user?.id;

    if (status === "authenticated" && userId && !identifiedRef.current) {
      posthog.identify(userId, {
        email: session.user.email,
        name: session.user.name,
      });
      identifiedRef.current = true;
    }

    if (status === "unauthenticated" && identifiedRef.current) {
      posthog.reset();
      identifiedRef.current = false;
    }
  }, [status, session?.user?.id, session?.user?.email, session?.user?.name]);

  return null;
}
