import { WEB_APP_ORIGIN } from "./config.js";
import {
  clearAuthTokens,
  getAuthTokens,
  setAuthTokens,
  setUserProfile,
} from "./storage.js";

const REFRESH_SAFETY_MARGIN_MS = 60 * 1000;

/**
 * OAuth-style browser handoff: opens /extension/authorize in Chrome's
 * dedicated web-auth-flow window via chrome.identity.launchWebAuthFlow. The
 * server (already authenticated via the user's normal NextAuth session, or
 * having just prompted /login) redirects to
 * https://<extension-id>.chromiumapp.org/?code=...&state=..., which Chrome
 * intercepts without ever loading — no custom callback page needed.
 */
export async function startLogin() {
  const redirectUri = chrome.identity.getRedirectURL();
  const state = crypto.randomUUID();

  const authUrl = new URL("/extension/authorize", WEB_APP_ORIGIN);
  authUrl.searchParams.set("client_id", chrome.runtime.id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  const resultUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });
  if (!resultUrl) {
    throw new Error("Login was cancelled.");
  }

  const parsed = new URL(resultUrl);
  const code = parsed.searchParams.get("code");
  const returnedState = parsed.searchParams.get("state");
  if (!code || returnedState !== state) {
    throw new Error("Login failed — the server's response could not be verified.");
  }

  const tokenRes = await fetch(`${WEB_APP_ORIGIN}/api/extension/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "authorization_code",
      code,
      redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error("Login failed — could not exchange the authorization code.");
  }
  const tokenData = await tokenRes.json();
  await persistTokenResponse(tokenData);

  const profile = await fetchProfile();
  return profile;
}

async function persistTokenResponse(tokenData) {
  await setAuthTokens({
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    expiresAt: Date.now() + tokenData.expiresIn * 1000,
  });
}

async function fetchProfile() {
  const res = await authedFetch("/api/extension/me");
  if (!res.ok) throw new Error("Could not load profile after login.");
  const profile = await res.json();
  await setUserProfile(profile);
  return profile;
}

export async function logout() {
  const tokens = await getAuthTokens();
  if (tokens?.refreshToken) {
    try {
      await fetch(`${WEB_APP_ORIGIN}/api/extension/token/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
    } catch {
      // Best-effort — clear local state regardless of network outcome.
    }
  }
  await clearAuthTokens();
}

/**
 * Returns a valid access token, refreshing proactively if it's within the
 * safety margin of expiry. Throws "SESSION_EXPIRED" if the refresh grant
 * itself fails (revoked/expired refresh token) — callers should treat this
 * as "the user needs to log in again."
 */
export async function getValidAccessToken() {
  const tokens = await getAuthTokens();
  if (!tokens?.accessToken) throw new Error("SESSION_EXPIRED");

  if (Date.now() < tokens.expiresAt - REFRESH_SAFETY_MARGIN_MS) {
    return tokens.accessToken;
  }
  return refreshAccessToken(tokens.refreshToken);
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw new Error("SESSION_EXPIRED");

  const res = await fetch(`${WEB_APP_ORIGIN}/api/extension/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grantType: "refresh_token", refreshToken }),
  });

  if (!res.ok) {
    await clearAuthTokens();
    throw new Error("SESSION_EXPIRED");
  }

  const tokenData = await res.json();
  await persistTokenResponse(tokenData);
  return tokenData.accessToken;
}

/**
 * fetch() wrapper that attaches a valid access token and, on a 401 that
 * looks like an expired/invalid token, refreshes once and retries — the
 * one exception to "always resolve a token before calling" above, covering
 * clock skew or a token that expired between resolution and send.
 */
export async function authedFetch(path, options = {}) {
  const accessToken = await getValidAccessToken();
  const doFetch = (token) =>
    fetch(`${WEB_APP_ORIGIN}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await doFetch(accessToken);
  if (res.status === 401) {
    const tokens = await getAuthTokens();
    const newAccessToken = await refreshAccessToken(tokens?.refreshToken);
    res = await doFetch(newAccessToken);
  }
  return res;
}
