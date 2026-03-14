"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CircleNotch, GitFork, Robot, Stop, CheckCircle, XCircle, Warning, DownloadSimple } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Markdown } from "@/components/prompt-kit/markdown"
import { SwarmTree, stripAgentTags, type SwarmEvent } from "@/app/components/swarms/swarm-tree"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SwarmMachine {
  machine_id: string
  machine_index: number
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  lastText?: string
  stepCount: number
}

interface SwarmChunk {
  type: string
  swarm_id?: string
  machine_id?: string
  machine_index?: number
  status?: string
  machine_count?: number
  machines?: Array<{ machine_id: string; index: number }>
  error?: string
  content?: string
  machine_statuses?: Record<string, string>
  tool_name?: string
  toolName?: string
  screenshot?: string
  frontendScreenshot?: string
  summary?: string
  subtasks?: Array<{ machine_index: number; machine_id: string; subtask: string }>
  args?: Record<string, any>
  result?: any
  [key: string]: any
}

interface SwarmPanelProps {
  isActive: boolean
  swarmId: string | null
  prompt: string
  machineCount?: number
  onStop: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SwarmPanel({ isActive, swarmId, prompt, machineCount, onStop }: SwarmPanelProps) {
  const [machines, setMachines] = useState<SwarmMachine[]>([])
  const [overallStatus, setOverallStatus] = useState<"idle" | "creating" | "planning" | "running" | "aggregating" | "completed" | "cancelled" | "failed">("idle")
  const [error, setError] = useState<string | null>(null)
  const [swarmEvents, setSwarmEvents] = useState<SwarmEvent[]>([])
  const [subtasks, setSubtasks] = useState<Array<{ machine_index: number; subtask: string }>>([])
  const [swarmSummary, setSwarmSummary] = useState<string | null>(null)
  const eventSourceRef = useRef<ReadableStreamDefaultReader | null>(null)
  const eventIdCounter = useRef(0)

  // Ref to always call the latest handleChunk from the long-running stream loop
  const handleChunkRef = useRef<(code: string, chunk: SwarmChunk) => void>(() => {})

  // Capture props in refs so the stream loop always reads the latest values
  // without needing to be in the useEffect dependency array.
  const promptRef = useRef(prompt)
  promptRef.current = prompt
  const machineCountRef = useRef(machineCount)
  machineCountRef.current = machineCount

  // Convert SSE chunk to SwarmEvent and accumulate
  const appendSwarmEvent = useCallback((eventType: string, chunk: SwarmChunk) => {
    // Map CUA chunk fields properly — CUAExecutor uses camelCase (toolName, frontendScreenshot)
    // while SwarmEvent uses snake_case (tool_name, screenshot)
    let content = chunk.content || chunk.status || chunk.error || ""
    let toolName = chunk.toolName || chunk.tool_name || null
    let screenshot = chunk.frontendScreenshot || chunk.screenshot || null

    // For tool_call, include tool name and args in content
    if (eventType === "tool_call") {
      const name = toolName || "action"
      const args = chunk.args ? JSON.stringify(chunk.args) : ""
      content = args ? `${name}: ${args}` : name
    }

    // For tool_result, include result in content
    if (eventType === "tool_result") {
      const result = chunk.result
      if (result && !content) {
        content = typeof result === "string" ? result : JSON.stringify(result)
      }
    }

    const event: SwarmEvent = {
      id: `sse-${eventIdCounter.current++}`,
      swarm_id: chunk.swarm_id || swarmId || "",
      machine_index: chunk.machine_index ?? null,
      event_type: eventType,
      content: content.slice(0, 5000),
      screenshot: screenshot || null,
      tool_name: toolName || null,
      created_at: new Date().toISOString(),
    }
    setSwarmEvents((prev) => [...prev, event])
  }, [swarmId])

  const handleChunk = useCallback((code: string, chunk: SwarmChunk) => {
    const type = chunk.type

    if (type === "swarm_meta") {
      if (chunk.status === "starting" && chunk.machines) {
        setOverallStatus("running")
        setMachines(
          chunk.machines.map((m) => ({
            machine_id: m.machine_id,
            machine_index: m.index,
            status: "pending",
            stepCount: 0,
          }))
        )
      } else if (chunk.status === "aggregating") {
        setOverallStatus("aggregating")
        appendSwarmEvent("swarm_meta", { ...chunk, content: "Aggregating results..." })
      } else if (chunk.status === "completed") {
        setOverallStatus("completed")
        appendSwarmEvent("swarm_meta", chunk)
        if (chunk.machine_statuses) {
          setMachines((prev) =>
            prev.map((m) => ({
              ...m,
              status: (chunk.machine_statuses?.[m.machine_id] as any) || m.status,
            }))
          )
        }
      } else if (chunk.status === "cancelled") {
        setOverallStatus("cancelled")
        appendSwarmEvent("swarm_meta", chunk)
      }
    } else if (type === "swarm_planning") {
      if (chunk.status === "decomposing") {
        setOverallStatus("planning")
      } else if (chunk.status === "planned" && chunk.subtasks) {
        setOverallStatus("running")
        setSubtasks(chunk.subtasks.map((s) => ({
          machine_index: s.machine_index,
          subtask: s.subtask,
        })))
        appendSwarmEvent("swarm_planning", {
          ...chunk,
          content: chunk.subtasks.map((s) => `Machine ${s.machine_index}: ${s.subtask}`).join("\n"),
        })
      }
    } else if (type === "swarm_summary") {
      setSwarmSummary(chunk.summary || null)
      appendSwarmEvent("swarm_summary", { ...chunk, content: chunk.summary || "" })
    } else if (type === "swarm_machine_status") {
      const mid = chunk.machine_id
      const status = chunk.status
      if (mid && status) {
        setMachines((prev) =>
          prev.map((m) =>
            m.machine_id === mid ? { ...m, status: status as any } : m
          )
        )
        appendSwarmEvent("machine_status", chunk)
      }
    } else if (type === "text" && chunk.machine_index !== undefined) {
      const cleaned = stripAgentTags(chunk.content || "").slice(0, 120)
      if (cleaned) {
        setMachines((prev) =>
          prev.map((m) =>
            m.machine_index === chunk.machine_index
              ? { ...m, lastText: cleaned }
              : m
          )
        )
      }
      appendSwarmEvent("text", chunk)
    } else if (type === "tool_call" && chunk.machine_index !== undefined) {
      appendSwarmEvent("tool_call", chunk)
    } else if (type === "tool_result" && chunk.machine_index !== undefined) {
      appendSwarmEvent("tool_result", chunk)
    } else if (type === "step_complete" && chunk.machine_id) {
      setMachines((prev) =>
        prev.map((m) =>
          m.machine_id === chunk.machine_id
            ? { ...m, stepCount: (chunk.step || m.stepCount) + 1 }
            : m
        )
      )
      appendSwarmEvent("step_complete", chunk)
    } else if (type === "error") {
      if (chunk.machine_id) {
        setMachines((prev) =>
          prev.map((m) =>
            m.machine_id === chunk.machine_id
              ? { ...m, status: "failed", lastText: chunk.error || "Error" }
              : m
          )
        )
      } else {
        setError(chunk.error || "Unknown error")
      }
      appendSwarmEvent("error", chunk)
    }
  }, [appendSwarmEvent])

  // Keep the ref in sync so the long-running stream loop always calls the latest version
  handleChunkRef.current = handleChunk

  // Launch the swarm stream ONCE when isActive+swarmId become truthy.
  // We inline the fetch here instead of depending on a useCallback, because
  // putting the callback in the dep array caused re-fires whenever prompt or
  // machineCount changed reference — leading to duplicate POST /api/swarm calls
  // that created two full sets of EC2 machines.
  useEffect(() => {
    if (!isActive || !swarmId) return

    const abortController = new AbortController()
    let cancelled = false

    ;(async () => {
      setOverallStatus("creating")
      setError(null)
      setMachines([])
      setSwarmEvents([])
      eventIdCounter.current = 0

      try {
        const res = await fetch("/api/swarm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptRef.current,
            machineCount: machineCountRef.current,
          }),
          signal: abortController.signal,
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Swarm request failed" }))
          if (!cancelled) {
            setError(errData.error || `HTTP ${res.status}`)
            setOverallStatus("failed")
          }
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          if (!cancelled) {
            setError("No response stream")
            setOverallStatus("failed")
          }
          return
        }

        eventSourceRef.current = reader
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (!line.trim()) continue
            const colonIdx = line.indexOf(":")
            if (colonIdx < 0) continue

            const code = line.substring(0, colonIdx)
            const dataStr = line.substring(colonIdx + 1)

            try {
              const chunk: SwarmChunk = JSON.parse(dataStr)
              handleChunkRef.current(code, chunk)
            } catch {
              // skip non-JSON
            }
          }
        }

        // Stream ended
        if (!cancelled) {
          setOverallStatus((prev) => (prev === "running" ? "completed" : prev))
        }
      } catch (e: any) {
        if (e.name !== "AbortError" && !cancelled) {
          setError(e.message || "Stream error")
          setOverallStatus("failed")
        }
      }
    })()

    return () => {
      cancelled = true
      abortController.abort()
      if (eventSourceRef.current) {
        eventSourceRef.current.cancel().catch(() => {})
        eventSourceRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, swarmId])

  const handleStop = useCallback(async () => {
    if (swarmId) {
      try {
        await fetch(`/api/swarm/${swarmId}/stop`, { method: "POST" })
      } catch {
        // best-effort
      }
    }
    onStop()
  }, [swarmId, onStop])

  const completed = machines.filter((m) => m.status === "completed").length
  const running = machines.filter((m) => m.status === "running").length
  const failed = machines.filter((m) => m.status === "failed").length
  const total = machines.length
  const isDone = overallStatus === "completed" || overallStatus === "cancelled" || overallStatus === "failed"

  // Show tree graph once we have events with machine data
  const hasTreeEvents = swarmEvents.some(
    (e) => (e.machine_index !== null && ["text", "tool_call", "tool_result", "step_complete"].includes(e.event_type))
      || ["swarm_planning", "swarm_summary"].includes(e.event_type)
  )

  const isWaiting = !hasTreeEvents && (overallStatus === "creating" || overallStatus === "planning" || overallStatus === "idle")

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {/* Header bar */}
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-7 rounded-lg bg-amber-500/10 dark:bg-amber-500/15">
            <GitFork className="size-4 text-amber-500" weight="duotone" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">Swarm Mode</span>
              <StatusBadge status={overallStatus} />
            </div>
            {total > 0 && (
              <span className="text-[11px] text-muted-foreground/70 leading-none mt-0.5">
                {isDone
                  ? `${completed} of ${total} machines completed${failed > 0 ? ` \u00b7 ${failed} failed` : ""}`
                  : running > 0
                    ? `${running} of ${total} machines running`
                    : `${total} machines allocated`
                }
              </span>
            )}
          </div>
        </div>
        {(overallStatus === "running" || overallStatus === "creating" || overallStatus === "planning") && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleStop}
            className="h-8 px-3 text-xs gap-1.5 text-red-600 border-red-200/60 hover:text-red-700 hover:bg-red-50 hover:border-red-300/60 dark:text-red-400 dark:border-red-800/40 dark:hover:bg-red-950/30 dark:hover:border-red-700/50 transition-colors"
          >
            <Stop className="size-3.5" weight="fill" />
            Stop
          </Button>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-border/50 bg-background/50 backdrop-blur-sm mx-1 sm:mx-2 mb-1 overflow-hidden">
        {/* Error banner */}
        {error && (
          <div className="shrink-0 px-4 py-2.5 bg-red-50/80 dark:bg-red-950/25 border-b border-red-200/40 dark:border-red-800/30">
            <div className="flex items-center gap-2">
              <XCircle className="size-3.5 text-red-500 shrink-0" weight="fill" />
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Waiting states — centered in the card */}
        {isWaiting && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
            {/* Prompt echo */}
            {prompt && (
              <div className="max-w-md px-5 py-3 rounded-xl border border-border/40 bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground/60 uppercase tracking-wider font-medium mb-1">Task</p>
                <p className="text-sm text-foreground/80 line-clamp-3 leading-relaxed">{prompt}</p>
              </div>
            )}

            {/* Spinner + status text */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <CircleNotch className={cn(
                  "size-8 animate-spin",
                  overallStatus === "planning" ? "text-amber-500/70" : "text-muted-foreground/40"
                )} />
                <div className={cn(
                  "absolute inset-0 rounded-full blur-xl",
                  overallStatus === "planning" ? "bg-amber-500/10" : "bg-muted-foreground/5"
                )} />
              </div>
              <span className="text-sm text-muted-foreground">
                {overallStatus === "planning"
                  ? "Decomposing task into subtasks\u2026"
                  : overallStatus === "creating"
                    ? "Creating temporary machines\u2026"
                    : "Initializing\u2026"
                }
              </span>
            </div>

            {/* Subtask assignments — shown during/after planning */}
            {subtasks.length > 0 && (
              <div className="w-full max-w-md space-y-1.5 px-4">
                <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest text-center">
                  Subtask Assignments
                </p>
                {subtasks.map((s) => (
                  <div
                    key={s.machine_index}
                    className="flex items-start gap-2 rounded-lg border border-border/30 bg-background/60 px-3 py-2"
                  >
                    <span className="shrink-0 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5 mt-px">
                      #{s.machine_index + 1}
                    </span>
                    <span className="text-xs text-foreground/70 leading-relaxed">{s.subtask}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Aggregating state */}
        {overallStatus === "aggregating" && !hasTreeEvents && (
          <div className="flex-1 flex items-center justify-center gap-3 py-12">
            <CircleNotch className="size-6 animate-spin text-purple-500/70" />
            <span className="text-sm text-muted-foreground">
              Aggregating results from all machines\u2026
            </span>
          </div>
        )}

        {/* Machine list fallback — before events arrive, when running */}
        {machines.length > 0 && !hasTreeEvents && !isWaiting && overallStatus !== "aggregating" && (
          <div className="shrink-0 divide-y divide-border/20">
            {machines.map((m) => (
              <MachineRow key={m.machine_id} machine={m} />
            ))}
          </div>
        )}

        {/* Tree graph — fills the remaining space once events start */}
        {hasTreeEvents && (
          <div className="flex-1 min-h-0">
            <SwarmTree
              events={swarmEvents}
              machineCount={machineCount || total}
              prompt={prompt}
              status={overallStatus}
              className="h-full"
              containerClassName="rounded-b-xl"
            />
          </div>
        )}

        {/* Aggregating overlay — shown on top of tree when aggregating */}
        {overallStatus === "aggregating" && hasTreeEvents && (
          <div className="shrink-0 flex items-center justify-center gap-2.5 px-4 py-3 border-t border-purple-500/15 bg-purple-50/40 dark:bg-purple-950/15">
            <CircleNotch className="size-4 animate-spin text-purple-500" />
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
              Aggregating results\u2026
            </span>
          </div>
        )}

        {/* Aggregated summary */}
        {swarmSummary && (
          <SwarmSummaryBlock summary={swarmSummary} />
        )}

        {/* Completion footer */}
        {(overallStatus === "completed" || overallStatus === "cancelled") && !swarmSummary && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-t border-border/30 bg-muted/20">
            {overallStatus === "completed" ? (
              <CheckCircle className="size-3.5 text-emerald-500 shrink-0" weight="fill" />
            ) : (
              <Warning className="size-3.5 text-amber-500 shrink-0" weight="fill" />
            )}
            <p className="text-xs text-muted-foreground">
              {overallStatus === "completed"
                ? `Swarm finished \u2014 ${completed} completed${failed > 0 ? `, ${failed} failed` : ""}`
                : "Swarm cancelled. All temporary machines deleted."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Swarm summary block — markdown + download
// ---------------------------------------------------------------------------

function SwarmSummaryBlock({ summary }: { summary: string }) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([summary], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `swarm-summary-${new Date().toISOString().slice(0, 10)}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [summary])

  return (
    <div className="shrink-0 border-t border-purple-200/25 dark:border-purple-800/25 bg-purple-50/40 dark:bg-purple-950/15">
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-widest">
          Summary
        </p>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-500/70 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          title="Download as markdown"
        >
          <DownloadSimple className="size-3" />
          .md
        </button>
      </div>
      <div className="px-4 pb-3">
        <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0.5 [&_blockquote]:my-1.5 [&_blockquote]:border-amber-500/40 [&_blockquote]:text-amber-700 [&_blockquote]:dark:text-amber-400 [&_blockquote]:bg-amber-50/50 [&_blockquote]:dark:bg-amber-950/20 [&_blockquote]:rounded-md [&_blockquote]:px-3 [&_blockquote]:py-1.5 [&_code]:text-[11px] [&_code]:bg-purple-100/50 [&_code]:dark:bg-purple-900/30 [&_strong]:text-foreground">
          <Markdown>{summary}</Markdown>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MachineRow({ machine }: { machine: SwarmMachine }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex-shrink-0">
        <MachineStatusIcon status={machine.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            Machine #{machine.machine_index + 1}
          </span>
          {machine.stepCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {machine.stepCount} steps
            </span>
          )}
        </div>
        {machine.lastText && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {machine.lastText}
          </p>
        )}
      </div>
      <MachineStatusBadge status={machine.status} />
    </div>
  )
}

function MachineStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running":
      return <CircleNotch className="size-4 animate-spin text-blue-500" />
    case "completed":
      return <CheckCircle className="size-4 text-green-500" weight="fill" />
    case "failed":
      return <XCircle className="size-4 text-red-500" weight="fill" />
    case "cancelled":
      return <Warning className="size-4 text-amber-500" weight="fill" />
    default:
      return <Robot className="size-4 text-muted-foreground" />
  }
}

function MachineStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { className: string; label: string }> = {
    pending: { className: "bg-muted text-muted-foreground", label: "Pending" },
    running: { className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Running" },
    completed: { className: "bg-green-500/10 text-green-700 dark:text-green-400", label: "Done" },
    failed: { className: "bg-red-500/10 text-red-600 dark:text-red-400", label: "Failed" },
    cancelled: { className: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "Cancelled" },
  }
  const v = variants[status] || variants.pending
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", v.className)}>
      {v.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { className: string; label: string }> = {
    idle: { className: "bg-muted text-muted-foreground", label: "Idle" },
    creating: { className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", label: "Creating" },
    planning: { className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", label: "Planning" },
    running: { className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", label: "Running" },
    aggregating: { className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", label: "Aggregating" },
    completed: { className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20", label: "Completed" },
    cancelled: { className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", label: "Cancelled" },
    failed: { className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", label: "Failed" },
  }
  const v = map[status] || map.idle
  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 border", v.className)}>
      {(status === "creating" || status === "running" || status === "planning" || status === "aggregating") && (
        <CircleNotch className="size-3 animate-spin mr-1" />
      )}
      {v.label}
    </Badge>
  )
}
