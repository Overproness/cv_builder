import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dbConnect from "@/lib/dbConnect";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { queryPostHogEventCounts } from "@/lib/posthogQuery";
import ApplicationGroup from "@/models/ApplicationGroup";
import CoverLetter from "@/models/CoverLetter";
import Resume from "@/models/Resume";
import User from "@/models/User";

async function getOverviewStats() {
  await dbConnect();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsers7d,
    totalResumes,
    totalCoverLetters,
    totalApplicationGroups,
    costAgg,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Resume.countDocuments(),
    CoverLetter.countDocuments(),
    ApplicationGroup.countDocuments(),
    User.aggregate([
      { $group: { _id: null, totalCost: { $sum: "$tokenUsage.totalCost" } } },
    ]),
  ]);

  return {
    totalUsers,
    newUsers7d,
    totalResumes,
    totalCoverLetters,
    totalApplicationGroups,
    totalAiCost: costAgg[0]?.totalCost || 0,
  };
}

const FUNNEL_EVENTS = [
  ANALYTICS_EVENTS.SIGNUP_COMPLETED,
  ANALYTICS_EVENTS.TAILOR_STARTED,
  ANALYTICS_EVENTS.TAILOR_COMPLETED,
  ANALYTICS_EVENTS.PDF_COMPILE_SUCCEEDED,
];

export default async function AdminOverviewPage() {
  const [stats, eventCounts] = await Promise.all([
    getOverviewStats(),
    queryPostHogEventCounts(FUNNEL_EVENTS, 7),
  ]);

  const cards = [
    { label: "Total users", value: stats.totalUsers },
    { label: "New users (7d)", value: stats.newUsers7d },
    { label: "Resumes created", value: stats.totalResumes },
    { label: "Cover letters created", value: stats.totalCoverLetters },
    { label: "Application groups", value: stats.totalApplicationGroups },
    { label: "Total AI cost", value: `$${stats.totalAiCost.toFixed(2)}` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Overview</h1>
        <p className="text-muted-foreground text-sm">
          Business and product data at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-3xl font-bold mt-1">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product usage (last 7 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {eventCounts ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {FUNNEL_EVENTS.map((event) => (
                <div key={event}>
                  <p className="text-xs text-muted-foreground">{event}</p>
                  <p className="text-xl font-semibold">{eventCounts[event] || 0}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              PostHog isn&apos;t configured yet (missing POSTHOG_PERSONAL_API_KEY /
              POSTHOG_PROJECT_ID), or no events have been captured yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
