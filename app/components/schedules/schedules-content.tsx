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
  Plus,
  TrendingUp,
  Mail,
  Globe,
  RefreshCw,
  Bell,
  FileText,
  MoreHorizontal,
  Zap,
  History,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { CoastyIcon } from "@/components/icons/coasty"
import { NoiseBackground } from "@/components/ui/noise-background"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trackScheduleTriggered } from "@/lib/posthog/analytics"
import { ScheduleCalendar, getTasksForDate, type DayTask } from "./schedule-calendar"
import { ScheduleHistory } from "./schedule-history"
import { ScheduleDialog } from "./schedule-dialog"
import { CreateScheduleDialog } from "./create-schedule-dialog"
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
    <div className={`border-l-2 ${borderColor} rounded-r-xl bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-all`}>
      <div className="px-3 pt-3 pb-2.5 space-y-2">
        {/* Title + badge */}
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-[13px] font-medium leading-snug cursor-pointer hover:text-foreground/80 transition-colors line-clamp-2"
            onClick={() => router.push(`/c/${s.chat_id}`)}
          >
            {s.title || "Untitled Task"}
          </p>
          <Badge variant="outline" className={`text-[10px] shrink-0 leading-none py-0.5 ${badgeClass}`}>
            {statusText}
          </Badge>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 flex-wrap">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          <span>
            {task.runsPerDay > 6
              ? `${task.runsPerDay}× daily`
              : task.times.length > 0
              ? task.times.join(", ")
              : formatFrequency(s.frequency)}
          </span>
          <span className="opacity-40">·</span>
          <span>{s.run_count} runs</span>
          <span className="opacity-40">·</span>
          <span>Next {formatNextRun(s.next_run_at)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 pt-0.5">
          <button
            className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium border border-border bg-background hover:bg-foreground/5 transition-colors disabled:opacity-40"
            onClick={run}
            disabled={!!loading}
          >
            <CoastyIcon className="h-2.5 w-2.5" />
            {loading === "run" ? "Running…" : "Run now"}
          </button>
          <button
            className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] border border-border hover:bg-foreground/5 transition-colors disabled:opacity-40"
            onClick={toggle}
            disabled={!!loading}
          >
            {s.enabled ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
            {loading === "pause" ? "…" : s.enabled ? "Pause" : "Resume"}
          </button>
          {onEdit && (
            <button
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] text-muted-foreground hover:bg-foreground/5 transition-colors"
              onClick={() => onEdit(s.chat_id)}
            >
              <Pencil className="h-2.5 w-2.5" />
              Edit
            </button>
          )}
          <button
            className="ml-auto inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
            onClick={remove}
            disabled={!!loading}
          >
            <Trash2 className="h-3 w-3" />
          </button>
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
  const [showCreateDialog, setShowCreateDialog] = useState(false)

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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Scheduled Tasks</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <p className="text-sm text-muted-foreground">
                Set it and forget it. Coasty handles the rest, just like a human
              </p>
              {schedules.length > 0 && (
                <>
                  <span className="h-3.5 w-px bg-border hidden sm:block" />
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {activeCount} active
                    </span>
                    {pausedCount > 0 && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                        {pausedCount} paused
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <NoiseBackground
            containerClassName="w-auto p-[1px] rounded-lg bg-transparent dark:bg-transparent shadow-none"
            className="p-0"
            gradientColors={["rgb(115, 115, 115)", "rgb(163, 163, 163)", "rgb(82, 82, 82)"]}
            noiseIntensity={0.06}
            speed={0.06}
          >
            <button
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex h-10 items-center justify-center rounded-[7px] bg-background/80 px-5 text-sm font-medium text-foreground transition-opacity hover:opacity-80 gap-2"
            >
              <Plus className="h-4 w-4" />
              New Schedule
            </button>
          </NoiseBackground>
        </div>

        {/* Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 sm:px-4 py-3">
          <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1.5 text-muted-foreground/60 mt-0.5 sm:mt-0">
              <Timer className="h-3.5 w-3.5 shrink-0" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
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
                  px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-300 text-sm sm:text-base
                  ${statusFilter === f.id
                    ? "bg-foreground text-background font-medium"
                    : "bg-secondary hover:bg-secondary/80 text-foreground"
                  }
                `}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
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
          <div className="relative rounded-2xl border border-border/40 bg-card overflow-hidden">
            {/* Smoke background */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-12 right-1/4 h-56 w-56 rounded-full bg-foreground/[0.04] blur-3xl" />
              <div className="absolute -bottom-12 left-1/4 h-48 w-48 rounded-full bg-foreground/[0.03] blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full bg-foreground/[0.02] blur-2xl" />
            </div>

            <div className="relative flex flex-col items-center py-14 px-6 text-center">
              {/* Example task type icons */}
              <div className="flex items-center gap-2.5 mb-8">
                {[TrendingUp, Mail, Globe, RefreshCw, Bell, FileText].map((Icon, i) => (
                  <div
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.06] ring-1 ring-foreground/[0.08]"
                  >
                    <Icon className="h-4 w-4 text-foreground/50" />
                  </div>
                ))}
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.04] ring-1 ring-border/30">
                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground/30" />
                </div>
              </div>

              {/* Headline */}
              <h3 className="text-xl font-bold mb-2">Set it and forget it</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-10">
                Turn any chat into a recurring task — Coasty runs it automatically on your schedule, even while you sleep
              </p>

              {/* Feature cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10 text-left w-full max-w-xl">
                {[
                  {
                    icon: Timer,
                    title: "Any frequency",
                    desc: "Hourly, daily, weekly, monthly — or a custom cron expression for precise control",
                  },
                  {
                    icon: Zap,
                    title: "Full agent power",
                    desc: "Each run gets full access to browsing, terminal, and your connected machines",
                  },
                  {
                    icon: History,
                    title: "Run history",
                    desc: "Every execution is logged so you can see exactly what happened and when",
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="flex flex-col gap-2 rounded-xl bg-foreground/[0.02] ring-1 ring-border/30 p-4"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    <p className="text-xs font-semibold">{title}</p>
                    <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCreateDialog(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Scheduled Task
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors"
                >
                  <CoastyIcon className="h-3.5 w-3.5" />
                  Start from a chat
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_380px] gap-4 sm:gap-6">
            {/* Left: Calendar */}
            <ScheduleCalendar
              schedules={filteredSchedules}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            {/* Right: Day detail panel */}
            <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
              {/* Day header card */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3.5 border-b border-border bg-foreground/[0.015]">
                  <div className="flex items-center justify-between">
                    <div>
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
                          ? "Nothing scheduled"
                          : `${dayTasks.length} task${dayTasks.length !== 1 ? "s" : ""} scheduled`}
                      </p>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/[0.05] text-muted-foreground shrink-0">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                  </div>
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
                  <div className="py-10 text-center">
                    <CalendarDays className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground/50">No tasks on this day</p>
                  </div>
                )}
              </div>

              {/* All tasks summary */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-foreground/[0.015] flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    All Tasks
                  </h3>
                  <span className="text-xs tabular-nums text-muted-foreground">{filteredSchedules.length}</span>
                </div>
                <div className="divide-y divide-border/40 max-h-[300px] overflow-y-auto scrollbar-invisible">
                  {filteredSchedules.map((s) => {
                    const active = s.enabled && !s.paused_reason
                    const failed = s.paused_reason === "too_many_failures"
                    return (
                      <Link
                        key={s.chat_id}
                        href={`/c/${s.chat_id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-foreground/[0.03] transition-colors group"
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${active ? "bg-green-500" : failed ? "bg-red-500" : "bg-yellow-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate">{s.title || "Untitled"}</p>
                          <p className="text-[10px] text-muted-foreground">{formatFrequency(s.frequency)}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors shrink-0" />
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
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
              <div className="flex-1 h-px bg-border/50" />
            </div>
            <ScheduleHistory limit={10} />
          </div>
        )}
      </div>

      {/* Create Schedule Dialog */}
      <CreateScheduleDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        machines={machines}
        onScheduleCreated={() => { setShowCreateDialog(false); loadSchedules() }}
      />

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
