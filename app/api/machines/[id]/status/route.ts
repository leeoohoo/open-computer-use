import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getAzureContainerService } from "@/lib/azure/container-instances";
import { getAwsEc2Service } from "@/lib/aws/ec2-service";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/machines/[id]/status - Get real-time machine status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }
    const { id: machineId } = await params;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;

    // Get machine
    const { data: machine, error: machineError } = await supabase
      .from("user_machines")
      .select("*")
      .eq("id", machineId)
      .eq("user_id", userId)
      .single();

    if (machineError || !machine) {
      return NextResponse.json(
        { error: "Machine not found" },
        { status: 404 }
      );
    }

    const settings = machine.settings as any;
    const isAws = settings?.provider === 'aws';

    if (isAws) {
      // AWS EC2 status check
      const awsService = getAwsEc2Service();
      const instanceId = settings?.awsInstanceId;

      if (!instanceId) {
        return NextResponse.json({
          status: machine.status,
          message: "Machine ID not available yet",
          canStart: false,
        });
      }

      try {
        const status = await awsService.getInstanceStatus(instanceId);

        const updateData: any = {
          status: status.state,
          status_message: status.message,
          last_active_at: new Date().toISOString(),
        };

        if (status.ipAddress) {
          updateData.public_ip_address = status.ipAddress;
        }

        await supabase
          .from("user_machines")
          .update(updateData)
          .eq("id", machineId);

        return NextResponse.json({
          status: status.state,
          message: status.message,
          ipAddress: status.ipAddress,
          publicDnsName: status.publicDnsName,
          canStart: status.state === "stopped",
          provider: 'aws',
          desktopEnabled: settings?.desktopEnabled || false,
          desktopInitStatus: settings?.desktopInitStatus,
          agentPort: settings?.agent_port ?? (settings?.desktopEnabled ? 8080 : undefined),
        });
      } catch (awsError: any) {
        console.error("Error getting EC2 instance status:", awsError);

        if (awsError.name === "InvalidInstanceID.NotFound") {
          await supabase
            .from("user_machines")
            .update({
              status: "stopped",
              status_message: "Machine has been terminated.",
              public_ip_address: null
            })
            .eq("id", machineId);

          return NextResponse.json({
            status: "stopped",
            message: "Machine has been terminated.",
            canStart: false,
            provider: 'aws',
          });
        }

        throw awsError;
      }
    }

    // Azure status check (existing)
    const azureService = getAzureContainerService();

    try {
      const status = await azureService.getContainerStatus(machine.azure_container_group);

      const updateData: any = {
        status: status.state,
        status_message: status.message,
        last_active_at: new Date().toISOString(),
      };

      if (status.ipAddress) {
        updateData.public_ip_address = status.ipAddress;
      }

      await supabase
        .from("user_machines")
        .update(updateData)
        .eq("id", machineId);

      return NextResponse.json({
        status: status.state,
        message: status.message,
        ipAddress: status.ipAddress,
        fqdn: status.fqdn,
        canStart: status.state === "stopped",
        needsRecreation: status.state === "stopped" && !status.ipAddress,
      });
    } catch (azureError: any) {
      console.error("Error getting container status from Azure:", azureError);

      if (azureError.statusCode === 404) {
        await supabase
          .from("user_machines")
          .update({
            status: "stopped",
            status_message: "Container deallocated. Restart required.",
            public_ip_address: null
          })
          .eq("id", machineId);

        return NextResponse.json({
          status: "stopped",
          message: "Container has been deallocated. You'll need to start it again.",
          needsRecreation: true,
          canStart: true,
        });
      }

      throw azureError;
    }
  } catch (error) {
    console.error("Error in GET /api/machines/[id]/status:", error);
    return NextResponse.json(
      { error: "Failed to get machine status" },
      { status: 500 }
    );
  }
}
