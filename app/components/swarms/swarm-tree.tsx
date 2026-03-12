"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle,
  XCircle,
  Warning,
  Terminal,
  Monitor,
  CircleNotch,
  CaretRight,
  Eye,
  Wrench,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsOutCardinal,
  ArrowCounterClockwise,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types (exported for reuse)
// ---------------------------------------------------------------------------

export interface SwarmEvent {
  id: string
  swarm_id: string
  machine_index: number | null
  event_type: string
  content: string
  screenshot: string | null
  tool_name: string | null
  created_at: string
}

export interface TimelineStep {
  machineIndex: number
  text: string
  toolCalls: Array<{ name: string; content: string }>
  toolResults: Array<{ name: string; content: string; screenshot: string | null }>
  screenshot: string | null
  status: "success" | "error" | "pending"
  timestamp: string
}

// ---------------------------------------------------------------------------
// Strip ALL internal agent tags/markers from display text
// ---------------------------------------------------------------------------

export function stripAgentTags(text: string): string {
  return text
    .replace(/<cua-section[^>]*>[\s\S]*?<\/cua-section>/g, "")
    .replace(/<cua-section[^>]*>/g, "")
    .replace(/<\/cua-section>/g, "")
    .replace(/\[TASK_PLAN_START\][\s\S]*?\[TASK_PLAN_END\]/g, "")
    .replace(/\[TASK_PLAN_START\]/g, "")
    .replace(/\[TASK_PLAN_END\]/g, "")
    .replace(/\[Coasty_REPORT_START\][\s\S]*?\[Coasty_REPORT_END\]/g, "")
    .replace(/\[Coasty_REPORT_START\]/g, "")
    .replace(/\[Coasty_REPORT_END\]/g, "")
    .replace(/<file-attachment[^>]*>[\s\S]*?<\/file-attachment>/g, "")
    .replace(/<file-attachment[^>]*\/>/g, "")
    .replace(/<file-attachment[^>]*>/g, "")
    .replace(/<\/file-attachment>/g, "")
    .replace(/```python\s+agent\.[\s\S]*?```/g, "")
    .replace(/\[NEED_USER_INPUT\]/g, "")
    .replace(/<[a-z][\w-]*[^>]*\/>/g, "")
    .trim()
}

// ---------------------------------------------------------------------------
// Build timeline steps from flat events
// ---------------------------------------------------------------------------

export function buildTimelineSteps(events: SwarmEvent[]): TimelineStep[] {
  const steps: TimelineStep[] = []
  let current: TimelineStep | null = null

  function flush() {
    if (current) {
      steps.push(current)
      current = null
    }
  }

  for (const event of events) {
    const mIdx = event.machine_index ?? 0

    if (event.event_type === "text") {
      flush()
      const cleaned = stripAgentTags(event.content)
      if (!cleaned) continue
      current = {
        machineIndex: mIdx,
        text: cleaned,
        toolCalls: [],
        toolResults: [],
        screenshot: null,
        status: "pending",
        timestamp: event.created_at,
      }
    } else if (event.event_type === "tool_call") {
      if (!current) {
        current = {
          machineIndex: mIdx,
          text: "",
          toolCalls: [],
          toolResults: [],
          screenshot: null,
          status: "pending",
          timestamp: event.created_at,
        }
      }
      current.toolCalls.push({
        name: event.tool_name || stripAgentTags(event.content),
        content: stripAgentTags(event.content),
      })
    } else if (event.event_type === "tool_result") {
      if (!current) {
        current = {
          machineIndex: mIdx,
          text: "",
          toolCalls: [],
          toolResults: [],
          screenshot: null,
          status: "pending",
          timestamp: event.created_at,
        }
      }
      current.toolResults.push({
        name: event.tool_name || "",
        content: stripAgentTags(event.content),
        screenshot: event.screenshot,
      })
      if (event.screenshot) current.screenshot = event.screenshot
    } else if (event.event_type === "step_complete") {
      if (current) current.status = "success"
      flush()
    } else if (event.event_type === "error") {
      if (current) {
        current.status = "error"
        current.text = current.text || stripAgentTags(event.content)
      } else {
        steps.push({
          machineIndex: mIdx,
          text: stripAgentTags(event.content),
          toolCalls: [],
          toolResults: [],
          screenshot: null,
          status: "error",
          timestamp: event.created_at,
        })
      }
    } else if (event.event_type === "machine_status") {
      flush()
      steps.push({
        machineIndex: mIdx,
        text: `Machine ${event.content}`,
        toolCalls: [],
        toolResults: [],
        screenshot: null,
        status:
          event.content === "completed" ? "success" : event.content === "failed" ? "error" : "pending",
        timestamp: event.created_at,
      })
    } else if (event.event_type === "swarm_meta") {
      flush()
      steps.push({
        machineIndex: 0,
        text: `Swarm ${event.content}`,
        toolCalls: [],
        toolResults: [],
        screenshot: null,
        status:
          event.content === "completed" ? "success" : event.content === "cancelled" ? "error" : "pending",
        timestamp: event.created_at,
      })
    }
  }

  flush()
  return steps
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EASE = [0.22, 1, 0.36, 1] as const
const MIN_ZOOM = 0.15
const MAX_ZOOM = 2
const ZOOM_STEP = 0.15

// ---------------------------------------------------------------------------
// SwarmTree — pan/zoom canvas with prompt root → fork → machine branches
// ---------------------------------------------------------------------------

export function SwarmTree({
  events,
  machineCount,
  prompt,
  status,
  className,
  containerClassName,
  height,
}: {
  events: SwarmEvent[]
  machineCount: number
  prompt: string
  status: string
  className?: string
  containerClassName?: string
  height?: number | string
}) {
  const machineIndices = useMemo(
    () =>
      Array.from(
        new Set(events.filter((e) => e.machine_index !== null).map((e) => e.machine_index!))
      ).sort((a, b) => a - b),
    [events]
  )

  const perMachineSteps = useMemo(() => {
    const map: Record<number, TimelineStep[]> = {}
    for (const idx of machineIndices) {
      const filtered = events.filter(
        (e) => e.machine_index === idx || e.machine_index === null
      )
      map[idx] = buildTimelineSteps(filtered).filter((s) => s.machineIndex === idx)
    }
    return map
  }, [events, machineIndices])

  const machineStatuses = useMemo(() => {
    const s: Record<number, "success" | "error" | "pending"> = {}
    for (const idx of machineIndices) {
      const statusEvents = events.filter(
        (e) => e.machine_index === idx && e.event_type === "machine_status"
      )
      const last = statusEvents[statusEvents.length - 1]
      s[idx] = last
        ? last.content === "completed"
          ? "success"
          : last.content === "failed"
            ? "error"
            : "pending"
        : "pending"
    }
    return s
  }, [events, machineIndices])

  const cols = machineIndices.length || machineCount

  // Pan/zoom state
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const panOrigin = useRef({ x: 0, y: 0 })

  // Auto-fit on mount
  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return
    const containerW = containerRef.current.clientWidth
    const contentW = Math.max(cols * 220, 300)
    const fit = Math.min(1, (containerW - 32) / contentW)
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fit))
    setZoom(clamped)
    const scaledW = contentW * clamped
    setPan({ x: Math.max(0, (containerW - scaledW) / 2), y: 0 })
  }, [cols])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top
    setZoom((prev) => {
      const dir = e.deltaY < 0 ? 1 : -1
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + dir * ZOOM_STEP))
      const ratio = next / prev
      setPan((p) => ({
        x: cursorX - ratio * (cursorX - p.x),
        y: cursorY - ratio * (cursorY - p.y),
      }))
      return next
    })
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.closest("button, a, input, [data-no-pan]")) return
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY }
    panOrigin.current = { ...pan }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [pan])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return
    setPan({
      x: panOrigin.current.x + (e.clientX - panStart.current.x),
      y: panOrigin.current.y + (e.clientY - panStart.current.y),
    })
  }, [])

  const handlePointerUp = useCallback(() => {
    isPanning.current = false
  }, [])

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
  }, [])
  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
  }, [])
  const resetView = useCallback(() => {
    if (!containerRef.current) return
    const containerW = containerRef.current.clientWidth
    const contentW = Math.max(cols * 220, 300)
    const fit = Math.min(1, (containerW - 32) / contentW)
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fit))
    setZoom(clamped)
    const scaledW = contentW * clamped
    setPan({ x: Math.max(0, (containerW - scaledW) / 2), y: 0 })
  }, [cols])

  if (machineIndices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center">
        <Terminal className="size-6 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No event logs recorded</p>
      </div>
    )
  }

  const zoomPercent = Math.round(zoom * 100)

  return (
    <div className={cn("relative h-full", className)}>
      {/* Dotted canvas background */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 0.5px, transparent 0.5px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-amber-500/[0.03] dark:bg-amber-400/[0.04] blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-blue-500/[0.03] dark:bg-blue-400/[0.04] blur-3xl" />
      </div>

      {/* Controls overlay */}
      <div className="absolute top-3 right-3 z-[10] flex items-center gap-1">
        <span className="text-[10px] tabular-nums text-muted-foreground/50 mr-1 select-none">
          {zoomPercent}%
        </span>
        <button
          onClick={zoomIn}
          className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/40 bg-background/90 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background transition-colors shadow-sm"
          title="Zoom in"
        >
          <MagnifyingGlassPlus className="size-3.5" />
        </button>
        <button
          onClick={zoomOut}
          className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/40 bg-background/90 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background transition-colors shadow-sm"
          title="Zoom out"
        >
          <MagnifyingGlassMinus className="size-3.5" />
        </button>
        <button
          onClick={resetView}
          className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/40 bg-background/90 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background transition-colors shadow-sm"
          title="Fit to view"
        >
          <ArrowCounterClockwise className="size-3.5" />
        </button>
      </div>

      {/* Hint */}
      <div className="absolute bottom-2.5 left-3 z-[10] flex items-center gap-1.5 text-[10px] text-muted-foreground/35 select-none pointer-events-none">
        <ArrowsOutCardinal className="size-3" />
        <span>Drag to pan &middot; Scroll to zoom</span>
      </div>

      {/* Pan/zoom viewport */}
      <div
        ref={containerRef}
        className={cn("relative z-[1] overflow-hidden h-full select-none", containerClassName)}
        style={{
          ...(height != null ? { height } : {}),
          cursor: isPanning.current
            ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23222' stroke='%23fff' stroke-width='.5' d='M5 5.5a1 1 0 0 1 2 0V7h1V5.5a1 1 0 1 1 2 0V7h.5a1 1 0 0 1 2 0v3.5a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 2 0v1.5h.5V5.5a1 1 0 0 1 .5-.87z'/%3E%3C/svg%3E") 8 8, grabbing`
            : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23222' stroke='%23fff' stroke-width='.5' d='M5 4a1 1 0 0 1 2 0v4a1 1 0 0 1-2 0V4zm3-.5a1 1 0 0 0-1 1V5h2V4.5a1 1 0 0 0-1-1zM10 5v.5h.5a1 1 0 0 1 2 0v3a1 1 0 0 1 0 .5v1.5a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 2 0v1.5h.5V4a1 1 0 0 1 2 0v1h.5z'/%3E%3C/svg%3E") 8 8, grab`,
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          ref={contentRef}
          className="origin-top-left will-change-transform"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: isPanning.current ? "none" : "transform 0.15s ease-out",
          }}
        >
          <div className="px-6 py-6" style={{ width: Math.max(cols * 220, 300) }}>
            {/* Root prompt node */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex justify-center mb-1"
            >
              <div className="relative max-w-md px-5 py-3 rounded-xl border border-border/40 bg-background/90 backdrop-blur-sm text-center shadow-sm">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1 font-medium">Prompt</p>
                <p className="text-sm leading-snug line-clamp-2">{prompt}</p>
              </div>
            </motion.div>

            {/* Fork connector SVG */}
            <div className="flex justify-center">
              <svg
                width={Math.max(cols * 220, 200)}
                height={52}
                viewBox={`0 0 ${Math.max(cols * 220, 200)} 52`}
                className="shrink-0"
              >
                {machineIndices.map((_, i) => {
                  const totalW = Math.max(cols * 220, 200)
                  const colW = totalW / cols
                  const startX = totalW / 2
                  const endX = colW * i + colW / 2
                  const midY = 26
                  return (
                    <motion.path
                      key={i}
                      d={`M ${startX} 0 C ${startX} ${midY}, ${endX} ${midY}, ${endX} 52`}
                      fill="none"
                      className="stroke-border/50"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: "easeOut" }}
                    />
                  )
                })}
              </svg>
            </div>

            {/* Machine branches */}
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(180px, 1fr))`,
              }}
            >
              {machineIndices.map((idx, i) => {
                const steps = perMachineSteps[idx] || []
                const mStatus = machineStatuses[idx]
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.15 + i * 0.06, ease: EASE }}
                  >
                    <MachineBranch
                      machineIndex={idx}
                      steps={steps}
                      status={mStatus}
                    />
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Machine branch — single vertical column in the tree
// ---------------------------------------------------------------------------

function MachineBranch({
  machineIndex,
  steps,
  status,
}: {
  machineIndex: number
  steps: TimelineStep[]
  status: "success" | "error" | "pending"
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "w-full rounded-xl border px-3 py-2.5 text-center transition-colors shadow-sm backdrop-blur-sm",
          status === "success"
            ? "border-emerald-500/25 bg-emerald-50/80 dark:bg-emerald-950/30"
            : status === "error"
              ? "border-red-500/25 bg-red-50/80 dark:bg-red-950/30"
              : "border-border/40 bg-background/80"
        )}
      >
        <div className="flex items-center justify-center gap-1.5">
          <Monitor className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Machine #{machineIndex + 1}</span>
          {status === "success" && <CheckCircle className="size-3 text-emerald-500" weight="fill" />}
          {status === "error" && <XCircle className="size-3 text-red-500" weight="fill" />}
          {status === "pending" && <CircleNotch className="size-3 text-blue-500 animate-spin" />}
        </div>
      </div>

      {steps.length > 0 && (
        <div className="relative w-full mt-0 pt-2">
          <div
            className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, hsl(var(--border) / 0.35) 0px, hsl(var(--border) / 0.35) 4px, transparent 4px, transparent 8px)",
            }}
          />
          <div className="relative flex flex-col gap-2 items-center">
            {steps.map((step, i) => (
              <BranchStepCard key={i} step={step} index={i} />
            ))}
          </div>
        </div>
      )}

      {steps.length === 0 && (
        <div className="mt-3 text-[11px] text-muted-foreground/50 text-center">No steps</div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Branch step card
// ---------------------------------------------------------------------------

function BranchStepCard({ step, index }: { step: TimelineStep; index: number }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const hasScreenshot = !!step.screenshot
  const hasDetails = step.toolCalls.length > 0 || step.toolResults.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className="relative w-full z-[1]"
    >
      <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-[2]">
        {hasScreenshot ? (
          <ScreenshotDotSmall src={step.screenshot!} />
        ) : (
          <span
            className={cn(
              "block size-2.5 rounded-full ring-2 ring-background",
              step.status === "success"
                ? "bg-emerald-500/70"
                : step.status === "error"
                  ? "bg-red-500/70"
                  : "bg-muted-foreground/30"
            )}
          />
        )}
      </div>

      <div
        className={cn(
          "mx-1 mt-2 rounded-lg border px-3 py-2 text-left transition-all shadow-sm",
          "border-border/30 bg-background/85 backdrop-blur-sm hover:border-border/50 hover:bg-background/95"
        )}
      >
        {step.text && (
          <p className="text-[12px] leading-relaxed text-foreground/85 line-clamp-3">{step.text}</p>
        )}

        {step.toolResults.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {step.toolResults.map((r, j) => (
              <span
                key={j}
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] leading-none px-1.5 py-0.5 rounded-full",
                  step.status === "error"
                    ? "text-red-500/80 bg-red-500/8"
                    : "text-emerald-600/80 dark:text-emerald-400/70 bg-emerald-500/8"
                )}
              >
                <StatusDot status={step.status} />
                {r.name || "Action"}
              </span>
            ))}
          </div>
        )}

        {hasScreenshot && (
          <div className="mt-2">
            <ScreenshotInline src={step.screenshot!} />
          </div>
        )}

        {hasDetails && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              className="flex items-center gap-1 py-0.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <CaretRight
                weight="bold"
                className={cn(
                  "size-2 shrink-0 transition-transform duration-150",
                  detailsOpen && "rotate-90"
                )}
              />
              <Eye className="size-2.5 shrink-0" />
              <span>Details</span>
            </button>
            <AnimatePresence initial={false}>
              {detailsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="pt-1 pb-1 space-y-1.5">
                    {step.toolCalls.map((tc, j) => (
                      <div key={`tc-${j}`} className="text-[11px]">
                        <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 font-medium">
                          <Wrench className="size-2.5" />
                          {tc.name || "Tool call"}
                        </span>
                        {tc.content && (
                          <p className="text-muted-foreground/60 mt-0.5 break-words whitespace-pre-wrap text-[10px] line-clamp-4">
                            {tc.content}
                          </p>
                        )}
                      </div>
                    ))}
                    {step.toolResults.map((tr, j) => (
                      <div key={`tr-${j}`} className="text-[11px]">
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle className="size-2.5" weight="fill" />
                          {tr.name || "Result"}
                        </span>
                        {tr.content && (
                          <p className="text-muted-foreground/60 mt-0.5 break-words whitespace-pre-wrap text-[10px] line-clamp-4">
                            {tr.content}
                          </p>
                        )}
                        {tr.screenshot && <ScreenshotInline src={tr.screenshot} />}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Screenshot components
// ---------------------------------------------------------------------------

function ScreenshotDotSmall({ src }: { src: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  return (
    <>
      <motion.div
        className="cursor-pointer z-[2]"
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
        onClick={() => setLightboxOpen(true)}
      >
        <div className="size-5 rounded-[4px] overflow-hidden ring-2 ring-background shadow-sm">
          <img src={src} alt="" className="size-full object-cover" draggable={false} />
        </div>
      </motion.div>
      <AnimatePresence>
        {lightboxOpen && <ScreenshotLightbox src={src} onClose={() => setLightboxOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

function ScreenshotLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
      onClick={onClose}
    >
      <motion.img
        src={src}
        alt="Screenshot"
        initial={{ scale: 0.92 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>,
    document.body
  )
}

function ScreenshotInline({ src }: { src: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  return (
    <>
      <motion.div
        className="mt-1.5 cursor-pointer inline-block"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setLightboxOpen(true)}
      >
        <div className="max-w-[280px] rounded-lg overflow-hidden ring-1 ring-border/30">
          <img src={src} alt="Screenshot" className="w-full object-cover" draggable={false} />
        </div>
      </motion.div>
      <AnimatePresence>
        {lightboxOpen && <ScreenshotLightbox src={src} onClose={() => setLightboxOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

function StatusDot({ status }: { status: string }) {
  if (status === "success")
    return <span className="inline-block size-1.5 rounded-full bg-emerald-500/70 shrink-0" />
  if (status === "error")
    return <span className="inline-block size-1.5 rounded-full bg-red-500/70 shrink-0" />
  return <span className="inline-block size-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
}
