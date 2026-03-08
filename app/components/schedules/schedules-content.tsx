"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  Clock,
  Play,
  Pause,
  Trash2,
  Pencil,
  Briefcase,
  Mail,
  Globe,
  RefreshCw,
  ShieldCheck,
  FileText,
  MoreHorizontal,
  Cpu,
  Activity,
  ChevronRight,
  UserPlus,
} from "lucide-react"
import Link from "next/link"
import { CoastyIcon } from "@/components/icons/coasty"
import { AgentIcon } from "@/components/icons/agent"
import { NoiseBackground } from "@/components/ui/noise-background"
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
import { cn } from "@/lib/utils"

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
    ? "border-l-emerald-500/50"
    : s.paused_reason === "too_many_failures"
    ? "border-l-amber-500/50"
    : "border-l-muted-foreground/20"

  const statusText = isActive
    ? "On Duty"
    : s.paused_reason === "too_many_failures"
    ? "Needs Attention"
    : s.paused_reason === "insufficient_credits"
    ? "No Credits"
    : s.paused_reason === "machine_unavailable"
    ? "Offline"
    : "Standby"

  const badgeClass = isActive
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
    : s.paused_reason === "too_many_failures"
    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
    : "bg-foreground/[0.04] text-muted-foreground border-foreground/[0.06]"

  return (
    <div className={cn(
      "border-l-2 rounded-r-xl transition-all",
      "bg-foreground/[0.02] hover:bg-foreground/[0.04]",
      borderColor,
    )}>
      <div className="px-3 pt-3 pb-2.5 space-y-2">
        {/* Title + badge */}
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-[13px] font-medium leading-snug cursor-pointer text-foreground/90 hover:text-foreground transition-colors line-clamp-2"
            onClick={() => router.push(`/c/${s.chat_id}`)}
          >
            {s.title || "Untitled Employee"}
          </p>
          <span className={cn(
            "text-[10px] shrink-0 leading-none py-0.5 px-2 rounded-full border font-medium",
            badgeClass,
          )}>
            {statusText}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          <span>
            {task.runsPerDay > 6
              ? `${task.runsPerDay}\u00d7 daily`
              : task.times.length > 0
              ? task.times.join(", ")
              : formatFrequency(s.frequency)}
          </span>
          <span className="opacity-30">&middot;</span>
          <span>{s.run_count} executions</span>
          <span className="opacity-30">&middot;</span>
          <span>Next {formatNextRun(s.next_run_at)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 pt-0.5">
          <button
            className={cn(
              "inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium transition-all",
              "border border-foreground/[0.08] bg-foreground/[0.04] text-foreground/70",
              "hover:bg-foreground/[0.08] hover:text-foreground hover:border-foreground/[0.12]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            onClick={run}
            disabled={!!loading}
          >
            <CoastyIcon className="h-2.5 w-2.5" />
            {loading === "run" ? "Running\u2026" : "Run now"}
          </button>
          <button
            className={cn(
              "inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] transition-all",
              "border border-foreground/[0.06] text-muted-foreground",
              "hover:bg-foreground/[0.06] hover:text-foreground hover:border-foreground/[0.1]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            onClick={toggle}
            disabled={!!loading}
          >
            {s.enabled ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
            {loading === "pause" ? "\u2026" : s.enabled ? "Pause" : "Resume"}
          </button>
          {onEdit && (
            <button
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground transition-all"
              onClick={() => onEdit(s.chat_id)}
            >
              <Pencil className="h-2.5 w-2.5" />
              Edit
            </button>
          )}
          <button
            className={cn(
              "ml-auto inline-flex items-center justify-center h-6 w-6 rounded-md transition-all",
              "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.06]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
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
    { id: "all", label: "All Employees", count: schedules.length },
    { id: "active", label: "On Duty", count: activeCount },
    { id: "paused", label: "Standby", count: pausedCount },
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
            <div className="absolute inset-0 rounded-full border-2 border-foreground/[0.08]" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground/60 animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">Loading your employees...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-invisible relative bg-transparent">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6">

        {/* ═══ Header ═══ */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Employees</h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <p className="text-sm text-muted-foreground">
                Your AI workforce — assign tasks and let them handle the rest
              </p>
              {schedules.length > 0 && (
                <>
                  <span className="h-3.5 w-px bg-foreground/[0.08] hidden sm:block" />
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
                      {activeCount} on duty
                    </span>
                    {pausedCount > 0 && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-600" />
                        {pausedCount} standby
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
              className={cn(
                "inline-flex h-10 items-center justify-center rounded-[7px] px-5 text-sm font-medium gap-2 transition-all",
                "bg-background/90 text-foreground hover:text-foreground/80",
              )}
            >
              <UserPlus className="h-4 w-4" />
              Hire Employee
            </button>
          </NoiseBackground>
        </div>

        {/* ═══ Banner ═══ */}
        <div className={cn(
          "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl px-3 sm:px-4 py-3",
          "bg-card border border-border",
        )}>
          <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5 sm:mt-0">
              <AgentIcon className="h-3.5 w-3.5 shrink-0" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Open any chat and click{" "}
              <span className="inline-flex items-center gap-1 font-bold text-foreground">
                <AgentIcon className="h-3 w-3" />
                Assign Employee
              </span>{" "}
              on the{" "}
              <span className="font-bold text-foreground">top right</span> to
              put it on autopilot
            </p>
          </div>
          <Link
            href="/"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              "bg-foreground/[0.06] hover:bg-foreground/[0.1] text-foreground/70 hover:text-foreground",
            )}
          >
            <CoastyIcon className="h-3 w-3" />
            New Chat
          </Link>
        </div>

        {/* ═══ Status Filters ═══ */}
        {schedules.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all duration-300 text-sm",
                  statusFilter === f.id
                    ? "bg-foreground text-background font-semibold shadow-sm dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.8)_inset]"
                    : "bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground border border-foreground/[0.06]",
                )}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  {f.label}
                  {f.count > 0 && (
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full",
                        statusFilter === f.id
                          ? "bg-background/20 text-background/70"
                          : "bg-foreground/[0.06] text-muted-foreground",
                      )}
                    >
                      {f.count}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ═══ Main area ═══ */}
        {schedules.length === 0 ? (
          /* ─── Empty state ─── */
          <div className={cn(
            "relative rounded-2xl overflow-hidden",
            "bg-foreground/[0.02] border border-foreground/[0.06]",
          )}>
            {/* Atmospheric background */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-12 right-1/4 h-56 w-56 rounded-full bg-foreground/[0.03] blur-3xl" />
              <div className="absolute -bottom-12 left-1/4 h-48 w-48 rounded-full bg-foreground/[0.02] blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full bg-foreground/[0.015] blur-2xl" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.1] to-transparent" />
            </div>

            <div className="relative flex flex-col items-center py-14 px-6 text-center">
              {/* Agent type icons */}
              <div className="flex items-center gap-2.5 mb-8">
                {[Briefcase, Mail, Globe, RefreshCw, ShieldCheck, FileText].map((Icon, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl",
                      "bg-foreground/[0.04] ring-1 ring-foreground/[0.08]",
                      "shadow-[0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
                    )}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.02] ring-1 ring-foreground/[0.05]">
                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground/60" />
                </div>
              </div>

              {/* Headline */}
              <h3 className="text-xl font-bold mb-2 text-foreground">Hire your first employee</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-10">
                AI employees work on your behalf — assign a task, set a schedule, and they'll execute it automatically, even while you sleep
              </p>

              {/* Feature cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10 text-left w-full max-w-xl">
                {[
                  {
                    icon: Clock,
                    title: "Flexible shifts",
                    desc: "Schedule employees hourly, daily, weekly, monthly — or use a custom cron expression for precise control",
                  },
                  {
                    icon: Cpu,
                    title: "Full autonomy",
                    desc: "Each employee gets full access to browsing, terminal, and your connected workstations",
                  },
                  {
                    icon: Activity,
                    title: "Activity logs",
                    desc: "Every execution is logged so you can review what your employees accomplished and when",
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className={cn(
                      "relative flex flex-col gap-2 rounded-xl p-4 overflow-hidden",
                      "bg-foreground/[0.03] ring-1 ring-foreground/[0.06]",
                      "shadow-[0_2px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)]",
                    )}
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent" />
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/[0.06]">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-semibold text-foreground/80">{title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCreateDialog(true)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-300",
                    "text-background bg-gradient-to-b from-foreground to-foreground/80",
                    "hover:from-foreground hover:to-foreground/90",
                    "shadow-[0_1px_3px_rgba(0,0,0,0.15)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.8)_inset,0_4px_16px_rgba(255,255,255,0.08)]",
                    "hover:shadow-[0_1px_3px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.9)_inset,0_6px_24px_rgba(255,255,255,0.12)]",
                    "hover:scale-[1.02] active:scale-[0.98]",
                  )}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Hire Employee
                </button>
                <Link
                  href="/"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                    "bg-foreground/[0.04] border border-foreground/[0.08] text-foreground/80",
                    "hover:bg-foreground/[0.08] hover:text-foreground hover:border-foreground/[0.12]",
                  )}
                >
                  <CoastyIcon className="h-3.5 w-3.5" />
                  Start from a chat
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* ─── Calendar + Day panel ─── */
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
              <div className={cn(
                "rounded-xl overflow-hidden",
                "bg-foreground/[0.03] border border-foreground/[0.06]",
              )}>
                <div className={cn(
                  "relative px-4 py-3.5 border-b border-foreground/[0.06]",
                  "bg-foreground/[0.02]",
                )}>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent" />
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          {selectedDate.toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                        </h3>
                        {isToday && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground text-background font-semibold">
                            Today
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dayTasks.length === 0
                          ? "No employees scheduled"
                          : `${dayTasks.length} employee${dayTasks.length !== 1 ? "s" : ""} on this day`}
                      </p>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/[0.06] shrink-0">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
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
                    <AgentIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground/60">No employees on this day</p>
                  </div>
                )}
              </div>

              {/* All tasks summary */}
              <div className={cn(
                "rounded-xl overflow-hidden",
                "bg-foreground/[0.03] border border-foreground/[0.06]",
              )}>
                <div className={cn(
                  "relative px-4 py-3 border-b border-foreground/[0.06] flex items-center justify-between",
                  "bg-foreground/[0.02]",
                )}>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Your Employees
                  </h3>
                  <span className="text-xs tabular-nums text-muted-foreground">{filteredSchedules.length}</span>
                </div>
                <div className="divide-y divide-foreground/[0.04] max-h-[300px] overflow-y-auto scrollbar-invisible">
                  {filteredSchedules.map((s) => {
                    const active = s.enabled && !s.paused_reason
                    const failed = s.paused_reason === "too_many_failures"
                    return (
                      <Link
                        key={s.chat_id}
                        href={`/c/${s.chat_id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-foreground/[0.04] transition-all group"
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          active
                            ? "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                            : failed
                            ? "bg-amber-500"
                            : "bg-zinc-500 dark:bg-zinc-600",
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate text-foreground/80">{s.title || "Untitled Employee"}</p>
                          <p className="text-[10px] text-muted-foreground">{formatFrequency(s.frequency)}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-transparent group-hover:text-muted-foreground transition-colors shrink-0" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Activity Log ═══ */}
        {schedules.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground/80">Activity Log</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-foreground/[0.08] to-transparent" />
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
