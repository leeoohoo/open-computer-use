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
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { useState, useEffect } from "react"
import { captureUtmParams, trackSignIn, trackSignUp } from "@/lib/posthog/analytics"
import { HeaderGoBack } from "../components/header-go-back"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

type AuthView = "sign-in" | "sign-up" | "magic-link" | "forgot-password"

const viewTitles: Record<AuthView, string> = {
  "sign-in": "Welcome back",
  "sign-up": "Create your account",
  "magic-link": "Passwordless sign in",
  "forgot-password": "Reset your password",
}

const viewDescriptions: Record<AuthView, string> = {
  "sign-in": "Sign in to your workspace",
  "sign-up": "Get started with Coasty in seconds",
  "magic-link": "We'll send a link to your email",
  "forgot-password": "We'll send you a reset link",
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

      const data = await signUpWithEmail(supabase, email, password)

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
    <div className="relative flex h-dvh w-full flex-col bg-background overflow-hidden">
      {/* Ambient gradient mesh background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
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

      <main className="relative flex flex-1 flex-col lg:flex-row items-center justify-center z-10">
        {/* Left brand panel — visible on lg+ */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:flex flex-1 flex-col justify-center items-start px-16 xl:px-24 max-w-2xl"
        >
          <h1 className="text-foreground text-5xl xl:text-6xl font-medium tracking-tight leading-[1.1]">
            The AI that
            <br />
            <span className="text-muted-foreground">executes.</span>
          </h1>
          <p className="text-muted-foreground mt-6 text-lg leading-relaxed max-w-md">
            Your always-on operator that runs workflows, navigates the web,
            and handles the busywork. You decide the goal. It delivers the result.
          </p>
          <div className="mt-12 flex flex-col gap-4 text-sm text-muted-foreground/70">
            {[
              "Runs tasks in sandboxed environments",
              "Full audit trail with screenshots",
              "Schedule & automate 24/7",
            ].map((feature, i) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-3"
              >
                <div className="h-px w-5 bg-border" />
                <span>{feature}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right form panel */}
        <div className="flex flex-1 items-center justify-center w-full lg:max-w-xl px-4 sm:px-6 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[420px]"
          >
            {/* Mobile-only heading */}
            <div className="lg:hidden text-center mb-8">
              <h1 className="text-foreground text-3xl sm:text-4xl font-medium tracking-tight">
                The AI that executes.
              </h1>
              <p className="text-muted-foreground mt-3 text-sm sm:text-base">
                Your always-on operator for workflows, browsing, and busywork.
              </p>
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 sm:p-8 shadow-sm">
              {/* Dynamic title */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={authView}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="mb-6"
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
            <div className="mt-6 text-center">
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
