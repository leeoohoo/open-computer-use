"use client"

import { ArrowLeft } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"

export function HeaderGoBack({
  href = "/",
  label = "Back to Home",
}: {
  href?: string
  label?: string
}) {
  const router = useRouter()

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back()
      return
    }
    router.push(href)
  }

  return (
    <header className="relative z-20 p-4">
      <button
        type="button"
        onClick={handleGoBack}
        className="text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1"
      >
        <ArrowLeft className="text-foreground size-5" />
        <span className="font-base ml-2 hidden text-sm sm:inline-block">
          {label}
        </span>
      </button>
    </header>
  )
}
