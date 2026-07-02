import dbConnect from "@/lib/dbConnect";
import { hashRefreshToken } from "@/lib/extensionAuth";
import ExtensionToken from "@/models/ExtensionToken";
import { NextResponse } from "next/server";

// POST - Extension-initiated logout. Takes the refresh token itself as proof
// of possession (no bearer access token required — logging out shouldn't
// require a still-valid access token). Always responds 200, even if the
// token is unknown/already revoked, so this is a safe idempotent "log out"
// action from the extension's popup.
export async function POST(request) {
  await dbConnect();
  try {
    const { refreshToken } = await request.json();
    if (refreshToken) {
      await ExtensionToken.updateOne(
        { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: "user_revoked" } },
      );
    }
  } catch {
    // Malformed body — still respond 200, logout must never fail visibly.
  }
  return NextResponse.json({ message: "Logged out" });
}
