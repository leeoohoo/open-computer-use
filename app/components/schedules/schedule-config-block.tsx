"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import {
  Clock,
  Globe,
  CalendarDays,
  ChevronDown,
  Check,
  Terminal,
  Monitor,
  Repeat,
  MapPin,
} from "lucide-react"
import type { UserMachine } from "@/types/machines.types"

/* ─── Frequency pill data ─── */

const FREQUENCY_PILLS = [
  { value: "every_15_minutes", label: "15min", icon: "15" },
  { value: "every_30_minutes", label: "30min", icon: "30" },
  { value: "hourly", label: "Hourly", icon: "1h" },
  { value: "every_6_hours", label: "6 hours", icon: "6h" },
  { value: "every_12_hours", label: "12 hours", icon: "12h" },
  { value: "daily", label: "Daily", icon: "1d" },
  { value: "weekly", label: "Weekly", icon: "1w" },
  { value: "monthly", label: "Monthly", icon: "1M" },
  { value: "custom", label: "Cron", icon: "></>" },
] as const

/* ─── Common timezones ─── */

const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time", abbr: "ET", region: "Americas" },
  { value: "America/Chicago", label: "Central Time", abbr: "CT", region: "Americas" },
  { value: "America/Denver", label: "Mountain Time", abbr: "MT", region: "Americas" },
  { value: "America/Los_Angeles", label: "Pacific Time", abbr: "PT", region: "Americas" },
  { value: "America/Anchorage", label: "Alaska Time", abbr: "AKT", region: "Americas" },
  { value: "Pacific/Honolulu", label: "Hawaii Time", abbr: "HT", region: "Americas" },
  { value: "America/Toronto", label: "Toronto", abbr: "ET", region: "Americas" },
  { value: "America/Vancouver", label: "Vancouver", abbr: "PT", region: "Americas" },
  { value: "America/Sao_Paulo", label: "Sao Paulo", abbr: "BRT", region: "Americas" },
  { value: "America/Mexico_City", label: "Mexico City", abbr: "CST", region: "Americas" },
  { value: "Europe/London", label: "London", abbr: "GMT/BST", region: "Europe" },
  { value: "Europe/Paris", label: "Paris", abbr: "CET", region: "Europe" },
  { value: "Europe/Berlin", label: "Berlin", abbr: "CET", region: "Europe" },
  { value: "Europe/Amsterdam", label: "Amsterdam", abbr: "CET", region: "Europe" },
  { value: "Europe/Madrid", label: "Madrid", abbr: "CET", region: "Europe" },
  { value: "Europe/Rome", label: "Rome", abbr: "CET", region: "Europe" },
  { value: "Europe/Zurich", label: "Zurich", abbr: "CET", region: "Europe" },
  { value: "Europe/Stockholm", label: "Stockholm", abbr: "CET", region: "Europe" },
  { value: "Europe/Moscow", label: "Moscow", abbr: "MSK", region: "Europe" },
  { value: "Europe/Istanbul", label: "Istanbul", abbr: "TRT", region: "Europe" },
  { value: "Asia/Dubai", label: "Dubai", abbr: "GST", region: "Asia & Pacific" },
  { value: "Asia/Kolkata", label: "India (IST)", abbr: "IST", region: "Asia & Pacific" },
  { value: "Asia/Singapore", label: "Singapore", abbr: "SGT", region: "Asia & Pacific" },
  { value: "Asia/Shanghai", label: "Shanghai", abbr: "CST", region: "Asia & Pacific" },
  { value: "Asia/Tokyo", label: "Tokyo", abbr: "JST", region: "Asia & Pacific" },
  { value: "Asia/Seoul", label: "Seoul", abbr: "KST", region: "Asia & Pacific" },
  { value: "Australia/Sydney", label: "Sydney", abbr: "AEST", region: "Asia & Pacific" },
  { value: "Australia/Melbourne", label: "Melbourne", abbr: "AEST", region: "Asia & Pacific" },
  { value: "Pacific/Auckland", label: "Auckland", abbr: "NZST", region: "Asia & Pacific" },
  { value: "UTC", label: "UTC", abbr: "UTC", region: "Other" },
]

/* ─── Day selectors ─── */

const DAYS_OF_WEEK = [
  { value: 0, label: "M", full: "Monday" },
  { value: 1, label: "T", full: "Tuesday" },
  { value: 2, label: "W", full: "Wednesday" },
  { value: 3, label: "T", full: "Thursday" },
  { value: 4, label: "F", full: "Friday" },
  { value: 5, label: "S", full: "Saturday" },
  { value: 6, label: "S", full: "Sunday" },
]

/* ─── Types ─── */

export interface ScheduleConfigState {
  frequency: string
  time: string
  dayOfWeek: number
  dayOfMonth: number
  customCron: string
  timezone: string
  machineId: string
}

interface ScheduleConfigBlockProps {
  config: ScheduleConfigState
  onChange: (updates: Partial<ScheduleConfigState>) => void
  machines: UserMachine[]
  defaultMachineId?: string | null
  showStepNumbers?: boolean
}

/* ─── Timezone Combobox ─── */

function TimezoneCombobox({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (tz: string) => void
}) {
  const [open, setOpen] = useState(false)

  const selectedLabel = useMemo(() => {
    const found = COMMON_TIMEZONES.find((tz) => tz.value === value)
    if (found) return `${found.label} (${found.abbr})`
    if (value) return value
    return "Select timezone"
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group/tz flex h-11 w-full items-center justify-between rounded-xl px-4 text-sm transition-all duration-200",
            "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700",
            "hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_2px_8px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.4)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !value && "text-muted-foreground"
          )}
        >
          <span className="flex items-center gap-2.5 truncate">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <MapPin className="h-3 w-3 text-foreground/50" />
            </div>
            <span className="truncate font-medium text-foreground/90">{selectedLabel}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2 transition-transform duration-200 group-data-[state=open]/tz:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 rounded-xl border-zinc-200 dark:border-zinc-700 bg-background shadow-lg dark:shadow-[0_8px_40px_rgba(0,0,0,0.6)]" align="start">
        <Command className="bg-transparent">
          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <CommandInput placeholder="Search timezones..." className="h-10" />
          </div>
          <CommandList className="max-h-[240px]">
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {COMMON_TIMEZONES.map((tz) => (
                <CommandItem
                  key={tz.value}
                  value={`${tz.label} ${tz.value} ${tz.abbr}`}
                  onSelect={() => {
                    onValueChange(tz.value)
                    setOpen(false)
                  }}
                  className="rounded-lg mx-1 my-0.5"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{tz.label}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono tracking-wider">
                      {tz.abbr}
                    </span>
                  </div>
                  {value === tz.value && (
                    <Check className="h-3.5 w-3.5 text-foreground shrink-0" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* ─── Section Header ─── */

function SectionHeader({
  step,
  icon: Icon,
  title,
  subtitle,
  showStep = true,
}: {
  step?: number
  icon: React.ElementType
  title: string
  subtitle: string
  showStep?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
        "bg-zinc-100 dark:bg-zinc-800",
        "ring-1 ring-zinc-200 dark:ring-zinc-700"
      )}>
        <Icon className="h-3.5 w-3.5 text-foreground/60" />
        {showStep && step && (
          <div className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold ring-2 ring-background">
            {step}
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground/85">
          {title}
        </p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}

/* ─── Main Component ─── */

export function ScheduleConfigBlock({
  config,
  onChange,
  machines,
  defaultMachineId,
  showStepNumbers = true,
}: ScheduleConfigBlockProps) {
  const showTimePicker = ["daily", "weekly", "monthly"].includes(config.frequency)
  const showDayOfWeek = config.frequency === "weekly"
  const showDayOfMonth = config.frequency === "monthly"
  const showCustomCron = config.frequency === "custom"

  const selectableMachines = machines.filter(
    (m) => m.status !== "deleting" && m.status !== "error"
  )

  return (
    <div className="space-y-6">
      {/* ── Section: Schedule ── */}
      <div className="space-y-3">
        <SectionHeader
          step={1}
          icon={Repeat}
          title="Schedule"
          subtitle="How often should this employee work?"
          showStep={showStepNumbers}
        />

        {/* Glass card for frequency controls */}
        <div className={cn(
          "relative rounded-2xl overflow-hidden",
          "bg-white dark:bg-zinc-900/80",
          "border border-zinc-200 dark:border-zinc-800",
          "shadow-sm dark:shadow-none",
        )}>
          {/* Subtle top shine */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.1] to-transparent" />

          <div className="p-3.5 space-y-3.5">
            {/* Frequency pills */}
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCY_PILLS.map((pill) => {
                const isSelected = config.frequency === pill.value
                return (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => onChange({ frequency: pill.value })}
                    className={cn(
                      "relative px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-300",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? [
                          "text-foreground",
                          "bg-gradient-to-b from-foreground/20 to-foreground/10",
                          "shadow-[0_1px_2px_rgba(0,0,0,0.15)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.15)_inset,0_4px_12px_rgba(0,0,0,0.2)]",
                          "ring-1 ring-zinc-300 dark:ring-zinc-600",
                          "scale-[1.02]",
                        ]
                        : [
                          "text-muted-foreground",
                          "bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                          "border border-zinc-200/60 dark:border-zinc-700/40 hover:border-zinc-300 dark:hover:border-zinc-600",
                          "hover:text-foreground hover:scale-[1.02]",
                          "hover:shadow-sm",
                        ]
                    )}
                  >
                    {pill.label}
                  </button>
                )
              })}
            </div>

            {/* Time + Day pickers */}
            {(showTimePicker || showCustomCron) && (
              <div className="pt-1 border-t border-zinc-200 dark:border-zinc-800">
                <div
                  className={cn(
                    "grid gap-3 pt-3",
                    showDayOfWeek ? "grid-cols-1" : showDayOfMonth ? "grid-cols-2" : "grid-cols-1"
                  )}
                >
                  {showTimePicker && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                        <Clock className="h-3 w-3" />
                        Time
                      </label>
                      <div className="relative">
                        <Input
                          type="time"
                          value={config.time}
                          onChange={(e) => onChange({ time: e.target.value })}
                          className={cn(
                            "h-11 text-sm font-mono rounded-xl text-foreground",
                            "!bg-white dark:!bg-zinc-800",
                            "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                            "shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset,0_2px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_2px_4px_rgba(0,0,0,0.2)]",
                            "transition-all duration-200",
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {showDayOfWeek && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                        <CalendarDays className="h-3 w-3" />
                        Day
                      </label>
                      <div className="flex gap-1">
                        {DAYS_OF_WEEK.map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => onChange({ dayOfWeek: d.value })}
                            title={d.full}
                            className={cn(
                              "flex-1 h-11 rounded-xl text-[11px] font-bold transition-all duration-200",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              config.dayOfWeek === d.value
                                ? [
                                  "text-foreground",
                                  "bg-gradient-to-b from-foreground/20 to-foreground/10",
                                  "shadow-[0_1px_2px_rgba(0,0,0,0.15)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.15)_inset]",
                                  "ring-1 ring-zinc-300 dark:ring-zinc-600",
                                ]
                                : [
                                  "bg-zinc-50 dark:bg-zinc-800/50 text-muted-foreground",
                                  "border border-zinc-200 dark:border-zinc-700",
                                  "hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-foreground hover:border-zinc-300 dark:hover:border-zinc-600",
                                ]
                            )}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showDayOfMonth && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                        <CalendarDays className="h-3 w-3" />
                        Day of Month
                      </label>
                      <Select
                        value={String(config.dayOfMonth)}
                        onValueChange={(v) => onChange({ dayOfMonth: Number(v) })}
                      >
                        <SelectTrigger className={cn(
                          "h-11 rounded-xl text-foreground",
                          "!bg-white dark:!bg-zinc-800",
                          "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                            <SelectItem key={d} value={String(d)}>
                              {d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Custom cron */}
                {showCustomCron && (
                  <div className="space-y-2 pt-1">
                    <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                      <Terminal className="h-3 w-3" />
                      Cron Expression
                    </label>
                    <Input
                      placeholder="*/15 * * * *"
                      value={config.customCron}
                      onChange={(e) => onChange({ customCron: e.target.value })}
                      className={cn(
                        "h-11 font-mono text-sm rounded-xl text-foreground",
                        "!bg-white dark:!bg-zinc-800",
                        "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                      )}
                    />
                    <p className="text-[11px] text-muted-foreground font-mono tracking-wider">
                      minute &middot; hour &middot; day &middot; month &middot; weekday
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section: Workstation ── */}
      <div className="space-y-3">
        <SectionHeader
          step={2}
          icon={Monitor}
          title="Workstation"
          subtitle="Which computer should they use?"
          showStep={showStepNumbers}
        />

        {selectableMachines.length === 0 ? (
          <div className={cn(
            "rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 p-6 text-center",
            "bg-zinc-50 dark:bg-zinc-900/60",
          )}>
            <Monitor className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-medium">
              No workstations available
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Set up a machine from My Computers first.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {selectableMachines.map((m) => {
              const isSelected = config.machineId === m.id
              const statusColor =
                m.status === "running"
                  ? "bg-foreground"
                  : m.status === "stopped"
                  ? "bg-zinc-600"
                  : "bg-zinc-400"
              const statusGlow =
                m.status === "running"
                  ? "dark:shadow-[0_0_6px_rgba(255,255,255,0.3)]"
                  : ""

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ machineId: m.id })}
                  className={cn(
                    "group/machine relative flex items-center gap-3.5 rounded-2xl px-4 py-3 text-left transition-all duration-300",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? [
                        "bg-zinc-100 dark:bg-zinc-800/80",
                        "border border-zinc-300 dark:border-zinc-600",
                        "shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
                      ]
                      : [
                        "bg-white dark:bg-zinc-900/60",
                        "border border-zinc-200 dark:border-zinc-800",
                        "hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                        "hover:shadow-sm",
                      ]
                  )}
                >
                  {/* Machine avatar */}
                  <div className="relative">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300",
                      isSelected
                        ? "bg-gradient-to-br from-foreground/25 to-foreground/15 text-foreground shadow-md"
                        : "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground group-hover/machine:bg-zinc-200 dark:group-hover/machine:bg-zinc-700"
                    )}>
                      {m.displayName?.charAt(0)?.toUpperCase() || "M"}
                    </div>
                    <div
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[2.5px] border-background transition-all",
                        statusColor,
                        isSelected && statusGlow,
                      )}
                    />
                  </div>

                  {/* Machine info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-semibold truncate transition-colors",
                      isSelected ? "text-foreground" : "text-foreground/80 group-hover/machine:text-foreground"
                    )}>
                      {m.displayName}
                      {m.id === defaultMachineId && (
                        <span className="ml-1.5 text-[11px] font-medium text-foreground/60 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full">
                          current
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                      {m.status}
                    </p>
                  </div>

                  {/* Selection indicator */}
                  <div
                    className={cn(
                      "h-5 w-5 rounded-full transition-all duration-300 shrink-0 flex items-center justify-center",
                      isSelected
                        ? [
                          "bg-foreground",
                          "shadow-[0_1px_3px_rgba(0,0,0,0.15)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_6px_rgba(255,255,255,0.15)]",
                        ]
                        : "border-2 border-zinc-200 dark:border-zinc-700 group-hover/machine:border-zinc-300 dark:group-hover/machine:border-zinc-600"
                    )}
                  >
                    {isSelected && (
                      <Check className="h-3 w-3 text-background" strokeWidth={3} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section: Timezone ── */}
      <div className="space-y-3">
        <SectionHeader
          step={3}
          icon={Globe}
          title="Timezone"
          subtitle="Auto-detected — change if needed"
          showStep={showStepNumbers}
        />
        <TimezoneCombobox
          value={config.timezone}
          onValueChange={(tz) => onChange({ timezone: tz })}
        />
      </div>
    </div>
  )
}
