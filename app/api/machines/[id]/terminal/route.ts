import { createClient } from "@/lib/supabase/server";
import { getSshSessionManager } from "@/lib/ssh/session-manager";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/machines/[id]/terminal - Create a new SSH terminal session
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const { data: machine, error: machineError } = await supabase
      .from("user_machines")
      .select("*")
      .eq("id", machineId)
      .eq("user_id", userId)
      .single();

    if (machineError || !machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    const settings = machine.settings as any;

    if (settings?.provider !== "aws") {
      return NextResponse.json(
        { error: "Terminal is only available for SSH machines" },
        { status: 400 }
      );
    }

    if (!machine.public_ip_address) {
      return NextResponse.json(
        { error: "Machine has no IP address yet" },
        { status: 400 }
      );
    }

    if (!settings.sshPrivateKey) {
      return NextResponse.json(
        { error: "SSH key not available" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const manager = getSshSessionManager();
    const sessionId = await manager.createSession({
      machineId,
      userId,
      host: machine.public_ip_address,
      username: settings.sshUsername || "ubuntu",
      privateKey: settings.sshPrivateKey,
      cols: body.cols || 80,
      rows: body.rows || 24,
    });

    return NextResponse.json({ sessionId });
  } catch (error: any) {
    console.error("Error creating terminal session:", error);
    return NextResponse.json(
      { error: error.message || "Failed to connect via SSH" },
      { status: 500 }
    );
  }
}

// DELETE /api/machines/[id]/terminal?sessionId=xxx - Close a terminal session
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }
    await params;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    const manager = getSshSessionManager();
    if (!manager.validateSession(sessionId, authData.user.id)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 403 });
    }

    manager.closeSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error closing terminal session:", error);
    return NextResponse.json(
      { error: "Failed to close session" },
      { status: 500 }
    );
  }
}
