"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { History } from "lucide-react"
import {
  getScheduleHistory,
  type ScheduleHistoryEntry,
} from "@/lib/services/schedules-api"

interface ScheduleHistoryProps {
  chatId?: string
  limit?: number
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge
          variant="outline"
          className="border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 text-xs"
        >
          Completed
        </Badge>
      )
    case "failed":
      return (
        <Badge
          variant="outline"
          className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs"
        >
          Failed
        </Badge>
      )
    case "skipped":
      return (
        <Badge
          variant="outline"
          className="border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs"
        >
          Skipped
        </Badge>
      )
    case "cancelled":
      return (
        <Badge
          variant="outline"
          className="border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs"
        >
          Cancelled
        </Badge>
      )
    case "triggered":
      return (
        <Badge
          variant="outline"
          className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs"
        >
          Triggered
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {status}
        </Badge>
      )
  }
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
      <div className="flex items-center justify-center py-8">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-2 border-muted" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">Loading history...</span>
        </div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <History className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No execution history yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden divide-y">
      {history.map((entry) => (
        <div
          key={entry.id}
          className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm hover:bg-accent/50 transition-colors space-y-1"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <StatusBadge status={entry.status} />
              <span className="text-muted-foreground truncate text-xs sm:text-sm">
                {new Date(entry.executed_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {entry.trigger === "manual" && (
                <span className="text-xs text-muted-foreground hidden sm:inline">(manual)</span>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-muted-foreground shrink-0">
              {entry.duration_seconds != null && (
                <span className="text-xs">{entry.duration_seconds}s</span>
              )}
              {entry.credits_charged != null && entry.credits_charged > 0 && (
                <span className="text-xs">{entry.credits_charged} <span className="hidden sm:inline">credits</span><span className="sm:hidden">cr</span></span>
              )}
            </div>
          </div>
          {entry.error && (
            <p
              className="text-xs text-red-500 truncate"
              title={entry.error}
            >
              {entry.error}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
