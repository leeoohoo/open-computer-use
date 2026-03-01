import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8001';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ machineId: string }> }
) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { machineId } = await params;

    const response = await fetch(
      `${PYTHON_BACKEND_URL}/api/chat/stop-machine/${machineId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': authData.user.id,
          ...(INTERNAL_API_KEY && { 'X-Internal-Key': INTERNAL_API_KEY }),
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error stopping machine:', error);
    return NextResponse.json({ error: 'Failed to stop machine execution' }, { status: 500 });
  }
}
