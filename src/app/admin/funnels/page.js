import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// v1: embed a PostHog shareable insight iframe rather than re-implementing
// funnel math. In PostHog: Insights -> build a funnel from signup_completed
// -> master_cv_saved -> tailor_started -> tailor_completed ->
// pdf_compile_succeeded -> Share -> "Embed in your app" -> paste the URL
// below. Fast-follow: swap to a native render via PostHog's Query API once
// the important funnels are validated.
const FUNNEL_EMBED_URL = process.env.NEXT_PUBLIC_POSTHOG_FUNNEL_EMBED_URL || "";

export default function AdminFunnelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Funnels</h1>
        <p className="text-muted-foreground text-sm">
          Where people drop off across the core resume-building flow.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signup → Master CV saved → Tailor → PDF compiled</CardTitle>
        </CardHeader>
        <CardContent>
          {FUNNEL_EMBED_URL ? (
            <iframe
              src={FUNNEL_EMBED_URL}
              className="w-full h-[600px] rounded-lg border border-border"
              title="PostHog funnel"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No funnel embedded yet. In PostHog, build a funnel from the events{" "}
              <code>signup_completed → master_cv_saved → tailor_started →
              tailor_completed → pdf_compile_succeeded</code>, then use
              &quot;Share&quot; → &quot;Embed in your app&quot; and set
              NEXT_PUBLIC_POSTHOG_FUNNEL_EMBED_URL to that URL, or view it
              directly in PostHog for now.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
