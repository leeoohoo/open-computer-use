/**
 * POST /api/swarm/[swarmId]/stop — Stop a running swarm.
 *
 * 1. Proxies cancellation to the Python backend
 * 2. For temporary swarms: terminates machines directly (safety net)
 * 3. For persistent swarms: converts machines to regular persistent machines
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAwsEc2Service } from "@/lib/aws/ec2-service";
import { cleanupOrphanedMailboxes } from "@/lib/services/workmail-service";

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

    // 2. Check if this is a persistent swarm
    const { data: swarmRun } = await (supabase as any)
      .from("swarm_runs")
      .select("persistent")
      .eq("swarm_id", swarmId)
      .eq("user_id", userId)
      .maybeSingle();

    const isPersistent = swarmRun?.persistent === true;

    // 3. Handle swarm machines
    const { data: swarmMachines } = await (supabase as any)
      .from("user_machines")
      .select("id, settings, display_name")
      .eq("user_id", userId)
      .contains("settings", { swarm_id: swarmId });

    let terminated = 0;
    let converted = 0;

    if (swarmMachines && swarmMachines.length > 0) {
      if (isPersistent) {
        // Convert machines to regular persistent machines (keep them alive)
        for (const m of swarmMachines) {
          const s =
            typeof m.settings === "string"
              ? JSON.parse(m.settings)
              : { ...(m.settings || {}) };
          try {
            // Strip swarm flags
            delete s.is_swarm;
            delete s.persistent_swarm;
            delete s.swarm_id;
            delete s.swarm_index;
            delete s.swarm_created_at;

            await (supabase as any)
              .from("user_machines")
              .update({
                settings: s,
                display_name: m.display_name?.replace(/^Swarm #\d+/, "Machine"),
                status: "running",
              })
              .eq("id", m.id);
            converted++;
          } catch (e) {
            console.error(`Stop: failed to convert persistent machine ${m.id}:`, e);
          }
        }
      } else {
        // Terminate temporary swarm machines
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
    }

    // Cleanup WorkMail mailboxes for this swarm (fire-and-forget for non-persistent)
    if (!isPersistent) {
      cleanupOrphanedMailboxes(1).catch((e) =>
        console.error(`Stop: mailbox cleanup error for swarm ${swarmId}:`, e)
      );
    }

    // Update swarm_runs status to "cancelled" as a safety net.
    await (supabase as any)
      .from("swarm_runs")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("swarm_id", swarmId)
      .eq("user_id", userId)
      .in("status", ["creating", "running", "paused"]);

    return NextResponse.json({
      ...backendResult,
      machinesTerminated: terminated,
      machinesConverted: converted,
      persistent: isPersistent,
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
