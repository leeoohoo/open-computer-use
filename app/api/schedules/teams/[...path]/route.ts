/**
 * Catch-all proxy for team hub endpoints.
 *
 * Routes:
 * POST   /api/schedules/teams/create           → Create team
 * GET    /api/schedules/teams/list              → List teams
 * GET    /api/schedules/teams/:hubId            → Get team
 * PATCH  /api/schedules/teams/:hubId            → Update team
 * DELETE /api/schedules/teams/:hubId            → Delete team
 * POST   /api/schedules/teams/:hubId/members    → Add member
 * DELETE /api/schedules/teams/:hubId/members    → Remove member
 * GET    /api/schedules/teams/:hubId/memory     → View shared memory
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8001'
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || ''

async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return data.user.id
}

function buildHeaders(userId: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-ID': userId,
  }
  if (INTERNAL_API_KEY) {
    headers['X-Internal-Key'] = INTERNAL_API_KEY
  }
  return headers
}

function buildBackendUrl(path: string[], searchParams: URLSearchParams): string {
  const backendPath = `/api/schedules/teams/${path.join('/')}`
  const qs = searchParams.toString()
  return `${PYTHON_BACKEND_URL}${backendPath}${qs ? `?${qs}` : ''}`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { path } = await params
    const { searchParams } = new URL(req.url)
    const response = await fetch(buildBackendUrl(path, searchParams), {
      method: 'GET',
      headers: buildHeaders(userId),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Teams proxy GET error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { path } = await params
    const { searchParams } = new URL(req.url)

    let body: string | undefined
    try {
      body = JSON.stringify(await req.json())
    } catch {
      // no body (e.g. add member uses query params)
    }

    const response = await fetch(buildBackendUrl(path, searchParams), {
      method: 'POST',
      headers: buildHeaders(userId),
      body,
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Teams proxy POST error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { path } = await params

    let body: string | undefined
    try {
      body = JSON.stringify(await req.json())
    } catch {
      // no body
    }

    const response = await fetch(buildBackendUrl(path, new URLSearchParams()), {
      method: 'PATCH',
      headers: buildHeaders(userId),
      body,
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Teams proxy PATCH error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { path } = await params
    const { searchParams } = new URL(req.url)
    const response = await fetch(buildBackendUrl(path, searchParams), {
      method: 'DELETE',
      headers: buildHeaders(userId),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Teams proxy DELETE error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
