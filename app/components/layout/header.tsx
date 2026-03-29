"use client"

import { useState, useCallback } from "react"
import { AppInfoTrigger } from "@/app/components/layout/app-info/app-info-trigger"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { CoastyIcon } from "@/components/icons/coasty"
import { Button } from "@/components/ui/button"
import { APP_NAME } from "@/lib/config"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-store/provider"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { useProjectNavigator } from "@/lib/project-navigator-store/provider"
import { Info, Desktop } from "@phosphor-icons/react"
import { AgentIcon } from "@/components/icons/agent"
import Link from "next/link"
import { HeaderSidebarTrigger } from "./header-sidebar-trigger"
import { toast } from "sonner"
import { ChatVisibilityToggle } from "@/app/components/chat/chat-visibility-toggle"
import { ScheduleDialog } from "@/app/components/schedules/schedule-dialog"
import type { UserMachine } from "@/types/machines.types"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler"
import { useTranslations } from "next-intl"

interface HeaderProps {
  hasSidebar: boolean
}

export function Header({ hasSidebar }: HeaderProps) {
  const isMobile = useBreakpoint(768)
  const { user } = useUser()
  const { refresh, getChatById } = useChats()
  const { chatId } = useChatSession()
  const { isOpen: isNavigatorOpen, toggleNavigator, selectedVMId } = useProjectNavigator()
  const isLoggedIn = !!user
  const t = useTranslations("appHeader")

  // Schedule dialog state
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleMachines, setScheduleMachines] = useState<UserMachine[]>([])

  const openScheduleDialog = useCallback(async () => {
    try {
      const res = await fetch("/api/machines")
      if (res.ok) {
        const data = await res.json()
        setScheduleMachines(data.machines || [])
      }
    } catch {
      setScheduleMachines([])
    }
    setScheduleOpen(true)
  }, [])

  // Get current chat to check if it's collaborative
  const currentChat = chatId ? getChatById(chatId) : null
  const isCollaborativeRoom = currentChat?.collaborative === true

  // Clean, minimal header button — no background, no shadow, just icon + text
  const headerBtnClass = "text-muted-foreground hover:text-foreground rounded-full px-2 py-1.5 h-8 sm:h-8 transition-colors duration-150 font-medium"

  return (
    <>
      <header className="h-app-header pointer-events-none absolute top-0 right-0 left-0 z-40">
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
                  <CoastyIcon className="mr-1 size-4 flex-shrink-0" />
                  <span className="hidden sm:inline truncate">{APP_NAME}</span>
                </Link>
              )}
              {hasSidebar && isMobile && <HeaderSidebarTrigger />}
            </div>
          </div>
          {!isLoggedIn ? (
            <div className="pointer-events-auto flex items-center justify-end gap-1 sm:gap-2 min-w-0 flex-shrink-0">
              <AnimatedThemeToggler
                className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-150"
              />
              <AppInfoTrigger
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-full flex-shrink-0 transition-colors duration-150"
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
                {t("login")}
              </Link>
            </div>
          ) : (
            <div className="pointer-events-auto flex items-center justify-end gap-0.5 sm:gap-1 min-w-0 flex-shrink-0">
              {/* Assign Employee */}
              {chatId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={headerBtnClass}
                      onClick={openScheduleDialog}
                    >
                      <AgentIcon className="size-4" />
                      <span className="hidden sm:inline ml-1.5 text-sm">{t("assign")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("assignDescription")}</TooltipContent>
                </Tooltip>
              )}

              {/* Computer */}
              {chatId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        headerBtnClass,
                        isNavigatorOpen && "text-foreground bg-muted/60"
                      )}
                      onClick={toggleNavigator}
                    >
                      <Desktop className="size-4" />
                      <span className="hidden sm:inline ml-1.5 text-sm">{t("computer")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isNavigatorOpen ? t("hideComputer") : t("showComputer")}</TooltipContent>
                </Tooltip>
              )}

              {/* Share — slight accent to encourage usage */}
              {chatId && !isCollaborativeRoom && currentChat && (
                <ChatVisibilityToggle
                  chatId={chatId}
                  initialPublic={currentChat.public || false}
                />
              )}

              {/* Theme Toggle */}
              <AnimatedThemeToggler
                className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-150"
              />
            </div>
          )}
        </div>
      </div>
      </header>

      {/* Employee Assignment Dialog */}
      {chatId && (
        <ScheduleDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          chatId={chatId}
          chatTitle={currentChat?.title || undefined}
          machines={scheduleMachines}
          defaultMachineId={selectedVMId}
          onScheduleCreated={() => {
            toast.success(t("employeeHired"))
            refresh()
          }}
          onScheduleDeleted={() => {
            toast.success(t("employeeRemoved"))
            refresh()
          }}
        />
      )}
    </>
  )
}
