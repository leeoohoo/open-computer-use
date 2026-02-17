import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/machines/[id]/ssh-key - Download SSH private key for AWS machines
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

    if (settings?.provider !== 'aws') {
      return NextResponse.json(
        { error: "SSH key is only available for AWS machines" },
        { status: 400 }
      );
    }

    const privateKey = settings?.sshPrivateKey;
    const keyPairName = settings?.awsKeyPairName || 'llmhub-key';

    if (!privateKey) {
      return NextResponse.json(
        { error: "SSH key not found. The key may not have been generated yet." },
        { status: 404 }
      );
    }

    return new NextResponse(privateKey, {
      headers: {
        'Content-Type': 'application/x-pem-file',
        'Content-Disposition': `attachment; filename="${keyPairName}.pem"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error("Error in GET /api/machines/[id]/ssh-key:", error);
    return NextResponse.json(
      { error: "Failed to get SSH key" },
      { status: 500 }
    );
  }
}
