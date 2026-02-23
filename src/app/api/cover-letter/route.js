import { auth } from '@/auth';
import dbConnect from '@/lib/dbConnect';
import CoverLetter from '@/models/CoverLetter';
import { NextResponse } from 'next/server';

const UNAUTHORIZED = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// GET - List all saved cover letters for the user
export async function GET(request) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);

    const coverLetters = await CoverLetter.find({ userId }).sort({ createdAt: -1 }).lean();
    return NextResponse.json(coverLetters);
  } catch (error) {
    console.error('Error fetching cover letters:', error);
    return NextResponse.json({ error: 'Failed to fetch cover letters' }, { status: 500 });
  }
}

// POST - Save a new cover letter
export async function POST(request) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    const userId = String(session.user.id);

    const body = await request.json();
    const { title, company, position, jobDescription, content, masterCVId, resumeId } = body;

    if (!content) {
      return NextResponse.json({ error: 'Cover letter content is required' }, { status: 400 });
    }

    const coverLetter = await CoverLetter.create({
      userId,
      masterCVId: masterCVId || null,
      resumeId: resumeId || null,
      title: title || (company && position ? `${position} at ${company}` : 'Cover Letter'),
      company: company || '',
      position: position || '',
      jobDescription: jobDescription || '',
      content,
    });

    return NextResponse.json({ message: 'Cover letter saved', id: coverLetter._id.toString() });
  } catch (error) {
    console.error('Error saving cover letter:', error);
    return NextResponse.json({ error: 'Failed to save cover letter' }, { status: 500 });
  }
}
