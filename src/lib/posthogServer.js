import { PostHog } from "posthog-node";

// Cached across hot-reloads in dev, same pattern as dbConnect.js's
// mongoose connection cache.
let client = global._posthogServerClient;

if (!client && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  client = global._posthogServerClient = new PostHog(
    process.env.NEXT_PUBLIC_POSTHOG_KEY,
    {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    },
  );
}

// Must only ever be called from inside next/server's `after()`, i.e. after
// the response has already been sent — never awaited on the request's
// critical path. Vercel can freeze/tear down the function immediately after
// the response is flushed, so we explicitly flush this single event before
// returning rather than relying on posthog-node's internal batching.
export async function captureServerEvent(distinctId, event, properties) {
  if (!client) return;
  try {
    client.capture({ distinctId: distinctId || "anonymous", event, properties });
    await client.flush();
  } catch (err) {
    console.error("PostHog server capture failed:", err);
  }
}
