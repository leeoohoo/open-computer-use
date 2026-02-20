"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
  // GithubLogo,
  UsersThree,
  Monitor,
  Desktop,
  SidebarSimpleIcon,
  ShieldCheckIcon,
  Plus,
  CaretRight,
  CaretLeft,
} from "@phosphor-icons/react"
import { useParams, useRouter } from "next/navigation"
import { useMemo, useState, useEffect } from "react"
import { DialogCollaborativeAuth } from "../../collaborative/dialog-collaborative-auth"
import { SidebarList } from "./sidebar-list"
import { getChatIcon } from "./sidebar-item"
import { CoastyIcon } from "@/components/icons/coasty"
import { cn } from "@/lib/utils"
import { UserMenu } from "../user-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCredits } from "@/lib/hooks/use-credits"

export function AppSidebar() {
  const isMobile = useBreakpoint(768)
  const { setOpenMobile, state, setOpen } = useSidebar()
  const isCollapsed = state === "collapsed"
  // On mobile, always show full content when sidebar is open, ignore collapse state
  const shouldShowCollapsed = !isMobile && isCollapsed
  const { chats, isLoading, refresh } = useChats()
  const { user } = useUser()
  const { chatId } = useChatSession()
  const params = useParams<{ chatId: string }>()
  const currentChatId = params.chatId

  // State for dialogs
  const [isCollaborativeAuthDialogOpen, setIsCollaborativeAuthDialogOpen] = useState(false)

  const groupedChats = useMemo(() => {
    // Simple grouping by date
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
  const { credits, refetch: refetchCredits } = useCredits()

  // Check if current chat is collaborative
  const currentChat = chatId ? chats.find(chat => chat.id === chatId) : null
  const isCollaborativeRoom = currentChat?.collaborative === true
  const isLoggedIn = !!user

  const handleRoomCreated = async () => {
    // Refresh the chat list to show the new room
    await refresh()
    if (isMobile) {
      setOpenMobile(false)
    } else {
      setOpen(false)
    }
  }


  // Helper function to close sidebar on navigation
  const handleNavigation = (navigationFn: () => void) => {
    navigationFn()
    if (isMobile) {
      setOpenMobile(false)
    } else {
      setOpen(false)
    }
  }

  return (
    <>
      <Sidebar 
        side="left" 
        variant="sidebar" 
        collapsible="icon"
        className="border-r border-white/20 dark:border-white/10"
        style={{
          "--sidebar-width": "14rem",
          "--sidebar-width-icon": "3rem"
        } as React.CSSProperties}
      >
        {/* Header Section */}
        <SidebarHeader className="border-b border-border/40 p-0 transition-all duration-300 ease-in-out">
          <div className={cn("flex items-center px-3 py-2 min-h-[48px] transition-all duration-300 ease-in-out", shouldShowCollapsed && "px-1.5 py-1.5 min-h-[40px]")}>
            {shouldShowCollapsed ? (
              /* Collapsed State - Logo Only */
              <button
                onClick={() => handleNavigation(() => router.push("/"))}
                className="flex w-full flex-col items-center justify-center hover:bg-accent/50 rounded-md p-1 transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Coasty - Your AI Employee That Collaborates With Everyone"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md transition-transform duration-300 ease-in-out">
                  <CoastyIcon className="h-6 w-6 text-primary transition-all duration-300 ease-in-out" />
                </div>
              </button>
            ) : (
              /* Expanded State - Logo + Text */
              <button
                onClick={() => handleNavigation(() => router.push("/"))}
                className="flex items-center gap-2 flex-1 min-w-0 hover:bg-accent/50 rounded-md p-1.5 transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Coasty - Your AI Employee That Collaborates With Everyone"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md flex-shrink-0 transition-transform duration-300 ease-in-out">
                  <CoastyIcon className="h-6 w-6 text-primary transition-all duration-300 ease-in-out" />
                </div>
                <div className="flex flex-col justify-center min-w-0 overflow-hidden">
                  <span className="text-sm font-medium bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent leading-normal truncate transition-opacity duration-300 ease-in-out">Coasty</span>
                </div>
              </button>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className={cn("pt-2 relative transition-all duration-300 ease-in-out", shouldShowCollapsed ? "px-1.5" : "px-3")}>
          {/* Bottom fade overlay for smooth transition */}
          <div 
            className="absolute inset-x-0 bottom-0 h-20 pointer-events-none z-10 transition-opacity duration-300 ease-in-out"
            style={{
              background: 'linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.8) 25%, hsl(var(--background) / 0.4) 50%, transparent 100%)',
              opacity: shouldShowCollapsed ? 0 : 1
            }}
          />
          
          <div 
            className="h-full overflow-y-auto overflow-x-hidden scrollbar-none transition-all duration-300 ease-in-out"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              paddingBottom: '2rem',
              maskImage: shouldShowCollapsed ? 'none' : 'linear-gradient(to bottom, black 0%, black calc(100% - 60px), transparent 100%)',
              WebkitMaskImage: shouldShowCollapsed ? 'none' : 'linear-gradient(to bottom, black 0%, black calc(100% - 60px), transparent 100%)'
            }}
          >
            {/* Expand/Collapse Button */}
            {shouldShowCollapsed ? (
              <div className="mb-2 pb-2 border-b border-border/30">
                <button
                  onClick={() => setOpen(true)}
                  className={cn(
                    "group relative flex w-full items-center justify-center rounded-md text-sm font-medium transition-all duration-200 ease-in-out",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "p-1.5"
                  )}
                  title="Expand sidebar"
                >
                  <CaretRight size={16} className="shrink-0 transition-transform duration-200 hover:translate-x-0.5" />
                </button>
              </div>
            ) : (
              <div className="mb-2 pb-2 border-b border-border/30">
                <button
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group relative flex w-full items-center rounded-md text-sm font-medium transition-all duration-200 ease-in-out",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "gap-2 px-2.5 py-1.5"
                  )}
                  title="Collapse sidebar"
                >
                  <CaretLeft size={16} className="shrink-0 transition-transform duration-200 hover:-translate-x-0.5" />
                  <span className="truncate text-xs">Collapse</span>
                </button>
              </div>
            )}
            
            
            {/* Project Actions Section */}
            <div className="border-b border-border/30 pb-2 mb-2 transition-all duration-300 ease-in-out">
              <div className="space-y-1.5 transition-all duration-300 ease-in-out">
                {/* Assign Task Button */}
                {shouldShowCollapsed ? (
                  <button
                    className={cn(
                      "group relative flex w-full items-center justify-center rounded-md text-sm font-medium transition-all duration-200 ease-in-out",
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "p-1.5"
                    )}
                    type="button"
                    onClick={() => handleNavigation(() => router.push("/"))}
                    title="Assign New Task"
                  >
                    <Plus size={16} className="shrink-0 transition-transform duration-200 group-hover:rotate-90" />
                  </button>
                ) : (
                  <button
                    className={cn(
                      "group relative flex w-full items-center rounded-md text-sm font-medium transition-all duration-200 ease-in-out",
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "gap-2 px-2.5 py-2"
                    )}
                    type="button"
                    onClick={() => handleNavigation(() => router.push("/"))}
                  >
                    <Plus size={16} className="shrink-0 transition-transform duration-200 group-hover:rotate-90" />
                    <span className="truncate">Assign New Task</span>
                  </button>
                )}
                
                {/* My Computers Button */}
                {shouldShowCollapsed ? (
                  <button
                    id="sidebar-machines-link-collapsed"
                    className={cn(
                      "group relative flex w-full items-center justify-center rounded-md text-sm font-medium transition-all duration-200 ease-in-out",
                      "bg-muted-foreground/20 hover:bg-muted-foreground/30 text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "p-1.5"
                    )}
                    type="button"
                    onClick={() => handleNavigation(() => router.push("/machines"))}
                    title="My Computers"
                  >
                    <Desktop size={16} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  </button>
                ) : (
                  <button
                    id="sidebar-machines-link"
                    className={cn(
                      "group relative flex w-full items-center rounded-md text-sm font-medium transition-all duration-200 ease-in-out",
                      "bg-muted-foreground/20 hover:bg-muted-foreground/30 text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "gap-2 px-2.5 py-2"
                    )}
                    type="button"
                    onClick={() => handleNavigation(() => router.push("/machines"))}
                  >
                    <Desktop size={16} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
                    <span className="truncate">My Computers</span>
                  </button>
                )}
              </div>
            </div>


            {/* Chat History Section */}
            <div className="py-1 transition-all duration-300 ease-in-out">
              {/* Removed redundant Recent Chats header and count badge as they are added by inner elements */}

              {isLoading ? (
                <div className="space-y-1.5 transition-all duration-300 ease-in-out">
                  {[...Array(shouldShowCollapsed ? 3 : 5)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-md bg-muted/50 animate-pulse transition-all duration-300 ease-in-out",
                        shouldShowCollapsed ? "h-7 w-7 mx-auto" : "h-8"
                      )}
                    />
                  ))}
                </div>
              ) : hasChats ? (
                <div className={cn("space-y-1 transition-all duration-300 ease-in-out", !shouldShowCollapsed && "space-y-3")}>
                  {shouldShowCollapsed ? (
                    // Show only recent chat icons when collapsed
                    chats.slice(0, 8).map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => handleNavigation(() => router.push(`/c/${chat.id}`))}
                        className={cn(
                          "group relative flex w-full items-center justify-center rounded-md p-1.5 text-sm font-medium transition-all duration-200 ease-in-out transform hover:scale-105",
                          chat.id === currentChatId 
                            ? "bg-primary/10 text-primary" 
                            : "hover:bg-accent hover:text-accent-foreground",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                        title={chat.title || "Untitled Project"}
                      >
                        {getChatIcon(chat.title || "")}
                      </button>
                    ))
                  ) : (
                    groupedChats?.map((group) => (
                      <SidebarList
                        key={group.name}
                        title={group.name}
                        items={group.chats}
                        currentChatId={currentChatId}
                        isCollaborative={group.isCollaborative}
                      />
                    ))
                  )}
                </div>
              ) : (
                !shouldShowCollapsed && (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/30">
                      <ChatTeardropText size={18} className="text-muted-foreground/60" />
                    </div>
                    <p className="text-xs text-muted-foreground">No projects yet</p>
                  </div>
                )
              )}
            </div>
          </div>
        </SidebarContent>

        {/* Fading blur effect separator */}
        <div className="relative h-2">
          <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-transparent via-background/20 to-background/40 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-full backdrop-blur-[2px] pointer-events-none" />
        </div>

        {/* Footer Section */}
        <SidebarFooter className="relative pt-0 transition-all duration-300 ease-in-out">
          <div className={cn("space-y-1.5 transition-all duration-300 ease-in-out", shouldShowCollapsed ? "p-2 pt-1" : "p-3 pt-1")}>
            {/* Credits Section */}
            {user && (
              <div className="mb-3">
                {!shouldShowCollapsed && (
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                    Agent Time Balance
                  </div>
                )}
                {shouldShowCollapsed ? (
                  <button
                    className={cn(
                      "group flex w-full h-8 items-center justify-center rounded-md transition-all duration-200",
                      "bg-transparent hover:bg-muted/50",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    )}
                    type="button"
                    onClick={() => {
                      router.push("/account?section=billing")
                      if (isMobile) {
                        setOpenMobile(false)
                      }
                    }}
                    title={`${Math.floor((credits?.balance || 0) / 10)} minutes of agent time remaining`}
                  >
                    <CoastyIcon className="h-4 w-4 text-primary" />
                  </button>
                ) : (
                  <div className="relative">
                    {/* Aura effect only for expanded view */}
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-lg" />
                    
                    <button
                      className={cn(
                        "group relative flex w-full items-center rounded-md text-sm transition-all duration-200",
                        "bg-background/95 hover:bg-background",
                        "border border-border",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        "px-2 py-1",
                        "overflow-hidden"
                      )}
                      type="button"
                      onClick={() => {
                        router.push("/account?section=billing")
                        if (isMobile) {
                          setOpenMobile(false)
                        }
                      }}
                    >
                      {/* Icon */}
                      <CoastyIcon className="h-4 w-4 text-primary" />
                      
                      {/* Content */}
                      <div className="flex-1 ml-2 min-w-0 flex items-center">
                        <div className="flex items-baseline gap-0.5 whitespace-nowrap">
                          <span className="font-medium text-sm text-foreground">
                            {Math.floor((credits?.balance || 0) / 10)}
                          </span>
                          <span className="text-xs text-muted-foreground">minutes</span>
                        </div>
                      </div>
                      
                      {/* Buy indicator */}
                      <div className="ml-auto pl-1.5 border-l border-border">
                        <span className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                          Buy
                        </span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* <button
              onClick={() =>
                window.open("https://github.com/coasty-ai", "_blank")
              }
              className={cn(
                "group relative flex w-full items-center rounded-md text-sm font-medium transition-all",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                shouldShowCollapsed ? "justify-center p-1.5" : "gap-2 px-2.5 py-1.5"
              )}
              title={shouldShowCollapsed ? "GitHub - Open Source" : undefined}
            >
              <GithubLogo size={18} className="shrink-0" />
              {!shouldShowCollapsed && (
                <>
                  <span className="truncate">GitHub</span>
                  <div className="ml-auto">
                    <Badge variant="outline" className="text-xs">
                      Open Source
                    </Badge>
                  </div>
                </>
              )}
            </button> */}
            
            {/* User Account Menu */}
            {shouldShowCollapsed ? (
              <div className="flex items-center justify-center">
                <UserMenu />
              </div>
            ) : (
              <button 
                onClick={() => router.push("/account")}
                className="flex items-center gap-3 px-2.5 py-2 w-full rounded-md hover:bg-accent hover:text-accent-foreground transition-all duration-200 ease-in-out transform hover:scale-[1.02]"
              >
                <Avatar className="bg-background hover:bg-muted flex-shrink-0 transition-all duration-200 ease-in-out">
                  <AvatarImage src={user?.profile_image ?? undefined} />
                  <AvatarFallback>{user?.display_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 flex-1 text-left transition-opacity duration-300 ease-in-out">
                  <span className="text-sm font-medium truncate">{user?.display_name || "User"}</span>
                  <span className="text-xs text-muted-foreground truncate">{user?.email || ""}</span>
                </div>
              </button>
            )}
            
          </div>
        </SidebarFooter>

        {/* Dialogs */}
        <DialogCollaborativeAuth
          open={isCollaborativeAuthDialogOpen}
          setOpen={setIsCollaborativeAuthDialogOpen}
        />
      </Sidebar>
    </>
  )
}
