"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { type ScheduleResponse } from "@/lib/services/schedules-api"

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
   Style helpers
   ═══════════════════════════════════════════════════════════════ */

function dot(s: ScheduleResponse) {
  if (s.enabled && !s.paused_reason) return "bg-green-500"
  if (s.paused_reason === "too_many_failures") return "bg-red-500"
  return "bg-yellow-500"
}

function strip(s: ScheduleResponse) {
  if (s.enabled && !s.paused_reason) return "bg-green-500/10"
  if (s.paused_reason === "too_many_failures") return "bg-red-500/10"
  return "bg-yellow-500/10"
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
          <h2 className="text-lg font-semibold tracking-tight">
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
              className="text-[11px] px-2 py-0.5 rounded-md bg-foreground/5 hover:bg-foreground/10 text-muted-foreground transition-colors"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => nav(-1)}
            className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => nav(1)}
            className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-foreground/[0.015]">
          {DAYS.map((d) => (
            <div
              key={d}
              className="py-2.5 text-center text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest"
            >
              {d}
            </div>
          ))}
        </div>

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
                className={`
                  relative min-h-[80px] sm:min-h-[96px] p-1.5 sm:p-2
                  flex flex-col items-start text-left transition-all duration-150
                  ${!lastRow ? "border-b border-border/30" : ""}
                  ${!lastCol ? "border-r border-border/30" : ""}
                  ${c.cur ? "hover:bg-foreground/[0.04] cursor-pointer" : "cursor-default"}
                  ${!c.cur ? "bg-foreground/[0.01]" : ""}
                  ${sel ? "bg-foreground/[0.07] ring-1 ring-inset ring-foreground/15 z-10" : ""}
                `}
              >
                <span
                  className={`
                    leading-none
                    ${!c.cur ? "text-muted-foreground/20 text-[11px]" : "text-xs"}
                    ${c.isToday
                      ? "bg-foreground text-background font-bold rounded-full w-6 h-6 flex items-center justify-center text-[11px]"
                      : ""}
                    ${sel && !c.isToday ? "font-bold text-foreground" : ""}
                  `}
                >
                  {c.day}
                </span>

                {/* Mobile: dots */}
                {c.tasks.length > 0 && c.cur && (
                  <div className="flex flex-wrap gap-1 mt-auto sm:hidden pt-1">
                    {c.tasks.slice(0, 3).map((t) => (
                      <div
                        key={t.schedule.chat_id}
                        className={`w-1.5 h-1.5 rounded-full ${dot(t.schedule)}`}
                      />
                    ))}
                    {c.tasks.length > 3 && (
                      <span className="text-[8px] text-muted-foreground/40 leading-none">
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
                        className={`flex items-center gap-1 rounded-sm pl-1 pr-1 py-0.5 ${strip(t.schedule)}`}
                      >
                        <div className={`w-1 h-1 rounded-full shrink-0 ${dot(t.schedule)}`} />
                        <span className="text-[10px] leading-tight truncate text-foreground/70 font-medium">
                          {t.schedule.title || "Untitled"}
                        </span>
                      </div>
                    ))}
                    {c.tasks.length > 2 && (
                      <span className="text-[10px] text-muted-foreground/50 pl-1">
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
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground/70">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>Paused</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Failed</span>
        </div>
      </div>
    </div>
  )
}
