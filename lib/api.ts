  import { APP_DOMAIN } from "@/lib/config"
import type { UserProfile } from "@/lib/user/types"
import { SupabaseClient } from "@supabase/supabase-js"
import { fetchClient } from "./fetch"
import { API_ROUTE_CREATE_GUEST, API_ROUTE_UPDATE_CHAT_MODEL } from "./routes"
import { createClient } from "./supabase/client"

/**
 * Creates a guest user record on the server
 */
export async function createGuestUser(guestId: string) {
  try {
    const res = await fetchClient(API_ROUTE_CREATE_GUEST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: guestId }),
    })
    const responseData = await res.json()
    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to create guest user: ${res.status} ${res.statusText}`
      )
    }

    return responseData
  } catch (err) {
    // Error creating guest user
    throw err
  }
}

export class UsageLimitError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "DAILY_LIMIT_REACHED"
  }
}

/**
 * Checks the user's daily usage and increments both overall and daily counters.
 * Resets the daily counter if a new day (UTC) is detected.
 * Uses the `anonymous` flag from the user record to decide which daily limit applies.
 *
 * @param supabase - Your Supabase client.
 * @param userId - The ID of the user.
 * @returns The remaining daily limit.
 */
export async function checkRateLimits(
  userId: string,
  isAuthenticated: boolean
) {
  try {
    const res = await fetchClient(
      `/api/rate-limits?userId=${userId}&isAuthenticated=${isAuthenticated}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    )
    const responseData = await res.json()
    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to check rate limits: ${res.status} ${res.statusText}`
      )
    }
    return responseData
  } catch (err) {
    // Error checking rate limits
    throw err
  }
}

/**
 * Updates the model for an existing chat
 */
export async function updateChatModel(chatId: string, model: string) {
  try {
    const res = await fetchClient(API_ROUTE_UPDATE_CHAT_MODEL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, model }),
    })
    const responseData = await res.json()

    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to update chat model: ${res.status} ${res.statusText}`
      )
    }

    return responseData
  } catch (error) {
    // Error updating chat model
    throw error
  }
}

/**
 * Signs in user anonymously via Supabase
 */
export async function signInAnonymously(supabase: SupabaseClient) {
  try {
    const { data, error } = await supabase.auth.signInAnonymously()

    if (error) {
      throw error
    }

    // Create guest user profile
    if (data?.user?.id) {
      await createGuestUser(data.user.id)
      localStorage.setItem(`guestProfileAttempted_${data.user.id}`, "true")
    }

    return data
  } catch (err) {
    // Error signing in anonymously
    throw err
  }
}

/**
 * Signs up a new user with email and password.
 * Requires email confirmation before the user can sign in.
 */
export async function signUpWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string
) {
  const isDev = process.env.NODE_ENV === "development"
  const baseUrl = isDev
    ? "http://localhost:3000"
    : typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : APP_DOMAIN

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback`,
    },
  })

  if (error) throw error
  return data
}

/**
 * Signs in user with email and password
 */
export async function signInWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string
) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

/**
 * Sends a magic link to the user's email for passwordless sign-in
 */
export async function signInWithMagicLink(
  supabase: SupabaseClient,
  email: string
) {
  const isDev = process.env.NODE_ENV === "development"
  const baseUrl = isDev
    ? "http://localhost:3000"
    : typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : APP_DOMAIN

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback`,
      shouldCreateUser: false,
    },
  })

  if (error) throw error
  return data
}

/**
 * Sends a password reset email
 */
export async function resetPassword(
  supabase: SupabaseClient,
  email: string
) {
  const isDev = process.env.NODE_ENV === "development"
  const baseUrl = isDev
    ? "http://localhost:3000"
    : typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : APP_DOMAIN

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/auth/reset-password`,
  })

  if (error) throw error
  return data
}

/**
 * Signs in user with Google OAuth via Supabase
 */
export async function signInWithGoogle(supabase: SupabaseClient) {
  try {
    const isDev = process.env.NODE_ENV === "development"

    // Get base URL dynamically (will work in both browser and server environments)
    const baseUrl = isDev
      ? "http://localhost:3000"
      : typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_VERCEL_URL
          ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
          : APP_DOMAIN

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${baseUrl}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        // You can optionally specify a custom auth URL if you have a custom domain
        // authUrl: process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL || undefined,
      },
    })

    if (error) {
      throw error
    }

    // Return the provider URL
    return data
  } catch (err) {
    // Error signing in with Google
    throw err
  }
}

export const getOrCreateGuestUserId = async (
  user: UserProfile | null
): Promise<string | null> => {
  if (user?.id) return user.id

  const supabase = createClient()

  if (!supabase) {
    // Supabase is not available
    return null
  }

  const existingGuestSessionUser = await supabase.auth.getUser()
  if (
    existingGuestSessionUser.data?.user &&
    existingGuestSessionUser.data.user.is_anonymous
  ) {
    const anonUserId = existingGuestSessionUser.data.user.id

    const profileCreationAttempted = localStorage.getItem(
      `guestProfileAttempted_${anonUserId}`
    )

    if (!profileCreationAttempted) {
      try {
        await createGuestUser(anonUserId)
        localStorage.setItem(`guestProfileAttempted_${anonUserId}`, "true")
      } catch (error) {
        // Failed to ensure guest user profile exists
        return null
      }
    }
    return anonUserId
  }

  try {
    const { data: anonAuthData, error: anonAuthError } =
      await supabase.auth.signInAnonymously()

    if (anonAuthError) {
      // Error during anonymous sign-in
      return null
    }

    if (!anonAuthData || !anonAuthData.user) {
      // Anonymous sign-in did not return a user
      return null
    }

    const guestIdFromAuth = anonAuthData.user.id
    await createGuestUser(guestIdFromAuth)
    localStorage.setItem(`guestProfileAttempted_${guestIdFromAuth}`, "true")
    return guestIdFromAuth
  } catch (error) {
    // Error in getOrCreateGuestUserId
    return null
  }
}
