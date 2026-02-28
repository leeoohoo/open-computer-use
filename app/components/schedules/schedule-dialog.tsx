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
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  FREQUENCY_OPTIONS,
  type ScheduleConfig,
  type ScheduleResponse,
} from "@/lib/services/schedules-api"
import type { UserMachine } from "@/types/machines.types"

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingSchedule, setExistingSchedule] = useState<ScheduleResponse | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)

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
          } else {
            // No existing schedule — reset to defaults
            setFrequency("daily")
            setTime("09:00")
            setDayOfWeek(1)
            setDayOfMonth(1)
            setCustomCron("")
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

      const schedule = await createSchedule(chatId, config)
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {existingSchedule ? "Edit Schedule" : "Schedule Task"}
          </DialogTitle>
        </DialogHeader>

        {loadingExisting ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Task info */}
            {chatTitle && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Task: </span>
                <span className="font-medium">{chatTitle}</span>
              </div>
            )}

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

            {/* Error display */}
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {existingSchedule && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="mr-auto"
            >
              Remove Schedule
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !machineId}>
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
