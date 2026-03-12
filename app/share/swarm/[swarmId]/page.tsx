import { APP_DOMAIN } from "@/lib/config"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { SharedSwarmView } from "./shared-swarm-view"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ swarmId: string }>
}): Promise<Metadata> {
  if (!isSupabaseEnabled) {
    return notFound()
  }

  const { swarmId } = await params
  const admin = createServiceClient()

  if (!admin) {
    return notFound()
  }

  const { data: swarm } = await (admin as any)
    .from("swarm_runs")
    .select("prompt, machine_count, status, public, user_id, created_at")
    .eq("swarm_id", swarmId)
    .single()

  // Check if public or owner
  const supabase = await createClient()
  const { data: { user } } = await supabase!.auth.getUser()
  const isOwner = user?.id === swarm?.user_id
  const isPublic = swarm?.public === true

  if (!swarm || (!isPublic && !isOwner)) {
    return {
      title: "Swarm Not Found",
      description: "This swarm run is not available for viewing.",
    }
  }

  const promptPreview = swarm.prompt.length > 100
    ? swarm.prompt.slice(0, 100) + "..."
    : swarm.prompt
  const title = `Swarm: ${promptPreview}`
  const description = `Coasty swarm run across ${swarm.machine_count} machine${swarm.machine_count !== 1 ? "s" : ""} — ${promptPreview}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${APP_DOMAIN}/share/swarm/${swarmId}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default async function ShareSwarmPage({
  params,
}: {
  params: Promise<{ swarmId: string }>
}) {
  if (!isSupabaseEnabled) {
    return notFound()
  }

  const { swarmId } = await params
  const admin = createServiceClient()

  if (!admin) {
    return notFound()
  }

  // Use service client to bypass RLS — access control is handled below
  const { data: swarm, error: swarmError } = await (admin as any)
    .from("swarm_runs")
    .select("swarm_id, prompt, machine_count, status, model, result_summary, created_at, completed_at, public, user_id")
    .eq("swarm_id", swarmId)
    .single()

  if (swarmError || !swarm) {
    redirect("/")
  }

  // Check if public or owner
  const supabase = await createClient()
  const { data: { user } } = await supabase!.auth.getUser()
  const isOwner = user?.id === swarm.user_id
  const isPublic = swarm.public === true

  if (!isPublic && !isOwner) {
    redirect("/")
  }

  // Fetch events
  const { data: events } = await (admin as any)
    .from("swarm_run_events")
    .select("*")
    .eq("swarm_id", swarmId)
    .order("created_at", { ascending: true })
    .limit(500)

  return (
    <SharedSwarmView
      swarm={{
        swarm_id: swarm.swarm_id,
        prompt: swarm.prompt,
        machine_count: swarm.machine_count,
        status: swarm.status,
        model: swarm.model,
        result_summary: swarm.result_summary,
        created_at: swarm.created_at,
        completed_at: swarm.completed_at,
      }}
      events={events || []}
    />
  )
}
