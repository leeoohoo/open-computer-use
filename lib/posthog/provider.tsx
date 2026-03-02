"use client"

import posthog from "posthog-js"
import { useEffect } from "react"

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"

let initialized = false

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (initialized || !POSTHOG_KEY || typeof window === "undefined") return

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: true,
      session_recording: {
        maskInputOptions: { password: true },
      },
      persistence: "localStorage+cookie",
      person_profiles: "identified_only",
    })

    initialized = true
  }, [])

  return <>{children}</>
}
