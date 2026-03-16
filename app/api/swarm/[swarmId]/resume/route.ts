/**
 * POST /api/swarm/[swarmId]/resume — Resume a paused swarm.
 *
 * Proxies to the Python backend which clears the pause event.
 * All machines resume execution from where they left off.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8001";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

interface RouteParams {
  params: Promise<{ swarmId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
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

    const { swarmId } = await params;
    const userId = authData.user.id;

    const response = await fetch(
      `${PYTHON_BACKEND_URL}/api/swarm/resume/${swarmId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": userId,
          ...(INTERNAL_API_KEY && { "X-Internal-Key": INTERNAL_API_KEY }),
        },
      }
    );

    let backendResult: any = {};
    if (response.ok) {
      backendResult = await response.json();
    }

    // Update DB status back to running
    await (supabase as any)
      .from("swarm_runs")
      .update({ status: "running" })
      .eq("swarm_id", swarmId)
      .eq("user_id", userId)
      .eq("status", "paused");

    return NextResponse.json({ ...backendResult, swarmId });
  } catch (error: any) {
    console.error("Error resuming swarm:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resume swarm" },
      { status: 500 }
    );
  }
}
