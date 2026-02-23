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
    const all = searchParams.get('all');
    const userId = String(session.user.id);
    
    if (id) {
      const cv = await CV.findOne({ _id: id, userId });
      if (!cv) {
        return NextResponse.json({ error: 'CV not found' }, { status: 404 });
      }
      return NextResponse.json(cv);
    }

    // Return all CVs if requested (for multi-CV selection)
    if (all === 'true') {
      const cvs = await CV.find({ userId }, { personal_info: 1, cv_name: 1, updatedAt: 1, createdAt: 1 }, { sort: { updatedAt: -1 } }).lean();
      return NextResponse.json(cvs);
    }
    
    // Return most recent CV by default (backward compatibility)
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
