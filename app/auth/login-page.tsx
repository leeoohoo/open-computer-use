"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  signInWithGoogle,
  signInAnonymously,
  signUpWithEmail,
  signInWithEmail,
  signInWithMagicLink,
  resetPassword,
} from "@/lib/api"
import { validateEmailForSignup } from "@/lib/email-validation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { useState, useEffect } from "react"
import { captureUtmParams, trackSignIn, trackSignUp } from "@/lib/posthog/analytics"
import { HeaderGoBack } from "../components/header-go-back"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { CoastyIcon } from "@/components/icons/coasty"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

/* ── Minimal Computer Animation ── */
function MiniComputer({ activeStep }: { activeStep: number }) {
  const allDone = activeStep === 3

  return (
    <div className="relative w-[240px] xl:w-[280px]">
      {/* Subtle glow */}
      <motion.div
        className="absolute -inset-10 rounded-full blur-[80px] pointer-events-none"
        animate={{
          opacity: allDone ? 0.12 : 0.06,
          background: allDone
            ? "radial-gradient(circle, rgb(16 185 129 / 0.3), transparent 70%)"
            : "radial-gradient(circle, rgb(16 185 129 / 0.15), transparent 70%)",
        }}
        transition={{ duration: 1 }}
      />

      {/* Monitor */}
      <div className="relative rounded-xl border border-border/40 dark:border-border/20 bg-muted/20 dark:bg-neutral-900/50 overflow-hidden">
        {/* Screen */}
        <div className="relative h-[120px] xl:h-[140px] p-3">
          {/* Dots row — window controls */}
          <div className="flex gap-1.5 mb-4">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/10" />
            <div className="w-2 h-2 rounded-full bg-muted-foreground/10" />
            <div className="w-2 h-2 rounded-full bg-muted-foreground/10" />
          </div>

          {/* Screen content — changes per step */}
          <AnimatePresence mode="wait">
            {activeStep === 0 && (
              <motion.div
                key="typing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-2.5"
              >
                <div className="h-2 w-3/4 rounded-full bg-muted-foreground/8" />
                <div className="flex items-center gap-1">
                  <div className="h-2 w-1/2 rounded-full bg-emerald-500/20" />
                  <motion.div
                    className="w-[2px] h-3 rounded-full bg-emerald-500/60"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  />
                </div>
                <div className="h-2 w-1/3 rounded-full bg-muted-foreground/5" />
              </motion.div>
            )}

            {activeStep === 1 && (
              <motion.div
                key="browsing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                {/* URL bar */}
                <div className="h-5 rounded-md bg-muted-foreground/5 flex items-center px-2">
                  <div className="h-1.5 w-24 rounded-full bg-muted-foreground/10" />
                </div>
                {/* Content skeleton */}
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.12 }}
                      className="h-10 rounded-md bg-muted-foreground/[0.04]"
                    />
                  ))}
                </div>
                {/* Cursor */}
                <motion.div
                  className="absolute w-3 h-3"
                  animate={{
                    left: ["30%", "60%", "45%"],
                    top: ["50%", "65%", "55%"],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg viewBox="0 0 16 16" className="w-3 h-3 text-foreground/70 drop-shadow-sm">
                    <path d="M1 1l5.5 14 2.2-5.3L14 7.5z" fill="currentColor" />
                  </svg>
                </motion.div>
              </motion.div>
            )}

            {activeStep === 2 && (
              <motion.div
                key="working"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-2"
              >
                {/* Table rows filling in */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.3 }}
                    className="flex gap-2"
                  >
                    <div className="h-2 flex-1 rounded-full bg-muted-foreground/8" />
                    <div className="h-2 w-12 rounded-full bg-muted-foreground/6" />
                    <div className="h-2 w-8 rounded-full bg-emerald-500/15" />
                  </motion.div>
                ))}
              </motion.div>
            )}

            {allDone && (
              <motion.div
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center h-full -mt-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Check className="size-8 text-emerald-500/60" strokeWidth={2} />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-xs text-muted-foreground/40 mt-2"
                >
                  Complete
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Stand */}
      <div className="flex flex-col items-center">
        <div className="w-12 h-3 bg-gradient-to-b from-border/20 to-transparent dark:from-border/10" />
        <div className="w-20 h-[2px] rounded-full bg-border/30 dark:bg-border/15" />
      </div>
    </div>
  )
}

/* ── Left Brand Panel ── */
function LeftBrandPanel() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % (FLOW_STEPS.length + 1))
    }, 2800)
    return () => clearInterval(timer)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="hidden lg:flex flex-1 flex-col justify-center items-start px-16 xl:px-24 max-w-2xl"
    >
      <div className="mb-6">
        <CoastyIcon className="size-8" />
      </div>

      <MiniComputer activeStep={activeStep} />

      <h1 className="mt-6 text-foreground text-3xl xl:text-4xl font-medium tracking-tight leading-[1.25]">
        You set the goal.
        <br />
        <span className="text-muted-foreground/50">We handle the rest.</span>
      </h1>

      <div className="mt-8">
        <AgentFlowVisual activeStep={activeStep} />
      </div>
    </motion.div>
  )
}

/* ── Minimal Agent Flow ── */
const FLOW_STEPS = [
  { label: "You describe the task", sub: "\"Research our top 5 competitors\"" },
  { label: "Agent takes control", sub: "Browses, clicks, types autonomously" },
  { label: "Work delivered", sub: "Spreadsheet with 5 full competitor profiles" },
]

function AgentFlowVisual({ activeStep }: { activeStep: number }) {
  // When activeStep === FLOW_STEPS.length, all are complete before resetting
  const allDone = activeStep === FLOW_STEPS.length

  return (
    <div className="relative w-full max-w-[400px]">
      {/* Steps */}
      <div className="space-y-4">
        {FLOW_STEPS.map((step, i) => {
          const isComplete = allDone || i < activeStep
          const isCurrent = !allDone && i === activeStep

          return (
            <div key={step.label} className="flex gap-4">
              {/* Indicator column */}
              <div className="flex flex-col items-center">
                <motion.div
                  className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0"
                  animate={{
                    borderColor: isComplete
                      ? "rgb(16 185 129)"
                      : isCurrent
                        ? "rgb(16 185 129 / 0.5)"
                        : "rgb(128 128 128 / 0.15)",
                    backgroundColor: isComplete
                      ? "rgb(16 185 129 / 0.1)"
                      : "transparent",
                  }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <AnimatePresence mode="wait">
                    {isComplete ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <Check className="size-4 text-emerald-500" strokeWidth={3} />
                      </motion.div>
                    ) : (
                      <motion.span
                        key="num"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          isCurrent ? "text-emerald-500" : "text-muted-foreground/30"
                        )}
                      >
                        {i + 1}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Pulse ring on current */}
                  {isCurrent && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-emerald-500/30"
                      animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                </motion.div>

                {/* Connector line */}
                {i < FLOW_STEPS.length - 1 && (
                  <div className="w-[2px] flex-1 mt-2 mb-0 bg-border/30 dark:bg-border/15 relative overflow-hidden rounded-full min-h-[16px]">
                    <motion.div
                      className="absolute inset-x-0 top-0 bg-emerald-500/50 rounded-full"
                      animate={{ height: isComplete ? "100%" : "0%" }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="pt-1.5 pb-0.5 min-w-0">
                <motion.p
                  className="text-[15px] font-medium leading-tight"
                  animate={{
                    color: isCurrent || isComplete
                      ? "var(--foreground)"
                      : "var(--muted-foreground)",
                    opacity: isCurrent || isComplete ? 1 : 0.35,
                  }}
                  transition={{ duration: 0.4 }}
                >
                  {step.label}
                </motion.p>
                <AnimatePresence>
                  {(isCurrent || isComplete) && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="text-[13px] text-muted-foreground/60 mt-1 leading-snug"
                    >
                      {step.sub}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )
        })}
      </div>

      {/* Completion summary — fades in when all steps done */}
      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 flex items-center gap-3 text-emerald-600 dark:text-emerald-400"
          >
            <div className="h-px flex-1 bg-emerald-500/20" />
            <span className="text-[13px] font-medium">Done in 8 minutes</span>
            <div className="h-px flex-1 bg-emerald-500/20" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type AuthView = "sign-in" | "sign-up" | "magic-link" | "forgot-password"

const viewTitles: Record<AuthView, string> = {
  "sign-in": "Your operator is standing by",
  "sign-up": "Put your workflows on autopilot",
  "magic-link": "Skip the password",
  "forgot-password": "Let's get you back in",
}

const viewDescriptions: Record<AuthView, string> = {
  "sign-in": "Pick up right where you left off — your agents remember",
  "sign-up": "Deploy your first AI agent in under a minute",
  "magic-link": "One click from your inbox and you're in",
  "forgot-password": "We'll send a reset link to your email",
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isAnonymousLoading, setIsAnonymousLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [authView, setAuthView] = useState<AuthView>("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get("ref")
    if (ref) {
      localStorage.setItem("coasty_referral_code", ref)
    }
    captureUtmParams()
  }, [searchParams])

  function switchView(view: AuthView) {
    setAuthView(view)
    setError(null)
    setSuccess(null)
  }

  async function handleSignInWithGoogle() {
    const supabase = createClient()
    if (!supabase) {
      throw new Error("Supabase is not configured")
    }

    try {
      setIsLoading(true)
      setError(null)
      setSuccess(null)

      const data = await signInWithGoogle(supabase)

      if (data?.url) {
        trackSignIn("google")
        window.location.href = data.url
      }
    } catch (err: unknown) {
      console.error("Error signing in with Google:", err)
      setError(
        (err as Error).message ||
          "An unexpected error occurred. Please try again."
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSignInAnonymously() {
    const supabase = createClient()
    if (!supabase) {
      throw new Error("Supabase is not configured")
    }

    try {
      setIsAnonymousLoading(true)
      setError(null)
      setSuccess(null)

      const data = await signInAnonymously(supabase)

      if (data?.user) {
        trackSignUp("anonymous")
        router.push("/")
      }
    } catch (err: unknown) {
      console.error("Error signing in anonymously:", err)
      setError(
        (err as Error).message ||
          "An unexpected error occurred. Please try again."
      )
    } finally {
      setIsAnonymousLoading(false)
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    if (!supabase) {
      setError("Supabase is not configured")
      return
    }

    if (!email || !password) {
      setError("Please fill in all fields")
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      setSuccess(null)

      const data = await signInWithEmail(supabase, email, password)

      if (data?.user) {
        trackSignIn("email")
        router.push("/")
      }
    } catch (err: unknown) {
      const message = (err as Error).message
      if (message?.includes("Email not confirmed")) {
        setError("Please confirm your email before signing in. Check your inbox.")
      } else if (message?.includes("Invalid login credentials")) {
        setError("Invalid email or password.")
      } else {
        setError(message || "Sign in failed. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    if (!supabase) {
      setError("Supabase is not configured")
      return
    }

    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      setSuccess(null)

      // Validate email against 121k+ disposable domains (server-side check)
      const validation = await validateEmailForSignup(email)
      if (!validation.valid) {
        setError(validation.error || "Invalid email address.")
        return
      }

      const data = await signUpWithEmail(supabase, validation.normalized || email, password)

      if (data?.user?.identities?.length === 0) {
        setError("An account with this email already exists. Try signing in instead.")
        return
      }

      trackSignUp("email")
      setSuccess("Check your email to confirm your account before signing in.")
      setEmail("")
      setPassword("")
      setConfirmPassword("")
    } catch (err: unknown) {
      setError((err as Error).message || "Sign up failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    if (!supabase) {
      setError("Supabase is not configured")
      return
    }

    if (!email) {
      setError("Please enter your email")
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      setSuccess(null)

      await signInWithMagicLink(supabase, email)
      trackSignIn("magic_link")
      setSuccess("Check your email for the magic link to sign in.")
    } catch (err: unknown) {
      const message = (err as Error).message
      if (message?.includes("Signups not allowed for otp")) {
        setAuthView("sign-up")
        setError("No account found with this email. Please sign up first.")
      } else {
        setError(message || "Failed to send magic link. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    if (!supabase) {
      setError("Supabase is not configured")
      return
    }

    if (!email) {
      setError("Please enter your email")
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      setSuccess(null)

      await resetPassword(supabase, email)
      setSuccess("Check your email for the password reset link.")
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to send reset email. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-background">
      {/* Ambient gradient mesh background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-[40%] -left-[20%] h-[80%] w-[60%] rounded-full opacity-[0.03] dark:opacity-[0.06] blur-[100px]"
          style={{ background: "radial-gradient(circle, currentColor, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-[30%] -right-[10%] h-[70%] w-[50%] rounded-full opacity-[0.025] dark:opacity-[0.05] blur-[100px]"
          style={{ background: "radial-gradient(circle, currentColor, transparent 70%)" }}
        />
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(128,128,128,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.3) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <HeaderGoBack href="/" />

      <main className="relative flex flex-1 flex-col lg:flex-row items-center lg:justify-center z-10 py-4 sm:py-10">
        {/* Left brand panel — visible on lg+ */}
        <LeftBrandPanel />

        {/* Right form panel */}
        <div className="flex flex-none lg:flex-1 items-center justify-center w-full lg:max-w-xl px-4 sm:px-6 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[420px]"
          >
            {/* Mobile-only heading */}
            <div className="lg:hidden text-center mb-5 sm:mb-8">
              <div className="flex justify-center mb-3">
                <CoastyIcon className="size-7 sm:size-8" />
              </div>
              <h1 className="text-foreground text-2xl sm:text-4xl font-medium tracking-tight">
                You set the goal. We handle the rest.
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                AI agents that browse, click, and work like a real teammate.
              </p>
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 sm:p-8 shadow-sm">
              {/* Dynamic title */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={authView}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="mb-4 sm:mb-6"
                >
                  <h2 className="text-foreground text-xl font-medium tracking-tight">
                    {viewTitles[authView]}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    {viewDescriptions[authView]}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Error / Success banners */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm">
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg px-4 py-3 text-sm">
                      {success}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                {/* Google OAuth */}
                <Button
                  variant="secondary"
                  className="w-full h-11 text-sm font-medium gap-3 rounded-xl"
                  onClick={handleSignInWithGoogle}
                  disabled={isLoading || isAnonymousLoading}
                >
                  <svg className="size-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>
                    {isLoading && authView === "sign-in" && !email
                      ? "Connecting..."
                      : "Continue with Google"}
                  </span>
                </Button>

                {/* Divider */}
                <div className="relative flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[11px] uppercase tracking-widest text-muted-foreground/50 font-medium select-none">
                    or
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                {/* Forms */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={authView}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {authView === "sign-in" && (
                      <form onSubmit={handleEmailSignIn} className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                            Email
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                            autoComplete="email"
                            className="h-11 rounded-xl bg-background/50"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                            Password
                          </Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="Your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            autoComplete="current-password"
                            className="h-11 rounded-xl bg-background/50"
                          />
                        </div>
                        <Button
                          type="submit"
                          className="w-full h-11 rounded-xl font-medium"
                          disabled={isLoading}
                        >
                          {isLoading ? "Signing in..." : "Sign in"}
                        </Button>
                        <div className="flex items-center justify-between text-[13px] pt-1">
                          <button
                            type="button"
                            onClick={() => switchView("forgot-password")}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Forgot password?
                          </button>
                          <button
                            type="button"
                            onClick={() => switchView("magic-link")}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Use magic link
                          </button>
                        </div>
                        <p className="text-center text-[13px] text-muted-foreground pt-2">
                          Don&apos;t have an account?{" "}
                          <button
                            type="button"
                            onClick={() => switchView("sign-up")}
                            className="text-foreground hover:underline font-medium"
                          >
                            Sign up
                          </button>
                        </p>
                      </form>
                    )}

                    {authView === "sign-up" && (
                      <form onSubmit={handleEmailSignUp} className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="signup-email" className="text-xs font-medium text-muted-foreground">
                            Email
                          </Label>
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                            autoComplete="email"
                            className="h-11 rounded-xl bg-background/50"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="signup-password" className="text-xs font-medium text-muted-foreground">
                            Password
                          </Label>
                          <Input
                            id="signup-password"
                            type="password"
                            placeholder="Min. 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            autoComplete="new-password"
                            className="h-11 rounded-xl bg-background/50"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="signup-confirm" className="text-xs font-medium text-muted-foreground">
                            Confirm password
                          </Label>
                          <Input
                            id="signup-confirm"
                            type="password"
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isLoading}
                            autoComplete="new-password"
                            className="h-11 rounded-xl bg-background/50"
                          />
                        </div>
                        <Button
                          type="submit"
                          className="w-full h-11 rounded-xl font-medium"
                          disabled={isLoading}
                        >
                          {isLoading ? "Creating account..." : "Create account"}
                        </Button>
                        <p className="text-center text-[13px] text-muted-foreground pt-2">
                          Already have an account?{" "}
                          <button
                            type="button"
                            onClick={() => switchView("sign-in")}
                            className="text-foreground hover:underline font-medium"
                          >
                            Sign in
                          </button>
                        </p>
                      </form>
                    )}

                    {authView === "magic-link" && (
                      <form onSubmit={handleMagicLink} className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="magic-email" className="text-xs font-medium text-muted-foreground">
                            Email
                          </Label>
                          <Input
                            id="magic-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                            autoComplete="email"
                            className="h-11 rounded-xl bg-background/50"
                          />
                        </div>
                        <Button
                          type="submit"
                          className="w-full h-11 rounded-xl font-medium"
                          disabled={isLoading}
                        >
                          {isLoading ? "Sending..." : "Send magic link"}
                        </Button>
                        <p className="text-center text-[13px] text-muted-foreground pt-2">
                          <button
                            type="button"
                            onClick={() => switchView("sign-in")}
                            className="text-foreground hover:underline font-medium"
                          >
                            Back to sign in
                          </button>
                        </p>
                      </form>
                    )}

                    {authView === "forgot-password" && (
                      <form onSubmit={handleForgotPassword} className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="reset-email" className="text-xs font-medium text-muted-foreground">
                            Email
                          </Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                            autoComplete="email"
                            className="h-11 rounded-xl bg-background/50"
                          />
                        </div>
                        <Button
                          type="submit"
                          className="w-full h-11 rounded-xl font-medium"
                          disabled={isLoading}
                        >
                          {isLoading ? "Sending..." : "Send reset link"}
                        </Button>
                        <p className="text-center text-[13px] text-muted-foreground pt-2">
                          <button
                            type="button"
                            onClick={() => switchView("sign-in")}
                            className="text-foreground hover:underline font-medium"
                          >
                            Back to sign in
                          </button>
                        </p>
                      </form>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 sm:mt-6 text-center">
              <p className="text-[12px] text-muted-foreground/60 leading-relaxed">
                By continuing, you agree to our{" "}
                <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
