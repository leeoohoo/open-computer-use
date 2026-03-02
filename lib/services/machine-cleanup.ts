import { createServiceClient } from "@/lib/supabase/service";

interface CleanupStats {
  deleted: number;
  errors: number;
  processed: number;
}

export class MachineCleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {}

  /**
   * Start the periodic cleanup service (runs every 2 hours)
   */
  start() {
    if (this.intervalId) {
      console.log("Machine cleanup service is already running");
      return;
    }

    console.log("Starting machine cleanup service - runs every 2 hours");

    // Run immediately on start
    this.runCleanup();
    this.runPeriodicSnapshots();

    // Then run every 2 hours (2 * 60 * 60 * 1000 ms)
    this.intervalId = setInterval(() => {
      this.runCleanup();
      this.runPeriodicSnapshots();
    }, 2 * 60 * 60 * 1000);
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Machine cleanup service stopped");
    }
  }

  /**
   * Run the cleanup process
   */
  private async runCleanup(): Promise<CleanupStats> {
    if (this.isRunning) {
      console.log("Cleanup already in progress, skipping...");
      return { deleted: 0, errors: 0, processed: 0 };
    }

    this.isRunning = true;
    console.log("Starting machine cleanup for free users...");

    const stats: CleanupStats = {
      deleted: 0,
      errors: 0,
      processed: 0
    };

    try {
      const supabase = createServiceClient();
      if (!supabase) {
        throw new Error("Failed to create Supabase service client");
      }

      // Find machines from free users that are older than 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      // Use the same pattern as other parts of the codebase to bypass TypeScript issues
      const { data: expiredMachines, error: queryError } = await (supabase as any)
        .from("user_machines")
        .select(`
          id,
          user_id,
          container_name,
          display_name,
          settings,
          status,
          created_at,
          users!inner (
            user_subscriptions (
              status,
              subscription_plans (
                tier
              )
            )
          )
        `)
        .lt('created_at', twoHoursAgo)
        .neq('status', 'deleting')
        .neq('status', 'error');

      if (queryError) {
        throw new Error(`Failed to query expired machines: ${queryError.message}`);
      }

      if (!expiredMachines || expiredMachines.length === 0) {
        console.log("No expired machines found for cleanup");
        return stats;
      }

      // Filter for free users only, and skip electron/local machines
      const freeuserMachines = expiredMachines.filter((machine: any) => {
        // Never delete electron (desktop app) or local Docker machines
        const settings = machine.settings as any;
        if (settings?.provider === 'electron' || settings?.isLocal) {
          return false;
        }

        const userSubscriptions = (machine.users as any)?.user_subscriptions;

        // If no subscriptions, user is free
        if (!userSubscriptions || userSubscriptions.length === 0) {
          return true;
        }

        // Check if user has active paid subscription
        const hasActivePaidSubscription = userSubscriptions.some((sub: any) =>
          sub.status === 'active' &&
          sub.subscription_plans?.tier &&
          sub.subscription_plans.tier !== 'free'
        );

        // Only cleanup machines for users without active paid subscriptions
        return !hasActivePaidSubscription;
      });

      console.log(`Found ${freeuserMachines.length} machines from free users to cleanup`);
      stats.processed = freeuserMachines.length;

      // Process each machine
      for (const machine of freeuserMachines) {
        try {
          await this.deleteMachine(machine, supabase);
          stats.deleted++;
          console.log(`Deleted machine: ${machine.display_name} (${machine.id})`);
        } catch (error) {
          stats.errors++;
          console.error(`Failed to delete machine ${machine.id}:`, error);
        }
      }

      console.log(`Cleanup completed: ${stats.deleted} deleted, ${stats.errors} errors`);

    } catch (error) {
      console.error("Machine cleanup failed:", error);
      stats.errors++;
    } finally {
      this.isRunning = false;
    }

    return stats;
  }

  /**
   * Periodically snapshot running AWS machines (every 6 hours).
   * Runs alongside cleanup but only creates snapshots — never terminates.
   */
  private async runPeriodicSnapshots(): Promise<void> {
    try {
      const supabase = createServiceClient();
      if (!supabase) return;

      // Find all running AWS machines
      const { data: machines } = await (supabase as any)
        .from("user_machines")
        .select("id, user_id, display_name, settings, started_at")
        .eq("status", "running");

      if (!machines || machines.length === 0) return;

      const awsMachines = machines.filter((m: any) => {
        const s = m.settings as any;
        return s?.provider === "aws" && s?.awsInstanceId && s?.desktopEnabled;
      });

      if (awsMachines.length === 0) return;

      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

      for (const machine of awsMachines) {
        const settings = machine.settings as any;

        // Check if there's already a recent snapshot (within 6 hours)
        const { data: recentSnaps } = await (supabase as any)
          .from("machine_snapshots")
          .select("id, created_at")
          .eq("user_id", machine.user_id)
          .gt("created_at", sixHoursAgo)
          .limit(1);

        if (recentSnaps && recentSnaps.length > 0) {
          continue; // Already has a recent snapshot
        }

        try {
          const { getAwsEc2Service } = await import("@/lib/aws/ec2-service");
          const awsService = getAwsEc2Service();

          const snapshot = await awsService.createMachineImage(
            settings.awsInstanceId,
            machine.user_id,
            machine.display_name
          );

          await (supabase as any).from("machine_snapshots").insert({
            machine_id: machine.id,
            user_id: machine.user_id,
            snapshot_name: snapshot.name,
            snapshot_type: "auto",
            storage_location: snapshot.amiId,
            size_gb: settings.storageGb || 16,
            os_state: {
              provider: "aws",
              region: settings.awsRegion || process.env.AWS_REGION || "us-east-1",
              source_instance: settings.awsInstanceId,
              desktop_enabled: settings.desktopEnabled,
            },
          });

          console.log(`Periodic snapshot created for machine ${machine.display_name}: ${snapshot.amiId}`);

          // Keep only latest 2 snapshots per user
          await awsService.cleanupOldSnapshots(machine.user_id, 2);
        } catch (snapErr) {
          console.warn(`Periodic snapshot failed for machine ${machine.id}:`, snapErr);
        }
      }
    } catch (error) {
      console.error("Periodic snapshots failed:", error);
    }
  }

  /**
   * Delete a single machine (terminate EC2 instance + delete database record)
   */
  private async deleteMachine(machine: any, supabase: any): Promise<void> {
    try {
      // First, update status to deleting to prevent conflicts
      await (supabase as any)
        .from("user_machines")
        .update({ status: 'deleting' })
        .eq('id', machine.id);

      // Terminate AWS EC2 instance if applicable
      const settings = machine.settings as any;
      if (settings?.provider === 'aws' && settings?.awsInstanceId) {
        try {
          // Dynamic import to avoid pulling Node.js modules (zlib) into Edge Runtime
          const { getAwsEc2Service } = await import("@/lib/aws/ec2-service");
          const awsService = getAwsEc2Service();

          // Snapshot the instance before termination so user can restore later
          try {
            const snapshot = await awsService.createMachineImage(
              settings.awsInstanceId,
              machine.user_id,
              machine.display_name
            );
            console.log(`Created pre-termination snapshot: ${snapshot.amiId}`);

            await (supabase as any).from("machine_snapshots").insert({
              machine_id: machine.id,
              user_id: machine.user_id,
              snapshot_name: snapshot.name,
              snapshot_type: "pre_shutdown",
              storage_location: snapshot.amiId,
              size_gb: settings.storageGb || 16,
              os_state: {
                provider: "aws",
                region: settings.awsRegion || process.env.AWS_REGION || "us-east-1",
                source_instance: settings.awsInstanceId,
                desktop_enabled: settings.desktopEnabled,
              },
            });

            await awsService.cleanupOldSnapshots(machine.user_id, 2);
          } catch (snapError) {
            console.warn(`Failed to snapshot instance ${settings.awsInstanceId}:`, snapError);
            // Continue with termination — snapshot failure shouldn't block cleanup
          }

          await awsService.terminateInstance(settings.awsInstanceId, settings.awsKeyPairName);
          console.log(`Terminated EC2 instance: ${settings.awsInstanceId}`);
        } catch (awsError) {
          console.warn(`Failed to terminate EC2 instance ${settings.awsInstanceId} for machine ${machine.id}:`, awsError);
          // Continue with DB deletion — instance may already be gone
        }
      }

      // Delete from database
      const { error: deleteError } = await (supabase as any)
        .from("user_machines")
        .delete()
        .eq('id', machine.id);

      if (deleteError) {
        throw new Error(`Failed to delete machine from database: ${deleteError.message}`);
      }

    } catch (error) {
      // If deletion fails, reset status back to original
      try {
        await (supabase as any)
          .from("user_machines")
          .update({ status: machine.status })
          .eq('id', machine.id);
      } catch (resetError) {
        console.error(`Failed to reset machine status for ${machine.id}:`, resetError);
      }
      throw error;
    }
  }

  /**
   * Manual cleanup trigger (for testing or admin use)
   */
  async runManualCleanup(): Promise<CleanupStats> {
    console.log("Running manual machine cleanup...");
    return await this.runCleanup();
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasScheduledCleanup: this.intervalId !== null,
      nextCleanupIn: this.intervalId ? "Within 2 hours" : "Not scheduled"
    };
  }
}

// Singleton instance
let cleanupService: MachineCleanupService | null = null;

export function getMachineCleanupService(): MachineCleanupService {
  if (!cleanupService) {
    cleanupService = new MachineCleanupService();
  }
  return cleanupService;
}