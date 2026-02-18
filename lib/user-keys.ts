import { decryptKey } from "./encryption"
import { env } from "./openproviders/env"
import { Provider } from "./openproviders/types"
import { createClient } from "./supabase/server"

export type { Provider } from "./openproviders/types"

export async function getUserKey(
  userId: string,
  provider: Provider
): Promise<string | null> {
  try {
    const supabase = await createClient()
    if (!supabase) return null

    const { data, error } = await supabase
      .from("user_keys")
      .select("encrypted_key, iv")
      .eq("user_id", userId)
      .eq("provider", provider)
      .single()

    if (error || !data) return null

    return decryptKey(data.encrypted_key, data.iv)
  } catch (error) {
    console.error("Error retrieving user key:", error)
    return null
  }
}

export async function getEffectiveApiKey(
  userId: string | null,
  provider: Provider
): Promise<string | null> {
  // For Bedrock, we use AWS credentials from env — no per-user API keys
  return env.AWS_ACCESS_KEY_ID || null
}
