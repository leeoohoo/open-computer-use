"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, XCircle, SkipForward, Clock, Zap, History } from "lucide-react"
import { AgentIcon } from "@/components/icons/agent"
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
      return { icon: CheckCircle2, dotColor: "bg-emerald-500", label: "Completed", labelColor: "text-emerald-700 dark:text-emerald-400" }
    case "failed":
      return { icon: XCircle, dotColor: "bg-rose-500", label: "Failed", labelColor: "text-rose-700 dark:text-rose-400" }
    case "skipped":
      return { icon: SkipForward, dotColor: "bg-zinc-400 dark:bg-zinc-600", label: "Skipped", labelColor: "text-muted-foreground" }
    case "cancelled":
      return { icon: XCircle, dotColor: "bg-zinc-400 dark:bg-zinc-600", label: "Cancelled", labelColor: "text-muted-foreground" }
    case "triggered":
      return { icon: Zap, dotColor: "bg-sky-500", label: "Triggered", labelColor: "text-sky-700 dark:text-sky-400" }
    default:
      return { icon: Clock, dotColor: "bg-zinc-400 dark:bg-zinc-600", label: status, labelColor: "text-muted-foreground" }
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
      <div className="flex items-center justify-center py-12">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-2 border-foreground/[0.06]" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground/50 animate-spin" />
        </div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mb-3">
          <History className="h-5 w-5 text-muted-foreground/30" />
        </div>
        <p className="text-sm font-medium text-muted-foreground/70">No activity yet</p>
        <p className="text-xs text-muted-foreground/40 mt-1 max-w-[240px]">
          Logs will appear here once your employees start working
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {history.map((entry, idx) => {
        const cfg = statusConfig(entry.status)
        return (
          <div
            key={entry.id}
            className="group flex items-center gap-2.5 sm:gap-3.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-all"
          >
            {/* Timeline dot */}
            <div className="relative flex flex-col items-center shrink-0">
              <div className={cn("w-2 h-2 rounded-full", cfg.dotColor)} />
              {idx < history.length - 1 && (
                <div className="absolute top-3 w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className={cn("text-[11px] sm:text-xs font-semibold", cfg.labelColor)}>
                    {cfg.label}
                  </span>
                  {entry.trigger === "manual" && (
                    <span className="text-[10px] sm:text-[11px] uppercase tracking-widest font-medium text-muted-foreground/40 bg-zinc-100 dark:bg-zinc-800 px-1 sm:px-1.5 py-px rounded">
                      manual
                    </span>
                  )}
                </div>
                {entry.error && (
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground/50 truncate mt-0.5" title={entry.error}>
                    {entry.error}
                  </p>
                )}
              </div>

              {/* Meta */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                {entry.duration_seconds != null && (
                  <span className="hidden sm:inline text-[11px] text-muted-foreground/40 tabular-nums font-medium">
                    {entry.duration_seconds}s
                  </span>
                )}
                {entry.credits_charged != null && entry.credits_charged > 0 && (
                  <span className="hidden sm:inline text-[11px] text-muted-foreground/40 tabular-nums">
                    {entry.credits_charged} cr
                  </span>
                )}
                <span
                  className="text-[10px] sm:text-[11px] text-muted-foreground/40 tabular-nums min-w-[40px] sm:min-w-[52px] text-right"
                  title={formatExactDate(entry.executed_at)}
                >
                  {formatDate(entry.executed_at)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
