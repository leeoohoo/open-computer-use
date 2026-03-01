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
import { SparklesCore } from "@/components/ui/sparkles"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { HeaderGoBack } from "../components/header-go-back"
import { useRouter, useSearchParams } from "next/navigation"

type AuthView = "sign-in" | "sign-up" | "magic-link" | "forgot-password"

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
  const { theme } = useTheme()

  // Capture referral code from URL
  useEffect(() => {
    const ref = searchParams.get("ref")
    if (ref) {
      localStorage.setItem("coasty_referral_code", ref)
    }
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

      // If email confirmation is required, user.identities will be empty
      if (data?.user?.identities?.length === 0) {
        setError("An account with this email already exists. Try signing in instead.")
        return
      }

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
    <div className="relative bg-background flex h-dvh w-full flex-col">
      {/* Sparkles Background */}
      <div className="pointer-events-none absolute inset-0 w-full h-full">
        <SparklesCore
          id="auth-sparkles"
          background="transparent"
          minSize={0.4}
          maxSize={1}
          particleDensity={6}
          className="w-full h-full"
          particleColor={theme === "dark" ? "#FFFFFF" : "#000000"}
        />
      </div>
      {/* Elegant monotonic bottom-up gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-blue-100/25 via-blue-50/15 via-blue-25/8 to-transparent dark:from-blue-950/20 dark:via-blue-900/12 dark:via-blue-800/6 dark:to-transparent pointer-events-none z-0" />
      <HeaderGoBack href="/" />

      <main className="relative flex flex-1 flex-col items-center justify-center px-4 sm:px-6 z-10">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-foreground text-3xl font-medium tracking-tight sm:text-4xl">
              Meet the AI that executes, not excuses.
            </h1>
            <p className="text-muted-foreground mt-3">
              Your always-on AI operator that runs workflows, navigates the web, and handles the busywork in your digital workspace. You decide the goal. It delivers the result.
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md p-3 text-sm">
              {success}
            </div>
          )}

          <div className="space-y-4">
            {/* Google OAuth Button */}
            <Button
              variant="secondary"
              className="w-full text-base sm:text-base"
              size="lg"
              onClick={handleSignInWithGoogle}
              disabled={isLoading || isAnonymousLoading}
            >
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google logo"
                width={20}
                height={20}
                className="mr-2 size-4"
              />
              <span>
                {isLoading && authView === "sign-in" && !email
                  ? "Connecting..."
                  : "Continue with Google"}
              </span>
            </Button>

            {/* Divider */}
            <div className="relative flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or continue with email</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Email Sign In */}
            {authView === "sign-in" && (
              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
                <div className="flex items-center justify-between text-sm">
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
                    Sign in with magic link
                  </button>
                </div>
                <p className="text-center text-sm text-muted-foreground">
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

            {/* Email Sign Up */}
            {authView === "sign-up" && (
              <form onSubmit={handleEmailSignUp} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-confirm">Confirm password</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating account..." : "Create account"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
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

            {/* Magic Link */}
            {authView === "magic-link" && (
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="magic-email">Email</Label>
                  <Input
                    id="magic-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send magic link"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
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

            {/* Forgot Password */}
            {authView === "forgot-password" && (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send reset link"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
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
          </div>
        </div>
      </main>

      <footer className="relative text-muted-foreground py-6 text-center text-sm z-10">
        <p className="mb-3">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="text-foreground hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-foreground hover:underline">
            Privacy Policy
          </Link>
        </p>
        <div className="flex gap-4 justify-center text-xs">
          <Link href="/blog" className="hover:text-foreground transition-colors">
            Blog
          </Link>
        </div>
      </footer>
    </div>
  )
}
