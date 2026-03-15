import disposableDomains from "disposable-email-domains"
import { normalizeEmail } from "@/lib/email-validation"

// Build a Set once at module load for O(1) lookups (121k+ domains)
const DISPOSABLE_SET = new Set(disposableDomains)

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return Response.json(
        { valid: false, error: "Please enter a valid email address." },
        { status: 400 }
      )
    }

    const normalized = normalizeEmail(email)
    const domain = normalized.split("@")[1]

    if (!domain) {
      return Response.json(
        { valid: false, error: "Please enter a valid email address." },
        { status: 400 }
      )
    }

    if (DISPOSABLE_SET.has(domain)) {
      return Response.json(
        {
          valid: false,
          error:
            "Temporary or disposable email addresses are not allowed. Please use a permanent email.",
        },
        { status: 400 }
      )
    }

    return Response.json({ valid: true, normalized })
  } catch {
    return Response.json(
      { valid: false, error: "Invalid request." },
      { status: 400 }
    )
  }
}
