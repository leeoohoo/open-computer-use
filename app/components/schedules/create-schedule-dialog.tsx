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
          "border-border/30",
          "shadow-xl",
        )}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.1] to-transparent" />

          <div className="relative px-4 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5">
            <DialogHeader>
              <div className="flex items-center gap-3 sm:gap-3.5">
                <div className={cn(
                  "flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl",
                  "bg-muted/60 ring-1 ring-border/30",
                )}>
                  <AgentIcon className="h-4 w-4 sm:h-5 sm:w-5 text-foreground/80" />
                </div>
                <div>
                  <DialogTitle className="text-[15px] sm:text-[17px] font-bold tracking-tight">
                    Hire New Employee
                  </DialogTitle>
                  <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                    Set up an AI employee for recurring tasks
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-5 pt-4 sm:pt-5 space-y-5 sm:space-y-6 scrollbar-invisible">
          {/* Employee Name */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-muted/60">
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
                  "bg-muted/40 text-foreground",
                  "border border-border/40 hover:border-border/60 focus-visible:border-border",
                  "placeholder:text-muted-foreground",
                  "focus:outline-none transition-all duration-200",
                )}
              />
              <button
                type="button"
                onClick={() => setEmployeeName(randomEmployeeName())}
                className={cn(
                  "shrink-0 h-10 w-10 flex items-center justify-center rounded-xl",
                  "bg-muted/40 border border-border/40",
                  "text-muted-foreground hover:text-foreground hover:bg-muted/60",
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
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-muted/60">
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
                "bg-muted/40 text-foreground",
                "border-border/40 hover:border-border/60 focus-visible:border-border",
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
            "border border-border/30 bg-card/50 backdrop-blur-sm",
          )}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60">
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
              "border border-border/30 bg-card/50",
            )}>
              <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-foreground/80 font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          "shrink-0 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-end gap-2",
          "border-t border-border/30",
        )}>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-9 sm:h-10 px-4 sm:px-5 text-[13px] sm:text-sm rounded-lg sm:rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60"
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
                ? "text-background bg-foreground hover:bg-foreground/90 hover:scale-[1.02] active:scale-[0.98]"
                : "text-muted-foreground bg-muted/60"
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
