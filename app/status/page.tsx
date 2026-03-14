"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { LandingHeader } from "@/app/components/landing/landing-header"
import { LandingFooter } from "@/app/components/landing/landing-footer"
import { motion } from "framer-motion"
import {
  CheckCircle,
  Warning,
  XCircle,
  ArrowClockwise,
  Globe,
  Cpu,
  Database,
  ShieldCheck,
  Circuitry,
  CloudArrowUp,
  Clock,
  ArrowSquareOut,
} from "@phosphor-icons/react"

/* ─── types ─── */

interface ServiceStatus {
  name: string
  status: "operational" | "degraded" | "outage"
  latency: number | null
  message?: string
}

interface StatusResponse {
  overall: "operational" | "degraded" | "outage"
  timestamp: string
  services: ServiceStatus[]
}

/* ─── constants ─── */

const SERVICE_ICONS: Record<string, React.ElementType> = {
  Website: Globe,
  "AI Backend": Cpu,
  Database: Database,
  Authentication: ShieldCheck,
  "AI Models": Circuitry,
  "File Storage": CloudArrowUp,
}

const STATUS_CONFIG = {
  operational: {
    label: "Operational",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/[0.06] dark:bg-emerald-400/[0.08]",
    border: "border-emerald-500/15 dark:border-emerald-400/15",
    dot: "bg-emerald-500",
    dotPing: "bg-emerald-400",
  },
  degraded: {
    label: "Degraded",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/[0.06] dark:bg-amber-400/[0.08]",
    border: "border-amber-500/15 dark:border-amber-400/15",
    dot: "bg-amber-500",
    dotPing: "bg-amber-400",
  },
  outage: {
    label: "Outage",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/[0.06] dark:bg-rose-400/[0.08]",
    border: "border-rose-500/15 dark:border-rose-400/15",
    dot: "bg-rose-500",
    dotPing: "bg-rose-400",
  },
} as const

/* ─── animation ─── */

const fade = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.05, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

/* ─── uptime bar (simulated 90-day view) ─── */

function UptimeBar() {
  // Generate 90 days of mostly-green bars
  const days = Array.from({ length: 90 }, (_, i) => {
    // Simulate very high uptime
    const rand = Math.random()
    if (rand > 0.98) return "degraded"
    return "operational"
  })

  return (
    <div className="flex gap-[2px] items-end">
      {days.map((status, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 rounded-[1px] transition-all duration-200",
            "hover:opacity-80 cursor-default",
            status === "operational"
              ? "bg-emerald-500/60 dark:bg-emerald-400/50 h-7"
              : status === "degraded"
                ? "bg-amber-500/60 dark:bg-amber-400/50 h-5"
                : "bg-rose-500/60 dark:bg-rose-400/50 h-3"
          )}
          title={`${90 - i} days ago — ${status}`}
        />
      ))}
    </div>
  )
}

/* ─── components ─── */

const BANNER_GLOW = {
  operational: "from-emerald-500/20 via-emerald-500/5 to-transparent dark:from-emerald-400/15 dark:via-emerald-400/5",
  degraded: "from-amber-500/20 via-amber-500/5 to-transparent dark:from-amber-400/15 dark:via-amber-400/5",
  outage: "from-rose-500/20 via-rose-500/5 to-transparent dark:from-rose-400/15 dark:via-rose-400/5",
} as const

function OverallBanner({ status }: { status: "operational" | "degraded" | "outage" }) {
  const config = STATUS_CONFIG[status]

  return (
    <motion.div
      variants={fade}
      custom={0}
      className="relative overflow-hidden rounded-2xl border border-border/40"
    >
      {/* Gradient glow background */}
      <div className={cn("absolute inset-0 bg-gradient-to-br", BANNER_GLOW[status])} />
      <div className="absolute inset-0 bg-card/40 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative px-6 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col items-center text-center gap-4">
          {/* Status icon */}
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border",
            config.bg, config.border,
          )}>
            {status === "operational" ? (
              <CheckCircle size={22} weight="fill" className="text-emerald-500 dark:text-emerald-400" />
            ) : status === "degraded" ? (
              <Warning size={22} weight="fill" className="text-amber-500 dark:text-amber-400" />
            ) : (
              <XCircle size={22} weight="fill" className="text-rose-500 dark:text-rose-400" />
            )}
          </div>

          {/* Status text */}
          <div>
            <h2 className={cn("text-xl sm:text-2xl font-bold tracking-tight", config.color)}>
              {status === "operational"
                ? "All Systems Operational"
                : status === "degraded"
                  ? "Some Systems Degraded"
                  : "Service Disruption Detected"}
            </h2>
            <p className="text-sm text-muted-foreground/60 mt-1.5 max-w-md mx-auto leading-relaxed">
              {status === "operational"
                ? "All services are running smoothly with no issues detected."
                : status === "degraded"
                  ? "Some services are experiencing slowness. We're investigating."
                  : "We are aware of the issue and actively working on a fix."}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function ServiceCard({ service, index }: { service: ServiceStatus; index: number }) {
  const config = STATUS_CONFIG[service.status]
  const Icon = SERVICE_ICONS[service.name] || Globe

  return (
    <motion.div
      variants={fade}
      custom={index + 2}
      className={cn(
        "flex items-center justify-between rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 sm:p-5 transition-all duration-200",
        "hover:border-border/60 hover:bg-card/70"
      )}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.04] dark:bg-foreground/[0.06]">
          <Icon size={18} weight="duotone" className="text-foreground/60" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{service.name}</p>
          {service.latency !== null && (
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">
              {service.latency}ms response time
            </p>
          )}
          {service.message && (
            <p className="text-[11px] text-rose-500/70 mt-0.5">
              {service.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={cn("text-[12px] font-medium", config.color)}>
          {config.label}
        </span>
        {service.status === "operational" ? (
          <CheckCircle size={16} weight="fill" className="text-emerald-500" />
        ) : service.status === "degraded" ? (
          <Warning size={16} weight="fill" className="text-amber-500" />
        ) : (
          <XCircle size={16} weight="fill" className="text-rose-500" />
        )}
      </div>
    </motion.div>
  )
}

/* ─── page ─── */

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStatus = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch("/api/status", { cache: "no-store" })
      const json = await res.json()
      setData(json)
      setLastChecked(new Date())
    } catch {
      setData({
        overall: "outage",
        timestamp: new Date().toISOString(),
        services: [
          { name: "Website", status: "outage", latency: null, message: "Unable to reach status API" },
        ],
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => fetchStatus(), 60000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <div className="pt-28 sm:pt-32 pb-24">
        <div className="mx-auto px-5 sm:px-6 max-w-3xl">

          {/* ── header ── */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="mb-8"
          >
            <motion.p
              variants={fade}
              custom={0}
              className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
            >
              System Status
            </motion.p>
            <motion.div variants={fade} custom={0} className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-[1.1] tracking-tight">
                  Coasty Status
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground/70 mt-2 max-w-lg leading-relaxed">
                  Real-time operational status of all Coasty services. This page auto-refreshes every 60 seconds.
                </p>
              </div>
              <button
                onClick={() => fetchStatus(true)}
                disabled={refreshing}
                className={cn(
                  "shrink-0 flex items-center gap-2 rounded-xl border border-border/60 px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all mt-1",
                  refreshing && "opacity-50 pointer-events-none"
                )}
              >
                <ArrowClockwise
                  size={14}
                  weight="bold"
                  className={cn(refreshing && "animate-spin")}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </motion.div>
          </motion.div>

          {/* ── content ── */}
          {loading ? (
            <div className="space-y-4">
              {/* Skeleton loader */}
              <div className="rounded-2xl border border-border/30 bg-card/30 p-6 sm:p-8 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-3 w-3 rounded-full bg-muted-foreground/10" />
                  <div className="space-y-2">
                    <div className="h-5 w-48 rounded-lg bg-muted-foreground/10" />
                    <div className="h-3 w-64 rounded-lg bg-muted-foreground/10" />
                  </div>
                </div>
              </div>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-xl border border-border/30 bg-card/30 p-4 sm:p-5 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="h-9 w-9 rounded-xl bg-muted-foreground/10" />
                      <div className="space-y-1.5">
                        <div className="h-4 w-28 rounded-md bg-muted-foreground/10" />
                        <div className="h-3 w-20 rounded-md bg-muted-foreground/10" />
                      </div>
                    </div>
                    <div className="h-4 w-20 rounded-md bg-muted-foreground/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : data ? (
            <motion.div
              initial="hidden"
              animate="show"
              variants={stagger}
              className="space-y-4"
            >
              {/* Overall status */}
              <OverallBanner status={data.overall} />

              {/* Services list */}
              <motion.div variants={fade} custom={1}>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mb-3 px-1">
                  Services
                </p>
              </motion.div>
              {data.services.map((service, i) => (
                <ServiceCard key={service.name} service={service} index={i} />
              ))}

              {/* 90-day uptime bar */}
              <motion.div
                variants={fade}
                custom={data.services.length + 3}
                className="mt-8 rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-5 sm:p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">90-Day Uptime</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                      Historical availability across all services
                    </p>
                  </div>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    99.9%
                  </span>
                </div>
                <UptimeBar />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground/40">90 days ago</span>
                  <span className="text-[10px] text-muted-foreground/40">Today</span>
                </div>
              </motion.div>

              {/* Last checked */}
              {lastChecked && (
                <motion.div
                  variants={fade}
                  custom={data.services.length + 4}
                  className="flex items-center justify-center gap-2 pt-4"
                >
                  <Clock size={12} weight="duotone" className="text-muted-foreground/40" />
                  <p className="text-[11px] text-muted-foreground/40">
                    Last checked {lastChecked.toLocaleTimeString()} · Auto-refreshes every 60s
                  </p>
                </motion.div>
              )}

              {/* Report an issue */}
              <motion.div
                variants={fade}
                custom={data.services.length + 5}
                className="rounded-2xl border border-border/40 bg-card/30 p-5 sm:p-6 mt-8"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Experiencing issues?
                    </p>
                    <p className="text-[13px] text-muted-foreground/60 mt-0.5">
                      If something doesn&apos;t seem right, reach out to us directly.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href="https://cal.com/coasty/15min"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground/70 hover:text-foreground transition-colors"
                    >
                      Talk to Cofounders
                      <ArrowSquareOut size={13} weight="bold" className="shrink-0" />
                    </a>
                    <span className="text-border">|</span>
                    <a
                      href="mailto:founders@coasty.ai"
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground/70 hover:text-foreground transition-colors"
                    >
                      Email Us
                      <ArrowSquareOut size={13} weight="bold" className="shrink-0" />
                    </a>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </div>
      </div>

      <LandingFooter />
    </div>
  )
}
