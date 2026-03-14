/**
 * POST /api/swarm/[swarmId]/stop — Stop a running swarm.
 *
 * 1. Proxies cancellation to the Python backend
 * 2. Also terminates swarm machines directly (safety net if stream disconnected)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAwsEc2Service } from "@/lib/aws/ec2-service";

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

    // 1. Tell the backend to cancel execution
    const response = await fetch(
      `${PYTHON_BACKEND_URL}/api/swarm/stop/${swarmId}`,
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

    // 2. Also terminate and delete swarm machines directly (safety net)
    const { data: swarmMachines } = await (supabase as any)
      .from("user_machines")
      .select("id, settings")
      .eq("user_id", userId)
      .contains("settings", { swarm_id: swarmId });

    let terminated = 0;
    if (swarmMachines && swarmMachines.length > 0) {
      const awsService = getAwsEc2Service();

      for (const m of swarmMachines) {
        const s =
          typeof m.settings === "string"
            ? JSON.parse(m.settings)
            : m.settings || {};
        try {
          if (s.awsInstanceId) {
            await awsService.terminateInstance(
              s.awsInstanceId,
              s.awsKeyPairName
            );
          }
          await (supabase as any)
            .from("user_machines")
            .delete()
            .eq("id", m.id);
          terminated++;
        } catch (e) {
          console.error(`Stop cleanup: failed for machine ${m.id}:`, e);
        }
      }
    }

    // Update swarm_runs status to "cancelled" as a safety net.
    // The stream cleanup in route.ts also tries, but if the stream already
    // closed or the client disconnected this ensures the DB is correct.
    await (supabase as any)
      .from("swarm_runs")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("swarm_id", swarmId)
      .eq("user_id", userId)
      .in("status", ["creating", "running"]);

    return NextResponse.json({
      ...backendResult,
      machinesTerminated: terminated,
      swarmId,
    });
  } catch (error: any) {
    console.error("Error stopping swarm:", error);
    return NextResponse.json(
      { error: error.message || "Failed to stop swarm" },
      { status: 500 }
    );
  }
}
