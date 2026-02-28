"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

interface ScheduleCardProps {
  schedule: ScheduleResponse
  onUpdate: () => void
  onViewHistory: (chatId: string) => void
  onEdit?: (chatId: string) => void
}

function StatusBadge({ schedule }: { schedule: ScheduleResponse }) {
  if (schedule.enabled && !schedule.paused_reason) {
    return (
      <Badge
        variant="outline"
        className="border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
      >
        Active
      </Badge>
    )
  }

  if (schedule.paused_reason === "insufficient_credits") {
    return (
      <Badge
        variant="outline"
        className="border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
        title="Paused due to insufficient credits"
      >
        No Credits
      </Badge>
    )
  }

  if (schedule.paused_reason === "too_many_failures") {
    return (
      <Badge
        variant="outline"
        className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
        title={`${schedule.consecutive_failures} consecutive failures`}
      >
        Failed
      </Badge>
    )
  }

  if (schedule.paused_reason === "machine_unavailable") {
    return (
      <Badge
        variant="outline"
        className="border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
      >
        Machine Unavailable
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="border-gray-500/30 bg-gray-500/10 text-gray-600 dark:text-gray-400"
    >
      Paused
    </Badge>
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
      className={`
        group relative flex flex-col rounded-xl bg-card overflow-hidden
        transition-all duration-300 hover:shadow-lg h-full
        ${showBeam ? "border-0" : "border"}
        ${isActive ? "" : "opacity-80"}
      `}
    >
      {/* Rotating beam border effect (matching machine-card) */}
      {showBeam && (
        <>
          <div className="absolute -inset-[2px] rounded-xl overflow-hidden">
            <div
              className="absolute w-full h-full animate-rotate-beam dark:brightness-150"
              style={{
                filter: "drop-shadow(0 0 6px rgba(0, 0, 0, 0.2)) drop-shadow(0 0 12px currentColor)",
                background: isActive
                  ? `conic-gradient(from var(--beam-angle) at 50% 50%,
                      transparent 0deg,
                      rgba(34, 197, 94, 0.2) 5deg,
                      rgba(34, 197, 94, 0.5) 10deg,
                      rgba(34, 197, 94, 0.8) 20deg,
                      rgba(255, 255, 255, 1) 30deg,
                      rgba(34, 197, 94, 0.8) 40deg,
                      rgba(34, 197, 94, 0.5) 50deg,
                      rgba(34, 197, 94, 0.2) 55deg,
                      transparent 60deg,
                      transparent 360deg)`
                  : `conic-gradient(from var(--beam-angle) at 50% 50%,
                      transparent 0deg,
                      rgba(239, 68, 68, 0.2) 5deg,
                      rgba(239, 68, 68, 0.5) 10deg,
                      rgba(239, 68, 68, 0.8) 20deg,
                      rgba(255, 255, 255, 1) 30deg,
                      rgba(239, 68, 68, 0.8) 40deg,
                      rgba(239, 68, 68, 0.5) 50deg,
                      rgba(239, 68, 68, 0.2) 55deg,
                      transparent 60deg,
                      transparent 360deg)`,
              }}
            />
          </div>
          <div className="absolute inset-[2px] bg-background rounded-xl z-[1]" />
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

      {/* Content container with higher z-index */}
      <div className="relative z-[2] flex flex-col h-full">
      {/* Card Content */}
      <div className="p-4 space-y-3 flex-1">
        {/* Header: Title + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className="font-medium truncate cursor-pointer hover:underline"
              onClick={() => router.push(`/c/${schedule.chat_id}`)}
              title={schedule.title || "Untitled Task"}
            >
              {schedule.title || "Untitled Task"}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {formatFrequency(schedule.frequency)}
              {schedule.timezone !== "UTC" && (
                <span className="text-xs">({schedule.timezone})</span>
              )}
            </p>
          </div>
          <StatusBadge schedule={schedule} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Next Run
            </p>
            <p className="font-medium text-xs">
              {formatNextRun(schedule.next_run_at)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Total Runs
            </p>
            <p className="font-medium text-xs">{schedule.run_count}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Failures
            </p>
            <p
              className={`font-medium text-xs ${
                schedule.consecutive_failures > 0 ? "text-red-500" : ""
              }`}
            >
              {schedule.consecutive_failures}
            </p>
          </div>
        </div>

        {/* Last run */}
        {schedule.last_run_at && (
          <p className="text-xs text-muted-foreground">
            Last run:{" "}
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
            <div className="flex items-center gap-2 rounded-md bg-yellow-500/5 border border-yellow-500/20 px-2.5 py-1.5 text-xs text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {schedule.paused_reason === "insufficient_credits"
                  ? "Paused: insufficient credits"
                  : schedule.paused_reason === "too_many_failures"
                  ? `Paused: ${schedule.consecutive_failures} consecutive failures`
                  : schedule.paused_reason === "machine_unavailable"
                  ? "Paused: target machine unavailable"
                  : `Paused: ${schedule.paused_reason}`}
              </span>
            </div>
          )}
      </div>

      {/* Actions — pinned to bottom */}
      <div className="border-t px-4 py-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={handleRunNow}
          disabled={!!actionLoading}
        >
          <CoastyIcon className="h-3 w-3" />
          {actionLoading === "run" ? "Running..." : "Run Now"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
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
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5"
          onClick={() => onViewHistory(schedule.chat_id)}
        >
          <History className="h-3 w-3" />
          History
        </Button>
        {onEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5"
            onClick={() => onEdit(schedule.chat_id)}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-red-500 hover:text-red-600 ml-auto"
          onClick={handleDelete}
          disabled={!!actionLoading}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      </div>{/* end z-[2] wrapper */}
    </div>
  )
}
