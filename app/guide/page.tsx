import { createClient } from "@/lib/supabase/server"
import { GuideClient } from "./guide-client"

export const dynamic = "force-dynamic"

export default async function GuidePage() {
  const supabase = await createClient()
  let isAuthenticated = false

  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser()
    isAuthenticated = !!user
  }

  return <GuideClient inApp={isAuthenticated} />
}
