import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getMachineCleanupService } from "@/lib/services/machine-cleanup";

export const maxDuration = 300; // 5 minutes for cleanup operations

// GET /api/machines/cleanup - Get cleanup service status
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

    const cleanupService = getMachineCleanupService();
    const status = cleanupService.getStatus();

    return NextResponse.json({
      status,
      message: "Machine cleanup service status"
    });

  } catch (error) {
    console.error("Error getting cleanup status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/machines/cleanup - Manually trigger cleanup (admin only)
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

    // Check if user is admin via ADMIN_EMAILS env var (comma-separated list)
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const userEmail = authData.user.email?.toLowerCase() || "";

    if (!userEmail || !adminEmails.includes(userEmail)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const cleanupService = getMachineCleanupService();
    const stats = await cleanupService.runManualCleanup();

    return NextResponse.json({
      success: true,
      stats,
      message: `Cleanup completed: ${stats.deleted} machines deleted, ${stats.errors} errors`
    });

  } catch (error) {
    console.error("Error running manual cleanup:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}