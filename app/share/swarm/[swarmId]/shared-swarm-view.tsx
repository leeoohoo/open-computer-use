"use client"

import Link from "next/link"
import {
  GitFork,
  CheckCircle,
  XCircle,
  Warning,
  Monitor,
  CircleNotch,
  Terminal,
  Clock,
  ArrowRight,
} from "@phosphor-icons/react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { CoastyIcon } from "@/components/icons/coasty"
import { Button } from "@/components/ui/button"
import { SwarmTree, type SwarmEvent } from "@/app/components/swarms/swarm-tree"

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

const EASE = [0.22, 1, 0.36, 1] as const

interface SharedSwarm {
  swarm_id: string
  prompt: string
  machine_count: number
  status: string
  model: string | null
  result_summary: string | null
  created_at: string
  completed_at: string | null
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export function SharedSwarmView({
  swarm,
  events,
}: {
  swarm: SharedSwarm
  events: SwarmEvent[]
}) {
  const createdAt = new Date(swarm.created_at)
  const duration = swarm.completed_at
    ? formatDuration(new Date(swarm.completed_at).getTime() - createdAt.getTime())
    : null

  const statusMeta = STATUS_META[swarm.status] || STATUS_META.creating

  return (
    <div className="relative flex min-h-dvh lg:h-dvh w-full flex-col bg-background">
      {/* Ambient gradient mesh background — matching auth page */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-[40%] -left-[20%] h-[80%] w-[60%] rounded-full opacity-[0.03] dark:opacity-[0.06] blur-[100px]"
          style={{ background: "radial-gradient(circle, currentColor, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-[30%] -right-[10%] h-[70%] w-[50%] rounded-full opacity-[0.025] dark:opacity-[0.05] blur-[100px]"
          style={{ background: "radial-gradient(circle, currentColor, transparent 70%)" }}
        />
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(128,128,128,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.3) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <header className="relative z-20 p-3 sm:p-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
        >
          <CoastyIcon className="size-5 sm:size-6" />
          <span className="text-sm font-semibold tracking-tight">Coasty</span>
        </Link>
      </header>

      <main className="relative flex flex-1 flex-col lg:flex-row items-stretch z-10 lg:overflow-hidden">
        {/* ───── Left brand panel ───── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex flex-col items-start px-4 sm:px-8 lg:px-16 xl:px-24 py-6 sm:py-8 lg:py-0 lg:justify-center lg:flex-1 lg:max-w-2xl min-w-0 lg:overflow-y-auto shrink-0"
        >
          <div className="mb-4 lg:mb-8 hidden lg:block">
            <CoastyIcon className="size-10" />
          </div>

          {/* Status pill */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15, ease: EASE }}
            className="mb-3 sm:mb-5"
          >
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full",
                statusMeta.color
              )}
            >
              {statusMeta.icon}
              {statusMeta.label}
            </span>
          </motion.div>

          {/* Prompt as headline — scale down for long prompts, scrollable */}
          {swarm.prompt.length > 150 ? (
            <div className="w-full max-h-[25vh] sm:max-h-[30vh] lg:max-h-[35vh] overflow-y-auto rounded-xl border border-border/40 bg-card/20 px-3 py-2.5 sm:px-4 sm:py-3 scrollbar-thin">
              <p className="text-foreground text-sm sm:text-base lg:text-xl font-medium tracking-tight leading-relaxed break-words whitespace-pre-wrap">
                {swarm.prompt}
              </p>
            </div>
          ) : (
            <h1
              className={cn(
                "text-foreground font-medium tracking-tight leading-[1.15] w-full break-words",
                swarm.prompt.length > 100
                  ? "text-lg sm:text-xl lg:text-3xl"
                  : "text-2xl sm:text-3xl lg:text-5xl xl:text-[3.25rem]"
              )}
            >
              {swarm.prompt}
            </h1>
          )}

          {/* Meta info */}
          <div className="mt-3 sm:mt-5 lg:mt-6 flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1.5 sm:gap-y-2 text-xs sm:text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Monitor className="size-3 sm:size-3.5" />
              {swarm.machine_count} machine{swarm.machine_count !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-3 sm:size-3.5" />
              {createdAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {duration && (
              <span className="flex items-center gap-1.5">
                <CircleNotch className="size-3 sm:size-3.5" />
                {duration}
              </span>
            )}
            {swarm.model && (
              <span className="opacity-60 truncate max-w-[140px] sm:max-w-[180px]">{swarm.model}</span>
            )}
          </div>

          {/* Feature bullets — desktop only */}
          <div className="hidden lg:flex mt-12 flex-col gap-4 text-sm text-muted-foreground/70">
            {[
              "Each machine runs independently in its own VM",
              "Every action captured with live screenshots",
              "Parallel execution — N machines, one prompt",
            ].map((feature, i) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.1, ease: EASE }}
                className="flex items-center gap-3"
              >
                <div className="h-px w-5 bg-border" />
                <span>{feature}</span>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.7, ease: EASE }}
            className="mt-5 sm:mt-8 lg:mt-12 w-full sm:w-auto"
          >
            <Link href="/">
              <Button className="h-10 sm:h-11 rounded-xl font-medium px-5 sm:px-6 gap-2 w-full sm:w-auto">
                <GitFork className="size-4" weight="duotone" />
                Launch your own Swarm
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* ───── Right panel — swarm tree graph ───── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="flex-1 lg:max-w-[55%] xl:max-w-[58%] flex items-center justify-center p-3 sm:p-4 lg:p-6 min-h-[280px] sm:min-h-[350px] lg:min-h-0"
        >
          <div className="w-full h-full rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden shadow-sm relative">
            {/* Inner gradient accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 sm:py-16 text-center">
                <Terminal className="size-7 sm:size-8 text-muted-foreground/25 mb-3" />
                <p className="text-xs sm:text-sm text-muted-foreground">No event logs recorded</p>
              </div>
            ) : (
              <SwarmTree
                events={events}
                machineCount={swarm.machine_count}
                prompt={swarm.prompt}
                status={swarm.status}
              />
            )}
          </div>
        </motion.div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  creating: {
    icon: <CircleNotch className="size-3 animate-spin" />,
    label: "Creating",
    color: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
  },
  running: {
    icon: <CircleNotch className="size-3 animate-spin" />,
    label: "Running",
    color: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
  },
  completed: {
    icon: <CheckCircle className="size-3" weight="fill" />,
    label: "Completed",
    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  failed: {
    icon: <XCircle className="size-3" weight="fill" />,
    label: "Failed",
    color: "text-red-600 dark:text-red-400 bg-red-500/10",
  },
  cancelled: {
    icon: <Warning className="size-3" weight="fill" />,
    label: "Cancelled",
    color: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainSec = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainSec}s`
  const hours = Math.floor(minutes / 60)
  const remainMin = minutes % 60
  return `${hours}h ${remainMin}m`
}
