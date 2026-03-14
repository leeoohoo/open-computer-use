import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8001"

const CRON_SECRET = process.env.CRON_SECRET

interface ServiceCheck {
  service_name: string
  status: "operational" | "degraded" | "outage"
  latency: number | null
  message: string | null
}

async function checkService(
  name: string,
  fn: () => Promise<void>
): Promise<ServiceCheck> {
  const start = Date.now()
  try {
    await fn()
    return { service_name: name, status: "operational", latency: Date.now() - start, message: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return { service_name: name, status: "outage", latency: null, message: msg }
  }
}

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization")
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  // Run all health checks
  const checks = await Promise.all([
    checkService("Website", async () => {
      // Self-check: if this endpoint responds, frontend is up
    }),

    checkService("AI Backend", async () => {
      const res = await fetch(`${PYTHON_BACKEND_URL}/api/health`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.status !== "healthy") throw new Error("Unhealthy")
    }),

    checkService("Database", async () => {
      const { error } = await supabase
        .from("users")
        .select("id")
        .limit(1)
      if (error) throw new Error(error.message)
    }),

    checkService("Authentication", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!url) throw new Error("Supabase URL not configured")
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }),

    checkService("AI Models", async () => {
      const res = await fetch(`${PYTHON_BACKEND_URL}/api/health`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.status !== "healthy") throw new Error("Backend unhealthy")
    }),

    checkService("File Storage", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!url) throw new Error("Supabase URL not configured")
      const res = await fetch(`${url}/storage/v1/bucket`, {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
        },
        signal: AbortSignal.timeout(5000),
      })
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`)
    }),
  ])

  // Persist to database
  const now = new Date().toISOString()
  const rows = checks.map((c) => ({ ...c, checked_at: now }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("status_checks").insert(rows)

  if (error) {
    return NextResponse.json(
      { error: "Failed to persist checks", detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    timestamp: now,
    checks: checks.map((c) => ({ service: c.service_name, status: c.status })),
  })
}
