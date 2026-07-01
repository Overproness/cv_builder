import { requireAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/dbConnect";
import ApplicationGroup from "@/models/ApplicationGroup";
import CoverLetter from "@/models/CoverLetter";
import Resume from "@/models/Resume";
import User from "@/models/User";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [totalUsers, newUsers7d, totalResumes, totalCoverLetters, totalApplicationGroups, costAgg] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Resume.countDocuments(),
      CoverLetter.countDocuments(),
      ApplicationGroup.countDocuments(),
      User.aggregate([
        { $group: { _id: null, totalCost: { $sum: "$tokenUsage.totalCost" } } },
      ]),
    ]);

  return NextResponse.json({
    totalUsers,
    newUsers7d,
    totalResumes,
    totalCoverLetters,
    totalApplicationGroups,
    totalAiCost: costAgg[0]?.totalCost || 0,
  });
}
