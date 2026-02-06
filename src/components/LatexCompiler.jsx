'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * LaTeX compiler hook
 * Attempts browser-based compilation with SwiftLaTeX, falls back to server
 */
export function useLatexCompiler() {
  const [isLoading, setIsLoading] = useState(true);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [error, setError] = useState(null);
  const [engineNotAvailable, setEngineNotAvailable] = useState(false);
  const engineRef = useRef(null);
  const loadAttempted = useRef(false);

  // Load SwiftLaTeX engine on mount
  useEffect(() => {
    let mounted = true;
    let scriptElement = null;

    const loadEngine = async () => {
      if (engineRef.current || loadAttempted.current) return;
      loadAttempted.current = true;

      try {
        setIsLoading(true);
        setLoadingProgress('Initializing LaTeX compiler...');

        // Try to load SwiftLaTeX from working sources
        // SwiftLaTeX GitHub Pages hosting
        const cdnSources = [
          'https://www.swiftlatex.com/PdfTeXEngine.js',
          'https://texlive.swiftlatex.com/PdfTeXEngine.js',
          'https://unpkg.com/swiftlatex-core@latest/PdfTeXEngine.js',
        ];

        let engineLoaded = false;

        for (const cdnUrl of cdnSources) {
          if (!mounted || engineLoaded) break;

          try {
            setLoadingProgress(`Loading from ${cdnUrl.includes('swiftlatex.com') ? 'SwiftLaTeX' : 'CDN'}...`);
            console.log(`🔄 Attempting to load SwiftLaTeX from: ${cdnUrl}`);
            
            scriptElement = document.createElement('script');
            scriptElement.src = cdnUrl;
            scriptElement.async = true;
            scriptElement.crossOrigin = 'anonymous';
            
            const scriptLoadPromise = new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                console.warn(`⏱️ Timeout loading script from ${cdnUrl}`);
                reject(new Error('Timeout loading script'));
              }, 15000); // 15 second timeout
              
              scriptElement.onload = () => {
                clearTimeout(timeout);
                console.log(`✅ Script loaded successfully from ${cdnUrl}`);
                resolve();
              };
              
              scriptElement.onerror = (e) => {
                clearTimeout(timeout);
                console.error(`❌ Script load error from ${cdnUrl}:`, e);
                reject(new Error('Script load error'));
              };
            });

            document.head.appendChild(scriptElement);
            await scriptLoadPromise;

            // Wait for PdfTeXEngine to be available
            setLoadingProgress('Waiting for engine to initialize...');
            console.log('🔍 Checking for PdfTeXEngine...');
            
            let attempts = 0;
            while (attempts < 30 && typeof window.PdfTeXEngine === 'undefined') {
              await new Promise(resolve => setTimeout(resolve, 200));
              attempts++;
              if (attempts % 5 === 0) {
                console.log(`⏳ Still waiting for PdfTeXEngine... (${attempts}/30)`);
              }
            }

            if (typeof window.PdfTeXEngine !== 'undefined') {
              console.log('✅ PdfTeXEngine constructor found!');
              setLoadingProgress('Loading WebAssembly modules (may take 30s)...');
              
              const engine = new window.PdfTeXEngine();
              console.log('🔧 PdfTeXEngine instance created');
              
              // Load the engine with error handling
              try {
                console.log('⚙️ Loading WebAssembly engine...');
                await Promise.race([
                  engine.loadEngine(),
                  new Promise((_, reject) => 
                    setTimeout(() => {
                      console.error('⏱️ Engine load timeout after 45 seconds');
                      reject(new Error('Engine load timeout'));
                    }, 45000)
                  )
                ]);

                if (mounted) {
                  engineRef.current = engine;
                  setIsEngineReady(true);
                  setLoadingProgress('');
                  setError(null);
                  engineLoaded = true;
                  console.log('✅ LaTeX engine fully loaded and ready!');
                  break;
                }
              } catch (engineError) {
                console.error('❌ Engine initialization failed:', engineError);
                throw engineError;
              }
            } else {
              console.warn('⚠️ PdfTeXEngine still not available after waiting');
            }
          } catch (err) {
            console.warn(`Failed to load from ${cdnUrl}:`, err);
            // Remove failed script
            if (scriptElement && scriptElement.parentNode) {
              scriptElement.parentNode.removeChild(scriptElement);
            }
            scriptElement = null;
            continue;
          }
        }

        if (!engineLoaded && mounted) {
          console.log('Browser LaTeX engine not available, using server fallback');
          setEngineNotAvailable(true);
          setError('Browser compilation unavailable. Using server-side compilation.');
        }
      } catch (err) {
        console.error('LaTeX engine loading error:', err);
        if (mounted) {
          setEngineNotAvailable(true);
          setError('Browser compilation unavailable. Using server-side compilation.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadEngine();

    return () => {
      mounted = false;
      if (engineRef.current) {
        try {
          engineRef.current.closeWorker?.();
        } catch (err) {
          console.warn('Error closing engine:', err);
        }
      }
      if (scriptElement && scriptElement.parentNode) {
        scriptElement.parentNode.removeChild(scriptElement);
      }
    };
  }, []);

  /**
   * Compile LaTeX source code to PDF using browser engine
   * @param {string} latexSource - The LaTeX source code
   * @returns {Promise<{pdf: Blob, log: string, success: boolean}>}
   */
  const compileLatex = useCallback(async (latexSource) => {
    if (!engineRef.current || !isEngineReady) {
      throw new Error('LaTeX engine not ready. Please use server compilation.');
    }

    const engine = engineRef.current;

    try {
      console.log('🚀 Starting browser-based LaTeX compilation...');
      
      // Clear previous files
      if (engine.flushCache) {
        engine.flushCache();
      }

      // Write the main tex file
      engine.writeMemFSFile('main.tex', latexSource);
      engine.setEngineMainFile('main.tex');

      console.log('⚙️ Compiling LaTeX...');
      // Compile with timeout
      const result = await Promise.race([
        engine.compileLaTeX(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Compilation timeout')), 60000)
        )
      ]);
      
      console.log('✅ Compilation complete:', result);

      if (result.pdf) {
        const pdfBlob = new Blob([result.pdf], { type: 'application/pdf' });
        return {
          pdf: pdfBlob,
          log: result.log || 'Compilation successful',
          success: true
        };
      } else {
        return {
          pdf: null,
          log: result.log || 'Compilation failed without error message',
          success: false
        };
      }
    } catch (err) {
      console.error('❌ LaTeX compilation error:', err);
      throw err;
    }
  }, [isEngineReady]);

  /**
   * Compile LaTeX using server-side API (fallback)
   * @param {string} latexSource - The LaTeX source code
   * @returns {Promise<Blob>} The compiled PDF blob
   */
  const compileLatexOnServer = useCallback(async (latexSource) => {
    const response = await fetch('/api/resume/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latex: latexSource, source: 'server' }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Server error: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/pdf')) {
      return await response.blob();
    }
    
    throw new Error('Server did not return a PDF. Make sure LATEX_SERVER_URL is configured.');
  }, []);

  return {
    compileLatex,
    compileLatexOnServer,
    isLoading,
    isEngineReady,
    engineNotAvailable,
    loadingProgress,
    error
  };
}

/**
 * LatexCompiler component - provides UI for compiling LaTeX in the browser
 */
export default function LatexCompiler({ 
  latexSource, 
  onCompileSuccess, 
  onCompileError,
  className = '' 
}) {
  const { compileLatex, isLoading, isEngineReady, loadingProgress, error } = useLatexCompiler();
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationLog, setCompilationLog] = useState('');

  const handleCompile = async () => {
    if (!latexSource || !isEngineReady) return;

    setIsCompiling(true);
    setCompilationLog('');

    try {
      const result = await compileLatex(latexSource);
      
      if (result.success) {
        setCompilationLog(result.log);
        onCompileSuccess?.(result.pdf, result.log);
      } else {
        setCompilationLog(result.log);
        onCompileError?.(new Error('Compilation failed'), result.log);
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
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
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
