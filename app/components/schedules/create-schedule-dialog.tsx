"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  createSchedule,
  FREQUENCY_OPTIONS,
  type ScheduleConfig,
  type ScheduleResponse,
} from "@/lib/services/schedules-api"
import { trackScheduleCreated } from "@/lib/posthog/analytics"
import type { UserMachine } from "@/types/machines.types"
import { createClient } from "@/lib/supabase/client"
import { KeyRound, ArrowRight } from "lucide-react"
import Link from "next/link"

interface CreateScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  machines: UserMachine[]
  onScheduleCreated?: (schedule: ScheduleResponse) => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
]

export function CreateScheduleDialog({
  open,
  onOpenChange,
  machines,
  onScheduleCreated,
}: CreateScheduleDialogProps) {
  const [taskDescription, setTaskDescription] = useState("")
  const [frequency, setFrequency] = useState("daily")
  const [machineId, setMachineId] = useState("")
  const [timezone, setTimezone] = useState("")
  const [time, setTime] = useState("09:00")
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [customCron, setCustomCron] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detect timezone once
  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    } catch {
      setTimezone("UTC")
    }
  }, [])

  // Reset state when dialog opens; auto-select a running machine
  useEffect(() => {
    if (open) {
      setTaskDescription("")
      setFrequency("daily")
      setTime("09:00")
      setDayOfWeek(1)
      setDayOfMonth(1)
      setCustomCron("")
      setError(null)
      const firstRunning = machines.find((m) => m.status === "running")
      setMachineId(firstRunning?.id ?? machines[0]?.id ?? "")
    }
  }, [open, machines])

  const selectableMachines = machines.filter(
    (m) => m.status !== "deleting" && m.status !== "error"
  )

  const showTimePicker = ["daily", "weekly", "monthly"].includes(frequency)
  const showDayOfWeek = frequency === "weekly"
  const showDayOfMonth = frequency === "monthly"
  const showCustomCron = frequency === "custom"

  async function handleSave() {
    if (!taskDescription.trim()) {
      setError("Please describe what the task should do")
      return
    }
    if (!machineId) {
      setError("Please select a target machine")
      return
    }
    if (frequency === "custom" && !customCron) {
      setError("Please enter a cron expression")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Get current user
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // 2. Create a new chat with the task description as its title
      const chatRes = await fetch("/api/create-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          title: taskDescription.trim(),
          model: null,
          isAuthenticated: true,
        }),
      })
      const chatData = await chatRes.json()
      if (!chatRes.ok || !chatData.chat) {
        throw new Error(chatData.error || "Failed to create task")
      }

      // 3. Create the schedule on the new chat
      const config: ScheduleConfig = {
        frequency,
        timezone,
        machineId,
        taskPrompt: taskDescription.trim(),
      }
      if (frequency === "custom") config.cron = customCron
      if (showTimePicker) config.time = time
      if (showDayOfWeek) config.dayOfWeek = dayOfWeek
      if (showDayOfMonth) config.dayOfMonth = dayOfMonth

      const schedule = await createSchedule(chatData.chat.id, config)
      trackScheduleCreated(chatData.chat.id, frequency)
      onScheduleCreated?.(schedule)
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create schedule")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-w-[calc(100vw-2rem)] sm:max-w-[480px] max-h-[90dvh] p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle>New Scheduled Task</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 pt-1 space-y-4">
          {/* Task description */}
          <div className="space-y-2">
            <Label>What should this task do?</Label>
            <Textarea
              placeholder="e.g. Check my emails and summarise unread messages, then send a daily digest"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              rows={3}
              className="resize-none"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              This becomes the task prompt used every time it runs.
            </p>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom cron */}
          {showCustomCron && (
            <div className="space-y-2">
              <Label>Cron Expression</Label>
              <Input
                placeholder="*/15 * * * *"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Standard 5-field cron (minute hour day month weekday)
              </p>
            </div>
          )}

          {/* Time picker */}
          {showTimePicker && (
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          )}

          {/* Day of week */}
          {showDayOfWeek && (
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select
                value={String(dayOfWeek)}
                onValueChange={(v) => setDayOfWeek(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Day of month */}
          {showDayOfMonth && (
            <div className="space-y-2">
              <Label>Day of Month</Label>
              <Select
                value={String(dayOfMonth)}
                onValueChange={(v) => setDayOfMonth(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Machine selector */}
          <div className="space-y-2">
            <Label>Target Machine</Label>
            {selectableMachines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No machines available. Create a machine first from My Computers.
              </p>
            ) : (
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a machine" />
                </SelectTrigger>
                <SelectContent>
                  {selectableMachines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            m.status === "running"
                              ? "bg-green-500"
                              : m.status === "stopped"
                              ? "bg-gray-400"
                              : "bg-yellow-500"
                          }`}
                        />
                        {m.displayName}
                        <span className="text-xs text-muted-foreground">
                          {m.status}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Make sure the machine has all necessary logins and credentials so
              the task can run unattended.
            </p>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/New_York"
            />
            <p className="text-xs text-muted-foreground">
              Auto-detected. Change if needed.
            </p>
          </div>

          {/* Credentials hint */}
          <div className="flex items-start gap-3 rounded-lg border border-border bg-foreground/[0.02] px-3 py-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06]">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium mb-0.5">Add credentials for auto-login</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                If this task logs into any websites, save your credentials so the AI can sign in automatically — no interruptions.
              </p>
              <Link
                href="/secrets"
                className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-foreground hover:text-foreground/70 transition-colors"
              >
                Add credentials
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter className="px-5 py-4 shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !machineId || !taskDescription.trim()}
          >
            {loading ? "Creating…" : "Create Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
