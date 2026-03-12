"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { GitFork, CircleNotch, ArrowRight } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { SwarmTree, type SwarmEvent } from "@/app/components/swarms/swarm-tree"
import Link from "next/link"

interface ActiveSwarm {
  swarm_id: string
  prompt: string
  machine_count: number
  status: string
  model: string | null
  created_at: string
}

export function ActiveSwarmBanner() {
  const [swarm, setSwarm] = useState<ActiveSwarm | null>(null)
  const [events, setEvents] = useState<SwarmEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Check for running swarms on mount
  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch("/api/swarms")
      if (!res.ok) return
      const data = await res.json()
      const runs = data.swarms || []
      const active = runs.find(
        (s: any) => s.status === "running" || s.status === "creating"
      )
      if (active) {
        setSwarm(active)
        // Fetch events for the active swarm
        const evRes = await fetch(`/api/swarms/${active.swarm_id}`)
        if (evRes.ok) {
          const evData = await evRes.json()
          setEvents(evData.events || [])
        }
      } else {
        setSwarm(null)
        setEvents([])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActive()
  }, [fetchActive])

  // Poll every 5s while active
  useEffect(() => {
    if (!swarm) return
    const interval = setInterval(async () => {
      try {
        // Re-check status
        const res = await fetch("/api/swarms")
        if (!res.ok) return
        const data = await res.json()
        const runs = data.swarms || []
        const active = runs.find(
          (s: any) => s.status === "running" || s.status === "creating"
        )
        if (active) {
          setSwarm(active)
          const evRes = await fetch(`/api/swarms/${active.swarm_id}`)
          if (evRes.ok) {
            const evData = await evRes.json()
            setEvents(evData.events || [])
          }
        } else {
          setSwarm(null)
          setEvents([])
        }
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [swarm])

  if (loading || !swarm) return null

  const hasTreeEvents = events.some(
    (e) => e.machine_index !== null && ["text", "tool_call", "tool_result", "step_complete"].includes(e.event_type)
  )

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-3xl mx-auto mb-6"
      >
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-2">
              <GitFork className="size-4 text-amber-500" weight="duotone" />
              <span className="text-sm font-medium">Swarm Running</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-blue-500" />
                </span>
                Live
              </span>
            </div>
            <Link
              href="/swarms"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>

          {/* Prompt */}
          <div className="px-4 py-2 border-b border-border/20">
            <p className="text-xs text-muted-foreground truncate">
              {swarm.prompt}
            </p>
          </div>

          {/* Tree or loading */}
          {hasTreeEvents ? (
            <SwarmTree
              events={events}
              machineCount={swarm.machine_count}
              prompt={swarm.prompt}
              status={swarm.status}
              className="rounded-b-2xl"
              containerClassName="rounded-b-2xl"
              height={Math.min(350, Math.max(220, swarm.machine_count * 50 + 150))}
            />
          ) : (
            <div className="flex items-center gap-2 px-4 py-6 justify-center">
              <CircleNotch className="size-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {swarm.status === "creating"
                  ? "Creating temporary machines..."
                  : `Running on ${swarm.machine_count} machine${swarm.machine_count !== 1 ? "s" : ""}...`}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
