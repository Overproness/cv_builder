import { parseRawTextToCV } from '@/lib/gemini';
import { NextResponse } from 'next/server';

// POST - Parse raw text using Gemini AI
export async function POST(request) {
  try {
    const { rawText } = await request.json();
    
    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Raw text is required' }, 
        { status: 400 }
      );
    }
    
    const parsedCV = await parseRawTextToCV(rawText);
    
    return NextResponse.json({
      message: 'CV parsed successfully',
      cv: parsedCV
    });
  } catch (error) {
    console.error('Error parsing CV:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse CV' }, 
      { status: 500 }
    );
  }
}
