import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection error" },
        { status: 500 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch referral transactions where this user is the referrer
    // These have direction=referrer and the current user as user_id
    const { data: referrerTransactions } = await (supabase as any)
      .from("credit_transactions")
      .select("id, amount, created_at, metadata")
      .eq("user_id", user.id)
      .eq("type", "bonus")
      .filter("metadata->>referral_type", "eq", "signup_referral")
      .filter("metadata->>direction", "eq", "referrer")
      .order("created_at", { ascending: false })
      .limit(50)

    // Fetch referral transactions where this user was referred
    const { data: referredTransactions } = await (supabase as any)
      .from("credit_transactions")
      .select("id, amount, created_at, metadata")
      .eq("user_id", user.id)
      .eq("type", "bonus")
      .filter("metadata->>referral_type", "eq", "signup_referral")
      .filter("metadata->>direction", "eq", "referred")
      .order("created_at", { ascending: false })
      .limit(1)

    const referrals = (referrerTransactions || []).map((t: any) => ({
      id: t.id,
      email: t.metadata?.referred_user_email || "Unknown",
      credits: t.amount,
      date: t.created_at,
    }))

    const totalEarned = referrals.reduce(
      (sum: number, r: any) => sum + r.credits,
      0
    )

    // Check if user was referred by someone
    const referredBy =
      referredTransactions && referredTransactions.length > 0
        ? {
            email: referredTransactions[0].metadata?.referrer_email || "Someone",
            credits: referredTransactions[0].amount,
            date: referredTransactions[0].created_at,
          }
        : null

    return NextResponse.json({
      referrals,
      totalEarned,
      totalReferrals: referrals.length,
      referredBy,
    })
  } catch (error) {
    console.error("Error fetching referral stats:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
