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
  Check,
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

function StatusBadge({ schedule }: { schedule: ScheduleResponse }) {
  if (schedule.enabled && !schedule.paused_reason) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
        On Duty
      </span>
    )
  }

  if (schedule.paused_reason === "insufficient_credits") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-400">
        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        No Credits
      </span>
    )
  }

  if (schedule.paused_reason === "too_many_failures") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Needs Attention
      </span>
    )
  }

  if (schedule.paused_reason === "machine_unavailable") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        Offline
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border border-foreground/[0.06] bg-foreground/[0.03] text-muted-foreground">
      <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-600" />
      Standby
    </span>
  )
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
    try {
      await triggerScheduleNow(schedule.chat_id)
      onUpdate()
    } catch {
      // handled by parent
    } finally {
      setActionLoading(null)
    }
  }

  async function handleTogglePause() {
    setActionLoading("pause")
    try {
      await pauseSchedule(schedule.chat_id)
      onUpdate()
    } catch {
      // handled by parent
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete() {
    setActionLoading("delete")
    try {
      await deleteSchedule(schedule.chat_id)
      onUpdate()
    } catch {
      // handled by parent
    } finally {
      setActionLoading(null)
    }
  }

  const isActive = schedule.enabled && !schedule.paused_reason
  const isFailed = schedule.paused_reason === "too_many_failures"
  const showBeam = isActive || isFailed

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl overflow-hidden transition-all duration-300 h-full",
        showBeam ? "border border-foreground/[0.1] dark:border-0" : "border border-foreground/[0.06]",
        !isActive && "opacity-80",
        "bg-foreground/[0.03]",
      )}
    >
      {/* Monochrome rotating beam border — dark mode only */}
      {showBeam && (
        <>
          <div className="hidden dark:block absolute -inset-[2px] rounded-xl overflow-hidden">
            <div
              className="absolute w-full h-full animate-rotate-beam"
              style={{
                filter: "drop-shadow(0 0 6px rgba(255, 255, 255, 0.1))",
                background: isActive
                  ? `conic-gradient(from var(--beam-angle) at 50% 50%,
                      transparent 0deg,
                      rgba(255, 255, 255, 0.06) 5deg,
                      rgba(255, 255, 255, 0.12) 10deg,
                      rgba(255, 255, 255, 0.2) 20deg,
                      rgba(255, 255, 255, 0.5) 30deg,
                      rgba(255, 255, 255, 0.2) 40deg,
                      rgba(255, 255, 255, 0.12) 50deg,
                      rgba(255, 255, 255, 0.06) 55deg,
                      transparent 60deg,
                      transparent 360deg)`
                  : `conic-gradient(from var(--beam-angle) at 50% 50%,
                      transparent 0deg,
                      rgba(161, 161, 170, 0.06) 5deg,
                      rgba(161, 161, 170, 0.12) 10deg,
                      rgba(161, 161, 170, 0.2) 20deg,
                      rgba(255, 255, 255, 0.35) 30deg,
                      rgba(161, 161, 170, 0.2) 40deg,
                      rgba(161, 161, 170, 0.12) 50deg,
                      rgba(161, 161, 170, 0.06) 55deg,
                      transparent 60deg,
                      transparent 360deg)`,
              }}
            />
          </div>
          <div className="hidden dark:block absolute inset-[2px] bg-background rounded-xl z-[1]" />
          <style jsx>{`
            @property --beam-angle {
              syntax: '<angle>';
              inherits: false;
              initial-value: 0deg;
            }
            @keyframes rotate-beam {
              from { --beam-angle: 0deg; }
              to { --beam-angle: 360deg; }
            }
            .animate-rotate-beam {
              animation: rotate-beam 3s linear infinite;
            }
          `}</style>
        </>
      )}

      {/* Content */}
      <div className="relative z-[2] flex flex-col h-full">
      <div className="p-4 space-y-3 flex-1">
        {/* Header: Title + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className="font-semibold truncate cursor-pointer text-foreground/90 hover:text-foreground transition-colors"
              onClick={() => router.push(`/c/${schedule.chat_id}`)}
              title={schedule.title || "Untitled Employee"}
            >
              {schedule.title || "Untitled Employee"}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {formatFrequency(schedule.frequency)}
              {schedule.timezone !== "UTC" && (
                <span className="text-xs text-muted-foreground/60">({schedule.timezone})</span>
              )}
            </p>
          </div>
          <StatusBadge schedule={schedule} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-sm">
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium">
              Next Shift
            </p>
            <p className="font-medium text-xs text-foreground/80">
              {formatNextRun(schedule.next_run_at)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium">
              Executions
            </p>
            <p className="font-medium text-xs text-foreground/80">{schedule.run_count}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium">
              Failures
            </p>
            <p className={cn(
              "font-medium text-xs text-foreground/80",
            )}>
              {schedule.consecutive_failures}
            </p>
          </div>
        </div>

        {/* Last run */}
        {schedule.last_run_at && (
          <p className="text-xs text-muted-foreground">
            Last active:{" "}
            {new Date(schedule.last_run_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}

        {/* Paused reason alert */}
        {schedule.paused_reason &&
          schedule.paused_reason !== "deleted" && (
            <div className={cn(
              "flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs",
              "bg-foreground/[0.03] border border-foreground/[0.06] text-muted-foreground",
            )}>
              <AlertTriangle className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {schedule.paused_reason === "insufficient_credits"
                  ? "Standby: insufficient credits"
                  : schedule.paused_reason === "too_many_failures"
                  ? `Needs attention: ${schedule.consecutive_failures} consecutive failures`
                  : schedule.paused_reason === "machine_unavailable"
                  ? "Standby: workstation unavailable"
                  : `Standby: ${schedule.paused_reason}`}
              </span>
            </div>
          )}
      </div>

      {/* Actions — pinned to bottom */}
      <div className="border-t border-foreground/[0.06] px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
        <button
          className={cn(
            "inline-flex items-center gap-1 sm:gap-1.5 h-7 sm:h-8 px-2.5 rounded-lg text-xs font-medium transition-all",
            "border border-foreground/[0.08] bg-foreground/[0.04] text-foreground/70",
            "hover:bg-foreground/[0.08] hover:text-foreground hover:border-foreground/[0.12]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          onClick={handleRunNow}
          disabled={!!actionLoading}
        >
          <CoastyIcon className="h-3 w-3" />
          {actionLoading === "run" ? "..." : "Run"}
        </button>
        <button
          className={cn(
            "inline-flex items-center gap-1 sm:gap-1.5 h-7 sm:h-8 px-2.5 rounded-lg text-xs transition-all",
            "border border-foreground/[0.06] text-muted-foreground",
            "hover:bg-foreground/[0.06] hover:text-foreground hover:border-foreground/[0.1]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          onClick={handleTogglePause}
          disabled={!!actionLoading}
        >
          {schedule.enabled ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {actionLoading === "pause"
            ? "..."
            : schedule.enabled
            ? "Pause"
            : "Resume"}
        </button>
        <button
          className="inline-flex items-center gap-1 sm:gap-1.5 h-7 sm:h-8 px-2 rounded-lg text-xs text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground transition-all"
          onClick={() => onViewHistory(schedule.chat_id)}
        >
          <History className="h-3 w-3" />
          <span className="hidden sm:inline">Work Log</span>
        </button>
        {onEdit && (
          <button
            className="inline-flex items-center gap-1 sm:gap-1.5 h-7 sm:h-8 px-2 rounded-lg text-xs text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground transition-all"
            onClick={() => onEdit(schedule.chat_id)}
          >
            <Pencil className="h-3 w-3" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        )}
        <button
          className={cn(
            "h-7 sm:h-8 px-2 rounded-lg ml-auto transition-all",
            "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.06]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          onClick={handleDelete}
          disabled={!!actionLoading}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      </div>{/* end z-[2] wrapper */}
    </div>
  )
}
