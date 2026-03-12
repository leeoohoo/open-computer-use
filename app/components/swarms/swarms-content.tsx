"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  GitFork,
  CheckCircle,
  XCircle,
  Warning,
  Clock,
  CaretDown,
  CaretRight,
  Terminal,
  Robot,
  Wrench,
  Eye,
  Monitor,
  CircleNotch,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsOutCardinal,
  ArrowCounterClockwise,
  ShareNetwork,
  Globe,
  Lock,
  Copy,
  Check,
  X,
  TwitterLogo,
  LinkedinLogo,
  WhatsappLogo,
  FacebookLogo,
  TelegramLogo,
  RedditLogo,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { APP_DOMAIN } from "@/lib/config"

const EASE = [0.22, 1, 0.36, 1] as const

// Strip ALL internal agent tags/markers from display text
function stripAgentTags(text: string): string {
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
// Types
// ---------------------------------------------------------------------------

interface SwarmRun {
  id: string
  swarm_id: string
  prompt: string
  machine_count: number
  status: "creating" | "running" | "completed" | "failed" | "cancelled"
  model: string | null
  max_steps: number | null
  result_summary: string | null
  public: boolean
  created_at: string
  completed_at: string | null
}

interface SwarmEvent {
  id: string
  swarm_id: string
  machine_index: number | null
  event_type: string
  content: string
  screenshot: string | null
  tool_name: string | null
  created_at: string
}

interface TimelineStep {
  machineIndex: number
  text: string
  toolCalls: Array<{ name: string; content: string }>
  toolResults: Array<{ name: string; content: string; screenshot: string | null }>
  screenshot: string | null
  status: "success" | "error" | "pending"
  timestamp: string
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SwarmsContent() {
  const [swarms, setSwarms] = useState<SwarmRun[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const autoExpandedRef = useRef(false)
  const router = useRouter()

  const fetchSwarms = useCallback(async () => {
    try {
      const res = await fetch("/api/swarms")
      if (res.ok) {
        const data = await res.json()
        setSwarms(data.swarms || [])
        return data.swarms || []
      }
    } catch (e) {
      console.error("Failed to fetch swarms:", e)
    }
    return null
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchSwarms().then((list) => {
      setLoading(false)
      // Auto-expand the first running/creating swarm
      if (list && !autoExpandedRef.current) {
        const active = list.find((s: SwarmRun) => s.status === "running" || s.status === "creating")
        if (active) {
          setExpandedId(active.swarm_id)
          autoExpandedRef.current = true
        }
      }
    })
  }, [fetchSwarms])

  // Poll swarm list every 5s while any swarm is active
  const hasActiveSwarm = useMemo(
    () => swarms.some((s) => s.status === "running" || s.status === "creating"),
    [swarms]
  )

  useEffect(() => {
    if (!hasActiveSwarm) return
    const interval = setInterval(() => {
      fetchSwarms()
    }, 5000)
    return () => clearInterval(interval)
  }, [hasActiveSwarm, fetchSwarms])

  const handleToggle = useCallback((swarmId: string) => {
    setExpandedId((prev) => (prev === swarmId ? null : swarmId))
  }, [])

  const statusFilters = useMemo(() => {
    const counts: Record<string, number> = { all: swarms.length }
    for (const s of swarms) {
      counts[s.status] = (counts[s.status] || 0) + 1
    }
    return [
      { id: "all", label: "All", count: counts.all },
      { id: "completed", label: "Completed", count: counts.completed || 0 },
      { id: "running", label: "Running", count: counts.running || 0 },
      { id: "failed", label: "Failed", count: counts.failed || 0 },
    ].filter((f) => f.id === "all" || f.count > 0)
  }, [swarms])

  const filteredSwarms = useMemo(
    () => statusFilter === "all" ? swarms : swarms.filter((s) => s.status === statusFilter),
    [swarms, statusFilter]
  )

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-muted" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">Loading swarm runs...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-invisible relative">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-[30%] -right-[15%] h-[60%] w-[50%] rounded-full opacity-[0.02] dark:opacity-[0.04] blur-[120px]"
          style={{ background: "radial-gradient(circle, currentColor, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-[20%] -left-[10%] h-[50%] w-[40%] rounded-full opacity-[0.015] dark:opacity-[0.035] blur-[100px]"
          style={{ background: "radial-gradient(circle, currentColor, transparent 70%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.012] dark:opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(128,128,128,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,.3) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight flex items-center gap-2.5">
              Swarm Runs
              {swarms.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ({swarms.length})
                </span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-1.5">
              View parallel task executions across multiple machines
            </p>
          </div>
        </motion.div>

        {/* Filters */}
        {swarms.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: EASE }}
            className="flex flex-wrap gap-1.5"
          >
            {statusFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-sm transition-all duration-200",
                  statusFilter === filter.id
                    ? "bg-foreground text-background font-medium shadow-sm"
                    : "bg-transparent hover:bg-foreground/[0.05] text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  {filter.label}
                  {filter.count > 0 && (
                    <span
                      className={cn(
                        "text-[11px] tabular-nums px-1.5 py-0.5 rounded-full",
                        statusFilter === filter.id
                          ? "bg-background/20"
                          : "bg-foreground/[0.06]"
                      )}
                    >
                      {filter.count}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </motion.div>
        )}

        {/* Empty state */}
        {swarms.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
            className="relative rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden"
          >
            <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-foreground/[0.02] blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-foreground/[0.015] blur-3xl" />

            <div className="relative flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-10 flex items-center gap-2">
                {[GitFork, Monitor, Robot].map((Icon, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + i * 0.06, ease: EASE }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-background/60 text-muted-foreground/70"
                  >
                    <Icon className="h-[18px] w-[18px]" weight={i === 0 ? "fill" : "regular"} />
                  </motion.div>
                ))}
              </div>

              <h2 className="text-2xl font-medium tracking-tight mb-2.5">No swarm runs yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed mb-12">
                Use the lightning bolt toggle in chat to execute tasks across multiple machines in parallel.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mb-12">
                {[
                  {
                    icon: GitFork,
                    title: "Parallel Execution",
                    desc: "Run the same task on multiple machines simultaneously",
                  },
                  {
                    icon: Robot,
                    title: "Auto Cleanup",
                    desc: "Temporary machines are deleted after every run",
                  },
                  {
                    icon: Monitor,
                    title: "Full Logs",
                    desc: "Screenshots, tool calls, and step-by-step history",
                  },
                ].map(({ icon: Icon, title, desc }, i) => (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 + i * 0.08, ease: EASE }}
                    className="rounded-xl border border-border/30 bg-background/30 backdrop-blur-sm px-4 py-4 text-left"
                  >
                    <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/[0.04]">
                      <Icon className="h-4 w-4 text-foreground/60" />
                    </div>
                    <p className="text-sm font-medium mb-1">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : filteredSwarms.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="border border-border/30 bg-card/30 backdrop-blur-sm rounded-2xl">
              <div className="flex flex-col items-center justify-center py-14">
                <GitFork className="h-10 w-10 text-muted-foreground/40 mb-4" weight="duotone" />
                <h3 className="text-base font-medium mb-1.5">
                  No {statusFilter !== "all" ? statusFilter : ""} runs
                </h3>
                <p className="text-sm text-muted-foreground">
                  {statusFilter === "all"
                    ? "No swarm runs found."
                    : `No runs are currently ${statusFilter}.`}
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Swarm cards list */
          <div className="space-y-3">
            {filteredSwarms.map((swarm, i) => (
              <motion.div
                key={swarm.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 + i * 0.04, ease: EASE }}
              >
                <SwarmRunCard
                  swarm={swarm}
                  isExpanded={expandedId === swarm.swarm_id}
                  onToggle={() => handleToggle(swarm.swarm_id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Swarm card
// ---------------------------------------------------------------------------

function SwarmRunCard({
  swarm,
  isExpanded,
  onToggle,
}: {
  swarm: SwarmRun
  isExpanded: boolean
  onToggle: () => void
}) {
  const [events, setEvents] = useState<SwarmEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsFetched, setEventsFetched] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [isPublic, setIsPublic] = useState(swarm.public ?? false)
  const [shareLoading, setShareLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const isActive = swarm.status === "running" || swarm.status === "creating"
  const shareUrl = `${APP_DOMAIN}/share/swarm/${swarm.swarm_id}`

  const toggleVisibility = useCallback(async () => {
    setShareLoading(true)
    try {
      const csrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("csrf_token="))
        ?.split("=")[1]
      const res = await fetch(`/api/swarms/${swarm.swarm_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf || "",
        },
        body: JSON.stringify({ public: !isPublic }),
      })
      if (res.ok) {
        setIsPublic(!isPublic)
      }
    } catch {}
    setShareLoading(false)
  }, [isPublic, swarm.swarm_id])

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareUrl])

  // Fetch events on first expand
  useEffect(() => {
    if (isExpanded && !eventsFetched) {
      setEventsLoading(true)
      fetch(`/api/swarms/${swarm.swarm_id}`)
        .then((res) => res.json())
        .then((data) => {
          setEvents(data.events || [])
          setEventsFetched(true)
        })
        .catch(() => {})
        .finally(() => setEventsLoading(false))
    }
  }, [isExpanded, eventsFetched, swarm.swarm_id])

  // Live-poll events every 3s while expanded AND swarm is active
  useEffect(() => {
    if (!isExpanded || !isActive || !eventsFetched) return
    const poll = setInterval(() => {
      fetch(`/api/swarms/${swarm.swarm_id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.events) setEvents(data.events)
        })
        .catch(() => {})
    }, 3000)
    return () => clearInterval(poll)
  }, [isExpanded, isActive, eventsFetched, swarm.swarm_id])

  const statusMeta = STATUS_META[swarm.status] || STATUS_META.creating
  const createdAt = new Date(swarm.created_at)
  const duration = swarm.completed_at
    ? formatDuration(new Date(swarm.completed_at).getTime() - createdAt.getTime())
    : null

  return (
    <div
      className={cn(
        "group relative rounded-xl transition-all duration-300",
        "border bg-card/50 backdrop-blur-sm",
        "overflow-hidden",
        isExpanded
          ? "border-border/50 bg-card/80 shadow-lg shadow-foreground/[0.02]"
          : "border-border/30 hover:bg-card/80 hover:border-border/50 hover:shadow-lg hover:shadow-foreground/[0.02]"
      )}
    >
      {/* Subtle top line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 w-full text-left px-5 py-4">
        <button
          onClick={onToggle}
          className="flex items-start gap-3 flex-1 min-w-0 text-left"
        >
          <div className="mt-1 text-muted-foreground/60">
            {isExpanded ? (
              <CaretDown className="size-3.5" weight="bold" />
            ) : (
              <CaretRight className="size-3.5" weight="bold" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug mb-2">{swarm.prompt}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {formatDate(createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <Monitor className="size-3" />
                {swarm.machine_count} machine{swarm.machine_count !== 1 ? "s" : ""}
              </span>
              {duration && <span>{duration}</span>}
              {swarm.model && (
                <span className="truncate max-w-[120px] opacity-60">{swarm.model}</span>
              )}
            </div>
          </div>
        </button>

        {/* Status + Share */}
        <div className="flex items-center gap-2 shrink-0">
          {isActive && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-blue-500" />
              </span>
              Live
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full",
              statusMeta.color
            )}
          >
            {statusMeta.icon}
            {statusMeta.label}
          </span>

          {/* Share button */}
          <SharePopover
            swarm={swarm}
            isPublic={isPublic}
            shareLoading={shareLoading}
            copied={copied}
            shareUrl={shareUrl}
            onToggleVisibility={toggleVisibility}
            onCopyLink={copyLink}
            shareOpen={shareOpen}
            onShareOpenChange={setShareOpen}
          />
        </div>
      </div>

      {/* Expandable detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30">
              {eventsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative h-6 w-6">
                      <div className="absolute inset-0 rounded-full border-2 border-muted" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground animate-spin" />
                    </div>
                    <span className="text-xs text-muted-foreground">Loading logs...</span>
                  </div>
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <Terminal className="size-6 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No event logs recorded</p>
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
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Share button + centered modal dialog
// ---------------------------------------------------------------------------

function SharePopover({
  swarm,
  isPublic,
  shareLoading,
  copied,
  shareUrl,
  onToggleVisibility,
  onCopyLink,
  shareOpen,
  onShareOpenChange,
}: {
  swarm: SwarmRun
  isPublic: boolean
  shareLoading: boolean
  copied: boolean
  shareUrl: string
  onToggleVisibility: () => void
  onCopyLink: () => void
  shareOpen: boolean
  onShareOpenChange: (open: boolean) => void
}) {
  const socialText = `I just ran ${swarm.machine_count} AI agents in parallel on @coasty_ai — one prompt, ${swarm.machine_count} machines, fully autonomous. Check out the full execution tree:`
  const socialTextPlain = `I just ran ${swarm.machine_count} AI agents in parallel on Coasty — one prompt, ${swarm.machine_count} machines, fully autonomous. Check out the full execution tree: ${shareUrl}`

  const socials = [
    {
      icon: TwitterLogo,
      label: "X",
      color: "hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400 hover:border-sky-500/30",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(socialText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      icon: LinkedinLogo,
      label: "LinkedIn",
      color: "hover:bg-blue-600/10 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-600/30",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      icon: FacebookLogo,
      label: "Facebook",
      color: "hover:bg-blue-500/10 hover:text-blue-500 dark:hover:text-blue-400 hover:border-blue-500/30",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      icon: WhatsappLogo,
      label: "WhatsApp",
      color: "hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400 hover:border-green-500/30",
      url: `https://wa.me/?text=${encodeURIComponent(socialTextPlain)}`,
    },
    {
      icon: TelegramLogo,
      label: "Telegram",
      color: "hover:bg-sky-400/10 hover:text-sky-500 dark:hover:text-sky-400 hover:border-sky-400/30",
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(socialText)}`,
    },
    {
      icon: RedditLogo,
      label: "Reddit",
      color: "hover:bg-orange-500/10 hover:text-orange-500 dark:hover:text-orange-400 hover:border-orange-500/30",
      url: `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(socialText)}`,
    },
  ]

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onShareOpenChange(!shareOpen)
        }}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-all duration-200",
          isPublic
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15"
            : "border-border/40 bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background/90"
        )}
        title={isPublic ? "Shared publicly" : "Share this swarm"}
      >
        <ShareNetwork className="size-3.5" weight={isPublic ? "fill" : "regular"} />
        <span className="hidden sm:inline">{isPublic ? "Shared" : "Share"}</span>
      </button>

      {shareOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation()
                onShareOpenChange(false)
              }}
            />

            {/* Modal */}
            <div
              className="relative z-[101] w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/50 bg-card shadow-2xl shadow-black/20"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center",
                      isPublic ? "bg-emerald-500/10" : "bg-amber-500/10"
                    )}
                  >
                    {isPublic ? (
                      <Globe className="size-4 text-emerald-500" weight="fill" />
                    ) : (
                      <Lock className="size-4 text-amber-500" weight="fill" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">
                      {isPublic ? "This swarm is live!" : "Share this swarm"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground/70">
                      {isPublic
                        ? "Anyone with the link can view the full execution"
                        : "Make it public to get a shareable link"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onShareOpenChange(false)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Toggle */}
              <div className="px-5 pb-4">
                <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3.5 py-3">
                  <p className="text-xs font-medium">
                    {isPublic ? "Public" : "Private"}
                  </p>
                  <button
                    onClick={onToggleVisibility}
                    disabled={shareLoading}
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors duration-200 shrink-0",
                      isPublic ? "bg-emerald-500" : "bg-muted-foreground/20"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                        isPublic && "translate-x-5"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Link + socials — only when public */}
              {isPublic && (
                <div className="px-5 pb-5 space-y-3">
                  {/* Copy link */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 rounded-lg border border-border/40 bg-background/50 px-3 py-2">
                      <p className="text-xs text-muted-foreground truncate font-mono">
                        {shareUrl}
                      </p>
                    </div>
                    <button
                      onClick={onCopyLink}
                      className={cn(
                        "h-9 px-3 flex items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-all duration-200 shrink-0",
                        copied
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : "border-border/40 bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background/90"
                      )}
                    >
                      {copied ? (
                        <>
                          <Check className="size-3.5" weight="bold" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  {/* Social grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {socials.map(({ icon: Icon, label, color, url }) => (
                      <a
                        key={label}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "h-9 flex items-center justify-center gap-1.5 rounded-lg border border-border/40 bg-background/60 text-muted-foreground text-xs font-medium transition-all duration-200",
                          color
                        )}
                      >
                        <Icon className="size-3.5" weight="fill" />
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Tree view — prompt root → fork → per-machine vertical branches
// with pan/zoom canvas
// ---------------------------------------------------------------------------

const MIN_ZOOM = 0.15
const MAX_ZOOM = 2
const ZOOM_STEP = 0.15

function SwarmTree({
  events,
  machineCount,
  prompt,
  status,
}: {
  events: SwarmEvent[]
  machineCount: number
  prompt: string
  status: string
}) {
  const machineIndices = useMemo(
    () =>
      Array.from(
        new Set(events.filter((e) => e.machine_index !== null).map((e) => e.machine_index!))
      ).sort((a, b) => a - b),
    [events]
  )

  // Build steps per machine
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

  // Per-machine final status
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

  // --- Pan/zoom state ---
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const panOrigin = useRef({ x: 0, y: 0 })

  // Auto-fit zoom on mount: scale down so the full tree width fits the container
  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return
    const containerW = containerRef.current.clientWidth
    const contentW = Math.max(cols * 220, 300)
    const fit = Math.min(1, (containerW - 32) / contentW)
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fit))
    setZoom(clamped)
    // Center horizontally
    const scaledW = contentW * clamped
    setPan({ x: Math.max(0, (containerW - scaledW) / 2), y: 0 })
  }, [cols])

  // Wheel → zoom (centered on cursor)
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
      // Adjust pan so zoom is centered on cursor position
      setPan((p) => ({
        x: cursorX - ratio * (cursorX - p.x),
        y: cursorY - ratio * (cursorY - p.y),
      }))
      return next
    })
  }, [])

  // Mouse drag → pan
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only pan on middle-click or when clicking the background (not buttons/inputs)
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

  // Controls
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
      <div className="flex flex-col items-center py-10 text-center">
        <Terminal className="size-6 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No event logs recorded</p>
      </div>
    )
  }

  const zoomPercent = Math.round(zoom * 100)

  return (
    <div className="relative rounded-b-xl">
      {/* Dotted canvas background */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-b-xl">
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

      {/* Controls overlay — top-right */}
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

      {/* Hint — bottom-left */}
      <div className="absolute bottom-2.5 left-3 z-[10] flex items-center gap-1.5 text-[10px] text-muted-foreground/35 select-none pointer-events-none">
        <ArrowsOutCardinal className="size-3" />
        <span>Drag to pan · Scroll to zoom</span>
      </div>

      {/* Pan/zoom viewport */}
      <div
        ref={containerRef}
        className="relative z-[1] overflow-hidden rounded-b-xl select-none"
        style={{
          height: Math.min(600, Math.max(350, cols * 60 + 200)),
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
      {/* Machine header node */}
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

      {/* Vertical connector + steps */}
      {steps.length > 0 && (
        <div className="relative w-full mt-0 pt-2">
          {/* Vertical dashed line */}
          <div
            className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
            style={{
              backgroundImage: "repeating-linear-gradient(to bottom, hsl(var(--border) / 0.35) 0px, hsl(var(--border) / 0.35) 4px, transparent 4px, transparent 8px)",
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
// Branch step card — a single node in a machine's branch
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
      {/* Node dot on the vertical line */}
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

      {/* Card */}
      <div
        className={cn(
          "mx-1 mt-2 rounded-lg border px-3 py-2 text-left transition-all shadow-sm",
          "border-border/30 bg-background/85 backdrop-blur-sm hover:border-border/50 hover:bg-background/95"
        )}
      >
        {step.text && (
          <p className="text-[12px] leading-relaxed text-foreground/85 line-clamp-3">{step.text}</p>
        )}

        {/* Tool result badges */}
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

        {/* Screenshot thumbnail inline */}
        {hasScreenshot && (
          <div className="mt-2">
            <ScreenshotInline src={step.screenshot!} />
          </div>
        )}

        {/* Expandable details */}
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

// Small screenshot dot for tree nodes
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

// ---------------------------------------------------------------------------
// Screenshot components
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Build steps from flat events
// ---------------------------------------------------------------------------

function buildTimelineSteps(events: SwarmEvent[]): TimelineStep[] {
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
      if (!cleaned) continue // skip empty after stripping
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
      current.toolCalls.push({ name: event.tool_name || stripAgentTags(event.content), content: stripAgentTags(event.content) })
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

function formatDate(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
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
