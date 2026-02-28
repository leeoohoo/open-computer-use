/**
 * Next.js proxy for schedule list and history endpoints.
 *
 * GET /api/schedules        → Python backend GET /api/schedules
 * GET /api/schedules?history=true → Python backend GET /api/schedules/history
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8001'
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || ''

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const isHistory = searchParams.get('history') === 'true'
    const chatId = searchParams.get('chatId')
    const limit = searchParams.get('limit') || '50'

    let backendUrl: string
    if (isHistory) {
      const params = new URLSearchParams()
      if (chatId) params.set('chat_id', chatId)
      params.set('limit', limit)
      backendUrl = `${PYTHON_BACKEND_URL}/api/schedules/history?${params}`
    } else {
      backendUrl = `${PYTHON_BACKEND_URL}/api/schedules`
    }

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': authData.user.id,
        ...(INTERNAL_API_KEY && { 'X-Internal-Key': INTERNAL_API_KEY }),
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Schedules proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    )
  }
}
