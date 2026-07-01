import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import dbConnect from "@/lib/dbConnect";
import { queryPostHogEventCounts } from "@/lib/posthogQuery";
import ApplicationGroup from "@/models/ApplicationGroup";
import CoverLetter from "@/models/CoverLetter";
import Resume from "@/models/Resume";

async function countSince(Model, days) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return Model.countDocuments({ createdAt: { $gte: since } });
}

async function getMongoUsage() {
  await dbConnect();
  const [resumes7d, coverLetters7d, groups7d] = await Promise.all([
    countSince(Resume, 7),
    countSince(CoverLetter, 7),
    countSince(ApplicationGroup, 7),
  ]);
  return { resumes7d, coverLetters7d, groups7d };
}

const FEATURE_EVENTS = Object.values(ANALYTICS_EVENTS);

export default async function AdminUsagePage() {
  const [mongoUsage, eventCounts] = await Promise.all([
    getMongoUsage(),
    queryPostHogEventCounts(FEATURE_EVENTS, 7),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Usage</h1>
        <p className="text-muted-foreground text-sm">
          Feature adoption over the last 7 days.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents created</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Resumes</p>
            <p className="text-2xl font-bold">{mongoUsage.resumes7d}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cover letters</p>
            <p className="text-2xl font-bold">{mongoUsage.coverLetters7d}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Application groups</p>
            <p className="text-2xl font-bold">{mongoUsage.groups7d}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event counts</CardTitle>
        </CardHeader>
        <CardContent>
          {eventCounts ? (
            <table className="w-full text-sm">
              <tbody>
                {FEATURE_EVENTS.map((event) => (
                  <tr key={event} className="border-b border-border last:border-0">
                    <td className="py-2 text-muted-foreground">{event}</td>
                    <td className="py-2 text-right font-semibold">
                      {eventCounts[event] || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">
              PostHog isn&apos;t configured yet, or no events have been captured yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
