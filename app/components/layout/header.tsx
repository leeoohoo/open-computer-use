"use client"

import { useState, useCallback, useEffect } from "react"
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
import { LanguageSwitcherCompact } from "@/components/language-switcher"
import { useGuideStore } from "@/lib/guide-store"
import { BookOpen } from "lucide-react"
import { useTranslations } from "next-intl"

function GuideToggle() {
  const dismissed = useGuideStore((s) => s.dismissed)
  const toggle = useGuideStore((s) => s.toggle)
  const hydrate = useGuideStore((s) => s.hydrate)

  // Hydrate on mount so we read localStorage
  useEffect(() => { hydrate() }, [hydrate])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150",
            dismissed
              ? "text-muted-foreground hover:text-foreground"
              : "text-foreground bg-foreground/[0.06]",
          )}
          aria-label="Toggle guide"
        >
          <BookOpen className="size-4" strokeWidth={1.75} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{dismissed ? "Show guide" : "Hide guide"}</TooltipContent>
    </Tooltip>
  )
}

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

  // Consistent icon-button base for all header actions
  const iconBtnClass = "text-muted-foreground hover:text-foreground h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150"
  const labelBtnClass = "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] dark:hover:bg-white/[0.08] rounded-full h-7 !px-2.5 !gap-1.5 transition-all duration-150 font-medium"

  return (
    <>
      <header className="h-app-header pointer-events-none absolute top-0 right-0 left-0 z-40">
      <div className="relative mx-auto flex h-full max-w-full items-center justify-between px-2 sm:px-4 lg:px-6 xl:px-8">
        <div className="flex w-full items-center justify-between min-w-0">
          <div className="-ml-0.5 flex items-center gap-1 sm:gap-2 lg:-ml-2.5 min-w-0 flex-shrink-0">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
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
            <div className="pointer-events-auto flex items-center justify-end gap-1 min-w-0 shrink-0">
              <LanguageSwitcherCompact />
              <AnimatedThemeToggler className={iconBtnClass} />
              <AppInfoTrigger
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className={iconBtnClass}
                    aria-label={`About ${APP_NAME}`}
                  >
                    <Info className="size-4" />
                  </Button>
                }
              />
              <Link
                href="/auth"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors shrink-0 ml-1"
              >
                {t("login")}
              </Link>
            </div>
          ) : (
            <div className="pointer-events-auto flex items-center justify-end gap-1.5 min-w-0 shrink-0">
              {/* Action group pill */}
              {chatId && (
                <div className="flex items-center gap-px rounded-full bg-foreground/[0.04] dark:bg-white/[0.06] border border-border/40 dark:border-white/[0.08] p-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={labelBtnClass}
                        onClick={openScheduleDialog}
                      >
                        <AgentIcon className="size-4" />
                        <span className="hidden sm:inline text-[13px] leading-none">{t("assign")}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("assignDescription")}</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          labelBtnClass,
                          isNavigatorOpen && "text-foreground bg-foreground/[0.08] dark:bg-white/[0.1]"
                        )}
                        onClick={toggleNavigator}
                      >
                        <Desktop className="size-4" />
                        <span className="hidden sm:inline text-[13px] leading-none">{t("computer")}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isNavigatorOpen ? t("hideComputer") : t("showComputer")}</TooltipContent>
                  </Tooltip>

                  {!isCollaborativeRoom && currentChat && (
                    <ChatVisibilityToggle
                      chatId={chatId}
                      initialPublic={currentChat.public || false}
                    />
                  )}
                </div>
              )}

              {/* Guide — homepage only */}
              {!chatId && <GuideToggle />}

              {/* Language & Theme */}
              <LanguageSwitcherCompact />
              <AnimatedThemeToggler className={iconBtnClass} />
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
