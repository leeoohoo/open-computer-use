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
  type ScheduleConfig,
  type ScheduleResponse,
} from "@/lib/services/schedules-api"
import { trackScheduleCreated } from "@/lib/posthog/analytics"
import type { UserMachine } from "@/types/machines.types"
import { createClient } from "@/lib/supabase/client"
import { KeyRound, ArrowRight, PenLine, AlertCircle, Sparkles, User } from "lucide-react"
import { AgentIcon } from "@/components/icons/agent"
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

interface CreateScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  machines: UserMachine[]
  onScheduleCreated?: (schedule: ScheduleResponse) => void
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  machines,
  onScheduleCreated,
}: CreateScheduleDialogProps) {
  const [employeeName, setEmployeeName] = useState(randomEmployeeName)
  const [taskDescription, setTaskDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<ScheduleConfigState>({
    frequency: "daily",
    time: "09:00",
    dayOfWeek: 1,
    dayOfMonth: 1,
    customCron: "",
    timezone: "",
    machineId: "",
  })

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
    if (open) {
      setEmployeeName(randomEmployeeName())
      setTaskDescription("")
      setError(null)
      const firstRunning = machines.find((m) => m.status === "running")
      setConfig((prev) => ({
        ...prev,
        frequency: "daily",
        time: "09:00",
        dayOfWeek: 1,
        dayOfMonth: 1,
        customCron: "",
        machineId: firstRunning?.id ?? machines[0]?.id ?? "",
      }))
    }
  }, [open, machines])

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
    if (!taskDescription.trim()) {
      setError("Please describe what the employee should do")
      return
    }
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
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const chatRes = await fetch("/api/create-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          title: employeeName.trim() || randomEmployeeName(),
          model: null,
          isAuthenticated: true,
        }),
      })
      const chatData = await chatRes.json()
      if (!chatRes.ok || !chatData.chat) {
        throw new Error(chatData.error || "Failed to hire employee")
      }

      const scheduleConfig: ScheduleConfig = {
        frequency: config.frequency,
        timezone: config.timezone,
        machineId: config.machineId,
        taskPrompt: taskDescription.trim(),
      }
      if (config.frequency === "custom") scheduleConfig.cron = config.customCron
      if (showTimePicker) scheduleConfig.time = config.time
      if (showDayOfWeek) scheduleConfig.dayOfWeek = config.dayOfWeek
      if (showDayOfMonth) scheduleConfig.dayOfMonth = config.dayOfMonth

      const schedule = await createSchedule(chatData.chat.id, scheduleConfig)
      trackScheduleCreated(chatData.chat.id, config.frequency)
      onScheduleCreated?.(schedule)
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to hire employee")
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = taskDescription.trim() && config.machineId && (config.frequency !== "custom" || config.customCron)

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
        {/* Premium header with gradient */}
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
                  "ring-1 ring-zinc-300 dark:ring-zinc-600",
                  "dark:shadow-[0_2px_12px_rgba(255,255,255,0.06)]",
                )}>
                  <AgentIcon className="h-5 w-5 text-foreground/80" />
                  <div className="absolute inset-0 rounded-2xl bg-white dark:bg-zinc-800 animate-pulse" />
                </div>
                <div>
                  <DialogTitle className="text-[17px] font-bold tracking-tight">
                    Hire New Employee
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Set up an AI employee to handle recurring tasks automatically
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-5 pt-5 space-y-6 scrollbar-invisible">
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
                autoFocus
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
              placeholder="e.g. Check my emails and summarise unread messages, then send a daily digest to #team-updates on Slack"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              rows={3}
              className={cn(
                "resize-none text-sm leading-relaxed rounded-xl",
                "bg-white dark:!bg-zinc-800 text-foreground",
                "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 focus-visible:border-zinc-400 dark:focus-visible:border-zinc-500",
                "shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset,0_2px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_2px_4px_rgba(0,0,0,0.3)]",
                "placeholder:text-muted-foreground",
                "transition-all duration-200",
              )}
            />
            <p className="text-[11px] text-muted-foreground pl-0.5">
              These instructions are used every time the employee runs.
            </p>
          </div>

          <ScheduleConfigBlock
            config={config}
            onChange={handleConfigChange}
            machines={machines}
          />

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

        {/* Premium footer */}
        <div className={cn(
          "shrink-0 px-6 py-4 flex items-center justify-end gap-2.5",
          "border-t border-zinc-200 dark:border-zinc-800",
        )}>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-10 px-5 text-sm rounded-xl text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
                : "text-muted-foreground bg-zinc-100 dark:bg-zinc-800"
            )}
          >
            <span className="flex items-center gap-2">
              <AgentIcon className="h-4 w-4" />
              {loading ? "Hiring..." : "Hire Employee"}
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
