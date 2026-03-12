"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Play,
  Pause,
  Trash2,
  History,
  Clock,
  AlertTriangle,
  Pencil,
} from "lucide-react"
import { CoastyIcon } from "@/components/icons/coasty"
import {
  formatFrequency,
  formatNextRun,
  triggerScheduleNow,
  pauseSchedule,
  deleteSchedule,
  type ScheduleResponse,
} from "@/lib/services/schedules-api"
import { cn } from "@/lib/utils"

interface ScheduleCardProps {
  schedule: ScheduleResponse
  onUpdate: () => void
  onViewHistory: (chatId: string) => void
  onEdit?: (chatId: string) => void
}

export function ScheduleCard({
  schedule,
  onUpdate,
  onViewHistory,
  onEdit,
}: ScheduleCardProps) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function handleRunNow() {
    setActionLoading("run")
    try { await triggerScheduleNow(schedule.chat_id); onUpdate() } catch {} finally { setActionLoading(null) }
  }

  async function handleTogglePause() {
    setActionLoading("pause")
    try { await pauseSchedule(schedule.chat_id); onUpdate() } catch {} finally { setActionLoading(null) }
  }

  async function handleDelete() {
    setActionLoading("delete")
    try { await deleteSchedule(schedule.chat_id); onUpdate() } catch {} finally { setActionLoading(null) }
  }

  const isActive = schedule.enabled && !schedule.paused_reason
  const isFailed = schedule.paused_reason === "too_many_failures"

  const statusLabel = isActive
    ? "On Duty"
    : schedule.paused_reason === "too_many_failures"
      ? "Needs Attention"
      : schedule.paused_reason === "insufficient_credits"
        ? "No Credits"
        : schedule.paused_reason === "machine_unavailable"
          ? "Offline"
          : "Standby"

  return (
    <div className={cn(
      "group relative flex flex-col rounded-xl overflow-hidden transition-all duration-300 h-full",
      "border border-border/30 bg-card/50 backdrop-blur-sm",
      "hover:bg-card/80 hover:border-border/50 hover:shadow-lg hover:shadow-foreground/[0.02]",
      !isActive && !isFailed && "opacity-85 hover:opacity-100",
    )}>
      {/* Subtle top line */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-px",
        isActive
          ? "bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"
          : isFailed
            ? "bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"
            : "bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent",
      )} />

      {/* Content */}
      <div className="flex flex-col h-full">
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 flex-1 space-y-3 sm:space-y-4">
          {/* Identity */}
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                  <CoastyIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground/60" />
                </div>
                <h3
                  className="text-[13px] sm:text-sm font-semibold text-foreground truncate cursor-pointer hover:text-foreground/70 transition-colors"
                  onClick={() => router.push(`/c/${schedule.chat_id}`)}
                >
                  {schedule.title || "Untitled Employee"}
                </h3>
              </div>
              <div className="flex items-center gap-2 pl-9 sm:pl-[42px]">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  isActive ? "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                    : isFailed ? "bg-amber-500"
                    : "bg-muted-foreground/30",
                )} />
                <span className={cn(
                  "text-xs font-medium",
                  isActive ? "text-emerald-700 dark:text-emerald-400"
                    : isFailed ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground",
                )}>
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground/40" />
              {formatFrequency(schedule.frequency)}
            </span>
            <span className="text-foreground/[0.1]">&middot;</span>
            <span>{schedule.run_count} runs</span>
            {schedule.consecutive_failures > 0 && (
              <>
                <span className="text-foreground/[0.1]">&middot;</span>
                <span className="text-amber-600/70 dark:text-amber-400/70">{schedule.consecutive_failures} failed</span>
              </>
            )}
          </div>

          {/* Key-value rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Next shift</span>
              <span className="text-[11px] text-foreground font-medium">{formatNextRun(schedule.next_run_at)}</span>
            </div>
            {schedule.last_run_at && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Last active</span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(schedule.last_run_at).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Alert */}
          {schedule.paused_reason && schedule.paused_reason !== "deleted" && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-muted/50 border border-border/50">
              <AlertTriangle className="h-3 w-3 shrink-0 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground truncate">
                {schedule.paused_reason === "insufficient_credits" ? "Insufficient credits"
                  : schedule.paused_reason === "too_many_failures" ? `${schedule.consecutive_failures} consecutive failures`
                  : schedule.paused_reason === "machine_unavailable" ? "Workstation unavailable"
                  : schedule.paused_reason}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 flex items-center gap-1 sm:gap-1.5 border-t border-border/40">
          <button
            onClick={handleRunNow}
            disabled={!!actionLoading}
            className={cn(
              "h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all",
              "bg-muted/60 hover:bg-muted text-foreground/70 hover:text-foreground",
              "disabled:opacity-40",
            )}
          >
            <CoastyIcon className="h-3 w-3" />
            {actionLoading === "run" ? "\u2026" : "Run"}
          </button>
          <button
            onClick={handleTogglePause}
            disabled={!!actionLoading}
            className="h-8 px-2.5 rounded-lg text-[11px] flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all disabled:opacity-40"
          >
            {schedule.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {actionLoading === "pause" ? "\u2026" : schedule.enabled ? "Pause" : "Resume"}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onViewHistory(schedule.chat_id)}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/60 transition-all"
            title="Work Log"
          >
            <History className="h-3.5 w-3.5" />
          </button>
          {onEdit && (
            <button
              onClick={() => onEdit(schedule.chat_id)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/60 transition-all"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={!!actionLoading}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/60 transition-all disabled:opacity-40"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
