import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/swarms/shared/[id] — Public endpoint for shared swarm runs
// No auth required — only returns data if the swarm is marked public
export async function GET(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    );
  }

  const { id: swarmId } = await params;

  // Fetch the swarm run — only if public
  const { data: swarm, error: swarmError } = await (supabase as any)
    .from("swarm_runs")
    .select("swarm_id, prompt, machine_count, status, model, max_steps, result_summary, created_at, completed_at, public")
    .eq("swarm_id", swarmId)
    .eq("public", true)
    .single();

  if (swarmError || !swarm) {
    return NextResponse.json(
      { error: "Swarm not found or is not public" },
      { status: 404 }
    );
  }

  // Fetch events
  const { data: events, error: eventsError } = await (supabase as any)
    .from("swarm_run_events")
    .select("id, swarm_id, machine_index, event_type, content, screenshot, tool_name, created_at")
    .eq("swarm_id", swarmId)
    .order("created_at", { ascending: true })
    .limit(500);

  return NextResponse.json({
    swarm,
    events: events || [],
  });
}
