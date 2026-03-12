/**
 * GET /api/swarm/[swarmId] — Get swarm status.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8001";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

interface RouteParams {
  params: Promise<{ swarmId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
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

    // Get backend status
    const response = await fetch(
      `${PYTHON_BACKEND_URL}/api/swarm/status/${swarmId}`,
      {
        headers: {
          "X-User-ID": authData.user.id,
          ...(INTERNAL_API_KEY && { "X-Internal-Key": INTERNAL_API_KEY }),
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: errText || "Failed to get swarm status from backend" },
        { status: response.status }
      );
    }

    const backendStatus = await response.json();

    // Get machines from DB with this swarm_id using JSONB filter
    const { data: swarmMachines } = await (supabase as any)
      .from("user_machines")
      .select("id, display_name, status, public_ip_address, settings, created_at")
      .eq("user_id", authData.user.id)
      .contains("settings", { swarm_id: swarmId });

    return NextResponse.json({
      ...backendStatus,
      machines: swarmMachines || [],
    });
  } catch (error: any) {
    console.error("Error getting swarm status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get swarm status" },
      { status: 500 }
    );
  }
}
