import { auth } from "@/auth";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dbConnect from "@/lib/dbConnect";
import ExtensionAuthCode from "@/models/ExtensionAuthCode";
import crypto from "crypto";
import { redirect } from "next/navigation";

const CODE_TTL_MS = 60 * 1000;

async function issueAuthCode(userId, redirectUri) {
  await dbConnect();
  const code = crypto.randomBytes(32).toString("base64url");
  await ExtensionAuthCode.create({
    userId,
    code,
    redirectUri,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return code;
}

function ErrorScreen({ title, message }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-lg">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{message}</p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

// Entry point for the Chrome extension's OAuth-style browser handoff
// (chrome.identity.launchWebAuthFlow). This route is gated by the standard
// NextAuth middleware (see "/extension" in authConfig.protectedPaths), so an
// unauthenticated visitor is redirected to /login and returned here
// automatically after signing in.
//
// Being logged into the website already IS the consent for this first-party
// extension — no separate "Allow access" click is required.
export default async function ExtensionAuthorizePage({ searchParams }) {
  const params = await searchParams;
  const clientId = params?.client_id || "";
  const redirectUri = params?.redirect_uri || "";
  const state = params?.state || "";

  const extensionId = process.env.EXTENSION_ID || "";
  const expectedRedirectUri = extensionId
    ? `https://${extensionId}.chromiumapp.org/`
    : null;

  if (
    !expectedRedirectUri ||
    redirectUri !== expectedRedirectUri ||
    (clientId && clientId !== extensionId)
  ) {
    return (
      <ErrorScreen
        title="Invalid extension request"
        message="This authorization link is invalid, expired, or doesn't match a known extension install. Please try connecting the extension again from its popup."
      />
    );
  }

  const session = await auth();
  if (!session?.user) {
    // Should not happen — /extension is protected by middleware — but fail
    // safe rather than crash if it's ever reached without a session.
    redirect(`/login?callbackUrl=${encodeURIComponent(`/extension/authorize?${new URLSearchParams(params).toString()}`)}`);
  }

  const code = await issueAuthCode(session.user.id, redirectUri);

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);

  redirect(target.toString());
}
