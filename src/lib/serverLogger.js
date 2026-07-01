import { auth } from "@/auth";
import { captureServerEvent } from "@/lib/posthogServer";
import { after } from "next/server";

// Drop-in alongside existing console.error call sites: preserves today's
// logging exactly, and additionally emits a queryable `server_error` event
// via after() so PostHog live/error views have real data. Only wired into
// the highest-value AI-generation/compile routes for now — rolling this out
// to every console.error site in the app is an intentional fast-follow, not
// day-one work.
export function logServerError(context, error, { event = "server_error", userId, ...extra } = {}) {
  console.error(context, error);

  after(async () => {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      try {
        const session = await auth();
        resolvedUserId = session?.user?.id;
      } catch {
        // ignore — analytics must never affect the request
      }
    }
    await captureServerEvent(resolvedUserId, event, {
      context,
      message: error?.message,
      ...extra,
    });
  });
}
