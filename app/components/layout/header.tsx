"use client"

import { AppInfoTrigger } from "@/app/components/layout/app-info/app-info-trigger"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { LlmhubIcon } from "@/components/icons/llmhub"
import { Button } from "@/components/ui/button"
import { APP_NAME } from "@/lib/config"
import { cn } from "@/lib/utils"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { useUser } from "@/lib/user-store/provider"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { useProjectNavigator } from "@/lib/project-navigator-store/provider"
import { Info, Users, Copy, Link as LinkIcon, UserPlus, SidebarSimple, Globe, Desktop } from "@phosphor-icons/react"
import Link from "next/link"
import { HeaderSidebarTrigger } from "./header-sidebar-trigger"
import { toast } from "sonner"
import { ChatVisibilityToggle } from "@/app/components/chat/chat-visibility-toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler"

interface HeaderProps {
  hasSidebar: boolean
}

export function Header({ hasSidebar }: HeaderProps) {
  const isMobile = useBreakpoint(768)
  const { user } = useUser()
  const { preferences } = useUserPreferences()
  const { refresh, getChatById } = useChats()
  const { chatId } = useChatSession()
  const { isOpen: isNavigatorOpen, toggleNavigator } = useProjectNavigator()
  const isMultiModelEnabled = preferences.multiModelEnabled
  const isLoggedIn = !!user


  // Get current chat to check if it's collaborative
  const currentChat = chatId ? getChatById(chatId) : null
  const isCollaborativeRoom = currentChat?.collaborative === true

  // Common button styling for consistency and emphasis - using card color for dark mode
  const headerButtonClass = "text-foreground hover:text-foreground hover:bg-muted/80 bg-background dark:bg-card dark:hover:bg-card/70 rounded-3xl px-3 py-2 h-9 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
  
  // Mobile-responsive button styling - smaller on mobile - using card color for dark mode
  const mobileHeaderButtonClass = "text-foreground hover:text-foreground hover:bg-muted/80 bg-background dark:bg-card dark:hover:bg-card/70 rounded-3xl transition-all duration-200 shadow-sm hover:shadow-md font-medium px-2 py-1.5 h-8 sm:px-3 sm:py-2 sm:h-9"

  const handleRoomCreated = async () => {
    // Refresh the chat list to include the new room
    await refresh()
  }

  const handleRoomJoined = async () => {
    // Refresh the chat list to include the joined room
    await refresh()
  }

  // Helper functions for collaborative room actions
  const copyInviteCode = async (inviteCode: string) => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      toast.success("Invite code copied!")
    } catch (err) {
      toast.error("Failed to copy invite code")
    }
  }

  const copyInviteLink = async (inviteCode: string) => {
    try {
      const inviteLink = `${window.location.origin}/join/${inviteCode}`
      await navigator.clipboard.writeText(inviteLink)
      toast.success("Invite link copied!")
    } catch (err) {
      toast.error("Failed to copy invite link")
    }
  }


  return (
    <>
      <header className="h-app-header pointer-events-none fixed top-0 right-0 left-0 z-40">
      <div className="relative mx-auto flex h-full max-w-full items-center justify-between px-2 sm:px-4 lg:px-6 xl:px-8">
        <div className="flex w-full items-center justify-between min-w-0">
          <div className="-ml-0.5 flex items-center gap-1 sm:gap-2 lg:-ml-2.5 min-w-0 flex-shrink-0">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              {/* Only show logo when sidebar is not present */}
              {!hasSidebar && (
                <Link
                  href="/"
                  className="pointer-events-auto inline-flex items-center text-lg sm:text-xl font-medium tracking-tight min-w-0"
                >
                  <LlmhubIcon className="mr-1 size-4 flex-shrink-0" />
                  <span className="hidden sm:inline truncate">{APP_NAME}</span>
                </Link>
              )}
              {hasSidebar && isMobile && <HeaderSidebarTrigger />}
            </div>
          </div>
          {!isLoggedIn ? (
            <div className="pointer-events-auto flex items-center justify-end gap-1 sm:gap-2 min-w-0 flex-shrink-0">
              <AnimatedThemeToggler 
                className="bg-background dark:bg-card dark:hover:bg-card/70 hover:bg-muted text-muted-foreground h-8 w-8 rounded-3xl flex items-center justify-center flex-shrink-0 shadow-sm hover:shadow-md transition-all duration-200"
              />
              <AppInfoTrigger
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-background hover:bg-muted text-muted-foreground h-8 w-8 rounded-3xl flex-shrink-0"
                    aria-label={`About ${APP_NAME}`}
                  >
                    <Info className="size-4" />
                  </Button>
                }
              />
              <Link
                href="/auth"
                className="font-base text-muted-foreground hover:text-foreground text-sm sm:text-base transition-colors flex-shrink-0"
              >
                Login
              </Link>
            </div>
          ) : (
            <div className="pointer-events-auto flex items-center justify-end gap-1 sm:gap-2 min-w-0 flex-shrink-0">
              {/* Show share button for non-collaborative chats */}
              {chatId && !isCollaborativeRoom && currentChat && (
                <ChatVisibilityToggle 
                  chatId={chatId} 
                  initialPublic={currentChat.public || false}
                />
              )}
              
              {/* Project Navigator Toggle - show for all active chats */}
              {chatId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        mobileHeaderButtonClass,
                        "relative overflow-hidden",
                        isNavigatorOpen && "bg-accent text-accent-foreground"
                      )}
                      onClick={toggleNavigator}
                    >
                      {/* Gradient background */}
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/[0.04] via-violet-600/[0.04] to-indigo-600/[0.04] dark:from-purple-600/[0.02] dark:via-violet-600/[0.02] dark:to-indigo-600/[0.02]" />
                      <Desktop className="relative size-4 mr-0 sm:mr-2" />
                      <span className="relative hidden sm:inline text-sm font-medium">Computer</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isNavigatorOpen ? "Hide" : "Show"} LLMHub's Computer</TooltipContent>
                </Tooltip>
              )}
              
              {/* Theme Toggle */}
              <AnimatedThemeToggler 
                className="bg-background dark:bg-card dark:hover:bg-card/70 hover:bg-muted text-muted-foreground h-8 w-8 rounded-3xl flex items-center justify-center flex-shrink-0 shadow-sm hover:shadow-md transition-all duration-200"
              />
            </div>
          )}
        </div>
      </div>
      </header>
    </>
  )
}
