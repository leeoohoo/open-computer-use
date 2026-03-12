"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { useUser } from "@/lib/user-store/provider"
import {
  ChatTeardropText,
  UsersThree,
  Desktop,
  Plus,
  Gift,
  Key,
  GitFork,
} from "@phosphor-icons/react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DialogCollaborativeAuth } from "../../collaborative/dialog-collaborative-auth"
import { SidebarList } from "./sidebar-list"
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
          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
  const { chats, isLoading, isLoadingMore, hasMore, loadMore, refresh } = useChats()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Infinite scroll: observe sentinel element at the bottom of the chat list
  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadMore])
  const { user } = useUser()
  const { chatId } = useChatSession()
  const params = useParams<{ chatId: string }>()
  const currentChatId = params.chatId

  // State for dialogs
  const [isCollaborativeAuthDialogOpen, setIsCollaborativeAuthDialogOpen] = useState(false)
  const [isReferralPopupOpen, setIsReferralPopupOpen] = useState(false)

  const groupedChats = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const weekAgo = today - 7 * 24 * 60 * 60 * 1000
    const monthAgo = today - 30 * 24 * 60 * 60 * 1000

    const todayChats = chats.filter(chat => {
      if (!chat.updated_at) return true
      return new Date(chat.updated_at).getTime() >= today
    })

    const weekChats = chats.filter(chat => {
      if (!chat.updated_at) return false
      const time = new Date(chat.updated_at).getTime()
      return time >= weekAgo && time < today
    })

    const monthChats = chats.filter(chat => {
      if (!chat.updated_at) return false
      const time = new Date(chat.updated_at).getTime()
      return time >= monthAgo && time < weekAgo
    })

    const olderChats = chats.filter(chat => {
      if (!chat.updated_at) return false
      return new Date(chat.updated_at).getTime() < monthAgo
    })

    const result = []
    if (todayChats.length > 0) {
      result.push({ name: "Today", chats: todayChats, isCollaborative: true })
    }
    if (weekChats.length > 0) {
      result.push({ name: "Last 7 days", chats: weekChats, isCollaborative: true })
    }
    if (monthChats.length > 0) {
      result.push({ name: "Last 30 days", chats: monthChats, isCollaborative: true })
    }
    if (olderChats.length > 0) {
      result.push({ name: "Older", chats: olderChats, isCollaborative: true })
    }

    return result
  }, [chats])
  const hasChats = chats.length > 0
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
        <SidebarContent className={cn("pt-2 relative", expanded ? "px-3" : "px-1.5")}>
          {/* Bottom fade overlay */}
          {expanded && (
            <div
              className="absolute inset-x-0 bottom-0 h-20 pointer-events-none z-10"
              style={{
                background: 'linear-gradient(to top, var(--color-sidebar) 0%, transparent 100%)',
              }}
            />
          )}

          <div
            className="h-full overflow-y-auto overflow-x-hidden scrollbar-none"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              paddingBottom: expanded ? '2rem' : '0.5rem',
              ...(expanded ? {
                maskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 60px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 60px), transparent 100%)'
              } : {})
            }}
          >
            {/* Navigation Actions */}
            <div className={cn("relative", expanded ? "pb-2 mb-2" : "pb-1 mb-1")}>
              <div className="space-y-1">
                <NavButton
                  icon={<Plus size={16} className="shrink-0" />}
                  label="New Task"
                  onClick={() => handleNavigation(() => router.push("/"))}
                  variant="primary"
                />
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
                  id="sidebar-swarms-link"
                  icon={<GitFork size={16} weight="duotone" className="shrink-0" />}
                  label="Swarm Runs"
                  onClick={() => handleNavigation(() => router.push("/swarms"))}
                />
                <NavButton
                  id="sidebar-secrets-link"
                  icon={<Key size={16} className="shrink-0" />}
                  label="Saved Credentials"
                  onClick={() => handleNavigation(() => router.push("/secrets"))}
                />
              </div>
            </div>

            {/* Chat History - only when expanded */}
            {expanded && (
              <div className="py-1">
                {isLoading ? (
                  <div className="space-y-1.5">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="rounded-md bg-sidebar-accent/50 animate-pulse h-8"
                      />
                    ))}
                  </div>
                ) : hasChats ? (
                  <div className="space-y-3">
                    {groupedChats?.map((group) => (
                      <SidebarList
                        key={group.name}
                        title={group.name}
                        items={group.chats}
                        currentChatId={currentChatId}
                        isCollaborative={group.isCollaborative}
                      />
                    ))}
                    {/* Sentinel for infinite scroll */}
                    <div ref={loadMoreRef} className="h-1" />
                    {isLoadingMore && (
                      <div className="space-y-1.5 pb-2">
                        {[...Array(3)].map((_, i) => (
                          <div
                            key={i}
                            className="rounded-md bg-sidebar-accent/50 animate-pulse h-8"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/30">
                      <ChatTeardropText size={18} className="text-sidebar-foreground/60" />
                    </div>
                    <p className="text-xs text-sidebar-foreground/60">No projects yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Collapsed: show chat icon as hint */}
            {!expanded && hasChats && (
              <div className="flex justify-center py-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="flex items-center justify-center p-2 rounded-md hover:bg-sidebar-accent transition-colors"
                      onClick={() => handleNavigation(() => router.push("/"))}
                    >
                      <ChatTeardropText size={16} className="text-sidebar-foreground/60" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    Chat History
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="relative pt-0">
          <div className={cn("space-y-1.5", expanded ? "p-3 pt-1" : "p-1.5 pt-1")}>
            {/* Credits - expanded */}
            {user && expanded && (
              <div className="mb-1.5">
                <div className="text-[10px] font-medium text-sidebar-foreground/50 uppercase tracking-wider mb-1.5 px-1">
                  Credits Balance
                </div>
                <div className="relative">
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-lg" />
                  <button
                    className={cn(
                      "group relative flex w-full items-center rounded-md text-sm transition-all duration-200",
                      "bg-sidebar-accent/50 hover:bg-sidebar-accent",
                      "border border-sidebar-border",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "px-2 py-1",
                      "overflow-hidden"
                    )}
                    type="button"
                    onClick={() => {
                      router.push("/account?section=billing")
                      if (isMobile) setOpenMobile(false)
                    }}
                  >
                    <CoastyIcon className="h-4 w-4 text-sidebar-primary shrink-0" />
                    <div className="flex-1 ml-2 min-w-0 flex items-center">
                      <div className="flex items-baseline gap-0.5 whitespace-nowrap">
                        <span className="font-medium text-sm text-sidebar-foreground">
                          {(credits?.balance || 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-sidebar-foreground/60">credits</span>
                      </div>
                    </div>
                    <div className="ml-auto pl-1.5 border-l border-sidebar-border flex items-center self-stretch">
                      <span className="text-[10px] text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                        Buy
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Credits - collapsed icon */}
            {user && !expanded && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex w-full items-center justify-center p-2 rounded-md hover:bg-sidebar-accent transition-colors"
                    onClick={() => router.push("/account?section=billing")}
                  >
                    <CoastyIcon className="h-4 w-4 text-sidebar-primary shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {(credits?.balance || 0).toLocaleString()} credits
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
                  <span className="text-xs text-sidebar-foreground/60 truncate">{user?.email || ""}</span>
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
