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
  deleteSchedule,
  getSchedule,
  FREQUENCY_OPTIONS,
  type ScheduleConfig,
  type ScheduleResponse,
} from "@/lib/services/schedules-api"
import { trackScheduleCreated } from "@/lib/posthog/analytics"
import type { UserMachine } from "@/types/machines.types"
import { useSubscription } from "@/lib/hooks/use-subscription"
import { WarningCircle } from "@phosphor-icons/react"
import { KeyRound, ArrowRight } from "lucide-react"
import Link from "next/link"

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
  const [frequency, setFrequency] = useState("daily")
  const [machineId, setMachineId] = useState(defaultMachineId || "")
  const [timezone, setTimezone] = useState("")
  const [time, setTime] = useState("09:00")
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [customCron, setCustomCron] = useState("")
  const [taskPrompt, setTaskPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingSchedule, setExistingSchedule] = useState<ScheduleResponse | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const { isActiveSubscriber, loading: subLoading } = useSubscription()

  // Check if the selected machine is a cloud machine (will be auto-deleted for free users)
  const selectedMachine = machines.find((m) => m.id === machineId)
  const isCloudMachine = selectedMachine && !selectedMachine.settings?.isLocal && selectedMachine.settings?.provider !== "electron"
  const showFreeTierWarning = !subLoading && !isActiveSubscriber && isCloudMachine

  // Detect user timezone
  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    } catch {
      setTimezone("UTC")
    }
  }, [])

  // Load existing schedule when dialog opens, or pre-fill with current machine
  useEffect(() => {
    if (open && chatId) {
      // Reset stale state before fetching
      setExistingSchedule(null)
      setError(null)
      setLoadingExisting(true)
      getSchedule(chatId)
        .then((schedule) => {
          if (schedule) {
            setExistingSchedule(schedule)
            setFrequency(schedule.frequency || "daily")
            setMachineId(schedule.machine_id || defaultMachineId || "")
            setTimezone(schedule.timezone || timezone)
            setTaskPrompt(schedule.task_prompt || "")
          } else {
            // No existing schedule — reset to defaults
            setFrequency("daily")
            setTime("09:00")
            setDayOfWeek(1)
            setDayOfMonth(1)
            setCustomCron("")
            setTaskPrompt("")
            if (defaultMachineId) {
              setMachineId(defaultMachineId)
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoadingExisting(false))
    }
  }, [open, chatId])

  // Show all machines — the schedule runs later, so the machine doesn't need to be running now
  const selectableMachines = machines.filter(
    (m) => m.status !== "deleting" && m.status !== "error"
  )

  const showTimePicker = ["daily", "weekly", "monthly"].includes(frequency)
  const showDayOfWeek = frequency === "weekly"
  const showDayOfMonth = frequency === "monthly"
  const showCustomCron = frequency === "custom"

  async function handleSave() {
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
      const config: ScheduleConfig = {
        frequency,
        timezone,
        machineId,
      }

      if (frequency === "custom") {
        config.cron = customCron
      }
      if (showTimePicker) {
        config.time = time
      }
      if (showDayOfWeek) {
        config.dayOfWeek = dayOfWeek
      }
      if (showDayOfMonth) {
        config.dayOfMonth = dayOfMonth
      }
      if (taskPrompt.trim()) {
        config.taskPrompt = taskPrompt.trim()
      }

      const schedule = await createSchedule(chatId, config)
      trackScheduleCreated(chatId, frequency)
      onScheduleCreated?.(schedule)
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create schedule")
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
      setError(err instanceof Error ? err.message : "Failed to delete schedule")
    } finally {
      setLoading(false)
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-w-[calc(100vw-2rem)] sm:max-w-[480px] max-h-[90dvh] p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle>
            {existingSchedule ? "Edit Schedule" : "Schedule Task"}
          </DialogTitle>
        </DialogHeader>

        {loadingExisting ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground flex-1">
            Loading...
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 pt-1 space-y-4">
            {/* Task prompt */}
            <div className="space-y-2">
              <Label>Task</Label>
              <Textarea
                placeholder={chatTitle || "Describe what this task should do..."}
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {taskPrompt.trim()
                  ? "This prompt will be used each time the task runs."
                  : "Leave empty to use the original chat message as the task prompt."}
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
                  No machines found. Create a machine first from My Computers.
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
                          {m.id === defaultMachineId && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">
                              (current)
                            </span>
                          )}
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
                Make sure the machine has all necessary logins, credentials, and setup so the task can run unattended.
              </p>
            </div>

            {/* Free tier warning */}
            {showFreeTierWarning && (
              <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <WarningCircle className="size-5 shrink-0 text-amber-500 mt-0.5" weight="fill" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Free plan — machine will be deleted
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cloud machines on the free plan are automatically deleted after 2 hours of inactivity, along with all their data. Your scheduled task will fail if the machine no longer exists.{" "}
                    <a href="/billing" className="font-medium text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300">
                      Upgrade your plan
                    </a>{" "}
                    to keep machines running, or use your local computer instead.
                  </p>
                </div>
              </div>
            )}

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

            {/* Error display */}
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row px-5 py-4 shrink-0">
          {existingSchedule && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="w-full sm:w-auto sm:mr-auto"
            >
              Remove Schedule
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !machineId} className="w-full sm:w-auto">
            {loading
              ? "Saving..."
              : existingSchedule
              ? "Update Schedule"
              : "Create Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
