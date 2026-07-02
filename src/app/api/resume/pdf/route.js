import { compileLatexToPdf, LatexCompileError } from "@/lib/latexCompileClient";
import { logServerError } from "@/lib/serverLogger";
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

    let pdfBuffer;
    try {
      pdfBuffer = await compileLatexToPdf(latex);
    } catch (error) {
      if (error instanceof LatexCompileError) {
        if (error.status !== 503) {
          logServerError("❌ Compilation failed:", error, {
            event: "pdf_compile_failed",
          });
        } else {
          console.error(error.message);
        }
        return NextResponse.json(
          { error: error.message },
          { status: error.status || 500 },
        );
      }
      throw error;
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
      },
    });
  } catch (error) {
    logServerError("Error in PDF route:", error, { event: "pdf_compile_failed" });
    return NextResponse.json(
      { error: error.message || "Failed to compile LaTeX to PDF" },
      { status: 500 },
    );
  }
}
