"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  listSchedules,
  updateTriggers,
  getDelegates,
  updateDelegates,
  type ScheduleConfig,
  type ScheduleResponse,
  type TriggerConfig,
  type DelegateConfig,
} from "@/lib/services/schedules-api"
import { trackScheduleCreated } from "@/lib/posthog/analytics"
import type { UserMachine } from "@/types/machines.types"
import { useSubscription } from "@/lib/hooks/use-subscription"
import { WarningCircle } from "@phosphor-icons/react"
import { KeyRound, ArrowRight, PenLine, AlertCircle, Trash2, Zap, Plus, X, ChevronDown, User, Sparkles } from "lucide-react"
import { AgentIcon } from "@/components/icons/agent"
import { updateChatTitleInDb } from "@/lib/chat-store/chats/api"
import Link from "next/link"
import {
  ScheduleConfigBlock,
  type ScheduleConfigState,
} from "./schedule-config-block"
import { cn } from "@/lib/utils"

const EMPLOYEE_NAMES = [
  "Atlas", "Echo", "Nova", "Sage", "Onyx", "Cleo", "Milo", "Aria",
  "Dash", "Flux", "Iris", "Juno", "Koda", "Luna", "Neon", "Orion",
  "Pixel", "Quinn", "Rune", "Scout", "Taro", "Vale", "Wren", "Zara",
  "Blaze", "Coral", "Dune", "Ember", "Frost", "Haze", "Ivy", "Kit",
]

function randomEmployeeName() {
  return EMPLOYEE_NAMES[Math.floor(Math.random() * EMPLOYEE_NAMES.length)]
}

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatId: string
  chatTitle?: string
  machines: UserMachine[]
  defaultMachineId?: string | null
  onScheduleCreated?: (schedule: ScheduleResponse) => void
  onScheduleDeleted?: () => void
}

export function ScheduleDialog({
  open,
  onOpenChange,
  chatId,
  chatTitle,
  machines,
  defaultMachineId,
  onScheduleCreated,
  onScheduleDeleted,
}: ScheduleDialogProps) {
  const [employeeName, setEmployeeName] = useState(() =>
    chatTitle && chatTitle.length <= 30 ? chatTitle : randomEmployeeName()
  )
  const [taskPrompt, setTaskPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingSchedule, setExistingSchedule] = useState<ScheduleResponse | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const { isActiveSubscriber, loading: subLoading } = useSubscription()
  const [triggers, setTriggers] = useState<TriggerConfig[]>([])
  const [delegates, setDelegates] = useState<DelegateConfig[]>([])
  const [delegatesExpanded, setDelegatesExpanded] = useState(false)
  const [allSchedules, setAllSchedules] = useState<ScheduleResponse[]>([])
  const [triggersExpanded, setTriggersExpanded] = useState(true)

  const [config, setConfig] = useState<ScheduleConfigState>({
    frequency: "daily",
    time: "09:00",
    dayOfWeek: 1,
    dayOfMonth: 1,
    customCron: "",
    timezone: "",
    machineId: defaultMachineId || "",
  })

  const selectedMachine = machines.find((m) => m.id === config.machineId)
  const isCloudMachine = selectedMachine && !selectedMachine.settings?.isLocal && selectedMachine.settings?.provider !== "electron"
  const showFreeTierWarning = !subLoading && !isActiveSubscriber && isCloudMachine

  useEffect(() => {
    try {
      setConfig((prev) => ({
        ...prev,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }))
    } catch {
      setConfig((prev) => ({ ...prev, timezone: "UTC" }))
    }
  }, [])

  useEffect(() => {
    if (open && chatId) {
      setExistingSchedule(null)
      setError(null)
      setLoadingExisting(true)
      setTriggers([])
      setDelegates([])
      setTriggersExpanded(false)
      setDelegatesExpanded(false)
      setEmployeeName(chatTitle && chatTitle.length <= 30 ? chatTitle : randomEmployeeName())

      // Load schedule + all schedules for trigger targets + delegates
      Promise.all([
        getSchedule(chatId),
        listSchedules(),
        getDelegates(chatId).catch(() => [] as DelegateConfig[]),
      ])
        .then(([schedule, allScheds, existingDelegates]) => {
          setAllSchedules(allScheds.filter((s) => s.chat_id !== chatId))
          setDelegates(existingDelegates)
          if (existingDelegates.length > 0) {
            setDelegatesExpanded(true)
          }
          if (schedule) {
            setExistingSchedule(schedule)
            setConfig((prev) => ({
              ...prev,
              frequency: schedule.frequency || "daily",
              machineId: schedule.machine_id || defaultMachineId || "",
              timezone: schedule.timezone || prev.timezone,
            }))
            setTaskPrompt(schedule.task_prompt || "")
            setTriggers(schedule.triggers || [])
            if (schedule.triggers && schedule.triggers.length > 0) {
              setTriggersExpanded(true)
            }
          } else {
            setConfig((prev) => ({
              ...prev,
              frequency: "daily",
              time: "09:00",
              dayOfWeek: 1,
              dayOfMonth: 1,
              customCron: "",
              machineId: defaultMachineId || "",
            }))
            setTaskPrompt("")
          }
        })
        .catch(() => {})
        .finally(() => setLoadingExisting(false))
    }
  }, [open, chatId])

  const handleConfigChange = useCallback(
    (updates: Partial<ScheduleConfigState>) => {
      setConfig((prev) => ({ ...prev, ...updates }))
    },
    []
  )

  const showTimePicker = ["daily", "weekly", "monthly"].includes(config.frequency)
  const showDayOfWeek = config.frequency === "weekly"
  const showDayOfMonth = config.frequency === "monthly"

  async function handleSave() {
    if (!config.machineId) {
      setError("Please select a workstation")
      return
    }
    if (config.frequency === "custom" && !config.customCron) {
      setError("Please enter a cron expression")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const scheduleConfig: ScheduleConfig = {
        frequency: config.frequency,
        timezone: config.timezone,
        machineId: config.machineId,
      }

      if (config.frequency === "custom") scheduleConfig.cron = config.customCron
      if (showTimePicker) scheduleConfig.time = config.time
      if (showDayOfWeek) scheduleConfig.dayOfWeek = config.dayOfWeek
      if (showDayOfMonth) scheduleConfig.dayOfMonth = config.dayOfMonth
      if (taskPrompt.trim()) scheduleConfig.taskPrompt = taskPrompt.trim()

      // Update employee name if changed
      const trimmedName = employeeName.trim()
      if (trimmedName && trimmedName !== chatTitle) {
        await updateChatTitleInDb(chatId, trimmedName)
      }

      const schedule = await createSchedule(chatId, scheduleConfig)

      // Save triggers if any were configured
      if (triggers.length > 0) {
        await updateTriggers(chatId, triggers)
      }

      // Save delegates
      await updateDelegates(chatId, delegates)

      trackScheduleCreated(chatId, config.frequency)
      onScheduleCreated?.(schedule)
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to hire employee")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      await deleteSchedule(chatId)
      setExistingSchedule(null)
      onScheduleDeleted?.()
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove employee")
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = config.machineId && (config.frequency !== "custom" || config.customCron)

  const isEditing = !!existingSchedule

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col max-w-[calc(100vw-2rem)] sm:max-w-[540px] max-h-[90dvh] p-0 gap-0 overflow-hidden",
          "bg-background text-foreground",
          "border-zinc-200 dark:border-zinc-700",
          "shadow-[0_8px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)_inset,0_-20px_60px_-20px_rgba(255,255,255,0.02)_inset]",
        )}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-foreground/[0.02] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.1] to-transparent" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.15] to-transparent" />

          <div className="relative px-4 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5">
            <DialogHeader>
              <div className="flex items-center gap-3 sm:gap-3.5">
                <div className={cn(
                  "relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl",
                  "bg-gradient-to-br from-foreground/15 to-foreground/[0.06]",
                  "ring-1 ring-zinc-300 dark:ring-zinc-600",
                  "dark:shadow-[0_2px_12px_rgba(255,255,255,0.06)]",
                )}>
                  <AgentIcon className="h-4 w-4 sm:h-5 sm:w-5 text-foreground/80" />
                  <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-800 animate-pulse" />
                </div>
                <div>
                  <DialogTitle className="text-[15px] sm:text-[17px] font-bold tracking-tight">
                    {isEditing ? "Edit Employee" : "Configure Employee"}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                    {isEditing
                      ? "Update schedule, workstation, or instructions"
                      : "Set up an AI employee for this chat"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
        </div>

        {loadingExisting ? (
          <div className="flex items-center justify-center py-20 flex-1">
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-10 w-10">
                <div className="absolute inset-0 rounded-full border-2 border-zinc-200 dark:border-zinc-700" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground/60 animate-spin" />
              </div>
              <span className="text-xs text-muted-foreground">Loading configuration...</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-5 pt-4 sm:pt-5 space-y-5 sm:space-y-6 scrollbar-invisible">
            {/* Employee Name */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                  <User className="h-3 w-3 text-foreground/50" />
                </div>
                <label className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">
                  Name
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="Employee name"
                  className={cn(
                    "flex-1 h-10 rounded-xl px-4 text-sm font-medium",
                    "bg-white dark:bg-zinc-800 text-foreground",
                    "border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 focus-visible:border-zinc-400 dark:focus-visible:border-zinc-500",
                    "shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset,0_2px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_2px_4px_rgba(0,0,0,0.3)]",
                    "placeholder:text-muted-foreground",
                    "focus:outline-none transition-all duration-200",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setEmployeeName(randomEmployeeName())}
                  className={cn(
                    "shrink-0 h-10 w-10 flex items-center justify-center rounded-xl",
                    "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700",
                    "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:bg-zinc-800",
                    "transition-all duration-200",
                  )}
                  title="Randomize name"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                  <PenLine className="h-3 w-3 text-foreground/50" />
                </div>
                <label className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">
                  Instructions
                </label>
              </div>
              <Textarea
                placeholder={chatTitle || "Describe what this employee should do..."}
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                rows={3}
                className={cn(
                  "resize-none text-sm leading-relaxed rounded-xl",
                  "bg-white dark:bg-zinc-800 text-foreground",
                  "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 focus-visible:border-zinc-400 dark:focus-visible:border-zinc-500",
                  "shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset,0_2px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_2px_4px_rgba(0,0,0,0.3)]",
                  "placeholder:text-muted-foreground",
                  "transition-all duration-200",
                )}
              />
              <p className="text-[11px] text-muted-foreground pl-0.5">
                {taskPrompt.trim()
                  ? "These instructions will be used each time the employee runs."
                  : "Leave empty to use the original chat message."}
              </p>
            </div>

            <ScheduleConfigBlock
              config={config}
              onChange={handleConfigChange}
              machines={machines}
              defaultMachineId={defaultMachineId}
            />

            {/* Triggers */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setTriggersExpanded(!triggersExpanded)}
                className="flex items-center gap-2 w-full"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                  <Zap className="h-3 w-3 text-foreground/50" />
                </div>
                <span className="text-[11px] font-semibold text-foreground/80 tracking-wide uppercase">
                  Triggers
                </span>
                {triggers.length > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-muted-foreground tabular-nums">
                    {triggers.length}
                  </span>
                )}
                <ChevronDown className={cn(
                  "h-3 w-3 ml-auto text-muted-foreground transition-transform duration-200",
                  triggersExpanded && "rotate-180",
                )} />
              </button>

              {triggersExpanded && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground pl-0.5">
                    When this employee finishes, automatically trigger another employee.
                  </p>

                  {/* Existing triggers */}
                  {triggers.map((trig, idx) => {
                    const target = allSchedules.find((s) => s.chat_id === trig.target_chat_id)
                    return (
                      <div
                        key={trig.id || idx}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3.5 py-3",
                          "bg-white dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-700",
                          "transition-all hover:ring-zinc-300 dark:hover:ring-zinc-600",
                        )}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                          <Zap className="h-3 w-3 text-foreground/50" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {target?.title || "Unknown Employee"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {(["on_complete", "on_failure", "on_any"] as const).map((ev) => (
                              <button
                                key={ev}
                                type="button"
                                onClick={() => {
                                  const updated = [...triggers]
                                  updated[idx] = { ...updated[idx], event: ev }
                                  setTriggers(updated)
                                }}
                                className={cn(
                                  "text-[11px] px-2 py-0.5 rounded-full transition-all font-medium",
                                  trig.event === ev
                                    ? "bg-foreground text-background"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-foreground",
                                )}
                              >
                                {ev === "on_complete" ? "Success" : ev === "on_failure" ? "Failure" : "Always"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTriggers(triggers.filter((_, i) => i !== idx))}
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-zinc-100 dark:bg-zinc-800 transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}

                  {/* Add trigger — employee picker */}
                  {(() => {
                    const available = allSchedules.filter((s) => !triggers.some((t) => t.target_chat_id === s.chat_id))
                    if (available.length === 0 && allSchedules.length === 0) {
                      return (
                        <div className={cn(
                          "rounded-xl py-4 text-center",
                          "border border-dashed border-zinc-300 dark:border-zinc-700",
                        )}>
                          <p className="text-[11px] text-muted-foreground/50">Hire more employees to set up triggers</p>
                        </div>
                      )
                    }
                    if (available.length === 0) return null
                    return (
                      <div className={cn(
                        "rounded-xl overflow-hidden",
                        "ring-1 ring-zinc-200 dark:ring-zinc-700",
                      )}>
                        <div className="px-3.5 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Add trigger</p>
                        </div>
                        <div className="max-h-[140px] overflow-y-auto scrollbar-invisible divide-y divide-zinc-100 dark:divide-zinc-800">
                          {available.map((s) => {
                            const active = s.enabled && !s.paused_reason
                            return (
                              <button
                                key={s.chat_id}
                                type="button"
                                onClick={() => {
                                  setTriggers([...triggers, {
                                    target_chat_id: s.chat_id,
                                    event: "on_complete",
                                    pass_output: true,
                                    enabled: true,
                                  }])
                                }}
                                className={cn(
                                  "flex items-center gap-3 w-full px-3.5 py-2.5 text-left",
                                  "hover:bg-white dark:bg-zinc-800 transition-all",
                                )}
                              >
                                <div className={cn(
                                  "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                                  active ? "bg-emerald-500/15" : "bg-zinc-100 dark:bg-zinc-800",
                                )}>
                                  <AgentIcon className={cn("h-2.5 w-2.5", active ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/50")} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground/80 truncate">{s.title || "Untitled Employee"}</p>
                                </div>
                                <Plus className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Delegates */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setDelegatesExpanded(!delegatesExpanded)}
                className="flex items-center gap-2 w-full"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                  <User className="h-3 w-3 text-foreground/50" />
                </div>
                <span className="text-[11px] font-semibold text-foreground/80 tracking-wide uppercase">
                  Delegates
                </span>
                {delegates.length > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-muted-foreground tabular-nums">
                    {delegates.length}
                  </span>
                )}
                <ChevronDown className={cn(
                  "h-3 w-3 ml-auto text-muted-foreground transition-transform duration-200",
                  delegatesExpanded && "rotate-180",
                )} />
              </button>

              {delegatesExpanded && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground pl-0.5">
                    Employees this agent can call mid-task to delegate subtasks to.
                  </p>

                  {/* Existing delegates */}
                  {delegates.map((del, idx) => {
                    const target = allSchedules.find((s) => s.chat_id === del.chat_id)
                    return (
                      <div
                        key={del.chat_id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3.5 py-3",
                          "bg-white dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-700",
                          "transition-all hover:ring-zinc-300 dark:hover:ring-zinc-600",
                        )}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                          <User className="h-3 w-3 text-foreground/50" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {target?.title || del.title || "Unknown Employee"}
                          </p>
                          <input
                            type="text"
                            value={del.role}
                            onChange={(e) => {
                              const updated = [...delegates]
                              updated[idx] = { ...updated[idx], role: e.target.value }
                              setDelegates(updated)
                            }}
                            placeholder="Role description (e.g. 'Research specialist')"
                            className={cn(
                              "mt-1 w-full text-[11px] bg-transparent text-muted-foreground",
                              "border-none outline-none ring-0 p-0",
                              "placeholder:text-muted-foreground/40",
                            )}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setDelegates(delegates.filter((_, i) => i !== idx))}
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-zinc-100 dark:bg-zinc-800 transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}

                  {/* Add delegate — employee picker */}
                  {(() => {
                    const available = allSchedules.filter(
                      (s) => !delegates.some((d) => d.chat_id === s.chat_id)
                    )
                    if (available.length === 0 && allSchedules.length === 0) {
                      return (
                        <div className={cn(
                          "rounded-xl py-4 text-center",
                          "border border-dashed border-zinc-300 dark:border-zinc-700",
                        )}>
                          <p className="text-[11px] text-muted-foreground/50">Hire more employees to set up delegates</p>
                        </div>
                      )
                    }
                    if (available.length === 0) return null
                    return (
                      <div className={cn(
                        "rounded-xl overflow-hidden",
                        "ring-1 ring-zinc-200 dark:ring-zinc-700",
                      )}>
                        <div className="px-3.5 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Add delegate</p>
                        </div>
                        <div className="max-h-[140px] overflow-y-auto scrollbar-invisible divide-y divide-zinc-100 dark:divide-zinc-800">
                          {available.map((s) => {
                            const active = s.enabled && !s.paused_reason
                            return (
                              <button
                                key={s.chat_id}
                                type="button"
                                onClick={() => {
                                  setDelegates([...delegates, {
                                    chat_id: s.chat_id,
                                    title: s.title || "Untitled Employee",
                                    role: "",
                                  }])
                                }}
                                className={cn(
                                  "flex items-center gap-3 w-full px-3.5 py-2.5 text-left",
                                  "hover:bg-white dark:bg-zinc-800 transition-all",
                                )}
                              >
                                <div className={cn(
                                  "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                                  active ? "bg-emerald-500/15" : "bg-zinc-100 dark:bg-zinc-800",
                                )}>
                                  <AgentIcon className={cn("h-2.5 w-2.5", active ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/50")} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground/80 truncate">{s.title || "Untitled Employee"}</p>
                                </div>
                                <Plus className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Free tier warning */}
            {showFreeTierWarning && (
              <div className={cn(
                "flex gap-3 rounded-xl p-4",
                "bg-zinc-50 dark:bg-zinc-900/60",
                "border border-zinc-200 dark:border-zinc-700",
              )}>
                <WarningCircle className="size-5 shrink-0 text-muted-foreground mt-0.5" weight="fill" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground/70">
                    Free plan — machine will be deleted
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Cloud machines are auto-deleted after 2h of inactivity.{" "}
                    <a href="/billing" className="font-semibold text-foreground/70 underline underline-offset-2">
                      Upgrade
                    </a>{" "}
                    or use a local computer.
                  </p>
                </div>
              </div>
            )}

            {/* Credentials hint */}
            <div className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3",
              "bg-zinc-50 dark:bg-zinc-900/60",
              "border border-zinc-200 dark:border-zinc-800",
            )}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <KeyRound className="h-3.5 w-3.5 text-foreground/40" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Need auto-login?{" "}
                <Link
                  href="/secrets"
                  className="inline-flex items-center gap-0.5 font-semibold text-foreground/70 hover:text-foreground transition-colors"
                >
                  Add credentials
                  <ArrowRight className="h-2.5 w-2.5" />
                </Link>
              </p>
            </div>

            {error && (
              <div className={cn(
                "flex items-center gap-2.5 rounded-xl px-4 py-3",
                "bg-zinc-50 dark:bg-zinc-900/60",
                "border border-zinc-200 dark:border-zinc-700",
              )}>
                <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-foreground/80 font-medium">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className={cn(
          "shrink-0 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2",
          "border-t border-zinc-200 dark:border-zinc-800",
        )}>
          {isEditing && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className={cn(
                "h-9 sm:h-10 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold mr-auto transition-all duration-200",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "flex items-center gap-1.5",
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
          <div className={cn("flex items-center gap-2.5", !isEditing && "ml-auto")}>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-9 sm:h-10 px-4 sm:px-5 text-[13px] sm:text-sm rounded-lg sm:rounded-xl text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <button
              onClick={handleSave}
              disabled={loading || !canSubmit}
              className={cn(
                "relative h-9 sm:h-10 px-4 sm:px-6 rounded-lg sm:rounded-xl text-[13px] sm:text-sm font-semibold transition-all duration-300",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                canSubmit && !loading
                  ? [
                      "text-background",
                      "bg-gradient-to-b from-foreground to-foreground/80",
                      "hover:from-foreground hover:to-foreground/90",
                      "shadow-[0_1px_3px_rgba(0,0,0,0.15)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.8)_inset,0_4px_16px_rgba(255,255,255,0.08)]",
                      "hover:shadow-[0_1px_3px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.9)_inset,0_6px_24px_rgba(255,255,255,0.12)]",
                      "hover:scale-[1.02] active:scale-[0.98]",
                    ]
                  : "text-muted-foreground bg-zinc-100 dark:bg-zinc-800"
              )}
            >
              <span className="flex items-center gap-2">
                <AgentIcon className="h-4 w-4" />
                {loading
                  ? "Saving..."
                  : isEditing
                  ? "Update Employee"
                  : "Hire Employee"}
              </span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
