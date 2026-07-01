import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { queryPostHogEventCounts } from "@/lib/posthogQuery";

const FAILURE_EVENTS = [
  "server_error",
  "pdf_compile_failed",
  "tailor_failed",
  "cover_letter_generate_failed",
  "cv_parse_failed",
  "cv_edit_failed",
];

export default async function AdminHealthPage() {
  const counts = await queryPostHogEventCounts(FAILURE_EVENTS, 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">System health</h1>
        <p className="text-muted-foreground text-sm">
          Failures captured server-side over the last 24 hours. Reload the page for the latest data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Failure counts (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          {counts ? (
            <table className="w-full text-sm">
              <tbody>
                {FAILURE_EVENTS.map((event) => {
                  const count = counts[event] || 0;
                  return (
                    <tr key={event} className="border-b border-border last:border-0">
                      <td className="py-2 text-muted-foreground">{event}</td>
                      <td
                        className={`py-2 text-right font-semibold ${
                          count > 0 ? "text-destructive" : ""
                        }`}
                      >
                        {count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">
              PostHog isn&apos;t configured yet, or no failure events have landed yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
