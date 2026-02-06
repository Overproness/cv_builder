/**
 * Utility functions for LaTeX compilation
 */

/**
 * Check if we're in a browser environment (vs headless/API)
 * @returns {boolean} true if in browser with user interaction expected
 */
export function isBrowserEnvironment() {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Common headless browser indicators
  const headlessIndicators = [
    'headless',
    'phantomjs',
    'puppeteer',
    'playwright',
    'selenium',
    'webdriver',
  ];
  
  // Check for headless browsers
  if (headlessIndicators.some(indicator => userAgent.includes(indicator))) {
    return false;
  }
  
  // Check if webdriver is present (automation)
  if (navigator.webdriver) {
    return false;
  }
  
  return true;
}

/**
 * Get the LaTeX server URL from environment
 * @returns {string|null} The server URL or null if not configured
 */
export function getLatexServerUrl() {
  return process.env.NEXT_PUBLIC_LATEX_SERVER_URL || null;
}

/**
 * Compile LaTeX on the server (Render.com)
 * @param {string} latex - The LaTeX source code
 * @returns {Promise<Blob>} The compiled PDF blob
 */
export async function compileLatexOnServer(latex) {
  const serverUrl = getLatexServerUrl();
  
  if (!serverUrl) {
    throw new Error('LaTeX server URL not configured');
  }
  
  const response = await fetch(`${serverUrl}/compile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ latex }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Server error: ${response.status}`);
  }
  
  const pdfBlob = await response.blob();
  return pdfBlob;
}

/**
 * Compile LaTeX using Next.js API route (proxies to server)
 * This is for headless/API access
 * @param {string} latex - The LaTeX source code
 * @returns {Promise<Blob>} The compiled PDF blob
 */
export async function compileLatexViaApi(latex) {
  const response = await fetch('/api/resume/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ latex, source: 'server' }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }
  
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/pdf')) {
    return await response.blob();
  }
  
  // Fallback: might be .tex file
  throw new Error('Server did not return a PDF');
}
