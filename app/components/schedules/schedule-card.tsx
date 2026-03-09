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
      "group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 h-full",
      "bg-foreground/[0.06] hover:bg-foreground/[0.08]",
      "ring-1 ring-foreground/[0.1] hover:ring-foreground/[0.16]",
      !isActive && !isFailed && "opacity-85 hover:opacity-100",
    )}>
      <div className="p-5 flex-1 space-y-4">
        {/* Identity */}
        <div className="flex items-start gap-3.5">
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            isActive
              ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
              : isFailed
                ? "bg-amber-500/10 ring-1 ring-amber-500/20"
                : "bg-foreground/[0.08] ring-1 ring-foreground/[0.1]",
          )}>
            <CoastyIcon className={cn(
              "h-4 w-4",
              isActive ? "text-emerald-600 dark:text-emerald-400"
                : isFailed ? "text-amber-600 dark:text-amber-400"
                : "text-foreground/50",
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-[15px] font-semibold text-foreground truncate cursor-pointer hover:text-foreground/70 transition-colors leading-tight"
              onClick={() => router.push(`/c/${schedule.chat_id}`)}
            >
              {schedule.title || "Untitled Employee"}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                isActive ? "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                  : isFailed ? "bg-amber-500"
                  : "bg-zinc-400 dark:bg-zinc-600",
              )} />
              <span className={cn(
                "text-[11px] font-medium",
                isActive ? "text-emerald-700 dark:text-emerald-400"
                  : isFailed ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground/70",
              )}>
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground/70 flex-wrap">
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
            <span className="text-[11px] text-muted-foreground/50">Next shift</span>
            <span className="text-[11px] text-foreground/70 font-medium">{formatNextRun(schedule.next_run_at)}</span>
          </div>
          {schedule.last_run_at && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/50">Last active</span>
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
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-foreground/[0.04] ring-1 ring-foreground/[0.06]">
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
      <div className="px-4 py-3 flex items-center gap-1.5 border-t border-foreground/[0.06]">
        <button
          onClick={handleRunNow}
          disabled={!!actionLoading}
          className={cn(
            "h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all",
            "bg-foreground/[0.06] hover:bg-foreground/[0.1] text-foreground/70 hover:text-foreground",
            "disabled:opacity-40",
          )}
        >
          <CoastyIcon className="h-3 w-3" />
          {actionLoading === "run" ? "\u2026" : "Run"}
        </button>
        <button
          onClick={handleTogglePause}
          disabled={!!actionLoading}
          className="h-8 px-2.5 rounded-lg text-[11px] flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-all disabled:opacity-40"
        >
          {schedule.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {actionLoading === "pause" ? "\u2026" : schedule.enabled ? "Pause" : "Resume"}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onViewHistory(schedule.chat_id)}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground hover:bg-foreground/[0.06] transition-all"
          title="Work Log"
        >
          <History className="h-3.5 w-3.5" />
        </button>
        {onEdit && (
          <button
            onClick={() => onEdit(schedule.chat_id)}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground hover:bg-foreground/[0.06] transition-all"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={!!actionLoading}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground hover:bg-foreground/[0.06] transition-all disabled:opacity-40"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
