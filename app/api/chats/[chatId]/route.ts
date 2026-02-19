import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// PATCH: Toggle chat public/private status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const supabase = await createClient()
    
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      )
    }

    const { data: authData } = await supabase.auth.getUser()
    
    if (!authData?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { chatId } = await params
    const body = await request.json()
    const { public: isPublic } = body

    if (typeof isPublic !== "boolean") {
      return NextResponse.json(
        { error: "Invalid request body. 'public' must be a boolean" },
        { status: 400 }
      )
    }

    // First check if the user owns the chat
    const { data: chat, error: fetchError } = await supabase
      .from("chats")
      .select("*")
      .eq("id", chatId)
      .eq("user_id", authData.user.id)
      .single()

    if (fetchError || !chat) {
      return NextResponse.json(
        { error: "Chat not found or you don't have permission to modify it" },
        { status: 404 }
      )
    }

    // Update the chat's public status
    const { data: updatedChat, error: updateError } = await supabase
      .from("chats")
      .update({
        public: isPublic,
        updated_at: new Date().toISOString()
      })
      .eq("id", chatId)
      .eq("user_id", authData.user.id)
      .select("*")
      .single()

    if (updateError) {
      console.error("Error updating chat visibility:", updateError)
      return NextResponse.json(
        { error: "Failed to update chat visibility" },
        { status: 500 }
      )
    }

    // Generate share URL using the chat ID directly
    const baseUrl = 'https://coasty.ai'
    const shareUrl = isPublic 
      ? `${baseUrl}/share/${chatId}`
      : null

    return NextResponse.json({ 
      chat: updatedChat,
      shareUrl
    })
  } catch (err) {
    console.error("Error in chat visibility PATCH:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET: Get current visibility status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const supabase = await createClient()
    
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      )
    }

    const { data: authData } = await supabase.auth.getUser()
    
    if (!authData?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { chatId } = await params

    // Get the chat's current visibility status
    const { data: chat, error: fetchError } = await supabase
      .from("chats")
      .select("id, public, title")
      .eq("id", chatId)
      .eq("user_id", authData.user.id)
      .single()

    if (fetchError || !chat) {
      return NextResponse.json(
        { error: "Chat not found or you don't have permission to view it" },
        { status: 404 }
      )
    }

    // Generate share URL using the chat ID directly
    const baseUrl = 'https://coasty.ai'
    const shareUrl = chat.public 
      ? `${baseUrl}/share/${chatId}`
      : null

    return NextResponse.json({ 
      chat: {
        id: chat.id,
        title: chat.title,
        public: chat.public || false,
        shareUrl
      }
    })
  } catch (err) {
    console.error("Error in chat visibility GET:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}