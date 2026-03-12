/**
 * POST /api/swarm — Swarm Mode orchestrator.
 *
 * 1. Creates N temporary AWS machines (tagged is_swarm)
 * 2. Polls until all are ready (agent health)
 * 3. Proxies to Python backend for parallel execution (SSE)
 * 4. Deletes ALL swarm machines in finally block — guaranteed cleanup
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAwsEc2Service } from "@/lib/aws/ec2-service";
import WebSocket from "ws";

const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8001";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

export const maxDuration = 600; // 10 minutes — swarms take longer

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SwarmRequest {
  prompt: string;
  machineCount?: number;
  maxSteps?: number;
  model?: string;
}

interface SwarmMachineRecord {
  id: string;
  awsInstanceId: string;
  keyPairName: string;
  publicIp?: string;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
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

  const userId = authData.user.id;
  const body: SwarmRequest = await req.json();

  if (!body.prompt?.trim()) {
    return NextResponse.json(
      { error: "prompt is required" },
      { status: 400 }
    );
  }

  // -----------------------------------------------------------------------
  // Determine how many machines to create
  // -----------------------------------------------------------------------
  const { data: subscriptions } = await (supabase as any)
    .from("user_subscriptions")
    .select(`status, subscription_plans ( tier, max_machines )`)
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"]);

  const plan = subscriptions?.[0]?.subscription_plans;
  const maxMachines = plan?.max_machines || 1;
  const requestedCount = Math.min(
    body.machineCount || maxMachines,
    maxMachines,
    10 // hard cap
  );

  if (requestedCount < 1) {
    return NextResponse.json(
      { error: "Need at least 1 machine" },
      { status: 400 }
    );
  }

  // -----------------------------------------------------------------------
  // Create swarm machines
  // -----------------------------------------------------------------------
  const swarmId = crypto.randomUUID();
  console.log(`Swarm ${swarmId}: starting with ${requestedCount} machines for user ${userId}`);
  const awsService = getAwsEc2Service();
  const machines: SwarmMachineRecord[] = [];
  let cleanedUp = false;

  // Helper: delete ALL swarm machines — idempotent via cleanedUp guard.
  async function deleteAllSwarmMachines() {
    if (cleanedUp) return;
    cleanedUp = true;

    for (const m of machines) {
      try {
        if (m.awsInstanceId) {
          await awsService.terminateInstance(m.awsInstanceId, m.keyPairName);
        }
      } catch (e) {
        console.error(
          `Swarm cleanup: failed to terminate ${m.awsInstanceId}:`,
          e
        );
      }
      try {
        await (supabase as any)
          .from("user_machines")
          .delete()
          .eq("id", m.id);
      } catch (e) {
        console.error(`Swarm cleanup: failed to delete DB record ${m.id}:`, e);
      }
    }
    if (machines.length > 0) {
      console.log(
        `Swarm ${swarmId}: cleaned up ${machines.length} temporary machines`
      );
    }
  }

  try {
    const vncPassword =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 8);

    // Create all machines in parallel.
    // We push a partial record to `machines` immediately after DB insert
    // so cleanup can find it even if EC2 creation fails.
    const createPromises = Array.from({ length: requestedCount }, async (_, i) => {
      const containerName =
        `swarm-${userId.substring(0, 8)}-${swarmId.substring(0, 8)}-${i}`.toLowerCase();

      // Insert placeholder in DB
      const { data: dbMachine, error: insertError } = await (supabase as any)
        .from("user_machines")
        .insert({
          user_id: userId,
          container_name: containerName,
          display_name: `Swarm #${i + 1}`,
          status: "creating",
          azure_resource_group: "",
          azure_container_group: "",
          vnc_password: vncPassword,
          vnc_port: 5901,
          websocket_port: 6080,
          cpu_cores: 2,
          memory_gb: 2,
          storage_gb: 16,
          gpu_enabled: false,
          settings: {
            provider: "aws",
            is_swarm: true,
            swarm_id: swarmId,
            swarm_index: i,
            swarm_created_at: new Date().toISOString(),
            sshUsername: "ubuntu",
            desktopEnabled: true,
          },
        })
        .select()
        .single();

      if (insertError || !dbMachine) {
        console.error(`Swarm ${swarmId}: DB insert failed for machine #${i}:`, insertError);
        throw new Error(
          `Failed to create swarm machine #${i}: ${insertError?.message}`
        );
      }
      console.log(`Swarm ${swarmId}: DB record created for machine #${i}: ${dbMachine.id}`);

      // Track immediately so cleanup can find it if EC2 creation fails
      const record: SwarmMachineRecord = {
        id: dbMachine.id,
        awsInstanceId: "",
        keyPairName: "",
      };
      machines.push(record);

      // Launch EC2 instance
      const result = await awsService.createInstance(userId, {
        name: containerName,
        storageGb: 16,
        desktopEnabled: true,
        vncPassword,
      });

      // Update the tracked record with AWS details
      record.awsInstanceId = result.instanceId;
      record.keyPairName = result.keyPairName;

      // Update DB with AWS details
      await (supabase as any)
        .from("user_machines")
        .update({
          settings: {
            provider: "aws",
            is_swarm: true,
            swarm_id: swarmId,
            swarm_index: i,
            swarm_created_at: new Date().toISOString(),
            sshUsername: "ubuntu",
            desktopEnabled: true,
            awsInstanceId: result.instanceId,
            awsRegion: process.env.AWS_REGION || "us-east-1",
            awsKeyPairName: result.keyPairName,
            awsInstanceType: "t4g.small",
            agent_port: 8080,
          },
        })
        .eq("id", dbMachine.id);

      return record;
    });

    await Promise.allSettled(createPromises);

    // Filter to only machines that got an EC2 instance
    const liveMachines = machines.filter((m) => m.awsInstanceId);

    if (liveMachines.length === 0) {
      await deleteAllSwarmMachines();
      return NextResponse.json(
        { error: "Failed to create any swarm machines" },
        { status: 500 }
      );
    }

    console.log(
      `Swarm ${swarmId}: created ${liveMachines.length}/${requestedCount} machines`
    );

    // -----------------------------------------------------------------------
    // Poll for IP assignment and agent readiness
    // -----------------------------------------------------------------------
    const readyMachines = await waitForMachinesReady(
      supabase,
      awsService,
      liveMachines,
      swarmId
    );

    if (readyMachines.length === 0) {
      console.error(`Swarm ${swarmId}: no machines became ready`);
      await deleteAllSwarmMachines();
      return NextResponse.json(
        { error: "No swarm machines became ready in time" },
        { status: 504 }
      );
    }

    console.log(
      `Swarm ${swarmId}: ${readyMachines.length} machines ready, starting execution`
    );

    // -----------------------------------------------------------------------
    // Proxy to Python backend for parallel execution
    // -----------------------------------------------------------------------
    const backendBody = {
      swarm_id: swarmId,
      prompt: body.prompt,
      machines: readyMachines.map((m) => ({
        machine_id: m.id,
        display_name: `Swarm Machine`,
      })),
      model: body.model,
      max_steps: body.maxSteps || 200,
      user_id: userId,
    };

    const controller = new AbortController();
    req.signal.addEventListener("abort", () => {
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    });

    const backendResponse = await fetch(
      `${PYTHON_BACKEND_URL}/api/swarm/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "X-User-ID": userId,
          ...(INTERNAL_API_KEY && { "X-Internal-Key": INTERNAL_API_KEY }),
        },
        body: JSON.stringify(backendBody),
        signal: controller.signal,
      }
    );

    if (!backendResponse.ok) {
      const errText = await backendResponse.text();
      await deleteAllSwarmMachines();
      return NextResponse.json(
        { error: errText || "Backend swarm execution failed" },
        { status: backendResponse.status }
      );
    }

    const reader = backendResponse.body?.getReader();
    if (!reader) {
      await deleteAllSwarmMachines();
      return NextResponse.json(
        { error: "No response stream from backend" },
        { status: 500 }
      );
    }

    const stream = new ReadableStream({
      async start(streamController) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              streamController.close();
              break;
            }
            streamController.enqueue(value);
          }
        } catch (e) {
          try {
            streamController.error(e);
          } catch {
            /* already closed */
          }
        } finally {
          // GUARANTEED CLEANUP — always runs
          await deleteAllSwarmMachines();
        }
      },
      cancel() {
        reader.cancel();
        // cleanup handled by the finally above when reader errors/closes
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Swarm-ID": swarmId,
        "X-Swarm-Machine-Count": String(readyMachines.length),
      },
    });
  } catch (error: any) {
    console.error(`Swarm ${swarmId} error:`, error?.message || error);
    console.error(`Swarm ${swarmId} stack:`, error?.stack);
    await deleteAllSwarmMachines();
    return NextResponse.json(
      { error: error.message || "Swarm execution failed" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Wait for machines to get IPs and agent health
// ---------------------------------------------------------------------------

async function waitForMachinesReady(
  supabase: any,
  awsService: any,
  machines: SwarmMachineRecord[],
  swarmId: string,
  timeoutMs: number = 420000 // 7 minutes
): Promise<SwarmMachineRecord[]> {
  const deadline = Date.now() + timeoutMs;
  const pending = new Set(machines.map((m) => m.id));
  const ready: SwarmMachineRecord[] = [];

  while (pending.size > 0 && Date.now() < deadline) {
    await sleep(5000);

    for (const machineId of Array.from(pending)) {
      const machine = machines.find((m) => m.id === machineId)!;

      // Sync EC2 status to DB first
      if (machine.awsInstanceId) {
        await syncMachineStatus(supabase, awsService, machineId, machine.awsInstanceId);
      }

      // Check DB for IP
      const { data: dbm } = await (supabase as any)
        .from("user_machines")
        .select("public_ip_address, status, settings")
        .eq("id", machineId)
        .single();

      if (!dbm) {
        pending.delete(machineId);
        continue;
      }

      if (dbm.status === "error") {
        console.warn(`Swarm ${swarmId}: machine ${machineId} errored`);
        pending.delete(machineId);
        continue;
      }

      if (!dbm.public_ip_address) continue;

      machine.publicIp = dbm.public_ip_address;

      // Check agent health
      const settings = dbm.settings as any;
      const agentPort = settings?.agent_port || 8080;
      const agentReady = await pingAgent(dbm.public_ip_address, agentPort);

      if (agentReady) {
        await (supabase as any)
          .from("user_machines")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", machineId);

        ready.push(machine);
        pending.delete(machineId);
        console.log(
          `Swarm ${swarmId}: machine ${machineId} ready (${ready.length}/${machines.length})`
        );
      }
    }
  }

  if (pending.size > 0) {
    console.warn(
      `Swarm ${swarmId}: ${pending.size} machines never became ready`
    );
  }

  return ready;
}

// Sync EC2 instance status to database
async function syncMachineStatus(
  supabase: any,
  awsService: any,
  machineId: string,
  instanceId: string
) {
  try {
    const status = await awsService.getInstanceStatus(instanceId);
    const updates: Record<string, any> = {};

    if (status.state === "running") {
      updates.status = "running";
      if (status.ipAddress) updates.public_ip_address = status.ipAddress;
    } else if (status.state === "failed") {
      updates.status = "error";
      updates.status_message = status.message || "Instance failed";
    }

    if (Object.keys(updates).length > 0) {
      await (supabase as any)
        .from("user_machines")
        .update(updates)
        .eq("id", machineId);
    }
  } catch {
    // Non-critical — keep polling
  }
}

// ---------------------------------------------------------------------------
// Agent health ping
// ---------------------------------------------------------------------------

function pingAgent(ipAddress: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${ipAddress}:${port}`);
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        resolve(false);
      }
    }, 3000);

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "ping" }));
    });

    ws.on("message", (data: Buffer) => {
      if (settled) return;
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "pong") {
          settled = true;
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        }
      } catch {
        // ignore
      }
    });

    ws.on("error", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(false);
      }
    });

    ws.on("close", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(false);
      }
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
