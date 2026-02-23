import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { NextResponse } from "next/server";

const UNAUTHORIZED_RESPONSE = NextResponse.json(
  { error: "Unauthorized" },
  { status: 401 },
);

// GET - Fetch current user's profile settings
export async function GET() {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED_RESPONSE;

    const user = await User.findById(String(session.user.id)).select(
      "name email settings",
    );
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      name: user.name,
      email: user.email,
      settings: user.settings || {},
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PATCH - Update user's profile settings
export async function PATCH(request) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED_RESPONSE;

    const body = await request.json();
    const { displayName, phone, coverLetterEmail, coverLetterWordCount } = body;

    const update = {};
    if (displayName !== undefined) update["settings.displayName"] = displayName;
    if (phone !== undefined) update["settings.phone"] = phone;
    if (coverLetterEmail !== undefined) update["settings.coverLetterEmail"] = coverLetterEmail;
    if (coverLetterWordCount !== undefined)
      update["settings.coverLetterWordCount"] = Number(coverLetterWordCount);

    const user = await User.findByIdAndUpdate(
      String(session.user.id),
      { $set: update },
      { new: true, runValidators: false },
    ).select("name email settings");

    return NextResponse.json({
      message: "Settings saved",
      name: user.name,
      email: user.email,
      settings: user.settings || {},
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
