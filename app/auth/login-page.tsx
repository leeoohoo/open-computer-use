"use client"

import { Button } from "@/components/ui/button"
import { signInWithGoogle, signInAnonymously } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { SparklesCore } from "@/components/ui/sparkles"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useTheme } from "next-themes"
import { HeaderGoBack } from "../components/header-go-back"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isAnonymousLoading, setIsAnonymousLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { theme } = useTheme()

  async function handleSignInWithGoogle() {
    const supabase = createClient()

    if (!supabase) {
      throw new Error("Supabase is not configured")
    }

    try {
      setIsLoading(true)
      setError(null)

      const data = await signInWithGoogle(supabase)

      // Redirect to the provider URL
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

      const data = await signInAnonymously(supabase)

      if (data?.user) {
        // Redirect to home page after successful anonymous sign-in
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

  return (
    <div className="relative bg-background flex h-dvh w-full flex-col">
      {/* Sparkles Background */}
      <div className="absolute inset-0 w-full h-full">
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
              Meet your AI computer assistant
            </h1>
            <p className="text-muted-foreground mt-3">
              An AI employee that controls your computer to automate tasks, browse the web, and manage your digital workspace.
            </p>
          </div>
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          )}
          <div className="mt-8 space-y-4">
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
                {isLoading ? "Connecting..." : "Continue with Google"}
              </span>
            </Button>
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
          <Link href="/changelog" className="hover:text-foreground transition-colors">
            Changelog
          </Link>
          <Link href="/blog" className="hover:text-foreground transition-colors">
            Blog
          </Link>
        </div>
      </footer>
    </div>
  )
}
