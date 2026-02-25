import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// PATCH /api/machines/[id]/settings - Update machine settings
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const body = await request.json();

    // Verify machine ownership
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

    // Prepare update data
    const updateData: any = {};
    
    if (body.displayName !== undefined) {
      updateData.display_name = body.displayName;
    }
    
    if (body.autoShutdownMinutes !== undefined) {
      updateData.auto_shutdown_minutes = body.autoShutdownMinutes;
      
      // If auto shutdown is enabled, calculate the shutdown time
      if (body.autoShutdownMinutes !== null) {
        const shutdownTime = new Date();
        shutdownTime.setMinutes(shutdownTime.getMinutes() + body.autoShutdownMinutes);
        updateData.auto_shutdown_at = shutdownTime.toISOString();
      } else {
        updateData.auto_shutdown_at = null;
      }
    }
    
    // Update machine
    const { data: updatedMachine, error: updateError } = await supabase
      .from("user_machines")
      .update(updateData)
      .eq("id", machineId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating machine settings:", updateError);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      machine: updatedMachine,
      message: "Settings updated successfully"
    });
  } catch (error) {
    console.error("Error in PATCH /api/machines/[id]/settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}