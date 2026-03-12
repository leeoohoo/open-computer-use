"use client"

import { LandingHeader } from "@/app/components/landing/landing-header"
import { Button } from "@/components/ui/button"
import { RainbowButton } from "@/components/magicui/rainbow-button"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  Check,
  Zap,
  Clock,
  Monitor,
  GitFork,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  Layers,
  Target,
  TrendingUp,
  Shield,
  BarChart3,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Interactive Swarm Demo — simulates a prompt being split across N machines
// ---------------------------------------------------------------------------

interface DemoMachine {
  id: number
  label: string
  status: "idle" | "booting" | "running" | "done"
  progress: number
  steps: string[]
  currentStep: number
}

const demoPrompt = "Research the top 5 CRM tools — compare pricing, features, integrations, and user reviews"

const demoMachines: DemoMachine[] = [
  {
    id: 1,
    label: "Machine 1 — Salesforce",
    status: "idle",
    progress: 0,
    currentStep: -1,
    steps: [
      "Opening Salesforce pricing page",
      "Extracting plan tiers & limits",
      "Checking integration marketplace",
      "Scraping G2 reviews",
      "Compiling findings",
    ],
  },
  {
    id: 2,
    label: "Machine 2 — HubSpot",
    status: "idle",
    progress: 0,
    currentStep: -1,
    steps: [
      "Navigating to HubSpot CRM",
      "Comparing free vs paid tiers",
      "Listing native integrations",
      "Reading Capterra reviews",
      "Compiling findings",
    ],
  },
  {
    id: 3,
    label: "Machine 3 — Pipedrive",
    status: "idle",
    progress: 0,
    currentStep: -1,
    steps: [
      "Loading Pipedrive pricing",
      "Cataloging feature matrix",
      "Reviewing Zapier integrations",
      "Pulling TrustRadius scores",
      "Compiling findings",
    ],
  },
  {
    id: 4,
    label: "Machine 4 — Zoho CRM",
    status: "idle",
    progress: 0,
    currentStep: -1,
    steps: [
      "Visiting Zoho CRM site",
      "Extracting edition details",
      "Mapping Zoho ecosystem",
      "Checking G2 sentiment",
      "Compiling findings",
    ],
  },
  {
    id: 5,
    label: "Machine 5 — Close.io",
    status: "idle",
    progress: 0,
    currentStep: -1,
    steps: [
      "Opening Close pricing page",
      "Documenting feature set",
      "Checking API & integrations",
      "Reading customer testimonials",
      "Compiling findings",
    ],
  },
]

function useSwarmDemo() {
  const [machines, setMachines] = useState<DemoMachine[]>(
    demoMachines.map((m) => ({ ...m }))
  )
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle")
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef(0)

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setMachines(demoMachines.map((m) => ({ ...m })))
    setPhase("idle")
    setElapsed(0)
    tickRef.current = 0
  }, [])

  const start = useCallback(() => {
    reset()
    setPhase("running")

    // Randomise per-machine speed variance
    const speeds = demoMachines.map(() => 0.7 + Math.random() * 0.6) // 0.7–1.3x

    intervalRef.current = setInterval(() => {
      tickRef.current += 1
      setElapsed(tickRef.current)

      setMachines((prev) => {
        const next = prev.map((m, i) => {
          if (m.status === "done") return m
          const speed = speeds[i]
          const tick = tickRef.current

          // Boot phase: ticks 1-3
          if (tick <= 3) {
            return { ...m, status: "booting" as const }
          }

          // Running phase
          const runTick = tick - 3
          const stepDuration = 4 // ticks per step (base)
          const adjustedStep = Math.floor(
            (runTick * speed) / stepDuration
          )
          const clampedStep = Math.min(adjustedStep, m.steps.length - 1)
          const progress = Math.min(
            ((runTick * speed) / (m.steps.length * stepDuration)) * 100,
            100
          )

          if (progress >= 100) {
            return {
              ...m,
              status: "done" as const,
              progress: 100,
              currentStep: m.steps.length - 1,
            }
          }

          return {
            ...m,
            status: "running" as const,
            progress,
            currentStep: clampedStep,
          }
        })

        // Check if all done
        if (next.every((m) => m.status === "done")) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setPhase("done")
        }

        return next
      })
    }, 400)
  }, [reset])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { machines, phase, elapsed, start, reset }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DemoMachineCard({ machine }: { machine: DemoMachine }) {
  const statusColor =
    machine.status === "done"
      ? "text-emerald-500"
      : machine.status === "running"
        ? "text-amber-500"
        : machine.status === "booting"
          ? "text-blue-400"
          : "text-muted-foreground/40"

  const statusBg =
    machine.status === "done"
      ? "bg-emerald-500/10 border-emerald-500/20"
      : machine.status === "running"
        ? "bg-amber-500/[0.06] border-amber-500/15"
        : machine.status === "booting"
          ? "bg-blue-500/[0.06] border-blue-400/15"
          : "bg-muted/30 border-border/50"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border p-4 transition-colors duration-300",
        statusBg
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Monitor className={cn("h-4 w-4", statusColor)} />
          <span className="text-sm font-medium truncate">{machine.label}</span>
        </div>
        <span className={cn("text-xs font-medium", statusColor)}>
          {machine.status === "done"
            ? "Complete"
            : machine.status === "running"
              ? `${Math.round(machine.progress)}%`
              : machine.status === "booting"
                ? "Booting..."
                : "Idle"}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden mb-3">
        <motion.div
          className={cn(
            "h-full rounded-full",
            machine.status === "done"
              ? "bg-emerald-500"
              : "bg-amber-500"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${machine.progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {machine.steps.map((step, i) => {
          const isDone = machine.currentStep > i || machine.status === "done"
          const isActive =
            machine.currentStep === i && machine.status === "running"
          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 text-xs transition-colors duration-200",
                isDone
                  ? "text-foreground/70"
                  : isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/40"
              )}
            >
              {isDone ? (
                <Check className="h-3 w-3 text-emerald-500 flex-shrink-0" />
              ) : isActive ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="flex-shrink-0"
                >
                  <RotateCcw className="h-3 w-3 text-amber-500" />
                </motion.div>
              ) : (
                <div className="h-3 w-3 rounded-full border border-border/50 flex-shrink-0" />
              )}
              <span className="truncate">{step}</span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Comparison section data
// ---------------------------------------------------------------------------

const comparisons = [
  {
    label: "5 CRM tools research",
    sequential: "~50 min",
    swarm: "~10 min",
    speedup: "5x",
  },
  {
    label: "QA across 8 pages",
    sequential: "~40 min",
    swarm: "~8 min",
    speedup: "5x",
  },
  {
    label: "Lead enrichment (100 contacts)",
    sequential: "~3 hours",
    swarm: "~30 min",
    speedup: "6x",
  },
  {
    label: "Competitor price monitoring",
    sequential: "~25 min",
    swarm: "~5 min",
    speedup: "5x",
  },
]

const useCases = [
  {
    icon: BarChart3,
    title: "Market Research at Scale",
    description:
      "Research multiple competitors, markets, or products simultaneously. Each machine handles one target while results aggregate automatically.",
  },
  {
    icon: Target,
    title: "Lead Generation & Enrichment",
    description:
      "Split a list of leads across machines. Each enriches profiles, finds emails, and checks social presence — completing hours of work in minutes.",
  },
  {
    icon: Shield,
    title: "QA & Regression Testing",
    description:
      "Run test scenarios across different pages or flows in parallel. Catch bugs faster before they reach production.",
  },
  {
    icon: Layers,
    title: "Content & Social Campaigns",
    description:
      "Post to multiple platforms simultaneously. Each machine handles a different social network, forum, or listing site.",
  },
  {
    icon: TrendingUp,
    title: "Data Extraction Pipelines",
    description:
      "Scrape and structure data from dozens of sources at once. Price monitoring, review aggregation, directory scraping — all in parallel.",
  },
  {
    icon: Clock,
    title: "Scheduled Swarm Runs",
    description:
      "Combine swarm mode with scheduling for recurring parallel tasks. Hourly price checks, daily report generation, weekly audits.",
  },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgentSwarmsPage() {
  const { machines, phase, elapsed, start, reset } = useSwarmDemo()
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    setMounted(true)
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const sectionViewport = { once: true, amount: isMobile ? 0.05 : 0.1 }
  const containerVariants = isMobile
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.08, delayChildren: 0.1 },
        },
      }
  const itemVariants = isMobile
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: "easeOut" as const },
        },
      }

  return (
    <div className="min-h-screen bg-background relative">
      <LandingHeader />

      <main className={cn("relative", isMobile ? "pt-16" : "pt-20")}>
        {/* ── Hero ── */}
        <section
          className={cn(
            "relative flex flex-col items-center justify-center overflow-hidden",
            isMobile ? "px-4 pt-12 pb-16" : "px-6 pt-24 pb-28"
          )}
        >
          {/* Subtle radial glow */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full bg-amber-500/[0.04] blur-[120px]" />
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 max-w-3xl mx-auto text-center"
          >
            <motion.div variants={itemVariants} className="mb-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-4 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <GitFork className="h-3.5 w-3.5" />
                Agent Swarm Mode
              </span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-5xl sm:text-6xl"
              )}
            >
              One prompt.{" "}
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                Multiple machines.
              </span>
              <br />
              Parallel results.
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className={cn(
                "text-muted-foreground mt-5 max-w-xl mx-auto leading-relaxed",
                isMobile ? "text-sm" : "text-lg"
              )}
            >
              Agent Swarms split your task across multiple isolated machines
              running simultaneously. Work that takes an hour sequentially
              finishes in minutes.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex items-center justify-center gap-3 mt-8"
            >
              <RainbowButton className="gap-2" asChild>
                <Link href="/auth">
                  Try Swarm Mode
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </RainbowButton>
              <Button variant="outline" className="rounded-full" asChild>
                <a href="#demo">
                  See it in action
                  <ChevronRight className="h-4 w-4 ml-1" />
                </a>
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* ── How It Works — 3-step visual ── */}
        <section
          className={cn("py-20", isMobile ? "px-4" : "px-6")}
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-14">
              <h2
                className={cn(
                  "font-bold tracking-tight",
                  isMobile ? "text-3xl" : "text-4xl"
                )}
              >
                How Agent Swarms work
              </h2>
              <p
                className={cn(
                  "text-muted-foreground mt-3 max-w-lg mx-auto",
                  isMobile ? "text-sm" : "text-base"
                )}
              >
                Three steps from prompt to parallel execution
              </p>
            </motion.div>

            <div
              className={cn(
                "grid gap-8",
                isMobile ? "grid-cols-1" : "grid-cols-3"
              )}
            >
              {[
                {
                  step: "1",
                  title: "You type a prompt",
                  desc: "Describe the task as usual — research, test, extract, post. Toggle Swarm mode and choose how many machines.",
                  icon: Zap,
                  color: "text-blue-500",
                  bg: "bg-blue-500/10 border-blue-500/20",
                },
                {
                  step: "2",
                  title: "Machines spin up in parallel",
                  desc: "Each machine gets a full isolated environment — browser, terminal, desktop. They all start working on your task simultaneously.",
                  icon: Monitor,
                  color: "text-amber-500",
                  bg: "bg-amber-500/10 border-amber-500/20",
                },
                {
                  step: "3",
                  title: "Results stream back live",
                  desc: "Watch every machine's progress in real-time. Screenshots, tool calls, and findings — all visible in the swarm tree view.",
                  icon: TrendingUp,
                  color: "text-emerald-500",
                  bg: "bg-emerald-500/10 border-emerald-500/20",
                },
              ].map((s, i) => (
                <motion.div
                  key={s.step}
                  variants={itemVariants}
                  className="relative"
                >
                  {/* Connector line (desktop only) */}
                  {!isMobile && i < 2 && (
                    <div className="absolute top-10 -right-4 w-8 border-t border-dashed border-border/40 z-0" />
                  )}
                  <div className="relative rounded-2xl border border-border/50 bg-card/50 p-6 h-full">
                    <div
                      className={cn(
                        "flex items-center justify-center h-10 w-10 rounded-xl border mb-4",
                        s.bg
                      )}
                    >
                      <s.icon className={cn("h-5 w-5", s.color)} />
                    </div>
                    <div className="text-xs font-medium text-muted-foreground/50 mb-1">
                      Step {s.step}
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Interactive Demo ── */}
        <section
          id="demo"
          className={cn("py-20 bg-muted/20", isMobile ? "px-4" : "px-6")}
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-6xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-10">
              <h2
                className={cn(
                  "font-bold tracking-tight",
                  isMobile ? "text-3xl" : "text-4xl"
                )}
              >
                See it in action
              </h2>
              <p
                className={cn(
                  "text-muted-foreground mt-3 max-w-lg mx-auto",
                  isMobile ? "text-sm" : "text-base"
                )}
              >
                Watch 5 machines tackle a CRM research task simultaneously
              </p>
            </motion.div>

            <motion.div variants={itemVariants}>
              {/* Prompt bar */}
              <div className="rounded-xl border border-border/50 bg-background p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <GitFork className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">
                      Swarm prompt — 5 machines
                    </div>
                    <p className="text-sm font-medium">{demoPrompt}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {phase === "idle" && (
                      <Button
                        size="sm"
                        className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={start}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Run Demo
                      </Button>
                    )}
                    {phase === "running" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {(elapsed * 0.4).toFixed(1)}s
                        </span>
                        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      </div>
                    )}
                    {phase === "done" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={reset}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Machine grid */}
              <div
                className={cn(
                  "grid gap-4",
                  isMobile
                    ? "grid-cols-1"
                    : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
                )}
              >
                {machines.map((m) => (
                  <DemoMachineCard key={m.id} machine={m} />
                ))}
              </div>

              {/* Completion banner */}
              <AnimatePresence>
                {phase === "done" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5 text-center"
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Check className="h-5 w-5 text-emerald-500" />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        All 5 machines completed
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      In a real swarm, this would have taken ~10 minutes
                      instead of ~50 minutes running sequentially. That's a{" "}
                      <span className="font-semibold text-foreground">
                        5x speedup
                      </span>
                      .
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </section>

        {/* ── Speed Comparison ── */}
        <section className={cn("py-20", isMobile ? "px-4" : "px-6")}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-4xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2
                className={cn(
                  "font-bold tracking-tight",
                  isMobile ? "text-3xl" : "text-4xl"
                )}
              >
                Sequential vs Swarm
              </h2>
              <p
                className={cn(
                  "text-muted-foreground mt-3 max-w-lg mx-auto",
                  isMobile ? "text-sm" : "text-base"
                )}
              >
                Real-world tasks completed dramatically faster with parallel
                execution
              </p>
            </motion.div>

            <motion.div variants={itemVariants}>
              <div className="rounded-xl border border-border overflow-hidden">
                {/* Table header */}
                <div
                  className={cn(
                    "grid border-b border-border bg-muted/30",
                    isMobile ? "grid-cols-3" : "grid-cols-4"
                  )}
                >
                  <div
                    className={cn(
                      "p-4 font-medium text-muted-foreground",
                      isMobile ? "text-xs col-span-1" : "text-sm col-span-1"
                    )}
                  >
                    Task
                  </div>
                  <div
                    className={cn(
                      "p-4 text-center font-medium text-muted-foreground border-l border-border",
                      isMobile ? "text-xs" : "text-sm"
                    )}
                  >
                    Sequential
                  </div>
                  <div
                    className={cn(
                      "p-4 text-center font-medium border-l border-amber-500/20 bg-amber-500/[0.04]",
                      isMobile ? "text-xs" : "text-sm"
                    )}
                  >
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Swarm
                    </span>
                  </div>
                  {!isMobile && (
                    <div className="p-4 text-center font-medium text-muted-foreground border-l border-border text-sm">
                      Speedup
                    </div>
                  )}
                </div>

                {/* Rows */}
                {comparisons.map((row, i) => (
                  <div
                    key={row.label}
                    className={cn(
                      "grid",
                      isMobile ? "grid-cols-3" : "grid-cols-4",
                      i < comparisons.length - 1 && "border-b border-border",
                      i % 2 === 1 && "bg-muted/20"
                    )}
                  >
                    <div
                      className={cn(
                        "p-4 flex items-center",
                        isMobile ? "text-xs" : "text-sm"
                      )}
                    >
                      <span className="font-medium text-foreground">
                        {row.label}
                      </span>
                    </div>
                    <div className="p-4 flex items-center justify-center text-muted-foreground border-l border-border">
                      <span
                        className={cn(
                          "line-through decoration-muted-foreground/30",
                          isMobile ? "text-xs" : "text-sm"
                        )}
                      >
                        {row.sequential}
                      </span>
                    </div>
                    <div className="p-4 flex items-center justify-center border-l border-amber-500/20 bg-amber-500/[0.02]">
                      <span
                        className={cn(
                          "font-semibold text-amber-600 dark:text-amber-400",
                          isMobile ? "text-xs" : "text-sm"
                        )}
                      >
                        {row.swarm}
                      </span>
                    </div>
                    {!isMobile && (
                      <div className="p-4 flex items-center justify-center border-l border-border">
                        <span className="text-sm font-bold text-emerald-500">
                          {row.speedup}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* ── Use Cases ── */}
        <section
          className={cn("py-20 bg-muted/20", isMobile ? "px-4" : "px-6")}
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2
                className={cn(
                  "font-bold tracking-tight",
                  isMobile ? "text-3xl" : "text-4xl"
                )}
              >
                What you can do with Swarms
              </h2>
              <p
                className={cn(
                  "text-muted-foreground mt-3 max-w-lg mx-auto",
                  isMobile ? "text-sm" : "text-base"
                )}
              >
                Any task that can be parallelised benefits from swarm mode
              </p>
            </motion.div>

            <div
              className={cn(
                "grid gap-6",
                isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"
              )}
            >
              {useCases.map((uc) => (
                <motion.div
                  key={uc.title}
                  variants={itemVariants}
                  className="rounded-xl border border-border/50 bg-background p-6"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <uc.icon className="h-4.5 w-4.5 text-amber-500" />
                    </div>
                    <h3 className="font-semibold text-sm">{uc.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {uc.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Key Benefits / Features ── */}
        <section className={cn("py-20", isMobile ? "px-4" : "px-6")}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-4xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2
                className={cn(
                  "font-bold tracking-tight",
                  isMobile ? "text-3xl" : "text-4xl"
                )}
              >
                Why Agent Swarms
              </h2>
            </motion.div>

            <div className="space-y-6">
              {[
                {
                  title: "True Parallel Execution",
                  desc: "Each machine is a fully isolated environment with its own browser, terminal, and desktop. There's no shared state — they all work independently at full speed.",
                  icon: Layers,
                },
                {
                  title: "2x Your Machine Limit",
                  desc: "Swarm mode temporarily doubles your plan's machine capacity. If you have 3 machines on Pro, you can run a swarm across 6 machines.",
                  icon: TrendingUp,
                },
                {
                  title: "Live Progress Tracking",
                  desc: "Watch every machine's progress in a real-time tree view. See screenshots, tool calls, and status updates as they happen — nothing is a black box.",
                  icon: Monitor,
                },
                {
                  title: "Automatic Result Aggregation",
                  desc: "When all machines finish, their findings are combined into a single consolidated result. No manual merging required.",
                  icon: Target,
                },
                {
                  title: "Shareable Swarm Runs",
                  desc: "Share completed swarm runs with your team via a link. Anyone with access can replay the full execution timeline of every machine.",
                  icon: GitFork,
                },
                {
                  title: "Sandboxed & Secure",
                  desc: "Every machine in the swarm runs in its own isolated container. Nothing leaks between machines, and all environments are destroyed after completion.",
                  icon: Shield,
                },
              ].map((b, i) => (
                <motion.div
                  key={b.title}
                  variants={itemVariants}
                  className={cn(
                    "flex gap-5",
                    isMobile ? "flex-col" : "items-start"
                  )}
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
                    <b.icon className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{b.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {b.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Pricing CTA ── */}
        <section
          className={cn("py-20 bg-muted/20", isMobile ? "px-4" : "px-6")}
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-3xl mx-auto text-center"
          >
            <motion.div variants={itemVariants} className="mb-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-4 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                Available on Starter, Plus & Pro plans
              </span>
            </motion.div>

            <motion.h2
              variants={itemVariants}
              className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl"
              )}
            >
              Ready to run tasks in parallel?
            </motion.h2>

            <motion.p
              variants={itemVariants}
              className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed",
                isMobile ? "text-sm" : "text-base"
              )}
            >
              Swarm mode is included with every paid plan. Upgrade to unlock
              parallel execution across multiple machines.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex items-center justify-center gap-4 mt-8"
            >
              <RainbowButton className="gap-2" asChild>
                <Link href="/auth">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </RainbowButton>
              <Button variant="outline" className="rounded-full gap-2" asChild>
                <Link href="/#pricing">
                  View Pricing
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            {/* Plan breakdown */}
            <motion.div
              variants={itemVariants}
              className={cn(
                "mt-12 grid gap-4",
                isMobile ? "grid-cols-1" : "grid-cols-3"
              )}
            >
              {[
                {
                  plan: "Starter",
                  price: "$19/mo",
                  machines: "Up to 2 machines",
                },
                {
                  plan: "Plus",
                  price: "$50/mo",
                  machines: "Up to 4 machines",
                  highlight: true,
                },
                {
                  plan: "Pro",
                  price: "$100/mo",
                  machines: "Up to 6 machines",
                },
              ].map((p) => (
                <div
                  key={p.plan}
                  className={cn(
                    "rounded-xl border p-5",
                    p.highlight
                      ? "border-amber-500/30 bg-amber-500/[0.04]"
                      : "border-border/50 bg-background"
                  )}
                >
                  <div className="text-sm font-semibold mb-1">
                    {p.plan}
                    {p.highlight && (
                      <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Popular
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold">{p.price}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.machines} per swarm
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40">
          <div
            className={cn(
              "mx-auto py-10",
              isMobile ? "px-4 max-w-xl" : "px-6 max-w-5xl"
            )}
          >
            <div
              className={cn(
                "flex justify-between items-center",
                isMobile && "flex-col gap-5"
              )}
            >
              <p className="text-sm text-muted-foreground/70">
                &copy; {new Date().getFullYear()} Coasty
              </p>
              <div
                className={cn(
                  "flex items-center gap-5",
                  isMobile && "flex-wrap justify-center"
                )}
              >
                {[
                  { href: "/privacy", label: "Privacy" },
                  { href: "/terms", label: "Terms" },
                  { href: "/blog", label: "Blog" },
                  { href: "/download", label: "Download" },
                  { href: "mailto:founders@coasty.ai", label: "Contact" },
                ].map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-sm text-muted-foreground/60 hover:text-foreground transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
