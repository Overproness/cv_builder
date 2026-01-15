import { generateLatex } from '@/lib/latex';
import { NextResponse } from 'next/server';

// POST - Generate LaTeX from CV JSON
export async function POST(request) {
  try {
    const { cv } = await request.json();
    
    if (!cv) {
      return NextResponse.json(
        { error: 'CV data is required' }, 
        { status: 400 }
      );
    }
    
    const latex = generateLatex(cv);
    
    return NextResponse.json({
      message: 'LaTeX generated successfully',
      latex
    });
  } catch (error) {
    console.error('Error generating LaTeX:', error);
    return NextResponse.json(
      { error: 'Failed to generate LaTeX' }, 
      { status: 500 }
    );
  }
}
