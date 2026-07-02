import dbConnect from "@/lib/dbConnect";
import { extensionAuthErrorStatus, getExtensionUser } from "@/lib/extensionAuth";
import { NextResponse } from "next/server";

// GET - Minimal profile info for the extension popup header (email/name).
// The access-token JWT itself only carries the userId (sub), by design, so
// the extension needs a lightweight lookup to display who's signed in.
export async function GET(request) {
  await dbConnect();
  try {
    const { email, name } = await getExtensionUser(request);
    return NextResponse.json({ email, name });
  } catch (e) {
    return NextResponse.json(
      { error: "Unauthorized", code: e.message },
      { status: extensionAuthErrorStatus(e) },
    );
  }
}
