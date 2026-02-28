/**
 * Frontend API client for scheduled tasks.
 *
 * Calls the Next.js proxy routes which forward to the Python backend.
 */

export interface ScheduleConfig {
  frequency: string
  cron?: string
  timezone: string
  machineId: string
  time?: string
  dayOfWeek?: number
  dayOfMonth?: number
}

export interface ScheduleResponse {
  chat_id: string
  title: string | null
  enabled: boolean
  frequency: string
  cron: string
  timezone: string
  machine_id: string
  last_run_at: string | null
  next_run_at: string | null
  consecutive_failures: number
  paused_reason: string | null
  run_count: number
  created_at: string | null
}

export interface ScheduleHistoryEntry {
  id: string
  chat_id: string
  status: string
  trigger: string
  duration_seconds: number | null
  credits_charged: number | null
  error: string | null
  executed_at: string
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    let message = body
    try {
      const parsed = JSON.parse(body)
      message = parsed.detail || parsed.error || body
    } catch {
      // use raw text
    }
    throw new Error(message)
  }

  return res
}

export async function createSchedule(
  chatId: string,
  config: ScheduleConfig
): Promise<ScheduleResponse> {
  const res = await fetchWithAuth(`/api/schedules/${chatId}`, {
    method: 'POST',
    body: JSON.stringify(config),
  })
  const data = await res.json()
  return data.schedule
}

export async function getSchedule(
  chatId: string
): Promise<ScheduleResponse | null> {
  const res = await fetchWithAuth(`/api/schedules/${chatId}`)
  const data = await res.json()
  return data.schedule ?? null
}

export async function deleteSchedule(chatId: string): Promise<void> {
  await fetchWithAuth(`/api/schedules/${chatId}`, { method: 'DELETE' })
}

export async function listSchedules(): Promise<ScheduleResponse[]> {
  const res = await fetchWithAuth('/api/schedules')
  const data = await res.json()
  return data.schedules ?? []
}

export async function getScheduleHistory(
  chatId?: string,
  limit = 50
): Promise<ScheduleHistoryEntry[]> {
  const params = new URLSearchParams()
  params.set('history', 'true')
  if (chatId) params.set('chatId', chatId)
  params.set('limit', String(limit))

  const res = await fetchWithAuth(`/api/schedules?${params}`)
  const data = await res.json()
  return data.history ?? []
}

export async function triggerScheduleNow(chatId: string): Promise<void> {
  await fetchWithAuth(`/api/schedules/${chatId}?action=run-now`, { method: 'POST' })
}

export async function pauseSchedule(chatId: string): Promise<{ enabled: boolean }> {
  const res = await fetchWithAuth(`/api/schedules/${chatId}?action=pause`, {
    method: 'PATCH',
  })
  const data = await res.json()
  return { enabled: data.enabled }
}

export const FREQUENCY_OPTIONS = [
  { value: 'every_15_minutes', label: 'Every 15 minutes' },
  { value: 'every_30_minutes', label: 'Every 30 minutes' },
  { value: 'hourly', label: 'Every hour' },
  { value: 'every_6_hours', label: 'Every 6 hours' },
  { value: 'every_12_hours', label: 'Every 12 hours' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom (cron)' },
] as const

export function formatFrequency(frequency: string): string {
  const opt = FREQUENCY_OPTIONS.find((o) => o.value === frequency)
  return opt?.label ?? frequency
}

export function formatNextRun(nextRunAt: string | null): string {
  if (!nextRunAt) return 'Not scheduled'
  const d = new Date(nextRunAt)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()

  if (diffMs < 0) return 'Overdue'
  if (diffMs < 60_000) return 'Less than a minute'
  if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)} minutes`
  if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)} hours`
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
