import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { provider, userId } = await request.json()

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // All models route through Bedrock — check if AWS credentials are configured
    const hasAwsCredentials = !!(
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    )

    return NextResponse.json({
      hasUserKey: false,
      hasSystemKey: hasAwsCredentials,
      provider: "bedrock",
    })
  } catch (error) {
    console.error("Error checking provider keys:", error)
    return NextResponse.json(
      { error: "Server error occurred" },
      { status: 500 }
    )
  }
}
