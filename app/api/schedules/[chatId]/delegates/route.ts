/**
 * Next.js proxy for delegate management endpoints.
 *
 * GET    /api/schedules/:chatId/delegates  → Get delegates list
 * PUT    /api/schedules/:chatId/delegates  → Update delegates list
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { chatId } = await params
    const response = await fetch(
      `${PYTHON_BACKEND_URL}/api/schedules/${chatId}/delegates`,
      { method: 'GET', headers: buildHeaders(userId) }
    )

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Get delegates error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { chatId } = await params
    const body = JSON.stringify(await req.json())

    const response = await fetch(
      `${PYTHON_BACKEND_URL}/api/schedules/${chatId}/delegates`,
      { method: 'PUT', headers: buildHeaders(userId), body }
    )

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Update delegates error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
