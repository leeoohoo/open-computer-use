"use client"

import { useState, useEffect } from "react"
import { History, CheckCircle2, XCircle, SkipForward, Clock, Zap } from "lucide-react"
import {
  getScheduleHistory,
  type ScheduleHistoryEntry,
} from "@/lib/services/schedules-api"
import { cn } from "@/lib/utils"

interface ScheduleHistoryProps {
  chatId?: string
  limit?: number
}

function statusConfig(status: string) {
  switch (status) {
    case "completed":
      return { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Completed" }
    case "failed":
      return { icon: XCircle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", label: "Failed" }
    case "skipped":
      return { icon: SkipForward, color: "text-muted-foreground", bg: "bg-foreground/[0.03]", border: "border-foreground/[0.05]", label: "Skipped" }
    case "cancelled":
      return { icon: XCircle, color: "text-muted-foreground", bg: "bg-foreground/[0.03]", border: "border-foreground/[0.05]", label: "Cancelled" }
    case "triggered":
      return { icon: Zap, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", label: "Triggered" }
    default:
      return { icon: Clock, color: "text-muted-foreground", bg: "bg-foreground/[0.03]", border: "border-foreground/[0.05]", label: status }
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function formatExactDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ScheduleHistory({ chatId, limit = 20 }: ScheduleHistoryProps) {
  const [history, setHistory] = useState<ScheduleHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getScheduleHistory(chatId, limit)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [chatId, limit])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground animate-spin" />
        </div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center py-10 text-center rounded-xl",
        "bg-foreground/[0.03] border border-foreground/[0.06]",
      )}>
        <History className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">No activity yet</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">Activity logs will appear here once your employees start working</p>
      </div>
    )
  }

  return (
    <div className={cn(
      "rounded-xl overflow-hidden",
      "bg-foreground/[0.03] border border-foreground/[0.06]",
    )}>
      <div className="divide-y divide-foreground/[0.04]">
        {history.map((entry) => {
          const cfg = statusConfig(entry.status)
          const Icon = cfg.icon
          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-foreground/[0.03] transition-all group"
            >
              {/* Status icon */}
              <div className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                cfg.bg, cfg.border,
              )}>
                <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</span>
                  <span
                    className="text-[11px] text-muted-foreground/60 shrink-0 tabular-nums"
                    title={formatExactDate(entry.executed_at)}
                  >
                    {formatDate(entry.executed_at)}
                  </span>
                </div>

                {/* Error message */}
                {entry.error && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate" title={entry.error}>
                    {entry.error}
                  </p>
                )}

                {/* Meta chips */}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {entry.trigger === "manual" && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-foreground/[0.04] px-1.5 py-0.5 rounded-md">
                      Manual
                    </span>
                  )}
                  {entry.duration_seconds != null && (
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                      {entry.duration_seconds}s
                    </span>
                  )}
                  {entry.credits_charged != null && entry.credits_charged > 0 && (
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                      {entry.credits_charged} credits
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
