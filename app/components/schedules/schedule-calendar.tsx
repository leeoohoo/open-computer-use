"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { type ScheduleResponse } from "@/lib/services/schedules-api"
import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════════════
   Cron helpers
   ═══════════════════════════════════════════════════════════════ */

function parseCronField(field: string, max: number, min = 0): number[] {
  const vals = new Set<number>()
  for (const part of field.split(",")) {
    const step = part.match(/^(\*|\d+(?:-\d+)?)\/(\d+)$/)
    if (step) {
      const s = parseInt(step[2])
      let lo = min, hi = max
      if (step[1] !== "*") {
        const [a, b] = step[1].split("-")
        lo = parseInt(a)
        if (b !== undefined) hi = parseInt(b)
      }
      for (let i = lo; i <= hi; i += s) vals.add(i)
      continue
    }
    const range = part.match(/^(\d+)-(\d+)$/)
    if (range) {
      for (let i = parseInt(range[1]); i <= parseInt(range[2]); i++) vals.add(i)
      continue
    }
    if (part === "*") { for (let i = min; i <= max; i++) vals.add(i); continue }
    const n = parseInt(part)
    if (!isNaN(n)) vals.add(n)
  }
  return [...vals].sort((a, b) => a - b)
}

function getOccurrencesForMonth(
  schedule: ScheduleResponse,
  year: number,
  month: number
): Map<number, { times: string[]; runsPerDay: number }> {
  const result = new Map<number, { times: string[]; runsPerDay: number }>()
  const dim = new Date(year, month + 1, 0).getDate()
  if (!schedule.cron) return result

  try {
    const p = schedule.cron.trim().split(/\s+/)
    if (p.length !== 5) return result
    const [minF, hrF, domF, monF, dowF] = p

    if (monF !== "*" && !parseCronField(monF, 12, 1).includes(month + 1))
      return result

    const hrs = parseCronField(hrF, 23)
    const mins = parseCronField(minF, 59)
    const allTimes: string[] = []
    for (const h of hrs)
      for (const m of mins)
        allTimes.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)

    const rpd = allTimes.length
    const show = rpd > 6 ? allTimes.slice(0, 3) : allTimes
    const vDom = domF !== "*" ? parseCronField(domF, dim, 1) : null
    const vDow = dowF !== "*" ? parseCronField(dowF, 6, 0) : null

    for (let d = 1; d <= dim; d++) {
      const dow = new Date(year, month, d).getDay()
      let ok = false
      if (!vDom && !vDow) ok = true
      else if (vDom && vDow) ok = vDom.includes(d) || vDow.includes(dow)
      else if (vDom) ok = vDom.includes(d)
      else if (vDow) ok = vDow.includes(dow)
      if (ok) result.set(d, { times: show, runsPerDay: rpd })
    }
  } catch {
    for (let d = 1; d <= dim; d++) result.set(d, { times: [], runsPerDay: 1 })
  }
  return result
}

/* ═══════════════════════════════════════════════════════════════
   Exported helper — used by parent to build the day detail panel
   ═══════════════════════════════════════════════════════════════ */

export interface DayTask {
  schedule: ScheduleResponse
  times: string[]
  runsPerDay: number
}

export function getTasksForDate(
  schedules: ScheduleResponse[],
  date: Date
): DayTask[] {
  const y = date.getFullYear()
  const m = date.getMonth()
  return schedules.flatMap((s) => {
    const occ = getOccurrencesForMonth(s, y, m)
    const info = occ.get(date.getDate())
    return info ? [{ schedule: s, times: info.times, runsPerDay: info.runsPerDay }] : []
  })
}

/* ═══════════════════════════════════════════════════════════════
   Style helpers (monochrome)
   ═══════════════════════════════════════════════════════════════ */

function dot(s: ScheduleResponse) {
  if (s.enabled && !s.paused_reason) return "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
  if (s.paused_reason === "too_many_failures") return "bg-amber-500"
  return "bg-zinc-500 dark:bg-zinc-600"
}

function strip(s: ScheduleResponse) {
  if (s.enabled && !s.paused_reason) return "bg-emerald-500/10"
  if (s.paused_reason === "too_many_failures") return "bg-amber-500/10"
  return "bg-zinc-100/50 dark:bg-zinc-800/30"
}

/* ═══════════════════════════════════════════════════════════════
   Calendar grid component
   ═══════════════════════════════════════════════════════════════ */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

interface Props {
  schedules: ScheduleResponse[]
  selectedDate: Date
  onSelectDate: (d: Date) => void
}

export function ScheduleCalendar({ schedules, selectedDate, onSelectDate }: Props) {
  const today = new Date()
  const [month, setMonth] = useState(selectedDate.getMonth())
  const [year, setYear] = useState(selectedDate.getFullYear())

  const cells = useMemo(() => {
    const first = new Date(year, month, 1)
    const total = new Date(year, month + 1, 0).getDate()
    const prev = new Date(year, month, 0).getDate()
    let start = first.getDay() - 1
    if (start < 0) start = 6

    const maps = schedules.map((s) => ({
      s,
      occ: getOccurrencesForMonth(s, year, month),
    }))

    const out: {
      day: number
      cur: boolean
      isToday: boolean
      tasks: { schedule: ScheduleResponse }[]
    }[] = []

    for (let i = start - 1; i >= 0; i--)
      out.push({ day: prev - i, cur: false, isToday: false, tasks: [] })

    for (let d = 1; d <= total; d++) {
      out.push({
        day: d,
        cur: true,
        isToday:
          d === today.getDate() &&
          month === today.getMonth() &&
          year === today.getFullYear(),
        tasks: maps
          .filter((m) => m.occ.has(d))
          .map((m) => ({ schedule: m.s })),
      })
    }

    while (out.length < 42)
      out.push({
        day: out.length - (start + total) + 1,
        cur: false,
        isToday: false,
        tasks: [],
      })

    return out
  }, [year, month, schedules, today])

  function nav(delta: number) {
    let m = month + delta
    let y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setMonth(m)
    setYear(y)
    onSelectDate(new Date(y, m, 1))
  }

  const isThisMonth =
    month === today.getMonth() && year === today.getFullYear()

  const selDay = selectedDate.getDate()
  const selMonth = selectedDate.getMonth()
  const selYear = selectedDate.getFullYear()

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {new Date(year, month).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </h2>
          {!isThisMonth && (
            <button
              onClick={() => {
                setMonth(today.getMonth())
                setYear(today.getFullYear())
                onSelectDate(today)
              }}
              className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-foreground transition-all"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => nav(-1)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => nav(1)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground transition-all"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className={cn(
        "rounded-xl overflow-hidden",
        "bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none",
      )}>
        {/* Day headers */}
        <div className={cn(
          "grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800",
          "bg-zinc-50 dark:bg-zinc-900",
        )}>
          {DAYS.map((d) => (
            <div
              key={d}
              className="py-2.5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-widest"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            const sel =
              c.cur &&
              c.day === selDay &&
              month === selMonth &&
              year === selYear
            const lastRow = Math.floor(i / 7) === 5
            const lastCol = i % 7 === 6

            return (
              <button
                key={i}
                onClick={() => c.cur && onSelectDate(new Date(year, month, c.day))}
                disabled={!c.cur}
                className={cn(
                  "relative min-h-[80px] sm:min-h-[96px] p-1.5 sm:p-2",
                  "flex flex-col items-start text-left transition-all duration-150",
                  !lastRow && "border-b border-zinc-100 dark:border-zinc-800/60",
                  !lastCol && "border-r border-zinc-100 dark:border-zinc-800/60",
                  c.cur ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer" : "cursor-default",
                  !c.cur && "bg-zinc-50/50 dark:bg-zinc-950/30",
                  sel && "bg-zinc-100 dark:bg-zinc-800 ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 z-10",
                )}
              >
                <span
                  className={cn(
                    "leading-none",
                    !c.cur ? "text-muted-foreground/40 text-[11px]" : "text-xs text-foreground/80",
                    c.isToday && "bg-foreground text-background font-bold rounded-full w-6 h-6 flex items-center justify-center text-[11px]",
                    sel && !c.isToday && "font-bold text-foreground",
                  )}
                >
                  {c.day}
                </span>

                {/* Mobile: dots */}
                {c.tasks.length > 0 && c.cur && (
                  <div className="flex flex-wrap gap-1 mt-auto sm:hidden pt-1">
                    {c.tasks.slice(0, 3).map((t) => (
                      <div
                        key={t.schedule.chat_id}
                        className={cn("w-1.5 h-1.5 rounded-full", dot(t.schedule))}
                      />
                    ))}
                    {c.tasks.length > 3 && (
                      <span className="text-[10px] text-muted-foreground/60 leading-none">
                        +{c.tasks.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Desktop: strips */}
                {c.tasks.length > 0 && c.cur && (
                  <div className="hidden sm:flex flex-col gap-0.5 mt-auto w-full pt-1">
                    {c.tasks.slice(0, 2).map((t) => (
                      <div
                        key={t.schedule.chat_id}
                        className={cn(
                          "flex items-center gap-1 rounded-sm pl-1 pr-1 py-0.5",
                          strip(t.schedule),
                        )}
                      >
                        <div className={cn("w-1 h-1 rounded-full shrink-0", dot(t.schedule))} />
                        <span className="text-[11px] leading-tight truncate text-foreground/60 font-medium">
                          {t.schedule.title || "Untitled"}
                        </span>
                      </div>
                    ))}
                    {c.tasks.length > 2 && (
                      <span className="text-[11px] text-muted-foreground/60 pl-1">
                        +{c.tasks.length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(52,211,153,0.4)]" />
          <span>On Duty</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-zinc-500 dark:bg-zinc-600" />
          <span>Standby</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Needs Attention</span>
        </div>
      </div>
    </div>
  )
}
