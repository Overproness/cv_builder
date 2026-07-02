import {
  generateRefreshToken,
  hashRefreshToken,
  mintExtensionAccessToken,
} from "@/lib/extensionAuth";
import dbConnect from "@/lib/dbConnect";
import ExtensionAuthCode from "@/models/ExtensionAuthCode";
import ExtensionToken from "@/models/ExtensionToken";
import crypto from "crypto";
import { NextResponse } from "next/server";

const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days, sliding

function deriveDeviceLabel(userAgent) {
  if (!userAgent) return "Chrome Extension";
  let os = "Unknown OS";
  if (/Windows/i.test(userAgent)) os = "Windows";
  else if (/Mac OS X/i.test(userAgent)) os = "macOS";
  else if (/CrOS/i.test(userAgent)) os = "ChromeOS";
  else if (/Android/i.test(userAgent)) os = "Android";
  else if (/Linux/i.test(userAgent)) os = "Linux";
  return `Chrome Extension — ${os}`;
}

async function issueNewTokenFamily(request, userId) {
  const refreshToken = generateRefreshToken();
  await ExtensionToken.create({
    userId,
    refreshTokenHash: hashRefreshToken(refreshToken),
    familyId: crypto.randomUUID(),
    deviceLabel: deriveDeviceLabel(request.headers.get("user-agent") || ""),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  const { accessToken, expiresIn } = await mintExtensionAccessToken(userId);
  return NextResponse.json({
    accessToken,
    refreshToken,
    expiresIn,
    tokenType: "Bearer",
  });
}

// grantType: "authorization_code" — trades a single-use code (issued by
// /extension/authorize) for an initial access + refresh token pair.
async function handleAuthorizationCodeGrant(request, { code, redirectUri }) {
  if (!code || !redirectUri) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Atomically claim the code so a concurrent double-submit can't both succeed.
  const authCode = await ExtensionAuthCode.findOneAndUpdate(
    { code, used: false },
    { $set: { used: true } },
  );

  if (
    !authCode ||
    authCode.expiresAt < new Date() ||
    authCode.redirectUri !== redirectUri
  ) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  return issueNewTokenFamily(request, authCode.userId);
}

// grantType: "refresh_token" — rotates a refresh token for a new access +
// refresh token pair. Detects reuse of an already-rotated token as theft and
// revokes the entire token family (standard refresh-token-rotation practice).
async function handleRefreshTokenGrant(request, { refreshToken }) {
  if (!refreshToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const tokenDoc = await ExtensionToken.findOne({
    refreshTokenHash: hashRefreshToken(refreshToken),
  });

  if (!tokenDoc || tokenDoc.revokedAt || tokenDoc.expiresAt < new Date()) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 401 });
  }

  if (tokenDoc.rotatedAt) {
    await ExtensionToken.updateMany(
      { familyId: tokenDoc.familyId, revokedAt: null },
      {
        $set: {
          revokedAt: new Date(),
          revokedReason: "rotation_reuse_detected",
        },
      },
    );
    return NextResponse.json(
      { error: "invalid_grant", reason: "reuse_detected" },
      { status: 401 },
    );
  }

  const newRefreshToken = generateRefreshToken();
  const newHash = hashRefreshToken(newRefreshToken);

  await ExtensionToken.create({
    userId: tokenDoc.userId,
    refreshTokenHash: newHash,
    familyId: tokenDoc.familyId,
    deviceLabel:
      tokenDoc.deviceLabel ||
      deriveDeviceLabel(request.headers.get("user-agent") || ""),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    lastUsedAt: new Date(),
  });

  tokenDoc.rotatedAt = new Date();
  tokenDoc.replacedByHash = newHash;
  await tokenDoc.save();

  const { accessToken, expiresIn } = await mintExtensionAccessToken(
    tokenDoc.userId,
  );

  return NextResponse.json({
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn,
    tokenType: "Bearer",
  });
}

export async function POST(request) {
  await dbConnect();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    if (body.grantType === "authorization_code") {
      return await handleAuthorizationCodeGrant(request, body);
    }
    if (body.grantType === "refresh_token") {
      return await handleRefreshTokenGrant(request, body);
    }
    return NextResponse.json(
      { error: "unsupported_grant_type" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error in extension token route:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
