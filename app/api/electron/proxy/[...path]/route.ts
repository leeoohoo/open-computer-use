/**
 * Catch-all proxy for Electron desktop app → Python backend.
 *
 * The Electron app sends Bearer token auth (not cookies). This route:
 * 1. Verifies the Bearer JWT against Supabase
 * 2. Forwards the request to the Python backend with X-Internal-Key
 *
 * Usage: Electron calls /api/electron/proxy/chats/create
 *        → this route strips the prefix and forwards to Python /api/chats/create
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyBearerToken } from "@/lib/supabase/bearer-auth"

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8001"
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || ""

async function proxyToBackend(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // Authenticate via Bearer token
  const { user, error } = await verifyBearerToken(req)
  if (!user) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status: 401 })
  }

  const { path } = await params
  const backendPath = `/api/${path.join("/")}`

  // Build the target URL, preserving query params
  const url = new URL(backendPath, PYTHON_BACKEND_URL)
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value)
  })

  // Forward headers, replacing auth with internal key + verified user ID
  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("Content-Type") || "application/json",
    "X-User-ID": user.id,
    ...(INTERNAL_API_KEY && { "X-Internal-Key": INTERNAL_API_KEY }),
  }

  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
  }

  // Forward body for non-GET requests
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      const body = await req.json()
      // Enforce verified user_id so clients can't spoof it
      body.user_id = user.id
      fetchOptions.body = JSON.stringify(body)
    } catch {
      // No body or non-JSON body
    }
  }

  try {
    const response = await fetch(url.toString(), fetchOptions)

    // Stream the response back
    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
      // Skip hop-by-hop headers
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    })

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to backend service" },
      { status: 503 },
    )
  }
}

export const GET = proxyToBackend
export const POST = proxyToBackend
export const PATCH = proxyToBackend
export const DELETE = proxyToBackend
export const PUT = proxyToBackend
