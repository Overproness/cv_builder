// Server-only. Queries PostHog's HogQL Query API using the personal API key
// (read access) — this key must never reach the browser, only used here.
// Returns null on any failure (missing config, network error, bad response)
// so admin pages can render gracefully before PostHog is fully set up.
export async function queryPostHogEventCounts(eventNames, sinceDays = 7) {
  const { POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID } = process.env;
  if (!POSTHOG_PERSONAL_API_KEY || !POSTHOG_PROJECT_ID || eventNames.length === 0) {
    return null;
  }

  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  const eventList = eventNames.map((e) => `'${e}'`).join(",");

  try {
    const res = await fetch(`${host}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: `SELECT event, count() AS count FROM events WHERE event IN (${eventList}) AND timestamp > now() - INTERVAL ${Number(sinceDays)} DAY GROUP BY event`,
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = await res.json();

    const counts = {};
    for (const row of data.results || []) {
      counts[row[0]] = row[1];
    }
    return counts;
  } catch (err) {
    console.error("PostHog query failed:", err);
    return null;
  }
}
