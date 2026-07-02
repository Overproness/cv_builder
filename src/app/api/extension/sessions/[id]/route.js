import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import ExtensionToken from "@/models/ExtensionToken";
import { NextResponse } from "next/server";

// DELETE - Revoke one of the current user's extension sessions from the
// website's Settings page. Ownership-checked (userId must match) so one
// user can never revoke another's session by guessing an id.
export async function DELETE(request, { params }) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = String(session.user.id);
    const { id } = await params;

    const result = await ExtensionToken.findOneAndUpdate(
      { _id: id, userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: "user_revoked" } },
    );

    if (!result) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: "Session revoked" });
  } catch (error) {
    console.error("Error revoking extension session:", error);
    return NextResponse.json(
      { error: "Failed to revoke session" },
      { status: 500 },
    );
  }
}
