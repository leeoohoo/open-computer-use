import { createClient } from "@/lib/supabase/server";
import { getSshSessionManager } from "@/lib/ssh/session-manager";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/machines/[id]/terminal/input - Send input to terminal session
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const { sessionId, data } = body;

    if (!sessionId || !data) {
      return NextResponse.json({ error: "sessionId and data required" }, { status: 400 });
    }

    const manager = getSshSessionManager();
    if (!manager.validateSession(sessionId, authData.user.id)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 403 });
    }

    const success = manager.writeToSession(sessionId, data);
    if (!success) {
      return NextResponse.json({ error: "Session disconnected" }, { status: 410 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error sending terminal input:", error);
    return NextResponse.json(
      { error: "Failed to send input" },
      { status: 500 }
    );
  }
}
