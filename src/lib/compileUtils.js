/**
 * Utility functions for LaTeX compilation
 * All compilation is done via the latex_server
 */

/**
 * Compile LaTeX using Next.js API route (proxies to latex_server)
 * @param {string} latex - The LaTeX source code
 * @returns {Promise<Blob>} The compiled PDF blob
 */
export async function compileLatexViaApi(latex) {
  const response = await fetch("/api/resume/pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ latex }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/pdf")) {
    throw new Error(
      "Server did not return a PDF. Compilation server may not be configured.",
    );
  }

  return await response.blob();
}
