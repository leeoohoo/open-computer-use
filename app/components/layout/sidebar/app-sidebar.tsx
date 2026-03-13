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
} from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
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

function NavButton({
  icon,
  label,
  onClick,
  variant = "default",
  id,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  variant?: "default" | "primary"
  id?: string
}) {
  const { open, isMobile } = useSidebar()
  // On mobile the slide-in panel is always fully expanded
  const expanded = isMobile || open

  const button = (
    <button
      id={id}
      className={cn(
        "group/btn flex w-full items-center rounded-md transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        expanded ? "gap-2 px-2.5 py-1.5" : "justify-center p-2",
        variant === "primary"
          ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
          : "text-sidebar-foreground hover:bg-sidebar-accent"
      )}
      type="button"
      onClick={onClick}
    >
      <span className="shrink-0 flex items-center justify-center w-4 h-4">{icon}</span>
      {expanded && <span className="truncate text-sm">{label}</span>}
    </button>
  )

  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}

export function AppSidebar() {
  const isMobile = useBreakpoint(768)
  const { setOpenMobile, open, isMobile: isMobileSidebar } = useSidebar()
  // On mobile the slide-in panel is always fully expanded
  const expanded = isMobileSidebar || open
  const { user } = useUser()

  // State for dialogs
  const [isCollaborativeAuthDialogOpen, setIsCollaborativeAuthDialogOpen] = useState(false)
  const [isReferralPopupOpen, setIsReferralPopupOpen] = useState(false)

  const router = useRouter()
  const { credits } = useCredits()

  const handleNavigation = (navigationFn: () => void) => {
    navigationFn()
    if (isMobile) {
      setOpenMobile(false)
    }
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
        {/* Header - Logo */}
        <SidebarHeader className="p-0">
          <div className={cn(
            "flex items-center min-h-[48px]",
            expanded ? "px-3 py-2" : "justify-center py-2"
          )}>
            <button
              onClick={() => handleNavigation(() => router.push("/"))}
              className={cn(
                "flex items-center rounded-md transition-all duration-200 ease-in-out",
                "hover:bg-sidebar-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                expanded ? "gap-2 flex-1 min-w-0 p-1.5" : "p-2 justify-center"
              )}
              title="Coasty"
            >
              <div className="flex h-7 w-7 items-center justify-center shrink-0">
                <CoastyIcon className="h-6 w-6 text-sidebar-primary" />
              </div>
              {expanded && (
                <span className="text-sm font-medium text-sidebar-foreground leading-normal truncate">
                  Coasty
                </span>
              )}
            </button>
          </div>
        </SidebarHeader>

        {/* Content */}
        <SidebarContent className={cn("pt-2", expanded ? "px-3" : "px-1.5")}>
          {/* Action */}
          <div className={cn("relative", expanded ? "pb-2 mb-1" : "pb-1 mb-1")}>
            <div className="space-y-1">
              <NavButton
                icon={<Plus size={16} className="shrink-0" />}
                label="New Task"
                onClick={() => handleNavigation(() => router.push("/"))}
                variant="primary"
              />
            </div>
          </div>

          {/* Divider */}
          {expanded && (
            <div className="h-px bg-sidebar-border/50 mx-1 mb-1" />
          )}

          {/* Activity */}
          <div className={cn("relative", expanded ? "pb-1" : "pb-1")}>
            {expanded && (
              <div className="text-[10px] font-medium text-sidebar-foreground/80 uppercase tracking-wider mb-1.5 px-2.5">
                Activity
              </div>
            )}
            <div className="space-y-0.5">
              <NavButton
                id="sidebar-history-link"
                icon={<ClockCounterClockwise size={16} className="shrink-0" />}
                label="Task History"
                onClick={() => handleNavigation(() => router.push("/history"))}
              />
              <NavButton
                id="sidebar-swarms-link"
                icon={<GitFork size={16} weight="duotone" className="shrink-0" />}
                label="Swarm Runs"
                onClick={() => handleNavigation(() => router.push("/swarms"))}
              />
              <NavButton
                id="sidebar-guide-link"
                icon={<BookOpen size={16} className="shrink-0" />}
                label="Guide"
                onClick={() => handleNavigation(() => router.push("/guide"))}
              />
            </div>
          </div>

          {/* Infrastructure */}
          <div className={cn("relative", expanded ? "pb-1" : "pb-1")}>
            {expanded && (
              <div className="text-[10px] font-medium text-sidebar-foreground/80 uppercase tracking-wider mb-1.5 px-2.5">
                Infrastructure
              </div>
            )}
            <div className="space-y-0.5">
              <NavButton
                id="sidebar-machines-link"
                icon={<Desktop size={16} className="shrink-0" />}
                label="My Computers"
                onClick={() => handleNavigation(() => router.push("/machines"))}
              />
              <NavButton
                id="sidebar-schedules-link"
                icon={<UsersThree size={16} weight="duotone" className="shrink-0" />}
                label="Workforce"
                onClick={() => handleNavigation(() => router.push("/schedules"))}
              />
              <NavButton
                id="sidebar-secrets-link"
                icon={<Key size={16} className="shrink-0" />}
                label="Saved Credentials"
                onClick={() => handleNavigation(() => router.push("/secrets"))}
              />
            </div>
          </div>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="relative pt-0">
          <div className={cn("space-y-1.5", expanded ? "p-3 pt-1" : "p-1.5 pt-1")}>
            {/* Credits — expanded */}
            {user && expanded && (() => {
              const balance = credits?.balance || 0
              const isLow = balance > 0 && balance < 50

              return (
                <button
                  className={cn(
                    "group flex w-full flex-col rounded-lg border transition-all duration-200",
                    "hover:border-sidebar-primary/30 hover:shadow-sm",
                    "px-3 py-2.5",
                    isLow
                      ? "border-orange-500/20 bg-orange-500/[0.04]"
                      : "border-sidebar-border/60 bg-sidebar-accent/30"
                  )}
                  type="button"
                  onClick={() => {
                    router.push("/account?section=billing")
                    if (isMobile) setOpenMobile(false)
                  }}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <CoastyIcon className={cn("h-3.5 w-3.5 shrink-0", isLow ? "text-orange-500" : "text-sidebar-primary")} />
                      <span className="text-[11px] font-medium text-sidebar-foreground/90 uppercase tracking-wider">Credits</span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-colors",
                      "bg-sidebar-primary/10 text-sidebar-primary group-hover:bg-sidebar-primary/20"
                    )}>
                      Buy
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={cn(
                      "text-lg font-semibold tabular-nums leading-none",
                      isLow ? "text-orange-500" : "text-sidebar-foreground"
                    )}>
                      {balance.toLocaleString()}
                    </span>
                    {isLow && (
                      <span className="text-[10px] text-orange-500/70 font-medium">Low</span>
                    )}
                  </div>
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
                      "hover:border-sidebar-primary/30 hover:shadow-sm",
                      (credits?.balance || 0) > 0 && (credits?.balance || 0) < 50
                        ? "border-orange-500/20 bg-orange-500/[0.04]"
                        : "border-sidebar-border/60 bg-sidebar-accent/30"
                    )}
                    onClick={() => router.push("/account?section=billing")}
                  >
                    <CoastyIcon className={cn(
                      "h-4 w-4 shrink-0",
                      (credits?.balance || 0) > 0 && (credits?.balance || 0) < 50
                        ? "text-orange-500"
                        : "text-sidebar-primary"
                    )} />
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

            {/* Referral */}
            {user && (
              <div className={expanded ? "mb-1.5" : ""}>
                {expanded ? (
                  <Link
                    href="/referral"
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-md text-sm transition-all duration-200",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "px-2.5 py-1.5"
                    )}
                  >
                    <Gift size={16} weight="duotone" className="shrink-0" />
                    <span className="truncate text-sm">Invite & Feedback</span>
                  </Link>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href="/referral"
                        className="flex w-full items-center justify-center p-2 rounded-md hover:bg-sidebar-accent transition-colors"
                      >
                        <Gift size={16} weight="duotone" className="shrink-0 text-sidebar-foreground" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      Invite & Feedback
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}

            {/* User Account */}
            {expanded ? (
              <button
                onClick={() => router.push("/account")}
                className="flex items-center gap-3 px-2.5 py-2 w-full rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 ease-in-out"
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={user?.profile_image ?? undefined} />
                  <AvatarFallback className="text-xs">{user?.display_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 flex-1 text-left">
                  <span className="text-sm font-medium truncate">{user?.display_name || "User"}</span>
                  <span className="text-xs text-sidebar-foreground/90 truncate">{user?.email || ""}</span>
                </div>
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => router.push("/account")}
                    className="flex w-full items-center justify-center p-1.5 rounded-md hover:bg-sidebar-accent transition-all duration-200"
                  >
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarImage src={user?.profile_image ?? undefined} />
                      <AvatarFallback className="text-xs">{user?.display_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {user?.display_name || "Account"}
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
    </>
  )
}
