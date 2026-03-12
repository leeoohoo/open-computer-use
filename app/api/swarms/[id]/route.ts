import { createClient } from "@/lib/supabase/server";
import { APP_DOMAIN } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/swarms/[id] — Fetch a single swarm run with its event log
export async function GET(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: swarmId } = await params;

  // Fetch the swarm run
  const { data: swarm, error: swarmError } = await (supabase as any)
    .from("swarm_runs")
    .select("*")
    .eq("swarm_id", swarmId)
    .eq("user_id", authData.user.id)
    .single();

  if (swarmError || !swarm) {
    return NextResponse.json({ error: "Swarm not found" }, { status: 404 });
  }

  // Fetch events
  const { data: events, error: eventsError } = await (supabase as any)
    .from("swarm_run_events")
    .select("*")
    .eq("swarm_id", swarmId)
    .order("created_at", { ascending: true })
    .limit(500);

  return NextResponse.json({
    swarm,
    events: events || [],
  });
}

// PATCH /api/swarms/[id] — Toggle public/private visibility
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: swarmId } = await params;
  const body = await req.json();
  const { public: isPublic } = body;

  if (typeof isPublic !== "boolean") {
    return NextResponse.json(
      { error: "Invalid request body. 'public' must be a boolean" },
      { status: 400 }
    );
  }

  // Verify ownership
  const { data: swarm, error: fetchError } = await (supabase as any)
    .from("swarm_runs")
    .select("*")
    .eq("swarm_id", swarmId)
    .eq("user_id", authData.user.id)
    .single();

  if (fetchError || !swarm) {
    return NextResponse.json(
      { error: "Swarm not found or you don't have permission" },
      { status: 404 }
    );
  }

  // Update visibility
  const { data: updated, error: updateError } = await (supabase as any)
    .from("swarm_runs")
    .update({ public: isPublic })
    .eq("swarm_id", swarmId)
    .eq("user_id", authData.user.id)
    .select("*")
    .single();

  if (updateError) {
    console.error("Error updating swarm visibility:", updateError);
    return NextResponse.json(
      { error: "Failed to update visibility", details: updateError.message },
      { status: 500 }
    );
  }

  const shareUrl = isPublic ? `${APP_DOMAIN}/share/swarm/${swarmId}` : null;

  return NextResponse.json({ swarm: updated, shareUrl });
}
