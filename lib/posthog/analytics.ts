import posthog from "posthog-js"

// ─── Helpers ───

function capture(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return
  posthog.capture(event, properties)
}

// ─── UTM Capture ───

export function captureUtmParams() {
  if (typeof window === "undefined") return

  const params = new URLSearchParams(window.location.search)
  const utmKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "ref",
  ]
  const utm: Record<string, string> = {}

  for (const key of utmKeys) {
    const value = params.get(key)
    if (value) utm[key] = value
  }

  if (Object.keys(utm).length === 0) return

  // Persist in localStorage so it survives OAuth redirects
  localStorage.setItem("coasty_utm", JSON.stringify(utm))

  // Register as super properties — attached to every subsequent event
  posthog.register(utm)

  capture("utm_captured", utm)
}

// ─── Identity ───

export function identifyUser(
  userId: string,
  traits: {
    email?: string
    display_name?: string
    profile_image?: string
    created_at?: string
    is_anonymous?: boolean
  }
) {
  if (typeof window === "undefined") return

  // Read stored UTMs for first-touch attribution
  let utmProps: Record<string, string> = {}
  try {
    const stored = localStorage.getItem("coasty_utm")
    if (stored) utmProps = JSON.parse(stored)
  } catch {
    /* ignore */
  }

  // Read referral code
  const referralCode = localStorage.getItem("coasty_referral_code")

  posthog.identify(
    userId,
    {
      // $set — updated on every identify
      email: traits.email,
      name: traits.display_name,
      avatar: traits.profile_image,
      is_anonymous: traits.is_anonymous,
      ...utmProps,
    },
    {
      // $set_once — only set on first identification
      initial_utm_source: utmProps.utm_source,
      initial_utm_medium: utmProps.utm_medium,
      initial_utm_campaign: utmProps.utm_campaign,
      initial_utm_term: utmProps.utm_term,
      initial_utm_content: utmProps.utm_content,
      initial_referral_code: referralCode || undefined,
      signed_up_at: traits.created_at,
    }
  )
}

export function resetUser() {
  if (typeof window === "undefined") return
  posthog.reset()
}

// ─── Auth Events ───

export function trackSignUp(
  method: "google" | "email" | "magic_link" | "anonymous"
) {
  capture("user_signed_up", { method })
}

export function trackSignIn(
  method: "google" | "email" | "magic_link" | "anonymous"
) {
  capture("user_signed_in", { method })
}

export function trackSignOut() {
  capture("user_signed_out")
}

// ─── Chat Events ───

export function trackChatCreated(chatId: string) {
  capture("chat_created", { chat_id: chatId })
}

export function trackMessageSent(
  chatId: string,
  machineId: string | null,
  hasAttachments: boolean
) {
  capture("message_sent", {
    chat_id: chatId,
    machine_id: machineId,
    has_attachments: hasAttachments,
  })
}

// ─── VM / Machine Events ───

export function trackVmCreated(machineId: string, provider: string) {
  capture("vm_created", { machine_id: machineId, provider })
}

export function trackVmConnected(machineId: string) {
  capture("vm_connected", { machine_id: machineId })
}

export function trackVmDeleted(machineId: string) {
  capture("vm_deleted", { machine_id: machineId })
}

// ─── Agent Session Events ───

export function trackAgentSessionStarted(machineId: string, model: string) {
  capture("agent_session_started", { machine_id: machineId, model })
}

export function trackAgentSessionCompleted(
  machineId: string,
  durationSeconds: number,
  creditsCharged: number
) {
  capture("agent_session_completed", {
    machine_id: machineId,
    duration_seconds: durationSeconds,
    credits_charged: creditsCharged,
  })
}

// ─── Billing Events ───

export function trackPricingViewed(source: string) {
  capture("pricing_viewed", { source })
}

export function trackCheckoutStarted(
  packageId: string,
  amount: number,
  type: "subscription" | "credits"
) {
  capture("checkout_started", { package_id: packageId, amount, type })
}

export function trackPaymentCompleted(
  packageId: string,
  amount: number,
  type: "subscription" | "credits"
) {
  capture("payment_completed", { package_id: packageId, amount, type })
}

export function trackPaymentCanceled() {
  capture("payment_canceled")
}

// ─── Schedule Events ───

export function trackScheduleCreated(chatId: string, frequency: string) {
  capture("schedule_created", { chat_id: chatId, frequency })
}

export function trackScheduleDeleted(chatId: string) {
  capture("schedule_deleted", { chat_id: chatId })
}

export function trackScheduleTriggered(chatId: string) {
  capture("schedule_triggered", { chat_id: chatId })
}

// ─── Desktop App Events ───

export function trackDesktopAppDownloaded(platform: "windows" | "mac") {
  capture("desktop_app_downloaded", { platform })
}

// ─── Generic Feature Usage ───

export function trackFeatureUsed(
  feature: string,
  metadata?: Record<string, unknown>
) {
  capture("feature_used", { feature, ...metadata })
}
