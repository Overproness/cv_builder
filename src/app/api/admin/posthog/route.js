import { requireAdmin } from "@/lib/adminAuth";
import { queryPostHogEventCounts } from "@/lib/posthogQuery";
import { NextResponse } from "next/server";

// Proxies PostHog event-count queries server-side — POSTHOG_PERSONAL_API_KEY
// must never reach the browser.
export async function GET(request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const events = (searchParams.get("events") || "").split(",").filter(Boolean);
  const sinceDays = Number(searchParams.get("sinceDays")) || 7;

  const counts = await queryPostHogEventCounts(events, sinceDays);
  return NextResponse.json({ counts });
}
