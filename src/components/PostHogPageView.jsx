"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

// App Router has no built-in route-change event, so pageviews are captured
// manually on pathname/search-param change instead of via capture_pageview.
export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (!pathname || !posthog) return;

    let url = window.origin + pathname;
    const search = searchParams?.toString();
    if (search) url += `?${search}`;

    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, posthog]);

  return null;
}
