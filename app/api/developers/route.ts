import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import * as crypto from "crypto"

const KEY_PREFIX = "cua_sk_"

export async function GET() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 500 })
    }

    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authData.user.id
    const now = Date.now()
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()

    // Fetch keys
    const { data: keys, error } = await supabase
      .from("api_keys")
      .select("id, name, tier, scopes, created_at, last_used_at, key_prefix")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch 30-day usage with full detail
    const { data: usage } = await supabase
      .from("api_usage")
      .select("endpoint, credits_charged, created_at, request_id")
      .eq("user_id", userId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })

    const rows: { endpoint: string; credits_charged: number; created_at: string; request_id: string }[] = usage ?? []

    // ── Aggregate stats ──
    const totalRequests = rows.length
    const totalCredits = rows.reduce((s: number, r) => s + (r.credits_charged ?? 0), 0)

    // Requests in last 24h and 7d
    const requests24h = rows.filter(r => r.created_at >= oneDayAgo).length
    const requests7d = rows.filter(r => r.created_at >= sevenDaysAgo).length
    const credits7d = rows.filter(r => r.created_at >= sevenDaysAgo).reduce((s: number, r) => s + (r.credits_charged ?? 0), 0)

    // ── Per-endpoint breakdown ──
    const byEndpoint: Record<string, { requests: number; credits: number }> = {}
    for (const r of rows) {
      const ep = r.endpoint ?? "unknown"
      if (!byEndpoint[ep]) byEndpoint[ep] = { requests: 0, credits: 0 }
      byEndpoint[ep].requests++
      byEndpoint[ep].credits += r.credits_charged ?? 0
    }

    // ── Daily activity (last 14 days) ──
    const dailyMap: Record<string, { requests: number; credits: number }> = {}
    for (let i = 0; i < 14; i++) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10) // YYYY-MM-DD
      dailyMap[key] = { requests: 0, credits: 0 }
    }
    for (const r of rows) {
      const day = r.created_at?.slice(0, 10)
      if (day && dailyMap[day]) {
        dailyMap[day].requests++
        dailyMap[day].credits += r.credits_charged ?? 0
      }
    }
    const daily = Object.entries(dailyMap)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ── Recent requests (last 10) ──
    const recent = rows.slice(0, 10).map(r => ({
      endpoint: r.endpoint,
      credits: r.credits_charged ?? 0,
      time: r.created_at,
    }))

    // ── Peak hour ──
    const hourBuckets: number[] = new Array(24).fill(0)
    for (const r of rows) {
      const h = new Date(r.created_at).getHours()
      hourBuckets[h]++
    }
    const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets))

    // ── Credit balance ──
    const { data: creditsData } = await supabase
      .from("user_credits")
      .select("balance, subscription_tier")
      .eq("user_id", userId)
      .single()

    return NextResponse.json({
      keys: keys ?? [],
      stats: {
        keyCount: keys?.length ?? 0,
        totalRequests,
        totalCredits,
        requests24h,
        requests7d,
        credits7d,
        avgCreditsPerRequest: totalRequests > 0 ? Math.round((totalCredits / totalRequests) * 10) / 10 : 0,
        peakHour: totalRequests > 0 ? peakHour : null,
        balance: creditsData?.balance ?? 0,
        tier: creditsData?.subscription_tier ?? "",
      },
      byEndpoint,
      daily,
      recent,
    })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 500 })
    }

    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, scopes } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const rawKey = KEY_PREFIX + crypto.randomBytes(24).toString("hex")
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")
    const keyId = crypto.randomBytes(8).toString("hex")

    const { error } = await supabase.from("api_keys").insert({
      id: keyId,
      user_id: authData.user.id,
      key_hash: keyHash,
      key_prefix: rawKey.slice(0, 12),
      name: name.trim(),
      tier: "free",
      scopes: scopes ?? ["predict", "session", "ground", "ocr", "parse"],
      is_active: true,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      key: rawKey,
      key_id: keyId,
      name: name.trim(),
      scopes: scopes ?? ["predict", "session", "ground", "ocr", "parse"],
      created_at: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
