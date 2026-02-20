"use client"

import { useEffect, useRef } from "react"
import { useUser } from "@/lib/user-store/provider"

export function ReferralProcessor() {
  const { user } = useUser()
  const processedRef = useRef(false)

  useEffect(() => {
    if (!user || processedRef.current) return

    const referralCode = localStorage.getItem("coasty_referral_code")
    if (!referralCode) return

    processedRef.current = true

    // Don't claim if referring yourself
    if (referralCode === user.id) {
      localStorage.removeItem("coasty_referral_code")
      return
    }

    const claimReferral = async () => {
      try {
        const response = await fetch("/api/referral/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referrerCode: referralCode }),
        })

        if (response.ok) {
          localStorage.removeItem("coasty_referral_code")
        } else {
          // Clean up on known non-retryable errors
          if (response.status === 409 || response.status === 400) {
            localStorage.removeItem("coasty_referral_code")
          }
          // On other errors, keep in localStorage for retry on next load
          processedRef.current = false
        }
      } catch {
        // Network error — allow retry next time
        processedRef.current = false
      }
    }

    claimReferral()
  }, [user])

  return null
}
