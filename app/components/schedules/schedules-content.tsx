"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Clock,
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
  UserPlus,
  Users,
  Plus,
  X,
  Brain,
  ChevronDown,
  GripVertical,
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
import { ScheduleCard } from "./schedule-card"
import type { UserMachine } from "@/types/machines.types"
import {
  listSchedules,
  listTeams,
  createTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  getTeamSharedMemory,
  updateTeam,
  formatFrequency,
  triggerScheduleNow,
  type ScheduleResponse,
  type TeamResponse,
  type SharedMemoryEntry,
} from "@/lib/services/schedules-api"
import { cn } from "@/lib/utils"

/* ─── types ─── */
type Tab = "teams" | "employees"

/* ─── Day task row (compact) ─── */
function DayTaskItem({ task, onUpdate }: { task: DayTask; onUpdate: () => void }) {
  const router = useRouter()
  const s = task.schedule
  const [loading, setLoading] = useState<string | null>(null)
  const isActive = s.enabled && !s.paused_reason

  async function run() {
    setLoading("run"); try { trackScheduleTriggered(s.chat_id); await triggerScheduleNow(s.chat_id); onUpdate() } catch {} finally { setLoading(null) }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-foreground/[0.04] transition-all group">
      <div className={cn(
        "w-2 h-2 rounded-full shrink-0",
        isActive ? "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
          : s.paused_reason === "too_many_failures" ? "bg-amber-500"
          : "bg-zinc-400 dark:bg-zinc-600",
      )} />
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-medium text-foreground/80 truncate cursor-pointer hover:text-foreground transition-colors"
          onClick={() => router.push(`/c/${s.chat_id}`)}
        >
          {s.title || "Untitled Employee"}
        </p>
      </div>
      <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
        {task.runsPerDay > 6 ? `${task.runsPerDay}\u00d7 daily` : task.times.length > 0 ? task.times[0] : formatFrequency(s.frequency)}
      </span>
      <button
        onClick={run}
        disabled={!!loading}
        className="h-6 px-2 rounded-md text-[10px] font-medium bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/60 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40"
      >
        {loading === "run" ? "\u2026" : "Run"}
      </button>
    </div>
  )
}

/* ═══ Team Card — the core of the Teams tab ═══ */
function TeamCard({ team, schedules, onRefresh }: { team: TeamResponse; schedules: ScheduleResponse[]; onRefresh: () => void }) {
  const [dragOver, setDragOver] = useState(false)
  const [memory, setMemory] = useState<SharedMemoryEntry[]>([])
  const [memLoaded, setMemLoaded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(team.name)
  const [editInstructions, setEditInstructions] = useState(team.instructions || "")

  useEffect(() => {
    if (!memLoaded) { getTeamSharedMemory(team.hub_id).then(setMemory).catch(() => setMemory([])); setMemLoaded(true) }
  }, [])

  async function drop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const id = e.dataTransfer.getData("application/x-employee-id")
    if (!id || team.members.some((m) => m.chat_id === id)) return
    setBusy(`add-${id}`); try { await addTeamMember(team.hub_id, id); onRefresh() } catch {} setBusy(null)
  }

  async function removeMember(id: string) {
    setBusy(`rm-${id}`); try { await removeTeamMember(team.hub_id, id); onRefresh() } catch {} setBusy(null)
  }

  async function disband() {
    setBusy("del"); try { await deleteTeam(team.hub_id); onRefresh() } catch {} setBusy(null)
  }

  async function saveEdit() {
    const trimmedName = editName.trim()
    if (!trimmedName) return
    setBusy("edit")
    try {
      await updateTeam(team.hub_id, {
        name: trimmedName !== team.name ? trimmedName : undefined,
        instructions: editInstructions.trim() !== (team.instructions || "") ? editInstructions.trim() : undefined,
      })
      onRefresh()
    } catch {}
    setBusy(null)
    setEditing(false)
  }

  function cancelEdit() {
    setEditName(team.name)
    setEditInstructions(team.instructions || "")
    setEditing(false)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDragOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false) }}
      onDrop={drop}
      className={cn(
        "rounded-2xl transition-all duration-200 overflow-hidden",
        dragOver
          ? "bg-foreground/[0.1] ring-2 ring-foreground/25 shadow-[0_0_30px_rgba(255,255,255,0.06)]"
          : "bg-foreground/[0.06] ring-1 ring-foreground/[0.12] hover:ring-foreground/[0.18]",
      )}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        {editing ? (
          <div className="space-y-2.5">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit() }}
              autoFocus
              className="w-full h-9 rounded-lg px-3 text-[15px] font-semibold bg-foreground/[0.04] border border-foreground/[0.08] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/[0.15] transition-all"
              placeholder="Team name"
            />
            <textarea
              value={editInstructions}
              onChange={(e) => setEditInstructions(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") cancelEdit() }}
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-xs resize-none bg-foreground/[0.04] border border-foreground/[0.08] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/[0.15] transition-all leading-relaxed"
              placeholder="Team guidelines (optional)"
            />
            <div className="flex items-center gap-2">
              <button onClick={saveEdit} disabled={!editName.trim() || !!busy} className={cn("h-7 px-3.5 rounded-lg text-xs font-semibold transition-all", editName.trim() ? "text-background bg-foreground hover:bg-foreground/90" : "text-muted-foreground bg-foreground/[0.06]", "disabled:opacity-40")}>
                {busy === "edit" ? "Saving\u2026" : "Save"}
              </button>
              <button onClick={cancelEdit} className="h-7 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-all">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-foreground tracking-[-0.01em]">{team.name}</h3>
              {team.instructions && (
                <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2 leading-relaxed">{team.instructions}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {memory.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 bg-foreground/[0.04] px-2 py-0.5 rounded-full">
                  <Brain className="h-2.5 w-2.5" />{memory.length}
                </span>
              )}
              <button onClick={() => setEditing(true)} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground/30 hover:text-muted-foreground hover:bg-foreground/[0.06] transition-all" title="Edit team">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={disband} disabled={!!busy} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground/30 hover:text-muted-foreground hover:bg-foreground/[0.06] transition-all disabled:opacity-40" title="Disband team">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="px-5 pb-4">
        {team.members.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {team.members.map((m) => (
              <div
                key={m.chat_id}
                className="group/pill flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-full bg-foreground/[0.1] hover:bg-foreground/[0.14] transition-all"
              >
                <div className="h-4 w-4 rounded-full bg-foreground/[0.15] flex items-center justify-center">
                  <AgentIcon className="h-2.5 w-2.5 text-foreground/70" />
                </div>
                <span className="text-xs text-foreground/90 font-medium max-w-[120px] truncate">{m.title || "Untitled"}</span>
                <button
                  onClick={() => removeMember(m.chat_id)}
                  disabled={!!busy}
                  className="h-5 w-5 flex items-center justify-center rounded-full opacity-0 group-hover/pill:opacity-100 hover:bg-foreground/[0.1] text-muted-foreground/50 hover:text-foreground transition-all"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(
            "rounded-xl py-5 text-center transition-all",
            dragOver
              ? "bg-foreground/[0.08]"
              : "border border-dashed border-foreground/[0.12]",
          )}>
            <p className="text-xs text-muted-foreground/60">
              {dragOver ? "Drop to add" : "Drag employees here to add them"}
            </p>
          </div>
        )}
      </div>

      {/* Shared memory preview */}
      {memory.length > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-invisible pb-0.5">
            {memory.slice(0, 4).map((entry) => (
              <div key={entry.key} className="shrink-0 max-w-[180px]">
                <span className="text-[10px] font-mono text-foreground/60">{entry.key}</span>
                <p className="text-[10px] text-muted-foreground/70 truncate">{entry.value}</p>
              </div>
            ))}
            {memory.length > 4 && (
              <span className="text-[10px] text-muted-foreground/50 shrink-0">+{memory.length - 4} more</span>
            )}
          </div>
        </div>
      )}

      {/* Drop overlay */}
      {dragOver && team.members.length > 0 && (
        <div className="px-5 pb-4 -mt-1">
          <div className="rounded-xl bg-foreground/[0.08] py-2.5 text-center">
            <p className="text-[11px] text-foreground/60 font-medium">Drop to add to {team.name}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══ Draggable employee pill ═══ */
function EmployeePill({ schedule }: { schedule: ScheduleResponse }) {
  const [dragging, setDragging] = useState(false)
  const isActive = schedule.enabled && !schedule.paused_reason

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-employee-id", schedule.chat_id)
        e.dataTransfer.setData("text/plain", schedule.title || "Untitled Employee")
        e.dataTransfer.effectAllowed = "copy"
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-grab active:cursor-grabbing select-none group transition-all",
        dragging
          ? "opacity-40 scale-95"
          : "bg-foreground/[0.03] hover:bg-foreground/[0.08]",
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground/70 shrink-0 transition-colors" />
      <div className={cn(
        "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
        isActive ? "bg-emerald-500/15" : "bg-foreground/[0.1]",
      )}>
        <AgentIcon className={cn("h-2.5 w-2.5", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/60")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate leading-tight">{schedule.title || "Untitled Employee"}</p>
        <p className="text-[10px] text-muted-foreground/60 leading-tight">{formatFrequency(schedule.frequency)}</p>
      </div>
    </div>
  )
}

/* ═══ Main ═══ */
export function SchedulesContent() {
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("teams")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [machines, setMachines] = useState<UserMachine[]>([])
  const [editChatId, setEditChatId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [historyChat, setHistoryChat] = useState<string | undefined>(undefined)
  const [showHistory, setShowHistory] = useState(false)
  const [teams, setTeams] = useState<TeamResponse[]>([])
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState("")
  const [newTeamInstructions, setNewTeamInstructions] = useState("")

  const loadSchedules = useCallback(async () => {
    try { setSchedules(await listSchedules()) } catch { setSchedules([]) } finally { setLoading(false) }
  }, [])

  const loadTeams = useCallback(async () => {
    try { setTeams(await listTeams()) } catch { setTeams([]) }
  }, [])

  const refreshAll = useCallback(() => { loadSchedules(); loadTeams() }, [loadSchedules, loadTeams])

  useEffect(() => {
    loadSchedules(); loadTeams()
    fetch("/api/machines").then((r) => r.json()).then((d) => setMachines(d.machines ?? [])).catch(() => {})
  }, [loadSchedules, loadTeams])

  const activeCount = schedules.filter((s) => s.enabled && !s.paused_reason).length
  const pausedCount = schedules.filter((s) => !s.enabled || s.paused_reason).length

  const filteredSchedules = useMemo(() =>
    statusFilter === "all" ? schedules
      : statusFilter === "active" ? schedules.filter((s) => s.enabled && !s.paused_reason)
      : schedules.filter((s) => !s.enabled || s.paused_reason),
    [schedules, statusFilter]
  )

  const dayTasks = useMemo(() => getTasksForDate(filteredSchedules, selectedDate), [filteredSchedules, selectedDate])

  const isToday = selectedDate.getDate() === new Date().getDate() && selectedDate.getMonth() === new Date().getMonth() && selectedDate.getFullYear() === new Date().getFullYear()

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: "teams", label: "Teams", icon: Users, count: teams.length },
    { id: "employees", label: "Employees", icon: AgentIcon, count: schedules.length },
  ]

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return
    try { await createTeam(newTeamName.trim(), newTeamInstructions.trim() || undefined) } catch {}
    setNewTeamName(""); setNewTeamInstructions(""); setShowCreateTeam(false); refreshAll()
  }

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

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Employees</h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <p className="text-sm text-muted-foreground">Your AI workforce — assign tasks and let them handle the rest</p>
              {schedules.length > 0 && (
                <>
                  <span className="h-3.5 w-px bg-foreground/[0.08] hidden sm:block" />
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.4)]" />{activeCount} on duty
                    </span>
                    {pausedCount > 0 && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-600" />{pausedCount} standby
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <NoiseBackground containerClassName="w-auto p-[1px] rounded-lg bg-transparent dark:bg-transparent shadow-none" className="p-0" gradientColors={["rgb(115, 115, 115)", "rgb(163, 163, 163)", "rgb(82, 82, 82)"]} noiseIntensity={0.06} speed={0.06}>
            <button onClick={() => setShowCreateDialog(true)} className={cn("inline-flex h-10 items-center justify-center rounded-[7px] px-5 text-sm font-medium gap-2 transition-all bg-background/90 text-foreground hover:text-foreground/80")}>
              <UserPlus className="h-4 w-4" />Hire Employee
            </button>
          </NoiseBackground>
        </div>

        {/* Banner */}
        <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl px-3 sm:px-4 py-3 bg-card border border-border")}>
          <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
            <AgentIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5 sm:mt-0" />
            <p className="text-xs sm:text-sm text-muted-foreground">
              Open any chat and click <span className="inline-flex items-center gap-1 font-bold text-foreground"><AgentIcon className="h-3 w-3" />Assign Employee</span> on the <span className="font-bold text-foreground">top right</span> to put it on autopilot
            </p>
          </div>
          <Link href="/" className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all bg-foreground/[0.06] hover:bg-foreground/[0.1] text-foreground/70 hover:text-foreground")}>
            <CoastyIcon className="h-3 w-3" />New Chat
          </Link>
        </div>

        {/* Tabs */}
        {schedules.length > 0 && (
          <div className="flex items-center gap-1 border-b border-foreground/[0.06]">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn(
                  "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
                )}>
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full tabular-nums", active ? "bg-foreground/[0.1] text-foreground/70" : "bg-foreground/[0.06] text-muted-foreground/70")}>{tab.count}</span>
                  )}
                  {active && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-foreground rounded-full" />}
                </button>
              )
            })}
          </div>
        )}

        {/* ═══ Empty state ═══ */}
        {schedules.length === 0 && (
          <div className={cn("relative rounded-2xl overflow-hidden bg-foreground/[0.02] border border-foreground/[0.06]")}>
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-12 right-1/4 h-56 w-56 rounded-full bg-foreground/[0.03] blur-3xl" />
              <div className="absolute -bottom-12 left-1/4 h-48 w-48 rounded-full bg-foreground/[0.02] blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full bg-foreground/[0.015] blur-2xl" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.1] to-transparent" />
            </div>
            <div className="relative flex flex-col items-center py-14 px-6 text-center">
              <div className="flex items-center gap-2.5 mb-8">
                {[Briefcase, Mail, Globe, RefreshCw, ShieldCheck, FileText].map((Icon, i) => (
                  <div key={i} className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.04] ring-1 ring-foreground/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]")}>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.02] ring-1 ring-foreground/[0.05]"><MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground/60" /></div>
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground">Hire your first employee</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-10">AI employees work on your behalf — assign a task, set a schedule, and they'll execute it automatically</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10 text-left w-full max-w-xl">
                {[
                  { icon: Clock, title: "Flexible shifts", desc: "Schedule employees hourly, daily, weekly, monthly — or use a custom cron expression" },
                  { icon: Cpu, title: "Full autonomy", desc: "Each employee gets full access to browsing, terminal, and your connected workstations" },
                  { icon: Activity, title: "Activity logs", desc: "Every execution is logged so you can review what your employees accomplished" },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className={cn("relative flex flex-col gap-2 rounded-xl p-4 overflow-hidden bg-foreground/[0.03] ring-1 ring-foreground/[0.06]")}>
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent" />
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/[0.06]"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
                    <p className="text-xs font-semibold text-foreground/80">{title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowCreateDialog(true)} className={cn("inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-300 text-background bg-gradient-to-b from-foreground to-foreground/80 hover:from-foreground hover:to-foreground/90 hover:scale-[1.02] active:scale-[0.98]")}>
                  <UserPlus className="h-3.5 w-3.5" />Hire Employee
                </button>
                <Link href="/" className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all bg-foreground/[0.04] border border-foreground/[0.08] text-foreground/80 hover:bg-foreground/[0.08]")}>
                  <CoastyIcon className="h-3.5 w-3.5" />Start from a chat
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TEAMS TAB ═══ */}
        {schedules.length > 0 && activeTab === "teams" && (
          <div className="space-y-5">
            {/* Teams explainer */}
            <div className="rounded-xl px-4 py-3 bg-foreground/[0.08] ring-1 ring-foreground/[0.1]">
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground/70">Teams</span> let employees share context and memory across runs — one employee&apos;s output becomes another&apos;s input, automatically. Drag employees from the sidebar into a team to get started.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] xl:grid-cols-[1fr_300px] gap-6">
            {/* Left: Teams */}
            <div className="space-y-4 min-w-0">
              {/* No teams yet — simple prompt */}
              {teams.length === 0 && !showCreateTeam && (
                <div className="rounded-2xl bg-foreground/[0.02] ring-1 ring-foreground/[0.05] py-14 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground/70 mb-1">No teams yet</p>
                  <p className="text-xs text-muted-foreground/50 max-w-xs mx-auto mb-5">
                    Teams let employees share context and memory. Create one, then drag employees from the sidebar.
                  </p>
                  <button onClick={() => setShowCreateTeam(true)} className={cn("inline-flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-medium transition-all text-background bg-foreground hover:bg-foreground/90")}>
                    <Plus className="h-3.5 w-3.5" />New Team
                  </button>
                </div>
              )}

              {/* Create team inline */}
              {showCreateTeam && (
                <div className="rounded-2xl bg-foreground/[0.03] ring-1 ring-foreground/[0.08] p-5 space-y-3">
                  <input
                    type="text"
                    placeholder="Team name"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
                    className="w-full h-10 rounded-xl px-4 text-sm bg-foreground/[0.04] border border-foreground/[0.08] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/[0.15] transition-all"
                  />
                  <textarea
                    placeholder="Team guidelines (optional)"
                    value={newTeamInstructions}
                    onChange={(e) => setNewTeamInstructions(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl px-4 py-2.5 text-sm resize-none bg-foreground/[0.04] border border-foreground/[0.08] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/[0.15] transition-all"
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={handleCreateTeam} disabled={!newTeamName.trim()} className={cn("h-9 px-5 rounded-xl text-sm font-semibold transition-all", newTeamName.trim() ? "text-background bg-foreground hover:bg-foreground/90" : "text-muted-foreground bg-foreground/[0.06]", "disabled:opacity-40")}>
                      Create
                    </button>
                    <button onClick={() => { setShowCreateTeam(false); setNewTeamName(""); setNewTeamInstructions("") }} className="h-9 px-3 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Teams */}
              {teams.length > 0 && (
                <>
                  {!showCreateTeam && (
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] text-muted-foreground/60">Drag employees from the right to add them</p>
                      <button onClick={() => setShowCreateTeam(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <Plus className="h-3 w-3" />New Team
                      </button>
                    </div>
                  )}
                  <div className="space-y-3">
                    {teams.map((team) => (
                      <TeamCard key={team.hub_id} team={team} schedules={schedules} onRefresh={refreshAll} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Right: Employee sidebar */}
            <div className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-2xl ring-1 ring-foreground/[0.12] bg-foreground/[0.04] overflow-hidden">
                <div className="px-4 py-3 border-b border-foreground/[0.08]">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Employees</p>
                </div>
                <div className="p-2 space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-invisible">
                  {schedules.map((s) => (
                    <EmployeePill key={s.chat_id} schedule={s} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ═══ EMPLOYEES TAB ═══ */}
        {schedules.length > 0 && activeTab === "employees" && (
          <div className="space-y-6">
            {/* Filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "All", count: schedules.length },
                { id: "active", label: "On Duty", count: activeCount },
                { id: "paused", label: "Standby", count: pausedCount },
              ].map((f) => (
                <button key={f.id} onClick={() => setStatusFilter(f.id)} className={cn(
                  "h-8 px-3.5 rounded-lg transition-all text-[13px] font-medium",
                  statusFilter === f.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]",
                )}>
                  <span className="flex items-center gap-1.5">
                    {f.label}
                    {f.count > 0 && (
                      <span className={cn(
                        "text-[10px] tabular-nums px-1.5 py-px rounded-full font-medium",
                        statusFilter === f.id ? "bg-background/20 text-background/80" : "bg-foreground/[0.06]",
                      )}>
                        {f.count}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* Employee grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSchedules.map((s) => (
                <ScheduleCard key={s.chat_id} schedule={s} onUpdate={loadSchedules} onViewHistory={(id) => { setHistoryChat(id); setShowHistory(true) }} onEdit={setEditChatId} />
              ))}
            </div>

            {/* Empty filter state */}
            {filteredSchedules.length === 0 && schedules.length > 0 && (
              <div className="flex flex-col items-center py-14">
                <AgentIcon className="h-8 w-8 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground/60">No employees match this filter</p>
              </div>
            )}

            {/* Schedule calendar */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-3 px-1">
                <h2 className="text-[13px] font-semibold text-foreground/60 uppercase tracking-wider">Schedule</h2>
                <div className="flex-1 h-px bg-foreground/[0.06]" />
              </div>
              <div className="rounded-2xl bg-foreground/[0.05] ring-1 ring-foreground/[0.08] p-4 sm:p-5">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_320px] gap-4">
                <ScheduleCalendar schedules={filteredSchedules} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
                <div className="lg:sticky lg:top-6 lg:self-start">
                  <div className="rounded-xl overflow-hidden bg-background/60 ring-1 ring-foreground/[0.08]">
                    <div className="px-4 py-3 border-b border-foreground/[0.06]">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-[13px] font-semibold text-foreground">
                            {selectedDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                          </h3>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                            {dayTasks.length === 0 ? "No employees scheduled" : `${dayTasks.length} employee${dayTasks.length !== 1 ? "s" : ""}`}
                          </p>
                        </div>
                        {isToday && (
                          <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-foreground text-background">
                            Today
                          </span>
                        )}
                      </div>
                    </div>
                    {dayTasks.length > 0 ? (
                      <div className="p-2 space-y-0.5">
                        {dayTasks.map((t) => (
                          <DayTaskItem key={t.schedule.chat_id} task={t} onUpdate={loadSchedules} />
                        ))}
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <AgentIcon className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                        <p className="text-[11px] text-muted-foreground/40">No employees on this day</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* Activity log */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-3 px-1">
                <h2 className="text-[13px] font-semibold text-foreground/60 uppercase tracking-wider">Recent Activity</h2>
                <div className="flex-1 h-px bg-foreground/[0.06]" />
              </div>
              <div className="rounded-xl bg-foreground/[0.02] ring-1 ring-foreground/[0.06] overflow-hidden">
                <ScheduleHistory chatId={showHistory ? historyChat : undefined} limit={10} />
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateScheduleDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} machines={machines} onScheduleCreated={() => { setShowCreateDialog(false); loadSchedules() }} />
      {editChatId && (
        <ScheduleDialog open={!!editChatId} onOpenChange={(open) => { if (!open) setEditChatId(null) }} chatId={editChatId} chatTitle={schedules.find((s) => s.chat_id === editChatId)?.title ?? undefined} machines={machines} defaultMachineId={schedules.find((s) => s.chat_id === editChatId)?.machine_id} onScheduleCreated={() => { setEditChatId(null); loadSchedules() }} onScheduleDeleted={() => { setEditChatId(null); loadSchedules() }} />
      )}
    </div>
  )
}
