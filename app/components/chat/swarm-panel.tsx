"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CircleNotch, GitFork, Robot, Stop, CheckCircle, XCircle, Warning } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
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
  screenshot?: string
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
  const [overallStatus, setOverallStatus] = useState<"idle" | "creating" | "running" | "completed" | "cancelled" | "failed">("idle")
  const [error, setError] = useState<string | null>(null)
  const [swarmEvents, setSwarmEvents] = useState<SwarmEvent[]>([])
  const eventSourceRef = useRef<ReadableStreamDefaultReader | null>(null)
  const eventIdCounter = useRef(0)

  // Start listening to the swarm SSE stream
  const startListening = useCallback(async () => {
    if (!swarmId || !isActive) return

    setOverallStatus("creating")
    setError(null)
    setMachines([])
    setSwarmEvents([])
    eventIdCounter.current = 0

    try {
      const res = await fetch("/api/swarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, machineCount }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Swarm request failed" }))
        setError(errData.error || `HTTP ${res.status}`)
        setOverallStatus("failed")
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setError("No response stream")
        setOverallStatus("failed")
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
            handleChunk(code, chunk)
          } catch {
            // skip non-JSON
          }
        }
      }

      // Stream ended
      setOverallStatus((prev) => (prev === "running" ? "completed" : prev))
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(e.message || "Stream error")
        setOverallStatus("failed")
      }
    }
  }, [swarmId, isActive, prompt, machineCount])

  // Convert SSE chunk to SwarmEvent and accumulate
  const appendSwarmEvent = useCallback((eventType: string, chunk: SwarmChunk) => {
    const event: SwarmEvent = {
      id: `sse-${eventIdCounter.current++}`,
      swarm_id: chunk.swarm_id || swarmId || "",
      machine_index: chunk.machine_index ?? null,
      event_type: eventType,
      content: chunk.content || chunk.status || chunk.error || "",
      screenshot: chunk.screenshot || null,
      tool_name: chunk.tool_name || null,
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

  useEffect(() => {
    if (isActive && swarmId) {
      startListening()
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.cancel()
        eventSourceRef.current = null
      }
    }
  }, [isActive, swarmId, startListening])

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

  if (!isActive && overallStatus === "idle") return null

  const completed = machines.filter((m) => m.status === "completed").length
  const failed = machines.filter((m) => m.status === "failed").length
  const total = machines.length

  // Show tree graph once we have events with machine data
  const hasTreeEvents = swarmEvents.some(
    (e) => e.machine_index !== null && ["text", "tool_call", "tool_result", "step_complete"].includes(e.event_type)
  )

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="w-full max-w-3xl mx-auto mb-4"
      >
        <div className="rounded-2xl border border-border/60 bg-background overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <GitFork className="size-4 text-amber-500" weight="duotone" />
              <span className="text-sm font-medium">Swarm Mode</span>
              <StatusBadge status={overallStatus} />
              {total > 0 && (
                <span className="text-xs text-muted-foreground">
                  {completed}/{total} machines
                </span>
              )}
            </div>
            {(overallStatus === "running" || overallStatus === "creating") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStop}
                className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Stop className="size-3.5 mr-1" weight="fill" />
                Stop All
              </Button>
            )}
          </div>

          {/* Prompt preview */}
          {prompt && !hasTreeEvents && (
            <div className="px-4 py-2 border-b border-border/30">
              <p className="text-xs text-muted-foreground truncate">
                {prompt}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-200/50 dark:border-red-800/30">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Creating state */}
          {overallStatus === "creating" && machines.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-6 justify-center">
              <CircleNotch className="size-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Creating temporary machines...
              </span>
            </div>
          )}

          {/* Tree graph — shown once events start arriving */}
          {hasTreeEvents ? (
            <SwarmTree
              events={swarmEvents}
              machineCount={machineCount || total}
              prompt={prompt}
              status={overallStatus}
              className="rounded-b-2xl"
              containerClassName="rounded-b-2xl"
              height={Math.min(450, Math.max(280, (machineCount || total) * 60 + 180))}
            />
          ) : (
            <>
              {/* Machine list fallback — before events arrive */}
              {machines.length > 0 && !hasTreeEvents && (
                <div className="divide-y divide-border/30">
                  {machines.map((m) => (
                    <MachineRow key={m.machine_id} machine={m} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Summary footer */}
          {(overallStatus === "completed" || overallStatus === "cancelled") && !hasTreeEvents && (
            <div className="px-4 py-2.5 bg-muted/30 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                {overallStatus === "completed"
                  ? `Swarm finished: ${completed} completed, ${failed} failed`
                  : "Swarm cancelled. All temporary machines deleted."}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
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
    running: { className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", label: "Running" },
    completed: { className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20", label: "Completed" },
    cancelled: { className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", label: "Cancelled" },
    failed: { className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", label: "Failed" },
  }
  const v = map[status] || map.idle
  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 border", v.className)}>
      {(status === "creating" || status === "running") && (
        <CircleNotch className="size-3 animate-spin mr-1" />
      )}
      {v.label}
    </Badge>
  )
}
