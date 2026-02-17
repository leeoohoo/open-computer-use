import { createClient } from "@/lib/supabase/server";
import { getSshSessionManager } from "@/lib/ssh/session-manager";
import { NextRequest, NextResponse } from "next/server";

// Ensure this route streams and is never statically cached
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/machines/[id]/terminal/stream?sessionId=xxx - SSE stream of terminal output
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const session = manager.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send buffered output first (replay)
        for (const data of session.buffer) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "output", data })}\n\n`)
          );
        }

        // Send connected event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
        );

        // Listen for new output
        const removeListener = manager.addListener(sessionId, (data) => {
          try {
            if (!data) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "disconnect" })}\n\n`
                )
              );
              controller.close();
              return;
            }
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "output", data })}\n\n`
              )
            );
          } catch {
            // Controller may be closed
          }
        });

        // Send keepalive pings every 15s
        const keepalive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            clearInterval(keepalive);
          }
        }, 15000);

        // Cleanup on abort
        request.signal.addEventListener("abort", () => {
          removeListener();
          clearInterval(keepalive);
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Error in terminal stream:", error);
    return NextResponse.json(
      { error: "Failed to open stream" },
      { status: 500 }
    );
  }
}
