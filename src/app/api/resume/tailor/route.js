import { tailorCVForJob } from '@/lib/gemini';
import { generateLatex } from '@/lib/latex';
import { NextResponse } from 'next/server';

// POST - Generate tailored resume from Master CV + Job Description
export async function POST(request) {
  try {
    const { masterCV, jobDescription } = await request.json();
    
    if (!masterCV) {
      return NextResponse.json(
        { error: 'Master CV is required' }, 
        { status: 400 }
      );
    }
    
    if (!jobDescription || jobDescription.trim().length === 0) {
      return NextResponse.json(
        { error: 'Job description is required' }, 
        { status: 400 }
      );
    }
    
    // Tailor the CV for the job
    const tailoredCV = await tailorCVForJob(masterCV, jobDescription);
    
    // Generate LaTeX from the tailored CV
    const latex = generateLatex(tailoredCV);
    
    return NextResponse.json({
      message: 'Resume tailored successfully',
      tailoredCV,
      latex
    });
  } catch (error) {
    console.error('Error tailoring resume:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to tailor resume' }, 
      { status: 500 }
    );
  }
}
