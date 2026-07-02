import dbConnect from "@/lib/dbConnect";
import { extensionAuthErrorStatus, getExtensionUser } from "@/lib/extensionAuth";
import CV from "@/models/CV";
import { NextResponse } from "next/server";

// GET - Master CV picker data for the extension popup. Same underlying
// query as GET /api/cv?all=true, but bearer-token gated (that route is
// cookie-session gated) since it's called from the extension.
export async function GET(request) {
  await dbConnect();

  let userId;
  try {
    ({ userId } = await getExtensionUser(request));
  } catch (e) {
    return NextResponse.json(
      { error: "Unauthorized", code: e.message },
      { status: extensionAuthErrorStatus(e) },
    );
  }

  const cvs = await CV.find(
    { userId },
    { personal_info: 1, cv_name: 1, updatedAt: 1, createdAt: 1 },
    { sort: { updatedAt: -1 } },
  ).lean();

  return NextResponse.json({
    cvs: cvs.map((cv) => ({
      id: String(cv._id),
      name: cv.cv_name || cv.personal_info?.name || "Untitled CV",
      updatedAt: cv.updatedAt,
    })),
    primaryCVId: cvs.length > 0 ? String(cvs[0]._id) : null,
  });
}
