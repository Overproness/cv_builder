import { auth } from '@/auth';
import dbConnect from '@/lib/dbConnect';
import CV from '@/models/CV';
import { NextResponse } from 'next/server';

const UNAUTHORIZED_RESPONSE = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// GET - Fetch user's Master CV
export async function GET(request) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED_RESPONSE;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = String(session.user.id);
    
    if (id) {
      const cv = await CV.findOne({ _id: id, userId });
      if (!cv) {
        return NextResponse.json({ error: 'CV not found' }, { status: 404 });
      }
      return NextResponse.json(cv);
    }
    
    // Return all CVs for the user or the most recent one if preferred
    // For now, let's keep the behavior of finding the most recent one for user
    const cv = await CV.findOne({ userId }, {}, { sort: { updatedAt: -1 } });
    return NextResponse.json(cv || null);
  } catch (error) {
    console.error('Error fetching CV:', error);
    return NextResponse.json({ error: 'Failed to fetch CV' }, { status: 500 });
  }
}

// POST - Create or update Master CV
export async function POST(request) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED_RESPONSE;
    const userId = String(session.user.id);

    const body = await request.json();
    // Remove _id and any userId from the body to prevent override
    const { _id, userId: bodyUserId, ...cvData } = body;
    
    console.log('Session user id:', session.user.id, 'Type:', typeof session.user.id);
    console.log('Body userId:', bodyUserId, 'Type:', typeof bodyUserId);
    console.log('Final userId being used:', userId);
    
    if (_id) {
      // Update existing CV - Ensure user owns it
      const updatedCV = await CV.findOneAndUpdate(
        { _id, userId },
        { ...cvData },
        { new: true, runValidators: true }
      );
      
      if (!updatedCV) {
        return NextResponse.json({ error: 'CV not found or authorized' }, { status: 404 });
      }
      
      return NextResponse.json({ 
        message: 'CV updated successfully',
        id: _id 
      });
    } else {
      // Create new CV
      const newCV = await CV.create({ ...cvData, userId });
      
      return NextResponse.json({ 
        message: 'CV created successfully',
        id: newCV._id.toString()
      });
    }
  } catch (error) {
    console.error('Error saving CV:', error);
    return NextResponse.json({ error: 'Failed to save CV' }, { status: 500 });
  }
}

// DELETE - Delete a CV
export async function DELETE(request) {
  await dbConnect();
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED_RESPONSE;
    const userId = String(session.user.id);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }
    
    const result = await CV.findOneAndDelete({ _id: id, userId });
    
    if (!result) {
      return NextResponse.json({ error: 'CV not found or authorized' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'CV deleted successfully' });
  } catch (error) {
    console.error('Error deleting CV:', error);
    return NextResponse.json({ error: 'Failed to delete CV' }, { status: 500 });
  }
}
