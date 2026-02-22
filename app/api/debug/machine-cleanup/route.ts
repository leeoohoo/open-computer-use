import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 60;

// GET /api/debug/machine-cleanup - Debug endpoint to check machines eligible for cleanup
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

    // Check environment - only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: "Debug endpoint only available in development" }, { status: 403 });
    }

    // Use service client for the query since we need to check all users
    const serviceSupabase = createServiceClient();
    if (!serviceSupabase) {
      return NextResponse.json({ error: "Service client not available" }, { status: 500 });
    }

    // Find machines from free users that are older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Use the same pattern as other parts of the codebase to bypass TypeScript issues
    const { data: expiredMachines, error: queryError } = await (serviceSupabase as any)
      .from("user_machines")
      .select(`
        id,
        user_id,
        container_name,
        display_name,
        status,
        settings,
        created_at,
        users!inner (
          email,
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
      return NextResponse.json({ error: `Query failed: ${queryError.message}` }, { status: 500 });
    }

    // Analyze machines by user subscription status
    const analysis = expiredMachines?.map((machine: any) => {
      const userSubscriptions = (machine.users as any)?.user_subscriptions;
      const userEmail = (machine.users as any)?.email;

      let subscriptionStatus = 'free';
      let hasActivePaidSubscription = false;

      if (userSubscriptions && userSubscriptions.length > 0) {
        hasActivePaidSubscription = userSubscriptions.some((sub: any) =>
          sub.status === 'active' &&
          sub.subscription_plans?.tier &&
          sub.subscription_plans.tier !== 'free'
        );

        if (hasActivePaidSubscription) {
          subscriptionStatus = 'paid';
        }
      }

      // Electron (desktop app) and local Docker machines are never cleaned up
      const settings = machine.settings as any;
      const isElectronOrLocal = settings?.provider === 'electron' || settings?.isLocal;

      return {
        machineId: machine.id,
        machineName: machine.display_name,
        userEmail: userEmail,
        containerName: machine.container_name,
        provider: settings?.provider || 'unknown',
        status: machine.status,
        createdAt: machine.created_at,
        ageHours: machine.created_at ? Math.round((Date.now() - new Date(machine.created_at).getTime()) / (1000 * 60 * 60) * 10) / 10 : 0,
        subscriptionStatus,
        isElectronOrLocal,
        eligibleForCleanup: !hasActivePaidSubscription && !isElectronOrLocal
      };
    }) || [];

    const eligibleMachines = analysis.filter((m: any) => m.eligibleForCleanup);
    const protectedMachines = analysis.filter((m: any) => !m.eligibleForCleanup);

    return NextResponse.json({
      summary: {
        totalExpiredMachines: analysis.length,
        eligibleForCleanup: eligibleMachines.length,
        protectedBySubscription: protectedMachines.length,
        cutoffTime: twoHoursAgo
      },
      eligibleMachines,
      protectedMachines,
      note: "This is a debug endpoint showing which machines would be cleaned up. Use POST /api/machines/cleanup to actually run cleanup."
    });

  } catch (error) {
    console.error("Error in debug cleanup endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}