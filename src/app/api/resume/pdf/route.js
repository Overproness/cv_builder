import { NextResponse } from "next/server";

// POST - Compile LaTeX to PDF using latex_server
export async function POST(request) {
  try {
    const { latex } = await request.json();

    if (!latex) {
      return NextResponse.json(
        { error: "LaTeX content is required" },
        { status: 400 },
      );
    }

    const serverUrl = process.env.LATEX_SERVER_URL;
    const apiKey = process.env.LATEX_SERVER_API_KEY;

    if (!serverUrl) {
      console.error("LATEX_SERVER_URL not configured");
      return NextResponse.json(
        {
          error:
            "LaTeX compilation server is not configured. Please set LATEX_SERVER_URL environment variable.",
        },
        { status: 503 },
      );
    }

    if (!apiKey) {
      console.error("LATEX_SERVER_API_KEY not configured");
      return NextResponse.json(
        {
          error:
            "LaTeX compilation server API key is not configured. Please set LATEX_SERVER_API_KEY environment variable.",
        },
        { status: 503 },
      );
    }

    // Call the LaTeX compilation server
    console.log("📤 Sending LaTeX to compilation server...");
    const response = await fetch(`${serverUrl}/compile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        latex,
        compiler: "pdflatex",
      }),
    });
    console.log("🚀 ~ POST ~ response:", response);

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown server error" }));
      console.error("❌ Compilation failed:", error);
      return NextResponse.json(
        { error: error.error || `Compilation failed: ${response.status}` },
        { status: response.status },
      );
    }

    // Get the PDF and return it
    const pdfBuffer = await response.arrayBuffer();
    console.log("✅ PDF compilation successful");

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
      },
    });
  } catch (error) {
    console.error("Error in PDF route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to compile LaTeX to PDF" },
      { status: 500 },
    );
  }
}
