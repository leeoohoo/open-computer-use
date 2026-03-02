"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Timer,
  CalendarClock,
  CalendarDays,
  Clock,
  Play,
  Pause,
  Trash2,
  Pencil,
} from "lucide-react"
import Link from "next/link"
import { CoastyIcon } from "@/components/icons/coasty"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trackScheduleTriggered } from "@/lib/posthog/analytics"
import { ScheduleCalendar, getTasksForDate, type DayTask } from "./schedule-calendar"
import { ScheduleHistory } from "./schedule-history"
import { ScheduleDialog } from "./schedule-dialog"
import type { UserMachine } from "@/types/machines.types"
import {
  listSchedules,
  formatFrequency,
  formatNextRun,
  triggerScheduleNow,
  pauseSchedule,
  deleteSchedule,
  type ScheduleResponse,
} from "@/lib/services/schedules-api"

/* ─── Day-panel task card ─── */

function DayTaskItem({
  task,
  onUpdate,
  onEdit,
}: {
  task: DayTask
  onUpdate: () => void
  onEdit?: (chatId: string) => void
}) {
  const router = useRouter()
  const s = task.schedule
  const [loading, setLoading] = useState<string | null>(null)

  const isActive = s.enabled && !s.paused_reason

  async function run() {
    setLoading("run")
    try { trackScheduleTriggered(s.chat_id); await triggerScheduleNow(s.chat_id); onUpdate() }
    catch { /* */ }
    finally { setLoading(null) }
  }

  async function toggle() {
    setLoading("pause")
    try { await pauseSchedule(s.chat_id); onUpdate() }
    catch { /* */ }
    finally { setLoading(null) }
  }

  async function remove() {
    setLoading("del")
    try { await deleteSchedule(s.chat_id); onUpdate() }
    catch { /* */ }
    finally { setLoading(null) }
  }

  const borderColor = isActive
    ? "border-l-green-500"
    : s.paused_reason === "too_many_failures"
    ? "border-l-red-500"
    : "border-l-yellow-500"

  const badgeClass = isActive
    ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
    : s.paused_reason === "too_many_failures"
    ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
    : "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"

  const statusText = isActive
    ? "Active"
    : s.paused_reason === "too_many_failures"
    ? "Failed"
    : s.paused_reason === "insufficient_credits"
    ? "No Credits"
    : s.paused_reason === "machine_unavailable"
    ? "Offline"
    : "Paused"

  return (
    <div
      className={`border-l-[3px] ${borderColor} rounded-r-lg bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors`}
    >
      <div className="px-3 py-2.5 space-y-2">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-sm font-medium truncate cursor-pointer hover:underline leading-tight"
            onClick={() => router.push(`/c/${s.chat_id}`)}
          >
            {s.title || "Untitled Task"}
          </p>
          <Badge
            variant="outline"
            className={`text-[10px] shrink-0 ${badgeClass}`}
          >
            {statusText}
          </Badge>
        </div>

        {/* Info */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {task.runsPerDay > 6
              ? `${task.runsPerDay}× daily`
              : task.times.length > 0
              ? task.times.join(", ")
              : formatFrequency(s.frequency)}
          </span>
          <span>{formatFrequency(s.frequency)}</span>
          <span className="tabular-nums">{s.run_count} runs</span>
        </div>

        {/* Next run */}
        <p className="text-[11px] text-muted-foreground/70">
          Next: {formatNextRun(s.next_run_at)}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 px-2"
            onClick={run}
            disabled={!!loading}
          >
            <CoastyIcon className="h-3 w-3" />
            {loading === "run" ? "..." : "Run"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 px-2"
            onClick={toggle}
            disabled={!!loading}
          >
            {s.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {loading === "pause" ? "..." : s.enabled ? "Pause" : "Resume"}
          </Button>
          {onEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 px-2"
              onClick={() => onEdit(s.chat_id)}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-red-500 hover:text-red-600 ml-auto px-1.5"
            onClick={remove}
            disabled={!!loading}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main content ─── */

export function SchedulesContent() {
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [machines, setMachines] = useState<UserMachine[]>([])
  const [editChatId, setEditChatId] = useState<string | null>(null)

  const loadSchedules = useCallback(async () => {
    try {
      const data = await listSchedules()
      setSchedules(data)
    } catch {
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSchedules()
    fetch("/api/machines")
      .then((r) => r.json())
      .then((data) => setMachines(data.machines ?? []))
      .catch(() => {})
  }, [loadSchedules])

  const activeCount = schedules.filter((s) => s.enabled && !s.paused_reason).length
  const pausedCount = schedules.filter((s) => !s.enabled || s.paused_reason).length

  const filteredSchedules = useMemo(() =>
    statusFilter === "all"
      ? schedules
      : statusFilter === "active"
      ? schedules.filter((s) => s.enabled && !s.paused_reason)
      : schedules.filter((s) => !s.enabled || s.paused_reason),
    [schedules, statusFilter]
  )

  const dayTasks = useMemo(
    () => getTasksForDate(filteredSchedules, selectedDate),
    [filteredSchedules, selectedDate]
  )

  const statusFilters = [
    { id: "all", label: "All", count: schedules.length },
    { id: "active", label: "Active", count: activeCount },
    { id: "paused", label: "Paused", count: pausedCount },
  ]

  const isToday =
    selectedDate.getDate() === new Date().getDate() &&
    selectedDate.getMonth() === new Date().getMonth() &&
    selectedDate.getFullYear() === new Date().getFullYear()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-muted" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">Loading scheduled tasks...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-invisible relative bg-transparent">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Scheduled Tasks</h1>
            <p className="text-muted-foreground mt-1">
              Set it and forget it. Coasty handles the rest, just like a human
            </p>
          </div>
        </div>

        {/* Banner */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 text-muted-foreground/60">
              <Timer className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm text-muted-foreground">
              Open any chat and click the{" "}
              <span className="inline-flex items-center gap-1 font-bold text-foreground">
                <Timer className="h-3 w-3" />
                Schedule
              </span>{" "}
              button on the{" "}
              <span className="font-bold text-foreground">top right</span> to
              automate it
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
          >
            <CoastyIcon className="h-3 w-3" />
            New Chat
          </Link>
        </div>

        {/* Status Filters */}
        {schedules.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`
                  px-4 py-2 rounded-lg transition-all duration-300
                  ${statusFilter === f.id
                    ? "bg-foreground text-background font-medium"
                    : "bg-secondary hover:bg-secondary/80 text-foreground"
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  {f.label}
                  {f.count > 0 && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        statusFilter === f.id
                          ? "bg-background/20"
                          : "bg-foreground/10"
                      }`}
                    >
                      {f.count}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ═══ Main area: Calendar + Day panel ═══ */}
        {schedules.length === 0 ? (
          <Card className="border-0">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarClock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No scheduled tasks yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Open a chat, run a task on a machine, then click the schedule
                button to automate it.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-6">
            {/* Left: Calendar */}
            <ScheduleCalendar
              schedules={filteredSchedules}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            {/* Right: Day detail panel */}
            <div className="lg:sticky lg:top-6 lg:self-start space-y-3">
              {/* Day header */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-foreground/[0.02]">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      {selectedDate.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </h3>
                    {isToday && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground text-background font-medium">
                        Today
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dayTasks.length === 0
                      ? "No tasks scheduled"
                      : `${dayTasks.length} task${dayTasks.length !== 1 ? "s" : ""} scheduled`}
                  </p>
                </div>

                {/* Task list */}
                {dayTasks.length > 0 ? (
                  <div className="p-3 space-y-2">
                    {dayTasks.map((t) => (
                      <DayTaskItem
                        key={t.schedule.chat_id}
                        task={t}
                        onUpdate={loadSchedules}
                        onEdit={setEditChatId}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <CalendarDays className="h-8 w-8 text-muted-foreground/25 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground/50">
                      No tasks on this day
                    </p>
                  </div>
                )}
              </div>

              {/* All tasks summary (always visible for quick overview) */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-foreground/[0.02]">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    All Tasks
                  </h3>
                </div>
                <div className="divide-y divide-border/50">
                  {filteredSchedules.map((s) => {
                    const active = s.enabled && !s.paused_reason
                    return (
                      <Link
                        key={s.chat_id}
                        href={`/c/${s.chat_id}`}
                        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-foreground/[0.03] transition-colors"
                      >
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            active
                              ? "bg-green-500"
                              : s.paused_reason === "too_many_failures"
                              ? "bg-red-500"
                              : "bg-yellow-500"
                          }`}
                        />
                        <span className="text-xs truncate flex-1">
                          {s.title || "Untitled"}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatFrequency(s.frequency)}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {schedules.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Recent Activity
            </h2>
            <ScheduleHistory limit={10} />
          </div>
        )}
      </div>

      {/* Edit Schedule Dialog */}
      {editChatId && (
        <ScheduleDialog
          open={!!editChatId}
          onOpenChange={(open) => { if (!open) setEditChatId(null) }}
          chatId={editChatId}
          chatTitle={schedules.find((s) => s.chat_id === editChatId)?.title ?? undefined}
          machines={machines}
          defaultMachineId={schedules.find((s) => s.chat_id === editChatId)?.machine_id}
          onScheduleCreated={() => { setEditChatId(null); loadSchedules() }}
          onScheduleDeleted={() => { setEditChatId(null); loadSchedules() }}
        />
      )}
    </div>
  )
}
