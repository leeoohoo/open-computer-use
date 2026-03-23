import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

interface DayStatus {
  date: string // YYYY-MM-DD
  status: "operational" | "degraded" | "outage"
  checks: number
  operational_count: number
  avg_latency: number | null
}

interface ServiceHistory {
  service_name: string
  days: DayStatus[]
  uptime_percent: number
}

export async function GET() {
  // Read-only — uses anon key since RLS allows public SELECT on status_checks
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json(
      { services: [], has_data: false },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
    )
  }
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Fetch last 90 days of checks
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("status_checks")
    .select("service_name, status, latency, checked_at")
    .gte("checked_at", ninetyDaysAgo.toISOString())
    .order("checked_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { services: [], has_data: false },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      }
    )
  }

  // Group by service, then by day
  const serviceMap = new Map<string, Map<string, { statuses: string[]; latencies: number[] }>>()

  for (const row of data) {
    const date = row.checked_at.split("T")[0] // YYYY-MM-DD

    if (!serviceMap.has(row.service_name)) {
      serviceMap.set(row.service_name, new Map())
    }
    const dayMap = serviceMap.get(row.service_name)!

    if (!dayMap.has(date)) {
      dayMap.set(date, { statuses: [], latencies: [] })
    }
    const day = dayMap.get(date)!
    day.statuses.push(row.status)
    if (row.latency !== null) {
      day.latencies.push(row.latency)
    }
  }

  // Build response with all 90 days filled in
  const services: ServiceHistory[] = []

  for (const [serviceName, dayMap] of serviceMap) {
    const days: DayStatus[] = []
    let totalChecks = 0
    let totalOperational = 0

    for (let i = 89; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split("T")[0]

      const dayData = dayMap.get(dateStr)

      if (dayData) {
        const checks = dayData.statuses.length
        const opCount = dayData.statuses.filter((s) => s === "operational").length
        const hasOutage = dayData.statuses.some((s) => s === "outage")
        const hasDegraded = dayData.statuses.some((s) => s === "degraded")

        // Day status: outage if any outage, degraded if >20% non-operational, else operational
        const nonOpRatio = (checks - opCount) / checks
        const dayStatus = hasOutage && nonOpRatio > 0.3
          ? "outage"
          : (hasDegraded || hasOutage) && nonOpRatio > 0.1
            ? "degraded"
            : "operational"

        const avgLatency = dayData.latencies.length > 0
          ? Math.round(dayData.latencies.reduce((a, b) => a + b, 0) / dayData.latencies.length)
          : null

        days.push({
          date: dateStr,
          status: dayStatus,
          checks,
          operational_count: opCount,
          avg_latency: avgLatency,
        })

        totalChecks += checks
        totalOperational += opCount
      } else {
        // No data for this day — mark as no data (treat as operational for uptime calc if before first check)
        days.push({
          date: dateStr,
          status: "operational",
          checks: 0,
          operational_count: 0,
          avg_latency: null,
        })
      }
    }

    const uptimePercent = totalChecks > 0
      ? Math.round((totalOperational / totalChecks) * 10000) / 100
      : 100

    services.push({
      service_name: serviceName,
      days,
      uptime_percent: uptimePercent,
    })
  }

  return NextResponse.json(
    { services, has_data: true },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    }
  )
}
