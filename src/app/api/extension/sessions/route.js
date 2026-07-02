import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import ExtensionToken from "@/models/ExtensionToken";
import { NextResponse } from "next/server";

// GET - List the current user's active extension sessions (one per
// logged-in device/browser-profile). Uses the normal web session cookie
// (auth()), not a bearer token, since this powers the website's Settings
// page "Connected Devices" section.
export async function GET() {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = String(session.user.id);

    const sessions = await ExtensionToken.find({
      userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .select("deviceLabel lastUsedAt createdAt expiresAt")
      .sort({ lastUsedAt: -1 })
      .lean();

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: String(s._id),
        deviceLabel: s.deviceLabel,
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
    });
  } catch (error) {
    console.error("Error listing extension sessions:", error);
    return NextResponse.json(
      { error: "Failed to list extension sessions" },
      { status: 500 },
    );
  }
}
