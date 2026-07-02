// Thin client for the external LaTeX compilation server (Render-hosted,
// pdflatex). Extracted out of src/app/api/resume/pdf/route.js so both that
// route and the extension job processor (src/lib/extensionJobProcessor.js)
// share one implementation instead of duplicating the fetch logic.
//
// Throws typed errors instead of building a NextResponse directly, since the
// job processor isn't running inside a route handler.

export class LatexCompileError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "LatexCompileError";
    this.status = status;
  }
}

/**
 * Compiles LaTeX source to a PDF Buffer via the external compile server.
 * Throws LatexCompileError on any failure (server not configured, server
 * down, or a compilation error reported by the server).
 */
export async function compileLatexToPdf(latex) {
  const serverUrl = process.env.LATEX_SERVER_URL;
  const apiKey = process.env.LATEX_SERVER_API_KEY;

  if (!serverUrl) {
    throw new LatexCompileError(
      "LaTeX compilation server is not configured. Please set LATEX_SERVER_URL environment variable.",
      { status: 503 },
    );
  }
  if (!apiKey) {
    throw new LatexCompileError(
      "LaTeX compilation server API key is not configured. Please set LATEX_SERVER_API_KEY environment variable.",
      { status: 503 },
    );
  }

  const response = await fetch(`${serverUrl}/compile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ latex, compiler: "pdflatex" }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown server error" }));
    throw new LatexCompileError(
      error.error || `Compilation failed: ${response.status}`,
      { status: response.status },
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
