/**
 * Next.js API route that proxies file operations to the Python backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

// Hard cap on inbound JSON payload size.  base64 file uploads inflate ~33 %, so
// a 50 MB cap maps to ~37 MB of binary file content.  We reject early via
// Content-Length so an attacker can't OOM the route by sending a 1 GB body
// that we'd otherwise materialise via req.json().  P1 audit fix.
const MAX_REQUEST_BYTES = 50 * 1024 * 1024;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // ---- Early Content-Length cap (cheap rejection before req.json()) ----
    const contentLengthHeader = req.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
        return NextResponse.json(
          {
            error: 'Request body too large',
            max_bytes: MAX_REQUEST_BYTES,
            received_bytes: contentLength,
          },
          { status: 413 }
        );
      }
    }

    const { pathname } = new URL(req.url);
    const operation = pathname.split('/').pop(); // Get the operation from the URL

    // Require authenticated user
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = authData.user.id;

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
        'X-Authenticated': 'true',
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

    // For download-stream endpoint, pipe the upstream body straight to the
    // client without buffering.  Previously we did `await response.blob()`
    // which materialised the entire file in memory before forwarding —
    // a 500 MB download would balloon the route's RSS by 500 MB.  Fix from
    // the P1 audit: hand the readable stream directly to NextResponse.
    if (endpoint.includes('download-stream')) {
      if (!response.body) {
        return NextResponse.json(
          { error: 'Backend returned empty stream' },
          { status: 502 }
        );
      }
      const headers = new Headers();
      const contentDisposition = response.headers.get('content-disposition');
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      if (contentDisposition) headers.set('Content-Disposition', contentDisposition);
      if (contentType) headers.set('Content-Type', contentType);
      if (contentLength) headers.set('Content-Length', contentLength);
      return new NextResponse(response.body, { status: response.status, headers });
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