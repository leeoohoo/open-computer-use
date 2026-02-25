import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

export const runtime = "nodejs"

const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
  apiVersion: "2025-08-27.basil",
})

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection error" },
        { status: 500 }
      )
    }
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get user's Stripe customer ID
    const { data: customer, error: customerError } = await (supabase as any)
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single()

    if (customerError || !customer) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 404 }
      )
    }

    // Create a Stripe billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${BASE_URL}/account?section=billing`,
    })

    return NextResponse.json({ 
      url: session.url 
    })
  } catch (error) {
    console.error("Error creating billing portal session:", error)
    return NextResponse.json(
      { error: "Failed to create billing portal session" },
      { status: 500 }
    )
  }
}