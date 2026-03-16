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
  ChatTeardropText,
  UsersThree,
  Desktop,
  Plus,
  Gift,
  Key,
  GitFork,
  ClockCounterClockwise,
  BookOpen,
  VideoCamera,
  Ghost,
} from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useRef } from "react"
import { DialogCollaborativeAuth } from "../../collaborative/dialog-collaborative-auth"
import { CoastyIcon } from "@/components/icons/coasty"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCredits } from "@/lib/hooks/use-credits"
import { ReferralPopup } from "../../referral/referral-popup"
import Link from "next/link"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ─── Easter egg: Konami-lite sequence detector ─────────────────────
function useSecretSequence(sequence: string, onActivate: () => void) {
  const bufferRef = useRef("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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

// ─── Nav button ────────────────────────────────────────────────────
function NavButton({
  icon,
  label,
  onClick,
  variant = "default",
  id,
  isActive,
  href,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  variant?: "default" | "primary"
  id?: string
  isActive?: boolean
  href?: string
}) {
  const { open, isMobile } = useSidebar()
  const expanded = isMobile || open

  const content = (
    <span
      className={cn(
        "group/btn relative flex w-full items-center rounded-lg transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        expanded ? "gap-2.5 px-2.5 py-2" : "justify-center p-2",
        variant === "primary"
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
          : isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-foreground/60 hover:text-foreground hover:bg-sidebar-accent/50"
      )}
    >
      {/* Active indicator bar */}
      {isActive && variant !== "primary" && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-sidebar-primary transition-all" />
      )}
      <span className={cn(
        "shrink-0 flex items-center justify-center w-4 h-4 transition-transform duration-200",
        variant !== "primary" && "group-hover/btn:scale-110"
      )}>
        {icon}
      </span>
      {expanded && (
        <span className={cn(
          "truncate text-[13px] font-medium transition-colors",
          isActive && "text-foreground"
        )}>
          {label}
        </span>
      )}
    </span>
  )

  const wrapper = href ? (
    <Link id={id} href={href} className="block w-full" onClick={onClick}>
      {content}
    </Link>
  ) : (
    <button id={id} className="w-full" type="button" onClick={onClick}>
      {content}
    </button>
  )

  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{wrapper}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return wrapper
}

// ─── Section label ─────────────────────────────────────────────────
function SectionLabel({ children, expanded }: { children: React.ReactNode; expanded: boolean }) {
  if (!expanded) return null
  return (
    <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em] mb-1 px-2.5 select-none">
      {children}
    </div>
  )
}

// ─── Credits ring (mini SVG donut) ─────────────────────────────────
function CreditsRing({ balance, className }: { balance: number; className?: string }) {
  // Show a ring that fills based on credits (cap at 1000 for visual)
  const pct = Math.min(balance / 1000, 1)
  const r = 8
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)

  return (
    <svg className={cn("shrink-0", className)} width="22" height="22" viewBox="0 0 22 22">
      <circle cx="11" cy="11" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" opacity={0.1} />
      <circle
        cx="11" cy="11" r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 11 11)"
        className="transition-all duration-700"
      />
    </svg>
  )
}

// ─── Main sidebar ──────────────────────────────────────────────────
export function AppSidebar() {
  const isMobile = useBreakpoint(768)
  const { setOpenMobile, open, isMobile: isMobileSidebar } = useSidebar()
  const expanded = isMobileSidebar || open
  const { user } = useUser()

  const [isCollaborativeAuthDialogOpen, setIsCollaborativeAuthDialogOpen] = useState(false)
  const [isReferralPopupOpen, setIsReferralPopupOpen] = useState(false)

  const router = useRouter()
  const { credits } = useCredits()

  // ─── Easter egg states ───────────────────────────────────────
  const [logoClicks, setLogoClicks] = useState(0)
  const [partyMode, setPartyMode] = useState(false)
  const [showGhost, setShowGhost] = useState(false)
  const [avatarWobble, setAvatarWobble] = useState(false)
  const avatarHoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Easter egg 1: Logo click counter → spin + party
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

  // Easter egg 2: Type "coast" → rainbow mode
  const [rainbowMode, setRainbowMode] = useState(false)
  useSecretSequence("coast", useCallback(() => {
    setRainbowMode(true)
    setTimeout(() => setRainbowMode(false), 4000)
  }, []))

  // Easter egg 3: Random ghost appearance (~5% chance per mount)
  useEffect(() => {
    if (Math.random() < 0.05) {
      setShowGhost(true)
    }
  }, [])

  const handleNavigation = (navigationFn: () => void) => {
    navigationFn()
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  // Get time-based greeting
  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 5) return "Night owl"
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    if (h < 21) return "Good evening"
    return "Night owl"
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
                icon={<ClockCounterClockwise size={16} className="shrink-0" />}
                label="Task History"
                href="/history"
                onClick={() => { if (isMobile) setOpenMobile(false) }}
              />
              <NavButton
                id="sidebar-swarms-link"
                icon={<GitFork size={16} weight="duotone" className="shrink-0" />}
                label="Swarm Runs"
                href="/swarms"
                onClick={() => { if (isMobile) setOpenMobile(false) }}
              />
              <NavButton
                id="sidebar-guide-link"
                icon={<BookOpen size={16} className="shrink-0" />}
                label="Guide"
                href="/guide"
                onClick={() => { if (isMobile) setOpenMobile(false) }}
              />
            </div>
          </div>

          {/* Infrastructure */}
          <div className="relative pb-1 mt-1">
            <SectionLabel expanded={expanded}>Infrastructure</SectionLabel>
            <div className="space-y-0.5">
              <NavButton
                id="sidebar-machines-link"
                icon={<Desktop size={16} className="shrink-0" />}
                label="My Computers"
                href="/machines"
                onClick={() => { if (isMobile) setOpenMobile(false) }}
              />
              <NavButton
                id="sidebar-schedules-link"
                icon={<UsersThree size={16} weight="duotone" className="shrink-0" />}
                label="Workforce"
                href="/schedules"
                onClick={() => { if (isMobile) setOpenMobile(false) }}
              />
              <NavButton
                id="sidebar-secrets-link"
                icon={<Key size={16} className="shrink-0" />}
                label="Credentials"
                href="/secrets"
                onClick={() => { if (isMobile) setOpenMobile(false) }}
              />
            </div>
          </div>

          {/* Easter egg: Ghost nav item (rare) */}
          {showGhost && expanded && (
            <div className="relative pb-1 mt-1">
              <div className="space-y-0.5">
                <NavButton
                  icon={<Ghost size={16} weight="fill" className="shrink-0 opacity-30 group-hover/btn:opacity-100 transition-opacity" />}
                  label="????"
                  onClick={() => {
                    setShowGhost(false)
                    setPartyMode(true)
                  }}
                />
              </div>
            </div>
          )}
        </SidebarContent>

        {/* ─── Footer ─────────────────────────────────────── */}
        <SidebarFooter className="relative pt-0">
          <div className={cn("space-y-1", expanded ? "p-2.5 pt-1" : "p-1.5 pt-1")}>

            {/* Credits — expanded */}
            {user && expanded && (() => {
              const balance = credits?.balance || 0
              const isLow = balance > 0 && balance < 50

              return (
                <button
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl border transition-all duration-300",
                    "hover:shadow-md hover:scale-[1.01] active:scale-[0.99]",
                    "px-3 py-2.5",
                    isLow
                      ? "border-orange-500/20 bg-orange-500/[0.04] hover:border-orange-500/40"
                      : "border-sidebar-border/40 bg-sidebar-accent/20 hover:border-sidebar-primary/20"
                  )}
                  type="button"
                  onClick={() => {
                    router.push("/account?section=billing")
                    if (isMobile) setOpenMobile(false)
                  }}
                >
                  <CreditsRing
                    balance={balance}
                    className={isLow ? "text-orange-500" : "text-sidebar-primary"}
                  />
                  <div className="flex flex-col items-start flex-1 min-w-0">
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
                    "text-[10px] font-semibold px-2 py-1 rounded-md transition-colors shrink-0",
                    "bg-sidebar-primary/10 text-sidebar-primary group-hover:bg-sidebar-primary/20"
                  )}>
                    Buy
                  </span>
                </button>
              )
            })()}

            {/* Credits — collapsed */}
            {user && !expanded && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center justify-center p-2 rounded-lg border transition-all duration-200",
                      "hover:shadow-sm",
                      (credits?.balance || 0) > 0 && (credits?.balance || 0) < 50
                        ? "border-orange-500/20 bg-orange-500/[0.04]"
                        : "border-sidebar-border/40 bg-sidebar-accent/20"
                    )}
                    onClick={() => router.push("/account?section=billing")}
                  >
                    <CreditsRing
                      balance={credits?.balance || 0}
                      className={cn(
                        "h-4 w-4",
                        (credits?.balance || 0) > 0 && (credits?.balance || 0) < 50
                          ? "text-orange-500"
                          : "text-sidebar-primary"
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{(credits?.balance || 0).toLocaleString()}</span>
                    <span className="text-muted-foreground">credits</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Divider */}
            <div className={cn(
              "mx-auto transition-all",
              expanded ? "w-[calc(100%-0.5rem)] h-px bg-sidebar-border/20" : "w-5 h-px bg-sidebar-border/15"
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

      {/* Easter egg: Rainbow wave animation */}
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
        .animate-wiggle {
          animation: wiggle 0.6s ease-in-out;
        }
        @keyframes rainbow-shift {
          0% { filter: hue-rotate(0deg); }
          50% { filter: hue-rotate(180deg); }
          100% { filter: hue-rotate(360deg); }
        }
        .rainbow-wave {
          animation: rainbow-shift 2s ease-in-out infinite;
        }
      `}</style>
    </>
  )
}
