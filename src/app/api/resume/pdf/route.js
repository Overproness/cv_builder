import { NextResponse } from 'next/server';

// POST - Compile LaTeX to PDF
export async function POST(request) {
  try {
    const { latex, source = 'server' } = await request.json();
    
    if (!latex) {
      return NextResponse.json(
        { error: 'LaTeX content is required' }, 
        { status: 400 }
      );
    }
    
    // For server-side compilation, proxy to the LaTeX server
    if (source === 'server') {
      const serverUrl = process.env.LATEX_SERVER_URL;
      const apiKey = process.env.LATEX_SERVER_API_KEY;
      
      if (!serverUrl) {
        // Fallback: return .tex file if server not configured
        console.warn('LATEX_SERVER_URL not configured, returning .tex file');
        return new NextResponse(latex, {
          status: 200,
          headers: {
            'Content-Type': 'application/x-tex',
            'Content-Disposition': 'attachment; filename="resume.tex"'
          }
        });
      }
      
      // Call the LaTeX compilation server
      const response = await fetch(`${serverUrl}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey || ''
        },
        body: JSON.stringify({ latex })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown server error' }));
        return NextResponse.json(
          { error: error.error || `Compilation failed: ${response.status}` }, 
          { status: response.status }
        );
      }
      
      // Get the PDF and return it
      const pdfBuffer = await response.arrayBuffer();
      
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="resume.pdf"'
        }
      });
    }
    
    // For browser source (shouldn't normally hit this endpoint)
    // Just return the .tex file for manual compilation
    return new NextResponse(latex, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-tex',
        'Content-Disposition': 'attachment; filename="resume.tex"'
      }
    });
    
  } catch (error) {
    console.error('Error in PDF route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' }, 
      { status: 500 }
    );
  }
}
