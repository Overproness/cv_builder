"use client";

import { useCallback, useState } from "react";

/**
 * LaTeX compiler hook
 * Uses server-side compilation via /api/resume/pdf
 *
 * Note: Browser-based SwiftLaTeX engine was removed because all upstream
 * CDN/npm sources are permanently offline (swiftlatex.com, texlive.swiftlatex.com,
 * unpkg.com/swiftlatex-core). The npm package does not exist and the WASM files
 * require building from source with Emscripten. Server-side compilation is the
 * reliable approach.
 */
export function useLatexCompiler() {
  const [isLoading] = useState(false);
  const [isEngineReady] = useState(false);
  const [loadingProgress] = useState("");
  const [error] = useState(null);
  const [engineNotAvailable] = useState(true);

  /**
   * Compile LaTeX using server-side API
   * @param {string} latexSource - The LaTeX source code
   * @returns {Promise<Blob>} The compiled PDF blob
   */
  const compileLatexOnServer = useCallback(async (latexSource) => {
    console.log("📤 Sending LaTeX to server for compilation...");
    const response = await fetch("/api/resume/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ latex: latexSource, source: "server" }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      console.error("❌ Server compilation failed:", error);
      throw new Error(error.error || `Server error: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/pdf")) {
      console.log("✅ PDF compilation successful");
      return await response.blob();
    }

    console.error("❌ Server did not return PDF");
    throw new Error(
      "Server did not return a PDF. Make sure LATEX_SERVER_URL is configured.",
    );
  }, []);

  /**
   * Compile LaTeX source code to PDF
   * Uses server-side compilation since browser WASM engine is unavailable.
   * @param {string} latexSource - The LaTeX source code
   * @returns {Promise<{pdf: Blob, log: string, success: boolean}>}
   */
  const compileLatex = useCallback(
    async (latexSource) => {
      const blob = await compileLatexOnServer(latexSource);
      return {
        pdf: blob,
        log: "Compiled via server",
        success: true,
      };
    },
    [compileLatexOnServer],
  );

  return {
    compileLatex,
    compileLatexOnServer,
    isLoading,
    isEngineReady,
    engineNotAvailable,
    loadingProgress,
    error,
  };
}

/**
 * LatexCompiler component - provides UI for compiling LaTeX in the browser
 */
export default function LatexCompiler({
  latexSource,
  onCompileSuccess,
  onCompileError,
  className = "",
}) {
  const { compileLatex, isLoading, isEngineReady, loadingProgress, error } =
    useLatexCompiler();
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationLog, setCompilationLog] = useState("");

  const handleCompile = async () => {
    if (!latexSource || !isEngineReady) return;

    setIsCompiling(true);
    setCompilationLog("");

    try {
      const result = await compileLatex(latexSource);

      if (result.success) {
        setCompilationLog(result.log);
        onCompileSuccess?.(result.pdf, result.log);
      } else {
        setCompilationLog(result.log);
        onCompileError?.(new Error("Compilation failed"), result.log);
      }
    } catch (err) {
      setCompilationLog(err.message);
      onCompileError?.(err, err.message);
    } finally {
      setIsCompiling(false);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div
        className={`flex items-center gap-2 text-muted-foreground ${className}`}
      >
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">{loadingProgress}</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`text-muted-foreground text-sm ${className}`}>
        {error}
      </div>
    );
  }

  return null; // This component is headless - UI is in parent
}
