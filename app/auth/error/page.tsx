"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "@phosphor-icons/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { GridBackground } from "@/components/ui/grid-background"

export const dynamic = "force-dynamic"

// Create a separate component that uses useSearchParams
function AuthErrorContent() {
  const searchParams = useSearchParams()
  const message =
    searchParams.get("message") || "An error occurred during authentication."

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          Authentication Error
        </h1>
        <div className="mt-6 rounded-md bg-red-500/10 p-4">
          <p className="text-red-400">{message}</p>
        </div>
        <div className="mt-8">
          <Button
            variant="secondary"
            className="w-full text-base sm:text-base"
            size="lg"
            asChild
          >
            <Link href="/auth">Try Again</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <div className="flex h-screen flex-col bg-background relative">
      {/* Grid pattern background */}
      <GridBackground />
      {/* Header */}
      <header className="p-4 relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-foreground hover:bg-accent"
        >
          <ArrowLeft className="size-5" />
          <span className="font-base ml-2 hidden text-sm sm:inline-block">
            Back to Chat
          </span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6 relative z-10">
        <Suspense fallback={<div>Loading...</div>}>
          <AuthErrorContent />
        </Suspense>
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground relative z-10">
        <p className="mb-3">
          Need help?{" "}
          <Link href="/" className="text-muted-foreground hover:underline">
            Contact Support
          </Link>
        </p>
        <div className="flex gap-4 justify-center text-xs">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  )
}
