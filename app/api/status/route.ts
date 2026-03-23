import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8001"

interface ServiceCheck {
  name: string
  status: "operational" | "degraded" | "outage"
  latency: number | null
  message?: string
}

async function checkService(
  name: string,
  fn: () => Promise<void>
): Promise<ServiceCheck> {
  const start = Date.now()
  try {
    await fn()
    return { name, status: "operational", latency: Date.now() - start }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return { name, status: "outage", latency: null, message: msg }
  }
}

export async function GET() {
  const checks = await Promise.all([
    // 1. Website / Frontend
    checkService("Website", async () => {
      // If this endpoint is responding, the frontend is up
    }),

    // 2. AI Backend
    checkService("AI Backend", async () => {
      const res = await fetch(`${PYTHON_BACKEND_URL}/api/health`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.status !== "healthy") throw new Error("Unhealthy")
    }),

    // 3. Database (Supabase)
    checkService("Database", async () => {
      // Try service client first, fall back to REST API ping with anon key
      const supabase = createServiceClient()
      if (supabase) {
        const { error } = await supabase
          .from("users")
          .select("id")
          .limit(1)
        if (error) throw new Error(error.message)
      } else {
        // Service role not available — verify Supabase REST API is reachable
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (!url) throw new Error("Supabase URL not configured")
        const res = await fetch(`${url}/rest/v1/`, {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          },
          signal: AbortSignal.timeout(5000),
        })
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`)
      }
    }),

    // 4. Authentication
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

    // 5. AI Models (readiness check — verifies Bedrock/model provider connectivity)
    checkService("AI Models", async () => {
      const res = await fetch(`${PYTHON_BACKEND_URL}/api/ready`, {
        signal: AbortSignal.timeout(10000),
      })
      const data = await res.json()
      if (data.models === "error") throw new Error("Model provider unreachable")
      if (data.status !== "ready" && data.models !== "available")
        throw new Error(data.status || "Not ready")
    }),

    // 6. File Storage (Supabase Storage)
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
      // 200 = buckets listed, 400 = no auth but storage responding, 401/403 = storage is up but auth needed (still operational)
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`)
    }),
  ])

  // Persist checks to database
  const supabase = createServiceClient()
  if (supabase) {
    const now = new Date().toISOString()
    const rows = checks.map((c) => ({
      service_name: c.name,
      status: c.status,
      latency: c.latency,
      message: c.message || null,
      checked_at: now,
    }))
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("status_checks").insert(rows)
    } catch (e) {
      console.error("[Status] Failed to persist checks:", e)
    }
  }

  const allOperational = checks.every((c) => c.status === "operational")
  const hasOutage = checks.some((c) => c.status === "outage")

  return NextResponse.json(
    {
      overall: allOperational
        ? "operational"
        : hasOutage
          ? "outage"
          : "degraded",
      timestamp: new Date().toISOString(),
      services: checks,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    }
  )
}
