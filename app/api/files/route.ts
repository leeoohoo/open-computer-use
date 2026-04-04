/**
 * Next.js API route that proxies file operations to the Python backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateGuestUserId } from '@/lib/api';

// Python backend URL
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8001';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

// Allowed file operations — prevents path traversal to arbitrary backend endpoints
const ALLOWED_FILE_OPS = new Set([
  'list',
  'upload',
  'upload-multipart',
  'download',
  'download-stream',
  'delete',
  'create-folder',
]);

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { pathname } = new URL(req.url);
    const operation = pathname.split('/').pop(); // Get the operation from the URL
    
    // Get current user
    const supabase = await createClient();
    let user = null;
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      user = data?.user;
    }
    
    // Get or create user ID
    const userId = await getOrCreateGuestUserId(user as any);
    if (!userId) {
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      );
    }
    
    // Get request body
    const body = await req.json();
    
    // Determine the backend endpoint based on the operation
    let endpoint = '/api/files';
    const searchParams = new URL(req.url).searchParams;
    const fileOp = searchParams.get('op') || body.operation || null;
    if (body.operation) {
      delete body.operation; // Remove from body before forwarding
    }

    if (fileOp) {
      if (!ALLOWED_FILE_OPS.has(fileOp)) {
        return NextResponse.json(
          { error: `Invalid file operation: ${fileOp}` },
          { status: 400 }
        );
      }
      endpoint += `/${fileOp}`;
    }
    
    // Forward the request to Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
        'X-Authenticated': user ? 'true' : 'false',
        ...(INTERNAL_API_KEY && { 'X-Internal-Key': INTERNAL_API_KEY }),
      },
      body: JSON.stringify(body),
    });
    
    // Check if the response is ok
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Backend request failed' },
        { status: response.status }
      );
    }
    
    // For download-stream endpoint, return the file as a stream
    if (endpoint.includes('download-stream')) {
      const blob = await response.blob();
      const headers = new Headers();
      
      // Copy content headers from backend response
      const contentDisposition = response.headers.get('content-disposition');
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      if (contentDisposition) headers.set('Content-Disposition', contentDisposition);
      if (contentType) headers.set('Content-Type', contentType);
      if (contentLength) headers.set('Content-Length', contentLength);
      
      return new NextResponse(blob, { headers });
    }
    
    // For JSON responses
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('[Files Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}