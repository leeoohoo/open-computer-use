"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "motion/react"
import { useUser } from "@/lib/user-store/provider"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import {
  ThumbsDown,
  Minus,
  ThumbsUp,
  Lightning,
  ChatCircleDots,
  PaperPlaneTilt,
  SealCheck,
  Coins,
  X,
} from "@phosphor-icons/react"

const REACTIONS = [
  {
    icon: ThumbsDown,
    label: "Bad",
    value: 1,
    color: "text-red-500",
    bg: "bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/15 dark:hover:bg-red-500/25",
    ring: "ring-red-500/30",
    border: "border-red-500/20",
  },
  {
    icon: Minus,
    label: "Okay",
    value: 2,
    color: "text-amber-500",
    bg: "bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-500/15 dark:hover:bg-amber-500/25",
    ring: "ring-amber-500/30",
    border: "border-amber-500/20",
  },
  {
    icon: ThumbsUp,
    label: "Good",
    value: 3,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25",
    ring: "ring-emerald-500/30",
    border: "border-emerald-500/20",
  },
  {
    icon: Lightning,
    label: "Amazing",
    value: 4,
    color: "text-blue-500",
    bg: "bg-blue-500/10 hover:bg-blue-500/20 dark:bg-blue-500/15 dark:hover:bg-blue-500/25",
    ring: "ring-blue-500/30",
    border: "border-blue-500/20",
  },
] as const

type FeedbackState = "idle" | "rated" | "commenting" | "nps" | "submitted"

interface RunFeedbackBarProps {
  chatId?: string | null
  swarmId?: string | null
  messageId?: string
  feedbackType?: "run" | "swarm"
  className?: string
}

export function RunFeedbackBar({
  chatId,
  swarmId,
  messageId,
  feedbackType = "run",
  className,
}: RunFeedbackBarProps) {
  const { user } = useUser()
  const [state, setState] = useState<FeedbackState>("idle")
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [comment, setComment] = useState("")
  const [creditsEarned, setCreditEarned] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNps, setShowNps] = useState(false)
  const commentRef = useRef<HTMLInputElement>(null)
  const hasSubmittedRef = useRef(false)

  useEffect(() => {
    setShowNps(Math.random() < 0.1)
  }, [])

  if (!isSupabaseEnabled || !user?.id) return null

  const selectedReaction = REACTIONS.find((r) => r.value === selectedRating)

  const submitFeedback = async (payload: {
    rating?: number
    comment?: string
    npsScore?: number
    feedbackType?: string
  }) => {
    if (hasSubmittedRef.current && !payload.npsScore) return
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/feedback/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          swarmId,
          messageId,
          feedbackType: payload.feedbackType || feedbackType,
          ...payload,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setCreditEarned((prev) => prev + (data.creditsAwarded || 0))
        if (!payload.npsScore) hasSubmittedRef.current = true
      }
    } catch {
      // best-effort
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRating = async (value: number) => {
    setSelectedRating(value)
    setState("rated")
    await submitFeedback({ rating: value })
  }

  const handleCommentSubmit = async () => {
    if (!comment.trim()) return
    await submitFeedback({ rating: selectedRating || undefined, comment: comment.trim() })
    setState(showNps ? "nps" : "submitted")
  }

  const handleNpsSubmit = async (score: number) => {
    await submitFeedback({ npsScore: score, feedbackType: "nps" })
    setState("submitted")
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn("w-full", className)}
    >
      <div className="rounded-xl border border-border/40 bg-muted/20 backdrop-blur-sm overflow-hidden">
        <AnimatePresence mode="wait">
          {/* ── Idle: reaction buttons ── */}
          {state === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-4 py-3"
            >
              <div className="flex items-center gap-4">
                <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider select-none shrink-0">
                  Rate this {feedbackType === "swarm" ? "swarm" : "run"}
                </span>
                <div className="flex items-center gap-1.5">
                  {REACTIONS.map((r) => {
                    const Icon = r.icon
                    return (
                      <button
                        key={r.value}
                        onClick={() => handleRating(r.value)}
                        disabled={isSubmitting}
                        className={cn(
                          "group relative flex items-center justify-center size-8 rounded-lg",
                          "transition-all duration-200 ease-out border border-transparent",
                          r.bg,
                          "hover:scale-105 active:scale-95",
                          "disabled:opacity-40 disabled:pointer-events-none"
                        )}
                        title={r.label}
                        type="button"
                      >
                        <Icon
                          className={cn("size-4 transition-transform group-hover:scale-110", r.color)}
                          weight="fill"
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Rated: confirmation + tell us more ── */}
          {state === "rated" && (
            <motion.div
              key="rated"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {/* Selected reaction chip */}
                {selectedReaction && (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border",
                      selectedReaction.bg,
                      selectedReaction.border
                    )}
                  >
                    <selectedReaction.icon
                      className={cn("size-3.5", selectedReaction.color)}
                      weight="fill"
                    />
                    <span className={cn("text-xs font-medium", selectedReaction.color)}>
                      {selectedReaction.label}
                    </span>
                  </div>
                )}

                <CreditBadge amount={1} />

                <div className="h-4 w-px bg-border/40" />

                <button
                  onClick={() => {
                    setState("commenting")
                    setTimeout(() => commentRef.current?.focus(), 100)
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-foreground",
                    "transition-colors group"
                  )}
                  type="button"
                >
                  <ChatCircleDots className="size-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                  Tell us more
                  <span className="text-emerald-500/70 text-[10px]">+5</span>
                </button>

                <button
                  onClick={() => setState(showNps ? "nps" : "submitted")}
                  className="ml-auto text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                  type="button"
                  title="Dismiss"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Commenting: text input ── */}
          {state === "commenting" && (
            <motion.div
              key="commenting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-4 py-3"
            >
              <div className="flex items-center gap-2.5 w-full">
                {selectedReaction && (
                  <div className={cn("flex items-center justify-center size-8 rounded-lg shrink-0", selectedReaction.bg)}>
                    <selectedReaction.icon className={cn("size-3.5", selectedReaction.color)} weight="fill" />
                  </div>
                )}
                <div className="flex-1 flex items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-2 focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/10 transition-all">
                  <input
                    ref={commentRef}
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleCommentSubmit()
                      }
                    }}
                    placeholder="What could be better?"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none min-w-0"
                    maxLength={500}
                    disabled={isSubmitting}
                  />
                  <button
                    onClick={handleCommentSubmit}
                    disabled={!comment.trim() || isSubmitting}
                    className={cn(
                      "flex items-center justify-center size-7 rounded-md transition-all shrink-0",
                      comment.trim()
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        : "bg-muted/60 text-muted-foreground/30 cursor-not-allowed"
                    )}
                    type="button"
                    title="Send feedback"
                  >
                    <PaperPlaneTilt className="size-3.5" weight="fill" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── NPS ── */}
          {state === "nps" && (
            <motion.div
              key="nps"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-4 py-3"
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider select-none">
                    Recommend Coasty?
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500/70 font-medium">
                    <Coins className="size-3" weight="fill" />
                    +10 credits
                  </span>
                </div>
                <button
                  onClick={() => setState("submitted")}
                  className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                  type="button"
                  title="Skip"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => handleNpsSubmit(i)}
                    disabled={isSubmitting}
                    className={cn(
                      "flex-1 flex items-center justify-center h-8 rounded-md text-xs font-medium",
                      "transition-all duration-150 border",
                      i <= 3
                        ? "border-red-500/10 hover:bg-red-500/15 hover:text-red-600 hover:border-red-500/25 dark:hover:text-red-400"
                        : i <= 6
                          ? "border-amber-500/10 hover:bg-amber-500/15 hover:text-amber-600 hover:border-amber-500/25 dark:hover:text-amber-400"
                          : i <= 8
                            ? "border-emerald-500/10 hover:bg-emerald-500/15 hover:text-emerald-600 hover:border-emerald-500/25 dark:hover:text-emerald-400"
                            : "border-blue-500/10 hover:bg-blue-500/15 hover:text-blue-600 hover:border-blue-500/25 dark:hover:text-blue-400",
                      "text-muted-foreground/50 bg-muted/30",
                      "disabled:opacity-40 disabled:pointer-events-none"
                    )}
                    type="button"
                  >
                    {i}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground/30 mt-1.5 px-1">
                <span>Not likely</span>
                <span>Very likely</span>
              </div>
            </motion.div>
          )}

          {/* ── Submitted ── */}
          {state === "submitted" && creditsEarned > 0 && (
            <motion.div
              key="submitted"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, type: "spring", bounce: 0.2 }}
              className="px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center size-6 rounded-full bg-emerald-500/10">
                  <SealCheck className="size-3.5 text-emerald-500" weight="fill" />
                </div>
                <span className="text-xs font-medium text-foreground/70">
                  Thanks for the feedback!
                </span>
                <CreditBadge amount={creditsEarned} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function CreditBadge({ amount }: { amount: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, type: "spring", bounce: 0.3 }}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        "text-[10px] font-semibold tracking-wide",
        "border border-emerald-500/15"
      )}
    >
      <Coins className="size-3" weight="fill" />
      +{amount}
    </motion.span>
  )
}
