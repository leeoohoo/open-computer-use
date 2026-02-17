import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getAzureContainerService } from "@/lib/azure/container-instances";
import { getAwsEc2Service } from "@/lib/aws/ec2-service";
import { transformMachineFromDB } from "@/lib/utils/db-transforms";
import type { UserMachine, CreateMachineRequest, MachineStatus } from "@/types/machines.types";
import { dockerService } from "@/lib/docker/docker-service";

// GET /api/machines - List user's machines
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }
    
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;

    // Get user's machines
    const { data: dbMachines, error: machinesError } = await supabase
      .from("user_machines")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (machinesError) {
      // Error fetching machines
      return NextResponse.json(
        { error: "Failed to fetch machines" },
        { status: 500 }
      );
    }
    
    // Transform database results to TypeScript format
    const azureMachines = (dbMachines || []).map(transformMachineFromDB);
    
    // Get local Docker machines
    const localMachines = await dockerService.getLocalMachines();
    
    // Transform local machines to match UserMachine type
    const dockerMachines: UserMachine[] = localMachines.map(local => ({
      id: local.id,
      userId: userId,
      containerName: local.containerName,
      displayName: `${local.displayName} (Local)`,
      status: local.status === 'paused' ? 'stopped' as const : local.status as MachineStatus,
      azureResourceGroup: '',
      azureContainerGroup: '',
      azureResourceId: '',
      azureLocation: 'local',
      publicIpAddress: local.publicIpAddress,
      vncPort: local.ports?.vnc || 5900,
      websocketPort: local.ports?.websocket || 6080,
      vncPassword: 'local', // Local containers handle auth differently
      cpuCores: local.cpuCores,
      memoryGb: local.memoryGb,
      storageGb: local.storageGb,
      gpuEnabled: local.gpuEnabled,
      createdAt: local.createdAt,
      startedAt: local.status === 'running' ? new Date().toISOString() : undefined,
      stoppedAt: undefined,
      lastActiveAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      autoShutdownMinutes: 60,
      statusMessage: `Local Docker container on port ${local.ports?.vnc || 'N/A'}`,
      settings: {
        isLocal: true,
        provider: 'docker',
        ports: local.ports
      }
    }));
    
    // Combine Azure and Docker machines
    const machines = [...azureMachines, ...dockerMachines];

    // Get user's subscription tier and limits from database
    const { data: subscriptions } = await (supabase as any)
      .from("user_subscriptions")
      .select(`
        status,
        subscription_plans (
          tier,
          max_machines,
          max_cpu_cores,
          max_memory_gb,
          max_storage_gb,
          max_hours_per_month,
          gpu_access,
          allow_persistence,
          allow_snapshots,
          allow_custom_software
        )
      `)
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "past_due"]);

    const subscription = subscriptions?.[0];
    const subscriptionPlan = subscription?.subscription_plans;
    const subscriptionTier = subscriptionPlan?.tier || null;

    // Get plan limits from database or use free tier defaults
    let baseLimits = {
      max_machines: 1,
      max_cpu_cores: 1,
      max_memory_gb: 3,
      max_storage_gb: 10,
      max_hours_per_month: 20,
      gpu_access: false,
      allow_persistence: false,
      allow_snapshots: false,
      allow_custom_software: false
    };

    if (subscriptionPlan) {
      baseLimits = {
        max_machines: subscriptionPlan.max_machines || 1,
        max_cpu_cores: subscriptionPlan.max_cpu_cores || 2,
        max_memory_gb: subscriptionPlan.max_memory_gb || 4,
        max_storage_gb: subscriptionPlan.max_storage_gb || 10,
        max_hours_per_month: subscriptionPlan.max_hours_per_month || 20,
        gpu_access: subscriptionPlan.gpu_access || false,
        allow_persistence: subscriptionPlan.allow_persistence || false,
        allow_snapshots: subscriptionPlan.allow_snapshots || false,
        allow_custom_software: subscriptionPlan.allow_custom_software || false
      };
    } else {
      // If no subscription, try to get free plan limits from database
      const { data: freePlan } = await (supabase as any)
        .from("subscription_plans")
        .select("*")
        .eq("tier", "free")
        .single();

      if (freePlan) {
        baseLimits = {
          max_machines: freePlan.max_machines || 1,
          max_cpu_cores: freePlan.max_cpu_cores || 1,
          max_memory_gb: freePlan.max_memory_gb || 3,
          max_storage_gb: freePlan.max_storage_gb || 10,
          max_hours_per_month: freePlan.max_hours_per_month || 20,
          gpu_access: freePlan.gpu_access || false,
          allow_persistence: freePlan.allow_persistence || false,
          allow_snapshots: freePlan.allow_snapshots || false,
          allow_custom_software: freePlan.allow_custom_software || false
        };
      }
    }
    
    // Still check database for any custom overrides
    const { data: limitsRows } = await supabase
      .from("machine_limits")
      .select("*")
      .eq("user_id", userId);
    
    const limitsData = limitsRows?.[0] || null;

    // Use database limits if they exist and are higher (for custom/grandfathered users)
    const effectiveLimits = limitsData ? {
      max_machines: Math.max(limitsData.max_machines || 0, baseLimits.max_machines),
      max_cpu_cores: Math.max(limitsData.max_cpu_cores || 0, baseLimits.max_cpu_cores),
      max_memory_gb: Math.max(limitsData.max_memory_gb || 0, baseLimits.max_memory_gb),
      max_storage_gb: Math.max(limitsData.max_storage_gb || 0, baseLimits.max_storage_gb),
    } : baseLimits;

    // Calculate current resource usage (only count Azure machines for limits)
    const activeMachines = azureMachines || [];
    const totalCpuCores = activeMachines.reduce((sum, m) => sum + (m?.cpuCores || 0), 0);
    const totalMemoryGb = activeMachines.reduce((sum, m) => sum + (m?.memoryGb || 0), 0);
    const totalStorageGb = activeMachines.reduce((sum, m) => sum + (m?.storageGb || 0), 0);

    return NextResponse.json({
      machines: machines || [],
      limits: effectiveLimits,
      subscriptionTier,
      usage: {
        machines_count: activeMachines.length,
        total_cpu_cores: totalCpuCores,
        total_memory_gb: totalMemoryGb,
        total_storage_gb: totalStorageGb,
      },
    });
  } catch (error) {
    // Error in GET /api/machines
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/machines - Create a new machine
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }
    
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;
    const body: CreateMachineRequest = await request.json();
    const provider = body.provider || 'azure';

    // Validate request
    if (!body.displayName) {
      return NextResponse.json(
        { error: "Display name is required" },
        { status: 400 }
      );
    }

    // Check if user can create more machines
    const { data: canCreate } = await supabase.rpc("can_user_create_machine", {
      p_user_id: userId,
    });

    if (!canCreate) {
      return NextResponse.json(
        { error: "Machine limit reached for your account" },
        { status: 403 }
      );
    }

    // Get user's subscription tier and limits from database
    const { data: subscriptions } = await (supabase as any)
      .from("user_subscriptions")
      .select(`
        status,
        subscription_plans (
          tier,
          max_machines,
          max_cpu_cores,
          max_memory_gb,
          max_storage_gb,
          max_hours_per_month,
          gpu_access,
          allow_persistence,
          allow_snapshots,
          allow_custom_software
        )
      `)
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "past_due"]);

    const subscription = subscriptions?.[0];
    const subscriptionPlan = subscription?.subscription_plans;
    const subscriptionTier = subscriptionPlan?.tier || null;

    // Get plan limits from database or use free tier defaults
    let baseLimits = {
      max_machines: 1,
      max_cpu_cores: 1,
      max_memory_gb: 3,
      max_storage_gb: 10,
      max_hours_per_month: 20,
      gpu_access: false,
      allow_persistence: false,
      allow_snapshots: false,
      allow_custom_software: false
    };

    if (subscriptionPlan) {
      baseLimits = {
        max_machines: subscriptionPlan.max_machines || 1,
        max_cpu_cores: subscriptionPlan.max_cpu_cores || 2,
        max_memory_gb: subscriptionPlan.max_memory_gb || 4,
        max_storage_gb: subscriptionPlan.max_storage_gb || 10,
        max_hours_per_month: subscriptionPlan.max_hours_per_month || 20,
        gpu_access: subscriptionPlan.gpu_access || false,
        allow_persistence: subscriptionPlan.allow_persistence || false,
        allow_snapshots: subscriptionPlan.allow_snapshots || false,
        allow_custom_software: subscriptionPlan.allow_custom_software || false
      };
    } else {
      // If no subscription, try to get free plan limits from database
      const { data: freePlan } = await (supabase as any)
        .from("subscription_plans")
        .select("*")
        .eq("tier", "free")
        .single();

      if (freePlan) {
        baseLimits = {
          max_machines: freePlan.max_machines || 1,
          max_cpu_cores: freePlan.max_cpu_cores || 1,
          max_memory_gb: freePlan.max_memory_gb || 3,
          max_storage_gb: freePlan.max_storage_gb || 10,
          max_hours_per_month: freePlan.max_hours_per_month || 20,
          gpu_access: freePlan.gpu_access || false,
          allow_persistence: freePlan.allow_persistence || false,
          allow_snapshots: freePlan.allow_snapshots || false,
          allow_custom_software: freePlan.allow_custom_software || false
        };
      }
    }
    
    // Still check database for any custom overrides
    const { data: limitsRows } = await supabase
      .from("machine_limits")
      .select("*")
      .eq("user_id", userId);
    
    const limitsData = limitsRows?.[0] || null;
    
    // Use database limits if they exist and are higher (for custom/grandfathered users)
    const effectiveLimits = limitsData ? {
      max_machines: Math.max(limitsData.max_machines || 0, baseLimits.max_machines),
      max_cpu_cores: Math.max(limitsData.max_cpu_cores || 0, baseLimits.max_cpu_cores),
      max_memory_gb: Math.max(limitsData.max_memory_gb || 0, baseLimits.max_memory_gb),
      max_storage_gb: Math.max(limitsData.max_storage_gb || 0, baseLimits.max_storage_gb),
    } : baseLimits;

    // Validate resources against limits and minimum requirements
    const isAws = provider === 'aws';
    const requestedCpu = isAws ? 2 : (body.cpuCores || 1);     // t4g.nano = 2 ARM vCPU
    const requestedMemory = isAws ? 0.5 : (body.memoryGb || 3); // t4g.nano = 0.5 GB
    const requestedStorage = body.storageGb || (isAws ? 8 : 10);

    // Enforce minimum requirements (only for Azure)
    if (!isAws && (requestedCpu < 1 || requestedMemory < 1)) {
      return NextResponse.json(
        { error: "Minimum requirements: 1 CPU core and 1GB memory" },
        { status: 400 }
      );
    }

    if (
      requestedCpu > effectiveLimits.max_cpu_cores ||
      requestedMemory > effectiveLimits.max_memory_gb ||
      requestedStorage > effectiveLimits.max_storage_gb
    ) {
      return NextResponse.json(
        { error: "Requested resources exceed your limits" },
        { status: 403 }
      );
    }

    // Generate the container/instance name
    const uniqueId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const containerName = `vm-${userId.substring(0, 8)}-${uniqueId}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const vncPassword = isAws ? '' : (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 8));

    // First, create a placeholder in the database so it appears immediately
    const placeholderData = {
      user_id: userId,
      container_name: containerName,
      display_name: body.displayName,
      status: "creating" as const,
      azure_resource_group: isAws ? '' : (process.env.AZURE_RESOURCE_GROUP || "llmhub-resources"),
      azure_container_group: isAws ? '' : containerName,
      vnc_password: vncPassword,
      cpu_cores: requestedCpu,
      memory_gb: requestedMemory,
      storage_gb: requestedStorage,
      gpu_enabled: false,
      settings: isAws ? { provider: 'aws' as const, sshUsername: 'ubuntu' } : {},
    };

    const { data: dbMachine, error: insertError } = await supabase
      .from("user_machines")
      .insert(placeholderData)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create machine" },
        { status: 500 }
      );
    }

    if (!dbMachine) {
      return NextResponse.json(
        { error: "Failed to create machine record" },
        { status: 500 }
      );
    }

    const machine = transformMachineFromDB(dbMachine);
    const machineId = machine?.id || dbMachine.id;

    if (isAws) {
      // AWS EC2 creation flow
      const awsService = getAwsEc2Service();

      (async () => {
        try {
          console.log(`Creating AWS EC2 instance (t4g.nano) with ${requestedStorage}GB storage`);

          const result = await awsService.createInstance(userId, {
            name: containerName,
            storageGb: requestedStorage,
          });

          console.log(`AWS EC2 instance created: ${result.instanceId}`);

          // Store AWS details in settings
          await supabase
            .from("user_machines")
            .update({
              settings: {
                provider: 'aws',
                awsInstanceId: result.instanceId,
                awsRegion: process.env.AWS_REGION || 'us-east-1',
                awsKeyPairName: result.keyPairName,
                sshPrivateKey: result.privateKeyPem,
                sshUsername: 'ubuntu',
              },
              ssh_port: 22,
            })
            .eq("id", machineId);

          // Poll for IP assignment
          let checkCount = 0;
          const checkInterval = setInterval(async () => {
            checkCount++;
            await updateMachineStatusAws(machineId, result.instanceId);

            const { data: updatedMachine } = await supabase
              .from("user_machines")
              .select("public_ip_address, status")
              .eq("id", machineId)
              .single();

            if (updatedMachine?.public_ip_address || checkCount > 24 || updatedMachine?.status === "error") {
              clearInterval(checkInterval);
            }
          }, 5000);

        } catch (awsError: any) {
          console.error("AWS EC2 instance creation failed:", awsError);

          await supabase
            .from("user_machines")
            .update({
              status: "error",
              status_message: awsError.message || "Failed to create EC2 instance",
            })
            .eq("id", machineId);

          setTimeout(async () => {
            await supabase
              .from("user_machines")
              .delete()
              .eq("id", machineId)
              .eq("status", "error");
          }, 30000);
        }
      })();

      return NextResponse.json({
        machine,
        connectionDetails: {
          sshPort: 22,
          sshUsername: 'ubuntu',
        },
      });
    }

    // Azure creation flow (existing)
    const azureService = getAzureContainerService();

    (async () => {
      try {
        console.log(`Creating Azure container with ${requestedCpu} vCPU, ${requestedMemory}GB RAM`);

        const containerResult = await azureService.createDesktopContainer(userId, {
          cpu: requestedCpu,
          memoryGb: requestedMemory,
          containerName: containerName,
          vncPassword: vncPassword,
        });

        console.log(`Azure container created successfully`);

        await supabase
          .from("user_machines")
          .update({
            azure_resource_id: containerResult.resourceId,
          })
          .eq("id", machineId);

        await updateMachineStatus(machineId, containerName);

        let checkCount = 0;
        const checkInterval = setInterval(async () => {
          checkCount++;
          await updateMachineStatus(machineId, containerName);

          const { data: updatedMachine } = await supabase
            .from("user_machines")
            .select("public_ip_address, status")
            .eq("id", machineId)
            .single();

          if (updatedMachine?.public_ip_address || checkCount > 12 || updatedMachine?.status === "error") {
            clearInterval(checkInterval);
          }
        }, 5000);

      } catch (azureError: any) {
        await supabase
          .from("user_machines")
          .update({
            status: "error",
            status_message: azureError.message || "Failed to create container",
          })
          .eq("id", machineId);

        setTimeout(async () => {
          await supabase
            .from("user_machines")
            .delete()
            .eq("id", machineId)
            .eq("status", "error");
        }, 30000);
      }
    })();

      return NextResponse.json({
        machine,
        connectionDetails: {
          vncUrl: `vnc://localhost:5901`,
          websocketUrl: `wss://${request.headers.get("host")}/api/machines/${machineId}/vnc`,
          password: vncPassword,
        },
      });
  } catch (error) {
    // Error in POST /api/machines
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to update machine status
async function updateMachineStatus(machineId: string, containerGroupName: string) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      console.error("Database connection failed in updateMachineStatus");
      return;
    }
    const azureService = getAzureContainerService();
    
    const status = await azureService.getContainerStatus(containerGroupName);
    
    const updateData: any = {
      status: status.state,
      status_message: status.message,
    };
    
    if (status.ipAddress) {
      updateData.public_ip_address = status.ipAddress;
    }
    
    if (status.state === "running") {
      updateData.started_at = new Date().toISOString();
    }
    
    await supabase
      .from("user_machines")
      .update(updateData)
      .eq("id", machineId);
      
  } catch (error) {
    // Error updating machine status
  }
}

// Helper function to update AWS EC2 machine status
async function updateMachineStatusAws(machineId: string, instanceId: string) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      console.error("Database connection failed in updateMachineStatusAws");
      return;
    }
    const awsService = getAwsEc2Service();

    const status = await awsService.getInstanceStatus(instanceId);

    const updateData: any = {
      status: status.state,
      status_message: status.message,
    };

    if (status.ipAddress) {
      updateData.public_ip_address = status.ipAddress;
    }

    if (status.state === "running") {
      updateData.started_at = new Date().toISOString();
    }

    await supabase
      .from("user_machines")
      .update(updateData)
      .eq("id", machineId);

  } catch (error) {
    // Error updating AWS machine status
  }
}