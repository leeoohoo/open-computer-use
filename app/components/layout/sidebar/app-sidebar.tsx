"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import { useUser } from "@/lib/user-store/provider"
import {
  UsersThree,
  Desktop,
  Plus,
  Gift,
  Key,
  GitFork,
  ClockCounterClockwise,
  BookOpen,
  VideoCamera,
} from "@phosphor-icons/react"
import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react"
import { DialogCollaborativeAuth } from "../../collaborative/dialog-collaborative-auth"
import { CoastyIcon } from "@/components/icons/coasty"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCredits } from "@/lib/hooks/use-credits"
import { useChats } from "@/lib/chat-store/chats/provider"
import type { UserMachine } from "@/types/machines.types"
import { ReferralPopup } from "../../referral/referral-popup"
import Image from "next/image"
import Link from "next/link"
import { Download } from "lucide-react"
import { WindowsIcon, AppleIcon } from "@/components/icons/platform-icons"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card"

// ─── Easter egg: Konami-lite sequence detector ─────────────────────
function useSecretSequence(sequence: string, onActivate: () => void) {
  const bufferRef = useRef("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.key) return
      bufferRef.current += e.key.toLowerCase()
      if (bufferRef.current.length > sequence.length) {
        bufferRef.current = bufferRef.current.slice(-sequence.length)
      }
      if (bufferRef.current === sequence) {
        onActivate()
        bufferRef.current = ""
      }
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        bufferRef.current = ""
      }, 2000)
    }
    window.addEventListener("keydown", handler)
    return () => {
      window.removeEventListener("keydown", handler)
      clearTimeout(timerRef.current)
    }
  }, [sequence, onActivate])
}

// ─── Hover info type ───────────────────────────────────────────────
type HoverInfo = {
  description: string
  detail: string
  visual: "history" | "swarms" | "guide" | "machines" | "workforce" | "credentials"
}

// ═══════════════════════════════════════════════════════════════════
//  MINI UI DEMO VISUALS — each tells the story of its feature
// ═══════════════════════════════════════════════════════════════════

// Task History: A mini chat list where you see past conversations
// and one gets selected + resumed
function HistoryVisual() {
  const rows = [
    { title: "Research competitors", time: "2h ago", width: "w-16" },
    { title: "Fill out invoice form", time: "5h ago", width: "w-20" },
    { title: "Book flights to NYC", time: "1d ago", width: "w-14" },
    { title: "Scrape pricing data", time: "2d ago", width: "w-[4.5rem]" },
  ]
  return (
    <div className="w-full h-full flex flex-col px-2.5 py-2 gap-[5px]">
      {rows.map((row, i) => (
        <div
          key={i}
          className={cn(
            "shv-row flex items-center gap-2 px-2 py-[5px] rounded-md border transition-all",
            i === 1
              ? "border-foreground/20 bg-foreground/[0.06] shv-selected"
              : "border-transparent"
          )}
          style={{ animationDelay: `${i * 0.08}s` }}
        >
          {/* Avatar dot */}
          <div className={cn(
            "w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center shrink-0",
            i === 1 ? "border-foreground/40 bg-foreground/10" : "border-foreground/15 bg-foreground/[0.04]"
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", i === 1 ? "bg-foreground/50" : "bg-foreground/15")} />
          </div>
          {/* Text lines */}
          <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
            <div className={cn("h-[5px] rounded-full", row.width, i === 1 ? "bg-foreground/35" : "bg-foreground/12")} />
            <div className={cn("h-[3px] w-8 rounded-full", i === 1 ? "bg-foreground/20" : "bg-foreground/8")} />
          </div>
          {/* Resume button appears on selected row */}
          {i === 1 && (
            <div className="shv-resume shrink-0 px-1.5 py-[2px] rounded text-[6px] font-bold border border-foreground/25 text-foreground/50 tracking-wide">
              RESUME
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Swarm Runs: Multiple parallel terminals/browsers each doing work
// with progress bars, converging into a result
function SwarmsVisual() {
  const agents = [
    { label: "A1", progress: 85, delay: "0s" },
    { label: "A2", progress: 60, delay: "0.15s" },
    { label: "A3", progress: 95, delay: "0.3s" },
  ]
  return (
    <div className="w-full h-full flex flex-col px-3 py-2 gap-1.5">
      {/* Agent windows */}
      <div className="flex gap-1.5 flex-1">
        {agents.map((a, i) => (
          <div
            key={i}
            className="shv-row flex-1 flex flex-col rounded border border-foreground/10 overflow-hidden"
            style={{ animationDelay: a.delay }}
          >
            {/* Window header */}
            <div className="flex items-center gap-1 px-1.5 py-[3px] border-b border-foreground/8 bg-foreground/[0.03]">
              <div className="w-1 h-1 rounded-full bg-foreground/20" />
              <div className="w-1 h-1 rounded-full bg-foreground/20" />
              <span className="text-[5px] font-bold text-foreground/30 ml-auto tracking-wider">{a.label}</span>
            </div>
            {/* Terminal content */}
            <div className="flex-1 p-1 flex flex-col justify-end gap-[2px]">
              <div className="h-[2px] w-full bg-foreground/8 rounded-full" />
              <div className="h-[2px] w-3/4 bg-foreground/6 rounded-full" />
              <div className="h-[2px] w-1/2 bg-foreground/10 rounded-full shv-typing" />
            </div>
            {/* Progress bar */}
            <div className="h-[3px] bg-foreground/[0.05]">
              <div
                className="h-full bg-foreground/25 rounded-r-full shv-progress"
                style={{ ["--progress" as string]: `${a.progress}%`, animationDelay: `${0.3 + i * 0.2}s` }}
              />
            </div>
          </div>
        ))}
      </div>
      {/* Converging result */}
      <div className="flex items-center gap-1.5 shv-fade-up" style={{ animationDelay: "0.6s" }}>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-foreground/15 to-foreground/15" />
        <div className="px-2 py-[2px] rounded-full border border-foreground/15 bg-foreground/[0.04] text-[5px] font-bold text-foreground/35 tracking-widest">
          RESULT
        </div>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-foreground/15 to-foreground/15" />
      </div>
    </div>
  )
}

// Guide: A mini docs page with TOC sidebar, reading progress, and
// sections being checked off as you learn
function GuideVisual() {
  const sections = [
    { w: "w-10", done: true },
    { w: "w-8", done: true },
    { w: "w-12", done: false },
    { w: "w-9", done: false },
  ]
  return (
    <div className="w-full h-full flex px-2.5 py-2 gap-2">
      {/* Mini TOC sidebar */}
      <div className="w-12 flex flex-col gap-[5px] pt-1 shv-row" style={{ animationDelay: "0s" }}>
        {sections.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={cn(
              "w-[6px] h-[6px] rounded-full border shrink-0 flex items-center justify-center",
              s.done ? "border-foreground/30 bg-foreground/15 shv-check" : "border-foreground/12"
            )} style={{ animationDelay: `${0.3 + i * 0.25}s` }}>
              {s.done && <div className="w-[2px] h-[2px] rounded-full bg-foreground/50" />}
            </div>
            <div className={cn("h-[3px] rounded-full", s.w, s.done ? "bg-foreground/20" : "bg-foreground/8")} />
          </div>
        ))}
      </div>
      {/* Divider */}
      <div className="w-px bg-foreground/8 self-stretch" />
      {/* Content area */}
      <div className="flex-1 flex flex-col gap-1.5 shv-row" style={{ animationDelay: "0.1s" }}>
        {/* Progress bar */}
        <div className="h-[2px] w-full bg-foreground/8 rounded-full overflow-hidden">
          <div className="h-full bg-foreground/25 rounded-full shv-progress" style={{ ["--progress" as string]: "50%" , animationDelay: "0.4s" }} />
        </div>
        {/* Content blocks */}
        <div className="flex flex-col gap-1">
          <div className="h-[4px] w-3/4 bg-foreground/15 rounded-full" />
          <div className="h-[3px] w-full bg-foreground/8 rounded-full" />
          <div className="h-[3px] w-5/6 bg-foreground/8 rounded-full" />
        </div>
        <div className="flex flex-col gap-1 mt-0.5">
          <div className="h-[4px] w-1/2 bg-foreground/12 rounded-full" />
          <div className="h-[3px] w-full bg-foreground/6 rounded-full" />
          <div className="h-[3px] w-2/3 bg-foreground/6 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// My Computers: Dashboard with machine cards showing status,
// one running with a live indicator, one being launched
function MachinesVisual() {
  return (
    <div className="w-full h-full flex flex-col px-2.5 py-2 gap-1.5">
      {/* Machine cards */}
      {[
        { name: "Cloud VM", os: "Ubuntu", status: "running" as const },
        { name: "My Desktop", os: "macOS", status: "connected" as const },
        { name: "Dev Server", os: "Ubuntu", status: "stopped" as const },
      ].map((m, i) => (
        <div
          key={i}
          className="shv-row flex items-center gap-2 px-2 py-[5px] rounded-md border border-foreground/8 bg-foreground/[0.02]"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          {/* Machine icon */}
          <div className="w-[18px] h-[14px] rounded-[2px] border border-foreground/15 bg-foreground/[0.04] flex items-center justify-center shrink-0">
            <div className="w-2 h-[5px] rounded-[1px] bg-foreground/10" />
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="text-[6px] font-bold text-foreground/40 leading-none tracking-wide">{m.name}</div>
            <div className="text-[5px] text-foreground/20 leading-none mt-[1px]">{m.os}</div>
          </div>
          {/* Status */}
          <div className="flex items-center gap-1 shrink-0">
            <div className={cn(
              "w-[5px] h-[5px] rounded-full",
              m.status === "running" && "bg-emerald-500/60 shv-pulse-dot",
              m.status === "connected" && "bg-blue-500/50 shv-pulse-dot",
              m.status === "stopped" && "bg-foreground/15",
            )} />
            <span className={cn(
              "text-[5px] font-semibold tracking-wide uppercase",
              m.status === "stopped" ? "text-foreground/20" : "text-foreground/35"
            )}>
              {m.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Workforce: A mini timeline showing scheduled tasks at different
// times, one currently executing with animated progress
function WorkforceVisual() {
  const tasks = [
    { time: "9 AM", label: "Send report", x: "left-[10%]", w: "w-[25%]", done: true },
    { time: "1 PM", label: "Scrape data", x: "left-[40%]", w: "w-[20%]", active: true },
    { time: "6 PM", label: "Backup DB", x: "left-[72%]", w: "w-[22%]", upcoming: true },
  ]
  return (
    <div className="w-full h-full flex flex-col justify-center px-3 py-2 gap-2">
      {/* Time axis */}
      <div className="relative h-[2px] w-full bg-foreground/10 rounded-full">
        {/* Progress so far */}
        <div className="absolute left-0 top-0 h-full bg-foreground/20 rounded-full shv-progress" style={{ ["--progress" as string]: "55%", animationDelay: "0.2s" }} />
        {/* Time markers */}
        {["0%", "33%", "66%", "100%"].map((pos, i) => (
          <div key={i} className="absolute top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-foreground/15" style={{ left: pos }} />
        ))}
      </div>
      {/* Task blocks on the timeline */}
      <div className="relative h-10">
        {tasks.map((t, i) => (
          <div
            key={i}
            className={cn(
              "shv-row absolute top-0 flex flex-col rounded border px-1.5 py-[3px]",
              t.x, t.w,
              t.done && "border-foreground/12 bg-foreground/[0.04]",
              t.active && "border-foreground/20 bg-foreground/[0.06]",
              t.upcoming && "border-dashed border-foreground/10 bg-transparent",
            )}
            style={{ animationDelay: `${0.1 + i * 0.15}s` }}
          >
            <span className={cn("text-[5px] font-bold tracking-wide", t.done ? "text-foreground/25" : "text-foreground/40")}>{t.time}</span>
            <span className={cn("text-[5px] truncate", t.done ? "text-foreground/15" : "text-foreground/25")}>{t.label}</span>
            {t.active && (
              <div className="h-[2px] w-full bg-foreground/10 rounded-full mt-[2px] overflow-hidden">
                <div className="h-full bg-foreground/30 rounded-full shv-progress" style={{ ["--progress" as string]: "60%", animationDelay: "0.5s" }} />
              </div>
            )}
            {t.done && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-background border border-foreground/15 flex items-center justify-center shv-check" style={{ animationDelay: "0.5s" }}>
                <svg width="5" height="5" viewBox="0 0 10 10"><path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-foreground/40" /></svg>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Repeat indicator */}
      <div className="flex items-center gap-1 self-end shv-fade-up" style={{ animationDelay: "0.6s" }}>
        <svg width="8" height="8" viewBox="0 0 16 16" className="text-foreground/20">
          <path d="M2 8a6 6 0 0110.5-4M14 8a6 6 0 01-10.5 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M13 1v3.5h-3.5M3 15v-3.5h3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[5px] font-semibold text-foreground/20 tracking-widest">REPEATS DAILY</span>
      </div>
    </div>
  )
}

// Credentials: A mini login form being auto-filled by the agent
// password dots appear one by one, then a success checkmark
function CredentialsVisual() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-4 py-2 gap-2">
      {/* Mini login form */}
      <div className="w-full flex flex-col gap-1.5 shv-row" style={{ animationDelay: "0s" }}>
        {/* URL bar */}
        <div className="flex items-center gap-1 px-2 py-[3px] rounded border border-foreground/10 bg-foreground/[0.03]">
          <svg width="6" height="6" viewBox="0 0 16 16" className="text-foreground/20 shrink-0">
            <rect x="2" y="6" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M5 6V4.5a3 3 0 016 0V6" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <div className="h-[3px] w-16 bg-foreground/10 rounded-full" />
        </div>
        {/* Username field */}
        <div className="flex flex-col gap-[2px]">
          <span className="text-[5px] font-bold text-foreground/25 tracking-wide px-0.5">EMAIL</span>
          <div className="flex items-center px-2 py-[4px] rounded border border-foreground/10 bg-foreground/[0.02]">
            <div className="shv-type-text flex items-center gap-[1px]">
              {Array.from("user@mail.co").map((char, i) => (
                <span
                  key={i}
                  className="text-[6px] text-foreground/40 font-mono shv-type-char"
                  style={{ animationDelay: `${0.3 + i * 0.04}s` }}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* Password field */}
        <div className="flex flex-col gap-[2px]">
          <span className="text-[5px] font-bold text-foreground/25 tracking-wide px-0.5">PASSWORD</span>
          <div className="flex items-center px-2 py-[4px] rounded border border-foreground/10 bg-foreground/[0.02]">
            <div className="flex items-center gap-[3px]">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[4px] h-[4px] rounded-full bg-foreground/30 shv-type-char"
                  style={{ animationDelay: `${0.8 + i * 0.06}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Auto-filled indicator */}
      <div className="flex items-center gap-1.5 shv-fade-up" style={{ animationDelay: "1.4s" }}>
        <div className="w-3 h-3 rounded-full border border-foreground/20 flex items-center justify-center bg-foreground/[0.05]">
          <svg width="6" height="6" viewBox="0 0 10 10"><path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-foreground/50" /></svg>
        </div>
        <span className="text-[6px] font-semibold text-foreground/30 tracking-wide">Auto-filled by Coasty</span>
      </div>
    </div>
  )
}

const visualComponents: Record<string, React.FC> = {
  history: HistoryVisual,
  swarms: SwarmsVisual,
  guide: GuideVisual,
  machines: MachinesVisual,
  workforce: WorkforceVisual,
  credentials: CredentialsVisual,
}

// ─── Nav hover card content ────────────────────────────────────────
function NavHoverContent({
  label,
  info,
}: {
  label: string
  info: HoverInfo
}) {
  const Visual = visualComponents[info.visual]

  return (
    <div className="flex flex-col overflow-hidden -m-4">
      {/* Visual demo area */}
      <div className="relative h-[120px] w-full bg-muted/50 border-b border-border/40 overflow-hidden rounded-t-md">
        {Visual && <Visual />}
      </div>
      {/* Text area */}
      <div className="p-3.5 pt-3">
        <h4 className="text-[13px] font-semibold text-foreground leading-tight">{label}</h4>
        <p className="text-[11px] text-foreground/45 mt-0.5 leading-tight">{info.description}</p>
        <p className="text-[11.5px] text-foreground/60 mt-2 leading-relaxed">
          {info.detail}
        </p>
      </div>
    </div>
  )
}

// ─── Nav button ────────────────────────────────────────────────────
function NavButton({
  icon,
  label,
  tooltip: tooltipText,
  onClick,
  variant = "default",
  id,
  isActive,
  href,
  accentColor,
  hoverInfo,
  livePopup,
}: {
  icon: React.ReactNode
  label: string
  tooltip?: string
  onClick?: () => void
  variant?: "default" | "primary"
  id?: string
  isActive?: boolean
  href?: string
  accentColor?: string
  hoverInfo?: HoverInfo
  livePopup?: ReactNode
}) {
  const { open, isMobile } = useSidebar()
  const expanded = isMobile || open

  const content = (
    <span
      className={cn(
        "group/btn relative flex w-full items-center rounded-lg transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        expanded ? "gap-2.5 px-2.5 py-[7px]" : "justify-center p-2",
        variant === "primary"
          ? cn(
              "bg-sidebar-primary text-sidebar-primary-foreground",
              "shadow-sm hover:shadow-md hover:brightness-110 active:scale-[0.98]"
            )
          : isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-foreground/50 hover:text-foreground hover:bg-sidebar-accent/50"
      )}
    >
      {isActive && variant !== "primary" && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full bg-emerald-500" />
      )}
      <span className={cn(
        "shrink-0 flex items-center justify-center w-4 h-4 transition-colors duration-150",
        isActive && "text-emerald-500"
      )}>
        {icon}
      </span>
      {expanded && (
        <span className={cn(
          "truncate text-[13px] font-medium",
          isActive && "font-semibold text-foreground"
        )}>
          {label}
        </span>
      )}
    </span>
  )

  const linkOrButton = href ? (
    <Link id={id} href={href} className="block w-full" onClick={onClick}>
      {content}
    </Link>
  ) : (
    <button id={id} className="w-full" type="button" onClick={onClick}>
      {content}
    </button>
  )

  // Collapsed: simple tooltip
  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkOrButton}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <div className="flex flex-col">
            <span className="font-medium text-[12px]">{label}</span>
            {tooltipText && (
              <span className="text-[10.5px] text-muted-foreground font-normal">{tooltipText}</span>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  // Expanded with livePopup: data-driven dark popup
  if (livePopup && variant !== "primary") {
    return (
      <HoverCard openDelay={350} closeDelay={200}>
        <HoverCardTrigger asChild>
          {linkOrButton}
        </HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          sideOffset={12}
          className="w-auto p-0 border-0 bg-transparent shadow-none"
        >
          {livePopup}
        </HoverCardContent>
      </HoverCard>
    )
  }

  // Expanded with hoverInfo: visual hover card (fallback)
  if (hoverInfo && variant !== "primary") {
    return (
      <HoverCard openDelay={400} closeDelay={200}>
        <HoverCardTrigger asChild>
          {linkOrButton}
        </HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          sideOffset={16}
          className="w-64 p-4 border border-border/50 shadow-xl rounded-xl"
        >
          <NavHoverContent label={label} info={hoverInfo} />
        </HoverCardContent>
      </HoverCard>
    )
  }

  return linkOrButton
}

// ─── Section label ─────────────────────────────────────────────────
function SectionLabel({ children, expanded }: { children: React.ReactNode; expanded: boolean }) {
  if (!expanded) return <div className="mx-auto my-1 w-4 h-px bg-sidebar-border/20 rounded-full" />
  return (
    <div className="text-[10px] font-semibold text-foreground/30 uppercase tracking-[0.08em] mb-1 px-2.5 select-none">
      {children}
    </div>
  )
}

// ─── Credits sparkline background ───────────────────────────────────
function CreditsSparkBg({ balance, totalUsed, className }: { balance: number; totalUsed: number; className?: string }) {
  // Generate a gentle curve representing usage pattern
  const total = balance + totalUsed
  const pct = total > 0 ? balance / total : 1

  // Build a smooth sparkline path — 8 points across the width
  // Simulates a usage curve: starts high, dips with usage, current level at end
  const w = 200
  const h = 40
  const pad = 2
  const points = 8
  const values: number[] = []
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1)
    // Curve: starts at ~total level, smoothly transitions to current balance level
    const base = pct + (1 - pct) * (1 - t) * (0.6 + 0.4 * Math.sin(t * Math.PI))
    // Add subtle variation
    const jitter = Math.sin(t * Math.PI * 3) * 0.06 + Math.cos(t * Math.PI * 1.5) * 0.04
    values.push(Math.min(1, Math.max(0.05, base + jitter)))
  }

  // Build SVG path with smooth cubic bezier curves
  const getX = (i: number) => pad + (i / (points - 1)) * (w - pad * 2)
  const getY = (v: number) => h - pad - v * (h - pad * 2)

  let d = `M ${getX(0)} ${getY(values[0])}`
  for (let i = 1; i < points; i++) {
    const cpx1 = getX(i - 1) + (getX(i) - getX(i - 1)) / 3
    const cpx2 = getX(i) - (getX(i) - getX(i - 1)) / 3
    d += ` C ${cpx1} ${getY(values[i - 1])}, ${cpx2} ${getY(values[i])}, ${getX(i)} ${getY(values[i])}`
  }

  // Area fill path (close to bottom)
  const areaD = d + ` L ${getX(points - 1)} ${h} L ${getX(0)} ${h} Z`

  return (
    <svg
      className={cn("absolute inset-0 w-full h-full", className)}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="spark-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#spark-fill)" />
      <path d={d} fill="none" stroke="url(#spark-line)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Machines activity bars background ───────────────────────────────
function MachinesActivityBg({
  running, stopped, total, className,
}: { running: number; stopped: number; total: number; className?: string }) {
  const w = 200
  const h = 44
  const bars = 12
  const barW = 8
  const gap = (w - bars * barW) / (bars + 1)

  // Generate bar heights: active machines = taller bars, creates a skyline feel
  const activePct = total > 0 ? running / total : 0
  const barHeights: number[] = []
  for (let i = 0; i < bars; i++) {
    const t = i / (bars - 1)
    // Wave pattern with activity influence
    const wave = Math.sin(t * Math.PI * 2.2 + 0.5) * 0.3
    const peak = Math.exp(-Math.pow((t - 0.65) * 3, 2)) * 0.4
    const base = 0.15 + activePct * 0.35 + wave * 0.15 + peak
    barHeights.push(Math.min(0.95, Math.max(0.08, base)))
  }

  return (
    <svg
      className={cn("absolute inset-0 w-full h-full", className)}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="bar-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {barHeights.map((h_pct, i) => {
        const x = gap + i * (barW + gap)
        const barH = h_pct * (h - 4)
        const y = h - 2 - barH
        // Bars toward the right (recent) are slightly brighter
        const opacity = 0.4 + (i / (bars - 1)) * 0.6
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={2.5}
            fill="url(#bar-fill)"
            opacity={opacity}
          />
        )
      })}
    </svg>
  )
}

// ─── Shared popup shell (theme-aware) ────────────────────────────────
function PopupShell({ children, width = "w-72" }: { children: ReactNode; width?: string }) {
  return (
    <div className={cn(width, "rounded-xl overflow-hidden border border-border/60 bg-popover shadow-2xl dark:border-white/[0.06]")}>
      {children}
    </div>
  )
}

function GlassSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-3 mb-3 rounded-lg backdrop-blur-[3px] bg-foreground/[0.03] border border-foreground/[0.06] px-3 pt-2.5 pb-2", className)}>
      {children}
    </div>
  )
}

// ─── Task History live popup ────────────────────────────────────────
function HistoryLivePopup({ chats }: { chats: { id: string; title: string | null; updated_at: string | null; last_message_preview?: string }[] }) {
  const recent = chats.slice(0, 5)

  const timeAgo = (d: string | null) => {
    if (!d) return ""
    const ms = Date.now() - new Date(d).getTime()
    if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))}m ago`
    if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
    return `${Math.round(ms / 86_400_000)}d ago`
  }

  return (
    <PopupShell>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-popover-foreground">{chats.length} Tasks</span>
          <span className="text-[10px] text-muted-foreground">Recent activity</span>
        </div>
      </div>
      <GlassSection>
        <div className="space-y-1.5">
          {recent.map((c, i) => (
            <div key={c.id} className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors",
              i === 0 ? "bg-foreground/[0.04] border border-foreground/[0.06]" : ""
            )}>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                i === 0 ? "bg-blue-400" : "bg-foreground/15"
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-popover-foreground/70 truncate font-medium">
                  {c.title || "Untitled"}
                </p>
                {c.last_message_preview && (
                  <p className="text-[9px] text-muted-foreground truncate">{c.last_message_preview}</p>
                )}
              </div>
              <span className="text-[9px] text-muted-foreground/60 shrink-0 tabular-nums">{timeAgo(c.updated_at)}</span>
            </div>
          ))}
        </div>
      </GlassSection>
      <Link href="/history" className="block px-4 pb-3 hover:opacity-80 transition-opacity">
        <span className="text-[10px] font-medium text-blue-500 dark:text-blue-400">View all history →</span>
      </Link>
    </PopupShell>
  )
}

// ─── Swarm Runs live popup ──────────────────────────────────────────
function SwarmsLivePopup({ swarms }: { swarms: { swarm_id: string; status?: string; created_at: string; prompt?: string; machine_count?: number }[] }) {
  const recent = swarms.slice(0, 4)

  const statusColor = (s?: string) => {
    if (s === "running") return "bg-violet-500 dark:bg-violet-400 shadow-[0_0_4px_rgba(139,92,246,0.5)]"
    if (s === "completed") return "bg-emerald-500 dark:bg-emerald-400"
    if (s === "failed") return "bg-red-500 dark:bg-red-400"
    return "bg-foreground/20"
  }

  const timeAgo = (d: string) => {
    const ms = Date.now() - new Date(d).getTime()
    if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))}m ago`
    if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
    return `${Math.round(ms / 86_400_000)}d ago`
  }

  const running = swarms.filter(s => s.status === "running").length
  const completed = swarms.filter(s => s.status === "completed").length

  return (
    <PopupShell>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-popover-foreground">{swarms.length} Swarm Runs</span>
          {running > 0 && (
            <span className="text-[10px] text-violet-500 dark:text-violet-400 font-medium">{running} active</span>
          )}
        </div>
        <div className="flex gap-3 mt-1.5">
          {running > 0 && <span className="text-[9px] text-muted-foreground">{running} running</span>}
          {completed > 0 && <span className="text-[9px] text-muted-foreground">{completed} completed</span>}
        </div>
      </div>
      <GlassSection>
        <div className="space-y-1.5">
          {recent.map((s) => (
            <div key={s.swarm_id} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusColor(s.status))} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-popover-foreground/70 truncate font-medium">
                  {s.prompt ? s.prompt.slice(0, 50) : `Swarm ${s.swarm_id.slice(0, 8)}`}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {s.machine_count ? `${s.machine_count} machines` : ""}{s.machine_count && s.status ? " · " : ""}{s.status || ""}
                </p>
              </div>
              <span className="text-[9px] text-muted-foreground/60 shrink-0 tabular-nums">{timeAgo(s.created_at)}</span>
            </div>
          ))}
        </div>
      </GlassSection>
      <Link href="/swarms" className="block px-4 pb-3 hover:opacity-80 transition-opacity">
        <span className="text-[10px] font-medium text-violet-500 dark:text-violet-400">View all swarms →</span>
      </Link>
    </PopupShell>
  )
}

// ─── Workforce/Schedules live popup ─────────────────────────────────
function WorkforceLivePopup({ schedules }: { schedules: { chat_id: string; title: string | null; enabled: boolean; frequency: string; next_run_at: string | null; run_count: number; consecutive_failures: number }[] }) {
  const recent = schedules.slice(0, 4)
  const active = schedules.filter(s => s.enabled).length
  const totalRuns = schedules.reduce((acc, s) => acc + s.run_count, 0)

  const formatNext = (d: string | null) => {
    if (!d) return "Not scheduled"
    const ms = new Date(d).getTime() - Date.now()
    if (ms < 0) return "Overdue"
    if (ms < 60_000) return "< 1 min"
    if (ms < 3_600_000) return `in ${Math.round(ms / 60_000)}m`
    if (ms < 86_400_000) return `in ${Math.round(ms / 3_600_000)}h`
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  return (
    <PopupShell>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-popover-foreground">{schedules.length} Schedules</span>
          <span className="text-[10px] text-muted-foreground">{totalRuns} total runs</span>
        </div>
        <div className="flex gap-3 mt-1.5">
          <span className="text-[9px] text-amber-500 dark:text-amber-400/70">{active} active</span>
          <span className="text-[9px] text-muted-foreground">{schedules.length - active} paused</span>
        </div>
      </div>
      <GlassSection>
        <div className="space-y-1.5">
          {recent.map((s) => (
            <div key={s.chat_id} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                s.enabled ? "bg-amber-500 dark:bg-amber-400" : "bg-foreground/15",
                s.consecutive_failures > 0 && "bg-red-500 dark:bg-red-400"
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-popover-foreground/70 truncate font-medium">
                  {s.title || "Untitled schedule"}
                </p>
                <p className="text-[9px] text-muted-foreground">{s.frequency} · {s.run_count} runs</p>
              </div>
              <span className={cn(
                "text-[9px] shrink-0 tabular-nums",
                s.enabled ? "text-amber-500/60 dark:text-amber-400/50" : "text-muted-foreground/50"
              )}>
                {s.enabled ? formatNext(s.next_run_at) : "paused"}
              </span>
            </div>
          ))}
        </div>
      </GlassSection>
      <Link href="/schedules" className="block px-4 pb-3 hover:opacity-80 transition-opacity">
        <span className="text-[10px] font-medium text-amber-500 dark:text-amber-400">View all schedules →</span>
      </Link>
    </PopupShell>
  )
}

// ─── Credentials live popup ─────────────────────────────────────────
function CredentialsLivePopup({ secrets }: { secrets: { id: string; name: string; service: string; username: string; updatedAt: string }[] }) {
  const recent = secrets.slice(0, 4)

  const timeAgo = (d: string) => {
    const ms = Date.now() - new Date(d).getTime()
    if (ms < 86_400_000) return "today"
    if (ms < 172_800_000) return "yesterday"
    return `${Math.round(ms / 86_400_000)}d ago`
  }

  return (
    <PopupShell>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-popover-foreground">{secrets.length} Credentials</span>
          <span className="text-[10px] text-muted-foreground">Encrypted vault</span>
        </div>
      </div>
      <GlassSection>
        <div className="space-y-1.5">
          {recent.map((s) => (
            <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
              <div className="w-5 h-5 rounded bg-foreground/[0.06] border border-foreground/[0.08] flex items-center justify-center shrink-0">
                <Key size={10} weight="duotone" className="text-rose-500/70 dark:text-rose-400/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-popover-foreground/70 truncate font-medium">{s.name || s.service}</p>
                <p className="text-[9px] text-muted-foreground truncate">{s.username}</p>
              </div>
              <span className="text-[9px] text-muted-foreground/50 shrink-0 tabular-nums">{timeAgo(s.updatedAt)}</span>
            </div>
          ))}
        </div>
      </GlassSection>
      <Link href="/secrets" className="block px-4 pb-3 hover:opacity-80 transition-opacity">
        <span className="text-[10px] font-medium text-rose-500 dark:text-rose-400">Manage credentials →</span>
      </Link>
    </PopupShell>
  )
}

// ─── Credits usage graph for hover popup ────────────────────────────
function CreditsUsageGraph({
  balance,
  totalUsed,
  totalPurchased,
  isLow,
}: {
  balance: number
  totalUsed: number
  totalPurchased: number
  isLow: boolean
}) {
  const total = balance + totalUsed
  const usedPct = total > 0 ? totalUsed / total : 0

  // 7 days of usage distributed from totalUsed with a natural curve
  // Deterministic weights (no Math.random — avoids SSR hydration mismatch)
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const weights = [0.18, 0.16, 0.2, 0.14, 0.12, 0.08, 0.12]
  const fallbackWeights = [0.35, 0.25, 0.45, 0.3, 0.2, 0.15, 0.28]
  const maxWeight = Math.max(...weights)
  // Normalize to 0–1 range where 1 = tallest bar
  const barValues = weights.map((w, i) =>
    totalUsed > 0 ? w / maxWeight : fallbackWeights[i]
  )

  const barMaxH = 52 // max bar height in px

  const accentColor = isLow ? "text-orange-500 dark:text-orange-400" : "text-emerald-500 dark:text-emerald-400"
  const accentBg = isLow ? "bg-orange-500 dark:bg-orange-400" : "bg-emerald-500 dark:bg-emerald-400"
  const accentFill = isLow
    ? "from-orange-500/30 to-orange-500/5 dark:from-orange-400/30 dark:to-orange-400/5"
    : "from-emerald-500/30 to-emerald-500/5 dark:from-emerald-400/30 dark:to-emerald-400/5"

  return (
    <PopupShell>
      {/* Header stats */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <span className={cn("text-xl font-bold tabular-nums", isLow ? "text-orange-500 dark:text-orange-400" : "text-popover-foreground")}>
              {balance.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground ml-1.5 font-medium">credits left</span>
          </div>
          {totalPurchased > 0 && (
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">
              of {totalPurchased.toLocaleString()}
            </span>
          )}
        </div>

        {/* Usage bar */}
        <div className="h-1.5 w-full bg-foreground/[0.06] rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", accentBg, "opacity-60")}
            style={{ width: `${Math.max(2, usedPct * 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] text-muted-foreground">Used: {totalUsed.toLocaleString()}</span>
          <span className={cn("text-[9px]", isLow ? "text-orange-500/60 dark:text-orange-400/60" : "text-muted-foreground")}>
            {(usedPct * 100).toFixed(0)}% consumed
          </span>
        </div>
      </div>

      {/* Graph area with glass effect */}
      <GlassSection>
        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider mb-2">Usage this week</p>

        {/* Bar chart — fixed pixel heights for reliable rendering */}
        <div className="flex items-end gap-[6px]" style={{ height: `${barMaxH}px` }}>
          {barValues.map((v, i) => {
            const h = Math.max(3, Math.round(v * barMaxH))
            return (
              <div key={i} className="flex-1 relative rounded-sm overflow-hidden" style={{ height: `${h}px` }}>
                <div className={cn("absolute inset-0 rounded-sm bg-gradient-to-t", accentFill)} />
                <div className={cn("absolute bottom-0 inset-x-0 h-[2px] rounded-full", accentBg, "opacity-50")} />
              </div>
            )
          })}
        </div>

        {/* Day labels */}
        <div className="flex gap-[6px] mt-1.5">
          {days.map((d, i) => (
            <span key={i} className="flex-1 text-center text-[8px] text-muted-foreground/60 font-medium">
              {d}
            </span>
          ))}
        </div>
      </GlassSection>

      {/* Footer hint */}
      <Link href="/account?section=billing" className="block px-4 pb-3 hover:opacity-80 transition-opacity">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">10 credits / minute of usage</span>
          <span className={cn("text-[10px] font-medium", accentColor)}>
            View billing →
          </span>
        </div>
      </Link>
    </PopupShell>
  )
}

// ─── Main sidebar ──────────────────────────────────────────────────
export function AppSidebar() {
  const isMobile = useBreakpoint(768)
  const { setOpenMobile, open, isMobile: isMobileSidebar } = useSidebar()
  const expanded = isMobileSidebar || open
  const { user } = useUser()
  const pathname = usePathname()

  const [isCollaborativeAuthDialogOpen, setIsCollaborativeAuthDialogOpen] = useState(false)
  const [isReferralPopupOpen, setIsReferralPopupOpen] = useState(false)

  const router = useRouter()
  const { credits } = useCredits()

  // ─── Machines state ────────────────────────────────────────────
  const [sidebarMachines, setSidebarMachines] = useState<UserMachine[]>([])

  useEffect(() => {
    if (!user) return
    const fetchMachines = async () => {
      try {
        const res = await fetch("/api/machines")
        if (res.ok) {
          const data = await res.json()
          setSidebarMachines(data.machines || [])
        }
      } catch { /* silent */ }
    }
    fetchMachines()
    const interval = setInterval(fetchMachines, 15000)
    return () => clearInterval(interval)
  }, [user])

  const machineStats = useMemo(() => {
    const running = sidebarMachines.filter(m => m.status === "running" || (m as any).electronConnected).length
    const stopped = sidebarMachines.filter(m => m.status === "stopped").length
    const creating = sidebarMachines.filter(m => ["creating", "starting"].includes(m.status)).length
    const total = sidebarMachines.length
    return { running, stopped, creating, total }
  }, [sidebarMachines])

  // ─── Sidebar hover data (lazy-loaded for popups) ─────────────
  const { chats: allChats } = useChats()

  const [sidebarSwarms, setSidebarSwarms] = useState<{ swarm_id: string; status?: string; created_at: string; prompt?: string; machine_count?: number }[]>([])
  const [sidebarSchedules, setSidebarSchedules] = useState<{ chat_id: string; title: string | null; enabled: boolean; frequency: string; next_run_at: string | null; run_count: number; consecutive_failures: number }[]>([])
  const [sidebarSecrets, setSidebarSecrets] = useState<{ id: string; name: string; service: string; username: string; updatedAt: string }[]>([])

  useEffect(() => {
    if (!user) return

    // Fetch swarm runs
    fetch("/api/swarms").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.swarms) setSidebarSwarms(d.swarms)
    }).catch(() => {})

    // Fetch schedules
    fetch("/api/schedules").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.schedules) setSidebarSchedules(d.schedules)
    }).catch(() => {})

    // Fetch credentials
    fetch("/api/secrets").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.secrets) setSidebarSecrets(d.secrets)
    }).catch(() => {})
  }, [user])

  // ─── Easter egg states ───────────────────────────────────────
  const [logoClicks, setLogoClicks] = useState(0)
  const [partyMode, setPartyMode] = useState(false)
  const [avatarWobble, setAvatarWobble] = useState(false)
  const avatarHoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (logoClicks >= 7) {
      setPartyMode(true)
      const t = setTimeout(() => {
        setPartyMode(false)
        setLogoClicks(0)
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [logoClicks])

  const [rainbowMode, setRainbowMode] = useState(false)
  useSecretSequence("coast", useCallback(() => {
    setRainbowMode(true)
    setTimeout(() => setRainbowMode(false), 4000)
  }, []))

  const handleNavigation = (navigationFn: () => void) => {
    navigationFn()
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const closeMobileIfNeeded = () => {
    if (isMobile) setOpenMobile(false)
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 5) return "Night owl"
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    if (h < 21) return "Good evening"
    return "Night owl"
  }

  const isItemActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname?.startsWith(href) || false
  }

  return (
    <>
      <Sidebar
        side="left"
        variant="sidebar"
        collapsible="icon"
        style={{
          "--sidebar-width": "14rem",
        } as React.CSSProperties}
      >
        {/* ─── Header ─────────────────────────────────────── */}
        <SidebarHeader className="p-0">
          <div className={cn(
            "flex items-center min-h-[52px]",
            expanded ? "px-3 py-2.5" : "justify-center py-2.5"
          )}>
            <button
              onClick={() => {
                setLogoClicks(c => c + 1)
                handleNavigation(() => router.push("/"))
              }}
              className={cn(
                "flex items-center rounded-lg transition-all duration-200 ease-out",
                "hover:bg-sidebar-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                expanded ? "gap-2.5 flex-1 min-w-0 p-1.5" : "p-2 justify-center"
              )}
              title="Coasty"
            >
              <div className={cn(
                "flex h-7 w-7 items-center justify-center shrink-0 transition-transform duration-500",
                partyMode && "animate-spin"
              )}>
                <CoastyIcon className="h-6 w-6 text-sidebar-primary" />
              </div>
              {expanded && (
                <span className="text-sm font-semibold text-foreground leading-normal truncate">
                  Coasty
                </span>
              )}
            </button>
          </div>
        </SidebarHeader>

        {/* ─── Content ────────────────────────────────────── */}
        <SidebarContent
          className={cn(
            "pt-1 overflow-y-auto overflow-x-hidden",
            expanded ? "px-2.5" : "px-1.5",
            rainbowMode && "rainbow-wave"
          )}
        >
          {/* New Task */}
          <div className={cn("relative", expanded ? "pb-2 mb-0.5" : "pb-1 mb-0.5")}>
            <NavButton
              icon={<Plus size={16} weight="bold" className="shrink-0" />}
              label="New Task"
              tooltip="Start a new AI automation"
              onClick={() => handleNavigation(() => router.push("/"))}
              variant="primary"
            />
          </div>

          {/* Divider */}
          <div className={cn(
            "mx-auto mb-2 transition-all",
            expanded ? "w-[calc(100%-1.25rem)] h-px bg-sidebar-border/30" : "w-5 h-px bg-sidebar-border/20"
          )} />

          {/* Activity */}
          <div className="relative pb-1">
            <SectionLabel expanded={expanded}>Activity</SectionLabel>
            <div className="space-y-0.5">
              <NavButton
                id="sidebar-history-link"
                icon={<ClockCounterClockwise size={16} weight="duotone" className="shrink-0" />}
                label="Task History"
                tooltip="Review past tasks and resume where you left off"
                href="/history"
                isActive={isItemActive("/history")}
                accentColor="text-blue-500"
                onClick={closeMobileIfNeeded}
                livePopup={allChats.length > 0 ? <HistoryLivePopup chats={allChats} /> : undefined}
                hoverInfo={{
                  description: "Your recent tasks",
                  detail: "Browse and continue past conversations. Every task is saved so you can resume right where you left off.",
                  visual: "history",
                }}
              />
              <NavButton
                id="sidebar-swarms-link"
                icon={<GitFork size={16} weight="duotone" className="shrink-0" />}
                label="Swarm Runs"
                tooltip="Monitor multi-agent parallel workflows"
                href="/swarms"
                isActive={isItemActive("/swarms")}
                accentColor="text-violet-500"
                onClick={closeMobileIfNeeded}
                livePopup={sidebarSwarms.length > 0 ? <SwarmsLivePopup swarms={sidebarSwarms} /> : undefined}
                hoverInfo={{
                  description: "Multi-agent workflows",
                  detail: "Run tasks across multiple machines in parallel. Each agent works independently and results converge automatically.",
                  visual: "swarms",
                }}
              />
              <NavButton
                id="sidebar-guide-link"
                icon={<BookOpen size={16} weight="duotone" className="shrink-0" />}
                label="Guide"
                tooltip="Learn how to get the most from Coasty"
                href="/guide"
                isActive={isItemActive("/guide")}
                accentColor="text-emerald-500"
                onClick={closeMobileIfNeeded}
                hoverInfo={{
                  description: "Getting started",
                  detail: "Step-by-step walkthroughs and best practices to help you automate effectively.",
                  visual: "guide",
                }}
              />
            </div>
          </div>

          {/* Infrastructure */}
          <div className="relative pb-1 mt-1">
            <SectionLabel expanded={expanded}>Infrastructure</SectionLabel>
            <div className="space-y-0.5">
              {/* My Computers — expanded card */}
              {expanded ? (
                <button
                  id="sidebar-machines-link"
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-xl border transition-all duration-200 overflow-hidden",
                    "hover:shadow-sm active:scale-[0.99]",
                    "px-3 py-2.5",
                    isItemActive("/machines")
                      ? "border-foreground/15 bg-foreground/[0.04]"
                      : "border-sidebar-border/40 bg-sidebar-accent/20 hover:border-foreground/15"
                  )}
                  type="button"
                  onClick={() => {
                    router.push("/machines")
                    closeMobileIfNeeded()
                  }}
                >
                  {isItemActive("/machines") && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full bg-emerald-500" />
                  )}
                  <MachinesActivityBg
                    running={machineStats.running}
                    stopped={machineStats.stopped}
                    total={machineStats.total}
                    className={cn("pointer-events-none", isItemActive("/machines") ? "text-emerald-500/80" : "text-foreground/80")}
                  />
                  <div className="relative flex flex-col items-start flex-1 min-w-0">
                    <span className="text-base font-semibold tabular-nums leading-tight text-foreground">
                      {machineStats.total}
                    </span>
                    <span className="text-[10px] text-foreground/40 font-medium">
                      {machineStats.total === 1 ? "Computer" : "Computers"}
                      {machineStats.running > 0 && (
                        <span className="text-emerald-500 ml-1.5">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)] align-middle mr-0.5" />
                          {machineStats.running} active
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="relative text-[10px] font-semibold px-2 py-1 rounded-md transition-colors shrink-0 bg-foreground/[0.06] text-foreground/60 group-hover:bg-foreground/[0.1]">
                    View
                  </span>
                </button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      id="sidebar-machines-link"
                      className={cn(
                        "relative flex w-full items-center justify-center p-2 rounded-lg border transition-all duration-200 overflow-hidden",
                        "hover:shadow-sm",
                        isItemActive("/machines")
                          ? "border-foreground/15 bg-foreground/[0.04]"
                          : "border-sidebar-border/40 bg-sidebar-accent/20 hover:border-foreground/15"
                      )}
                      onClick={() => router.push("/machines")}
                    >
                      <MachinesActivityBg
                        running={machineStats.running}
                        stopped={machineStats.stopped}
                        total={machineStats.total}
                        className={cn("pointer-events-none", isItemActive("/machines") ? "text-emerald-500/80" : "text-foreground/80")}
                      />
                      <Desktop size={16} weight="duotone" className={isItemActive("/machines") ? "relative text-emerald-500" : "relative text-foreground/60"} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">{machineStats.total}</span>
                      <span className="text-muted-foreground">{machineStats.total === 1 ? "computer" : "computers"}</span>
                      {machineStats.running > 0 && (
                        <span className="text-emerald-500">({machineStats.running} active)</span>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              <NavButton
                id="sidebar-schedules-link"
                icon={<UsersThree size={16} weight="duotone" className="shrink-0" />}
                label="Workforce"
                tooltip="Schedule automated agents and triggers"
                href="/schedules"
                isActive={isItemActive("/schedules")}
                accentColor="text-amber-500"
                onClick={closeMobileIfNeeded}
                livePopup={sidebarSchedules.length > 0 ? <WorkforceLivePopup schedules={sidebarSchedules} /> : undefined}
                hoverInfo={{
                  description: "Scheduled automation",
                  detail: "Set up recurring tasks with cron schedules and agent-to-agent triggers. Your workforce runs while you sleep.",
                  visual: "workforce",
                }}
              />
              <NavButton
                id="sidebar-secrets-link"
                icon={<Key size={16} weight="duotone" className="shrink-0" />}
                label="Credentials"
                tooltip="Securely store logins for agent access"
                href="/secrets"
                isActive={isItemActive("/secrets")}
                accentColor="text-rose-500"
                onClick={closeMobileIfNeeded}
                livePopup={sidebarSecrets.length > 0 ? <CredentialsLivePopup secrets={sidebarSecrets} /> : undefined}
                hoverInfo={{
                  description: "Secure credential vault",
                  detail: "Store logins and API keys with encryption. Agents auto-fill credentials without exposing raw values.",
                  visual: "credentials",
                }}
              />
            </div>
          </div>

{/* Desktop App Promo */}
          {isMobile ? (
            /* ── Mobile: compact inline card (no image, no hover) ── */
            <Link
              href="/download"
              className="group flex items-center gap-3 mx-1 mt-auto mb-1 px-3 py-2.5 rounded-xl border border-sidebar-border/40 bg-sidebar-accent/20 hover:border-foreground/15 transition-all duration-200 active:scale-[0.99]"
              onClick={closeMobileIfNeeded}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/[0.06] shrink-0">
                <Download size={15} className="text-foreground/60" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-semibold text-foreground leading-tight block">
                  Get Desktop App
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] text-foreground/40">
                    <WindowsIcon width={9} height={9} className="opacity-60" />
                    Windows
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-foreground/40">
                    <AppleIcon width={9} height={9} className="opacity-60" />
                    macOS
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-md shrink-0 bg-sidebar-primary/10 text-sidebar-primary">
                Download
              </span>
            </Link>
          ) : (
            /* ── Desktop: image card with hover popup ── */
            <HoverCard openDelay={300} closeDelay={200}>
              <HoverCardTrigger asChild>
                {expanded ? (
                  <Link
                    href="/download"
                    className="group relative block mx-1 mt-auto mb-1 rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/[0.15] transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                  >
                    <div className="relative">
                      <Image
                        src="/demo-screenshot.png"
                        alt="Coasty Desktop App"
                        width={728}
                        height={408}
                        className="w-full h-auto"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                      <div className="absolute bottom-0 inset-x-0 p-3">
                        <div className="rounded-md backdrop-blur-[3px] bg-white/[0.04] border border-white/[0.06] px-2.5 py-2">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Download size={12} className="text-white/90" />
                            <span className="text-[11px] font-semibold text-white/90">
                              Download Desktop App
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] text-white/60">
                              <WindowsIcon width={10} height={10} className="opacity-70" />
                              Windows
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-white/60">
                              <AppleIcon width={10} height={10} className="opacity-70" />
                              macOS
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <Link
                    href="/download"
                    className="flex w-full items-center justify-center p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors"
                  >
                    <Download size={16} className="shrink-0 text-foreground/50" />
                  </Link>
                )}
              </HoverCardTrigger>
              <HoverCardContent
                side="right"
                align="end"
                sideOffset={12}
                className="w-72 p-0 border-0 bg-transparent shadow-none overflow-hidden rounded-xl"
              >
                <div className="relative rounded-xl overflow-hidden">
                  <Image
                    src="/demo-screenshot.png"
                    alt="Coasty Desktop App"
                    width={728}
                    height={408}
                    className="w-full h-auto"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
                  <div className="absolute inset-0 flex flex-col justify-end p-3.5">
                    <div className="rounded-lg backdrop-blur-[3px] bg-white/[0.04] border border-white/[0.06] px-3 py-2.5">
                      <p className="text-[11px] font-semibold text-white/90 leading-tight">
                        Control your computer remotely
                      </p>
                      <p className="text-[10px] text-white/50 leading-snug mt-1">
                        Install the desktop app and run tasks on your PC from this dashboard — anywhere, anytime.
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-[9px] text-white/50">
                          <WindowsIcon width={9} height={9} className="opacity-60" />
                          Windows
                        </span>
                        <span className="inline-flex items-center gap-1 text-[9px] text-white/50">
                          <AppleIcon width={9} height={9} className="opacity-60" />
                          macOS
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
        </SidebarContent>

        {/* ─── Footer ─────────────────────────────────────── */}
        <SidebarFooter className="relative pt-0">
          <div className={cn("space-y-1", expanded ? "p-2.5 pt-1" : "p-1.5 pt-1")}>

            {/* Credits */}
            {user && (() => {
              const balance = credits?.balance || 0
              const totalUsed = credits?.total_used || 0
              const totalPurchased = credits?.total_purchased || 0
              const isLow = balance > 0 && balance < 50

              return (
                <HoverCard openDelay={350} closeDelay={200}>
                  <HoverCardTrigger asChild>
                    {expanded ? (
                      <button
                        className={cn(
                          "group relative flex w-full items-center gap-3 rounded-xl border transition-all duration-200 overflow-hidden",
                          "hover:shadow-sm active:scale-[0.99]",
                          "px-3 py-2.5",
                          isLow
                            ? "border-orange-500/20 bg-orange-500/[0.04] hover:border-orange-500/30"
                            : "border-sidebar-border/40 bg-sidebar-accent/20 hover:border-sidebar-primary/20"
                        )}
                        type="button"
                        onClick={() => {
                          router.push("/account?section=billing")
                          if (isMobile) setOpenMobile(false)
                        }}
                      >
                        <CreditsSparkBg
                          balance={balance}
                          totalUsed={totalUsed}
                          className={cn(
                            "pointer-events-none",
                            isLow ? "text-orange-500" : "text-sidebar-primary"
                          )}
                        />
                        <div className="relative flex flex-col items-start flex-1 min-w-0">
                          <span className={cn(
                            "text-base font-semibold tabular-nums leading-tight",
                            isLow ? "text-orange-500" : "text-foreground"
                          )}>
                            {balance.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-foreground/40 font-medium">
                            {isLow ? "Credits — Running low" : "Credits"}
                          </span>
                        </div>
                        <span className={cn(
                          "relative text-[10px] font-semibold px-2 py-1 rounded-md transition-colors shrink-0",
                          "bg-sidebar-primary/10 text-sidebar-primary group-hover:bg-sidebar-primary/20"
                        )}>
                          Buy
                        </span>
                      </button>
                    ) : (
                      <button
                        className={cn(
                          "relative flex w-full items-center justify-center p-2 rounded-lg border transition-all duration-200 overflow-hidden",
                          "hover:shadow-sm",
                          isLow
                            ? "border-orange-500/20 bg-orange-500/[0.04]"
                            : "border-sidebar-border/40 bg-sidebar-accent/20"
                        )}
                        onClick={() => router.push("/account?section=billing")}
                      >
                        <CreditsSparkBg
                          balance={balance}
                          totalUsed={totalUsed}
                          className={cn(
                            "pointer-events-none",
                            isLow ? "text-orange-500" : "text-sidebar-primary"
                          )}
                        />
                      </button>
                    )}
                  </HoverCardTrigger>
                  <HoverCardContent
                    side="right"
                    align="end"
                    sideOffset={12}
                    className="w-auto p-0 border-0 bg-transparent shadow-none"
                  >
                    <CreditsUsageGraph
                      balance={balance}
                      totalUsed={totalUsed}
                      totalPurchased={totalPurchased}
                      isLow={isLow}
                    />
                  </HoverCardContent>
                </HoverCard>
              )
            })()}

            {/* Divider */}
            <div className={cn(
              "mx-auto transition-all",
              expanded ? "w-[calc(100%-1.25rem)] h-px bg-sidebar-border/20" : "w-5 h-px bg-sidebar-border/15"
            )} />

            {/* Quick links row */}
            {expanded ? (
              <div className="flex items-center gap-1">
                <a
                  href="https://cal.com/coasty/15min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition-all duration-200",
                    "text-foreground/50 hover:text-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <VideoCamera size={14} weight="duotone" />
                  <span>Talk to us</span>
                </a>
                {user && (
                  <Link
                    href="/referral"
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition-all duration-200",
                      "text-foreground/50 hover:text-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Gift size={14} weight="duotone" />
                    <span>Invite & Earn</span>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href="https://cal.com/coasty/15min"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors"
                    >
                      <VideoCamera size={16} weight="duotone" className="shrink-0 text-foreground/50" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>Talk to us</TooltipContent>
                </Tooltip>
                {user && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href="/referral"
                        className="flex w-full items-center justify-center p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors"
                      >
                        <Gift size={16} weight="duotone" className="shrink-0 text-foreground/50" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>Invite & Earn</TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}

            {/* User Account */}
            {expanded ? (
              <button
                onClick={() => router.push("/account")}
                onMouseEnter={() => {
                  avatarHoverTimer.current = setTimeout(() => setAvatarWobble(true), 3000)
                }}
                onMouseLeave={() => {
                  clearTimeout(avatarHoverTimer.current)
                  setAvatarWobble(false)
                }}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-2 w-full rounded-xl transition-all duration-200 ease-out",
                  "hover:bg-sidebar-accent/60"
                )}
              >
                <Avatar className={cn(
                  "h-8 w-8 flex-shrink-0 ring-2 ring-sidebar-border/30 transition-all",
                  avatarWobble && "animate-wiggle"
                )}>
                  <AvatarImage src={user?.profile_image || undefined} />
                  <AvatarFallback className="bg-sidebar-accent text-foreground text-xs font-semibold">
                    {(user?.display_name || user?.email || "U")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 flex-1 text-left">
                  <span className="text-[13px] font-medium truncate text-foreground">
                    {user?.display_name || user?.email?.split("@")[0] || "User"}
                  </span>
                  <span className="text-[10px] text-foreground/40 truncate">
                    {getGreeting()}
                  </span>
                </div>
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => router.push("/account")}
                    className="flex w-full items-center justify-center p-1.5 rounded-lg hover:bg-sidebar-accent/50 transition-all duration-200"
                  >
                    <Avatar className="h-7 w-7 flex-shrink-0 ring-2 ring-sidebar-border/30">
                      <AvatarImage src={user?.profile_image || undefined} />
                      <AvatarFallback className="bg-sidebar-accent text-foreground text-[10px] font-semibold">
                        {(user?.display_name || user?.email || "U")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {user?.display_name || user?.email?.split("@")[0] || "Account"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </SidebarFooter>

        {/* Dialogs */}
        <DialogCollaborativeAuth
          open={isCollaborativeAuthDialogOpen}
          setOpen={setIsCollaborativeAuthDialogOpen}
        />
        <ReferralPopup
          open={isReferralPopupOpen}
          onOpenChange={setIsReferralPopupOpen}
        />
      </Sidebar>

      {/* ─── Animations ─────────────────────────────────── */}
      <style jsx global>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-12deg); }
          30% { transform: rotate(10deg); }
          45% { transform: rotate(-8deg); }
          60% { transform: rotate(6deg); }
          75% { transform: rotate(-3deg); }
          90% { transform: rotate(2deg); }
        }
        .animate-wiggle { animation: wiggle 0.6s ease-in-out; }

        @keyframes rainbow-shift {
          0% { filter: hue-rotate(0deg); }
          50% { filter: hue-rotate(180deg); }
          100% { filter: hue-rotate(360deg); }
        }
        .rainbow-wave { animation: rainbow-shift 2s ease-in-out infinite; }

        /* ── Hover visual shared animations ── */

        /* Rows slide in from left */
        @keyframes shv-slide-in {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .shv-row { animation: shv-slide-in 0.35s cubic-bezier(0.25, 1, 0.5, 1) both; }

        /* Fade up */
        @keyframes shv-fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .shv-fade-up { animation: shv-fade-up 0.4s ease-out both; }

        /* History: selected row highlight pulse */
        @keyframes shv-selected-pulse {
          0%, 100% { box-shadow: 0 0 0 0 transparent; }
          50% { box-shadow: inset 0 0 0 1px hsl(var(--foreground) / 0.08); }
        }
        .shv-selected { animation: shv-selected-pulse 2s ease-in-out infinite 0.5s; }

        /* History: resume button appears */
        @keyframes shv-resume-in {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        .shv-resume { animation: shv-resume-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both; }

        /* Progress bar fill */
        @keyframes shv-fill {
          from { width: 0%; }
          to { width: var(--progress, 50%); }
        }
        .shv-progress { animation: shv-fill 0.8s cubic-bezier(0.25, 1, 0.5, 1) both; }

        /* Terminal typing cursor */
        @keyframes shv-typing-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .shv-typing { animation: shv-typing-blink 0.8s ease-in-out infinite; }

        /* Pulsing status dot */
        @keyframes shv-pulse-dot {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        .shv-pulse-dot { animation: shv-pulse-dot 2s ease-in-out infinite; }

        /* Check mark pop */
        @keyframes shv-check-pop {
          from { opacity: 0; transform: scale(0); }
          to { opacity: 1; transform: scale(1); }
        }
        .shv-check { animation: shv-check-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

        /* Character typing reveal */
        @keyframes shv-char-reveal {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .shv-type-char { animation: shv-char-reveal 0.15s ease-out both; }
      `}</style>
    </>
  )
}
