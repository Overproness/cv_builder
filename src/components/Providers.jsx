"use client";

import { Suspense } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionProvider } from "next-auth/react";
import { PostHogProvider } from "@/components/PostHogProvider";
import { PostHogPageView } from "@/components/PostHogPageView";
import { AnalyticsIdentify } from "@/components/AnalyticsIdentify";

export function Providers({ children }) {
  return (
    <PostHogProvider>
      <ThemeProvider>
        <SessionProvider refetchOnWindowFocus={false}>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <AnalyticsIdentify />
          {children}
        </SessionProvider>
      </ThemeProvider>
    </PostHogProvider>
  );
}
