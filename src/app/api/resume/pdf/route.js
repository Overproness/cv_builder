import { NextResponse } from 'next/server';

// POST - Compile LaTeX to PDF
// Note: This is a placeholder. Full LaTeX compilation requires pdflatex installed.
// For production, consider using Overleaf API or a LaTeX Docker container.
export async function POST(request) {
  try {
    const { latex } = await request.json();
    
    if (!latex) {
      return NextResponse.json(
        { error: 'LaTeX content is required' }, 
        { status: 400 }
      );
    }
    
    // For now, we'll return the LaTeX as a downloadable .tex file
    // Users can compile it using Overleaf or local pdflatex
    
    // In a full implementation, you would:
    // 1. Write the LaTeX to a temp file
    // 2. Run pdflatex on it
    // 3. Return the PDF binary
    
    // For now, return the .tex content for download
    return new NextResponse(latex, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-tex',
        'Content-Disposition': 'attachment; filename="resume.tex"'
      }
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' }, 
      { status: 500 }
    );
  }
}
