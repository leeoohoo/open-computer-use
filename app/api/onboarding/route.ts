import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { headers } from "next/headers"

// Random adjective + noun name generator for machines
const ADJECTIVES = [
  "swift", "cosmic", "lunar", "stellar", "nova", "turbo", "hyper",
  "quantum", "cyber", "neon", "pixel", "atomic", "solar", "velvet",
  "crimson", "azure", "frost", "ember", "coral", "sage",
]
const NOUNS = [
  "falcon", "phoenix", "atlas", "titan", "orbit", "spark", "pulse",
  "nexus", "prism", "wave", "storm", "blaze", "comet", "eagle",
  "wolf", "hawk", "lynx", "puma", "raven", "fox",
]

function generateMachineName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${adj}-${noun}`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      display_name,
      role,
      company,
      website,
      team_size,
      referral_source,
      use_case,
    } = body

    const { error } = await supabase
      .from("users")
      .update({
        display_name: display_name || null,
        role: role || null,
        company: company || null,
        website: website || null,
        team_size: team_size || null,
        referral_source: referral_source || null,
        use_case: use_case || null,
        onboarding_completed: true,
      })
      .eq("id", user.id)

    if (error) {
      console.error("Onboarding update error:", error)
      return NextResponse.json(
        { error: "Failed to save onboarding data" },
        { status: 500 }
      )
    }

    // Check if user already has any machines — if not, create one automatically
    const { data: existingMachines } = await supabase
      .from("user_machines")
      .select("id")
      .eq("user_id", user.id)
      .not("status", "in", '("deleting","error")')
      .limit(1)

    if (!existingMachines || existingMachines.length === 0) {
      // Fire off machine creation in the background (don't block onboarding response)
      const reqHeaders = await headers()
      const host = reqHeaders.get("host") || "localhost:3000"
      const protocol = reqHeaders.get("x-forwarded-proto") || "http"
      const cookieHeader = reqHeaders.get("cookie") || ""

      const machineUrl = `${protocol}://${host}/api/machines`
      const machineName = generateMachineName()

      // Non-blocking: fire and forget
      fetch(machineUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({
          displayName: machineName,
          provider: "aws",
          desktopEnabled: true,
        }),
      }).catch((err) => {
        console.error("Auto machine creation failed:", err)
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Onboarding error:", err)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
