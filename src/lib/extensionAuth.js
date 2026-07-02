import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import crypto from "crypto";
import { jwtVerify, SignJWT } from "jose";

const EXTENSION_AUDIENCE = "extension";
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

function getExtensionJwtSecret() {
  const secret = process.env.EXTENSION_JWT_SECRET || "";
  if (!secret) {
    throw new Error(
      "EXTENSION_JWT_SECRET is not configured. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Mints a short-lived stateless access-token JWT for the extension. Signed
 * with EXTENSION_JWT_SECRET, distinct from NEXTAUTH_SECRET/MASTER_KEY so
 * extension token revocation is its own trust boundary.
 */
export async function mintExtensionAccessToken(userId) {
  const accessToken = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setAudience(EXTENSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getExtensionJwtSecret());
  return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

/** SHA-256 hex digest — the only form opaque refresh tokens are ever stored in. */
export function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Generates a new opaque refresh token (returned to the client once, never stored raw). */
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

/**
 * Bearer-token analogue of getUserApiKey()/auth() for extension-originated
 * requests, which have no NextAuth session cookie. Parses and verifies the
 * Authorization: Bearer <accessToken> header (a short-lived JWT minted by
 * POST /api/extension/token) and resolves the calling user.
 *
 * Throws "UNAUTHORIZED" (missing/malformed header), "TOKEN_INVALID"
 * (expired/bad signature — the extension should attempt a refresh), or
 * "USER_NOT_FOUND".
 */
export async function getExtensionUser(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }
  const token = authHeader.slice(7).trim();
  if (!token) throw new Error("UNAUTHORIZED");

  let payload;
  try {
    ({ payload } = await jwtVerify(token, getExtensionJwtSecret(), {
      audience: EXTENSION_AUDIENCE,
    }));
  } catch {
    throw new Error("TOKEN_INVALID");
  }

  if (!payload?.sub) throw new Error("TOKEN_INVALID");

  await dbConnect();
  const user = await User.findById(payload.sub)
    .select("_id email name role")
    .lean();
  if (!user) throw new Error("USER_NOT_FOUND");

  return { userId: String(user._id), email: user.email, name: user.name };
}

/**
 * Maps getExtensionUser()'s thrown error messages to HTTP status codes,
 * mirroring how every extension route needs to respond.
 */
export function extensionAuthErrorStatus(error) {
  if (error.message === "UNAUTHORIZED") return 401;
  if (error.message === "TOKEN_INVALID") return 401;
  if (error.message === "USER_NOT_FOUND") return 401;
  return 500;
}

export { EXTENSION_AUDIENCE };
