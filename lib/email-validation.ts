/**
 * Email validation utilities.
 *
 * Disposable domain checking is done server-side via /api/validate-email
 * using the `disposable-email-domains` npm package (121k+ domains).
 *
 * This file contains shared normalization logic and client-side helpers.
 */

/**
 * Normalizes an email address to prevent alias abuse:
 * - Lowercases the entire email
 * - For Gmail/Googlemail: removes dots and strips +aliases
 * - For other providers: strips +aliases
 */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const [localPart, domain] = trimmed.split("@")

  if (!localPart || !domain) return trimmed

  // Normalize googlemail.com → gmail.com
  const normalizedDomain = domain === "googlemail.com" ? "gmail.com" : domain

  let normalizedLocal = localPart

  // Strip +alias for all providers (user+anything → user)
  const plusIndex = normalizedLocal.indexOf("+")
  if (plusIndex > 0) {
    normalizedLocal = normalizedLocal.substring(0, plusIndex)
  }

  // For Gmail specifically: remove dots (u.s.e.r → user)
  if (normalizedDomain === "gmail.com") {
    normalizedLocal = normalizedLocal.replace(/\./g, "")
  }

  return `${normalizedLocal}@${normalizedDomain}`
}

/**
 * Validates an email for signup by calling the server-side API.
 * Returns { valid, normalized, error } — the server checks against 121k+ disposable domains.
 */
export async function validateEmailForSignup(
  email: string
): Promise<{ valid: boolean; normalized?: string; error?: string }> {
  if (!email || !email.includes("@")) {
    return { valid: false, error: "Please enter a valid email address." }
  }

  try {
    const res = await fetch("/api/validate-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })

    const data = await res.json()
    return {
      valid: data.valid ?? false,
      normalized: data.normalized,
      error: data.error,
    }
  } catch {
    // If the API is unreachable, allow signup (don't block legitimate users)
    return { valid: true, normalized: normalizeEmail(email) }
  }
}
