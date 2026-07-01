import { requireAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { NextResponse } from "next/server";

const PAGE_SIZE = 25;

export async function GET(request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const filter = email ? { email: { $regex: email, $options: "i" } } : {};
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("name email role createdAt tokenUsage.totalCost tokenUsage.totalTokens")
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    User.countDocuments(filter),
  ]);

  return NextResponse.json({ users, total, page, pageSize: PAGE_SIZE });
}
