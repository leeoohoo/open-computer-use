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
  type ScheduleConfig,
  type ScheduleResponse,
} from "@/lib/services/schedules-api"
import { trackScheduleCreated } from "@/lib/posthog/analytics"
import type { UserMachine } from "@/types/machines.types"
import { useSubscription } from "@/lib/hooks/use-subscription"
import { WarningCircle } from "@phosphor-icons/react"
import { KeyRound, ArrowRight, PenLine, AlertCircle, Trash2 } from "lucide-react"
import { AgentIcon } from "@/components/icons/agent"
import Link from "next/link"
import {
  ScheduleConfigBlock,
  type ScheduleConfigState,
} from "./schedule-config-block"
import { cn } from "@/lib/utils"

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
  const [taskPrompt, setTaskPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingSchedule, setExistingSchedule] = useState<ScheduleResponse | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const { isActiveSubscriber, loading: subLoading } = useSubscription()

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
      getSchedule(chatId)
        .then((schedule) => {
          if (schedule) {
            setExistingSchedule(schedule)
            setConfig((prev) => ({
              ...prev,
              frequency: schedule.frequency || "daily",
              machineId: schedule.machine_id || defaultMachineId || "",
              timezone: schedule.timezone || prev.timezone,
            }))
            setTaskPrompt(schedule.task_prompt || "")
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

      const schedule = await createSchedule(chatId, scheduleConfig)
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
          "border-foreground/[0.08]",
          "shadow-[0_8px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)_inset,0_-20px_60px_-20px_rgba(255,255,255,0.02)_inset]",
        )}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-foreground/[0.02] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.1] to-transparent" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.15] to-transparent" />

          <div className="relative px-6 pt-6 pb-5">
            <DialogHeader>
              <div className="flex items-center gap-3.5">
                <div className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-2xl",
                  "bg-gradient-to-br from-foreground/15 to-foreground/[0.06]",
                  "ring-1 ring-foreground/[0.12]",
                  "dark:shadow-[0_2px_12px_rgba(255,255,255,0.06)]",
                )}>
                  <AgentIcon className="h-5 w-5 text-foreground/80" />
                  <div className="absolute inset-0 rounded-2xl bg-foreground/[0.04] animate-pulse" />
                </div>
                <div>
                  <DialogTitle className="text-[17px] font-bold tracking-tight">
                    {isEditing ? "Edit Employee" : "Configure Employee"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
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
                <div className="absolute inset-0 rounded-full border-2 border-foreground/[0.08]" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground/60 animate-spin" />
              </div>
              <span className="text-xs text-muted-foreground">Loading configuration...</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-5 pt-5 space-y-6 scrollbar-invisible">
            {/* Instructions */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground/[0.08]">
                  <PenLine className="h-3 w-3 text-foreground/50" />
                </div>
                <label className="text-[13px] font-semibold text-foreground/80 tracking-wide uppercase text-[11px]">
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
                  "!bg-foreground/[0.04] text-foreground",
                  "border-foreground/[0.08] hover:border-foreground/[0.14] focus-visible:border-foreground/[0.2]",
                  "shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset,0_2px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_2px_4px_rgba(0,0,0,0.3)]",
                  "placeholder:text-muted-foreground",
                  "transition-all duration-200",
                )}
              />
              <p className="text-[10px] text-muted-foreground pl-0.5">
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

            {/* Free tier warning */}
            {showFreeTierWarning && (
              <div className={cn(
                "flex gap-3 rounded-xl p-4",
                "bg-foreground/[0.03]",
                "border border-foreground/[0.08]",
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
              "bg-foreground/[0.03]",
              "border border-foreground/[0.06]",
            )}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06]">
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
                "bg-foreground/[0.03]",
                "border border-foreground/[0.08]",
              )}>
                <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-foreground/80 font-medium">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className={cn(
          "shrink-0 px-6 py-4 flex items-center gap-2.5",
          "border-t border-foreground/[0.06]",
        )}>
          {isEditing && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className={cn(
                "h-10 px-4 rounded-xl text-xs font-semibold mr-auto transition-all duration-200",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-foreground/[0.06]",
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
              className="h-10 px-5 text-sm rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
            >
              Cancel
            </Button>
            <button
              onClick={handleSave}
              disabled={loading || !canSubmit}
              className={cn(
                "relative h-10 px-6 rounded-xl text-sm font-semibold transition-all duration-300",
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
                  : "text-muted-foreground bg-foreground/[0.06]"
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
