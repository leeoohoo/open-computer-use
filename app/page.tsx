import { createClient } from "@/lib/supabase/server"
import { HomeClient } from "./home-client"
import { FAQSchema } from "./seo-schemas"

export const dynamic = "force-dynamic"

export default async function Home() {
  const supabase = await createClient()
  let isAuthenticated = false

  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser()
    isAuthenticated = !!user
  }

  return (
    <>
      <FAQSchema />
      <HomeClient isAuthenticated={isAuthenticated} />
    </>
  )
}
