"use client"

import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { useState, useEffect, useCallback, useMemo } from "react"
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  MessageSquareText,
  Monitor,
  MonitorSmartphone,
  Smartphone,
  Sparkles,
  Workflow,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CoastyIcon } from "@/components/icons/coasty"
import { CreateMachineDialog } from "@/app/components/machines/create-machine-dialog"
import type { UserMachine } from "@/types/machines.types"

interface QuickStartGuideProps {
  userName?: string
  selectedVMId: string | null
  isUserAuthenticated: boolean
  hasCredentials: boolean | null
}

type StatusTone = "ready" | "pending" | "optional" | "neutral"
type GuideSlideId = "quickstart" | "desktop" | "swarms" | "schedules"

interface GuideAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: "default" | "secondary" | "outline"
}

interface GuideMiniCardProps {
  kicker: string
  icon: LucideIcon
  title: string
  subtitle: string
  statusLabel: string
  statusTone: StatusTone
  delay: number
  action?: GuideAction
}

interface FeatureSlideProps {
  id: string
  title: string
  description: string
  action: GuideAction
  cards: Array<Omit<GuideMiniCardProps, "delay" | "action">>
}

interface QuickStartSlideProps {
  title: string
  hasMachineSelection: boolean
  hasAvailableMachines: boolean
  hasCredentials: boolean | null
  onCreateMachine: () => void
}

const selectableStatuses = new Set(["running", "creating", "starting", "stopped"])

const guideSlides: Array<{ id: GuideSlideId; label: string }> = [
  { id: "quickstart", label: "Quick start" },
  { id: "desktop", label: "Desktop + mobile" },
  { id: "swarms", label: "Agent swarms" },
  { id: "schedules", label: "Scheduled runs" },
]

const desktopCards: FeatureSlideProps["cards"] = [
  {
    kicker: "Local",
    icon: Monitor,
    title: "Desktop",
    subtitle: "Run on your own computer.",
    statusLabel: "Mac/Win",
    statusTone: "ready",
  },
  {
    kicker: "Phone",
    icon: Smartphone,
    title: "Mobile",
    subtitle: "Check progress anywhere.",
    statusLabel: "Remote",
    statusTone: "optional",
  },
  {
    kicker: "Live",
    icon: MonitorSmartphone,
    title: "Control",
    subtitle: "Jump in on the go.",
    statusLabel: "Anywhere",
    statusTone: "ready",
  },
]

const swarmCards: FeatureSlideProps["cards"] = [
  {
    kicker: "Start",
    icon: Sparkles,
    title: "One prompt",
    subtitle: "Begin with one big task.",
    statusLabel: "1 task",
    statusTone: "neutral",
  },
  {
    kicker: "Spread",
    icon: Workflow,
    title: "Many machines",
    subtitle: "Run agents in parallel.",
    statusLabel: "Parallel",
    statusTone: "ready",
  },
  {
    kicker: "Finish",
    icon: CheckCircle2,
    title: "One result",
    subtitle: "Get answers back faster.",
    statusLabel: "Faster",
    statusTone: "pending",
  },
]

const scheduleCards: FeatureSlideProps["cards"] = [
  {
    kicker: "Set",
    icon: CalendarDays,
    title: "Timetable",
    subtitle: "Pick the cadence once.",
    statusLabel: "Daily",
    statusTone: "optional",
  },
  {
    kicker: "Run",
    icon: Sparkles,
    title: "Auto-start",
    subtitle: "Starts on its own.",
    statusLabel: "Auto",
    statusTone: "ready",
  },
  {
    kicker: "Repeat",
    icon: MessageSquareText,
    title: "Fresh results",
    subtitle: "Wake up to updates.",
    statusLabel: "Weekly",
    statusTone: "pending",
  },
]

function getStatusClasses(tone: StatusTone) {
  switch (tone) {
    case "ready":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    case "pending":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    case "optional":
      return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300"
    default:
      return "border-border/50 bg-muted/70 text-muted-foreground"
  }
}

function SmokeBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-8 top-0 h-16 w-20 rounded-full bg-sky-500/16 blur-3xl"
        animate={{ x: [0, 14, -8, 0], y: [0, -6, 8, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[-4%] top-0 h-20 w-24 rounded-full bg-emerald-500/16 blur-3xl"
        animate={{ x: [0, -18, 8, 0], y: [0, 10, -6, 0], scale: [1, 0.94, 1.06, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-1/4 top-1/2 h-20 w-24 rounded-full bg-violet-500/14 blur-3xl"
        animate={{ x: [0, 12, -10, 0], y: [0, -10, 6, 0], scale: [1, 1.06, 0.94, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-1/4 bottom-[-8%] h-20 w-28 rounded-full bg-amber-500/14 blur-3xl"
        animate={{ x: [0, -14, 9, 0], y: [0, 8, -8, 0], scale: [1, 0.96, 1.08, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-[42%] top-[18%] h-16 w-20 rounded-full bg-rose-500/13 blur-3xl"
        animate={{ x: [0, 10, -6, 0], y: [0, 6, -10, 0], scale: [1, 1.04, 0.95, 1] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
    </div>
  )
}

function GuideMiniCard({
  kicker,
  icon: Icon,
  title,
  subtitle,
  statusLabel,
  statusTone,
  delay,
  action,
}: GuideMiniCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="min-w-0 rounded-[15px] border border-border/35 bg-background/52 p-2 backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="relative">
          <motion.div
            className="absolute inset-0 rounded-2xl bg-foreground/10 blur-md"
            animate={{ scale: [1, 1.08, 1], opacity: [0.25, 0.45, 0.25] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative flex h-7 w-7 items-center justify-center rounded-xl border border-border/35 bg-background/85">
            <Icon className="size-3 text-foreground" />
          </div>
        </div>

        <span
          className={cn(
            "rounded-full border px-1.5 py-0.5 text-[8px] font-medium",
            getStatusClasses(statusTone)
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {kicker}
        </p>
        <p className="mt-1 text-[11px] font-medium tracking-tight text-foreground sm:text-[12px]">
          {title}
        </p>
        <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">
          {subtitle}
        </p>
      </div>

      {action?.href ? (
        <Button
          asChild
          size="sm"
          variant={action.variant ?? "secondary"}
          className="mt-2 h-5 rounded-full px-1.5 text-[9px]"
        >
          <Link href={action.href}>
            {action.label}
            <ArrowRight className="size-2.5" />
          </Link>
        </Button>
      ) : action?.onClick ? (
        <Button
          type="button"
          size="sm"
          variant={action.variant ?? "default"}
          className="mt-2 h-5 rounded-full px-1.5 text-[9px]"
          onClick={action.onClick}
        >
          {action.label}
          <ArrowRight className="size-2.5" />
        </Button>
      ) : null}
    </motion.div>
  )
}

function QuickStartSlide({
  title,
  hasMachineSelection,
  hasAvailableMachines,
  hasCredentials,
  onCreateMachine,
}: QuickStartSlideProps) {
  return (
    <motion.div
      key="quickstart"
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -14 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="mt-1"
    >
      <p className="text-[11px] font-medium tracking-tight text-foreground sm:text-[12px]">
        {title}
      </p>
      <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">
        Choose a computer, add logins if needed, then try a prompt below.
      </p>

      <div className="relative mt-2">
        <div className="pointer-events-none absolute left-[52px] right-[52px] top-5 h-px overflow-hidden">
          <motion.div
            className="h-full w-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)] bg-[length:200%_100%]"
            animate={{ backgroundPosition: ["0% 0%", "100% 0%"] }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <GuideMiniCard
            kicker="1"
            icon={Monitor}
            title="Computer"
            subtitle={
              hasMachineSelection
                ? "Connected."
                : hasAvailableMachines
                  ? "Choose one."
                  : "Create one."
            }
            statusLabel={hasMachineSelection ? "Ready" : hasAvailableMachines ? "Pick" : "New"}
            statusTone={hasMachineSelection ? "ready" : "pending"}
            delay={0.06}
            action={
              hasAvailableMachines
                ? undefined
                : {
                    label: "New",
                    onClick: onCreateMachine,
                  }
            }
          />

          <GuideMiniCard
            kicker="2"
            icon={KeyRound}
            title="Logins"
            subtitle="Optional."
            statusLabel={
              hasCredentials === true
                ? "Ready"
                : hasCredentials === false
                  ? "Optional"
                  : "Checking"
            }
            statusTone={
              hasCredentials === true
                ? "ready"
                : hasCredentials === false
                  ? "optional"
                  : "neutral"
            }
            delay={0.1}
            action={{
              label: hasCredentials === true ? "Manage" : "Add",
              href: "/secrets",
              variant: hasCredentials === true ? "outline" : "secondary",
            }}
          />

          <GuideMiniCard
            kicker="3"
            icon={MessageSquareText}
            title="Ask"
            subtitle="Use prompts below."
            statusLabel={hasMachineSelection ? "Go" : "Next"}
            statusTone={hasMachineSelection ? "ready" : "pending"}
            delay={0.14}
          />
        </div>
      </div>
    </motion.div>
  )
}

function FeatureSlide({ id, title, description, action, cards }: FeatureSlideProps) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -14 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="mt-1"
    >
      <p className="text-[11px] font-medium tracking-tight text-foreground sm:text-[12px]">
        {title}
      </p>
      <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">
        {description}
      </p>

      <div className="relative mt-2">
        <div className="pointer-events-none absolute left-[52px] right-[52px] top-5 h-px overflow-hidden">
          <motion.div
            className="h-full w-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)] bg-[length:200%_100%]"
            animate={{ backgroundPosition: ["0% 0%", "100% 0%"] }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {cards.map((card, index) => (
            <GuideMiniCard
              key={card.title}
              {...card}
              delay={0.06 + index * 0.04}
            />
          ))}
        </div>
      </div>

      {action.href ? (
        <Button
          asChild
          size="sm"
          variant={action.variant ?? "secondary"}
          className="mt-2 h-5 rounded-full px-1.5 text-[9px]"
        >
          <Link href={action.href}>
            {action.label}
            <ArrowRight className="size-2.5" />
          </Link>
        </Button>
      ) : null}
    </motion.div>
  )
}

export function QuickStartGuide({
  userName,
  selectedVMId,
  isUserAuthenticated,
  hasCredentials,
}: QuickStartGuideProps) {
  const [machines, setMachines] = useState<UserMachine[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)

  const fetchMachines = useCallback(async () => {
    if (!isUserAuthenticated) return

    try {
      const response = await fetch("/api/machines")
      if (!response.ok) return

      const data = await response.json()
      const availableMachines = (data.machines || []).filter((machine: UserMachine) => {
        if (machine.settings?.provider === "electron") {
          return true
        }

        if (machine.settings?.isLocal && machine.settings?.provider !== "docker") {
          return false
        }

        return selectableStatuses.has(machine.status)
      })

      setMachines(availableMachines)
    } catch {
      // Silently fail
    }
  }, [isUserAuthenticated])

  useEffect(() => {
    fetchMachines()
    const interval = setInterval(fetchMachines, 10000)
    return () => clearInterval(interval)
  }, [fetchMachines])

  const selectedMachine = useMemo(
    () => machines.find((machine) => machine.id === selectedVMId) ?? null,
    [machines, selectedVMId]
  )

  const currentSlide = guideSlides[activeSlide]
  const hasMachineSelection = Boolean(selectedVMId)
  const hasAvailableMachines = machines.length > 0

  const currentSlideCompanion = useMemo(() => {
    switch (currentSlide.id) {
      case "quickstart":
        return hasMachineSelection ? selectedMachine?.displayName ?? "Ready" : null
      case "desktop":
        return "Local + mobile"
      case "swarms":
        return "Parallel"
      case "schedules":
        return "Timed"
      default:
        return null
    }
  }, [currentSlide.id, hasMachineSelection, selectedMachine])

  const goToPreviousSlide = useCallback(() => {
    setActiveSlide((current) => (current - 1 + guideSlides.length) % guideSlides.length)
  }, [])

  const goToNextSlide = useCallback(() => {
    setActiveSlide((current) => (current + 1) % guideSlides.length)
  }, [])

  return (
    <>
      <div className="mx-auto w-full max-w-[34rem] px-2.5 sm:px-3.5">
        <div className="relative overflow-hidden rounded-[16px] border border-border/40 bg-background/76 shadow-[0_16px_34px_-32px_rgba(0,0,0,0.55)]">
          <SmokeBackground />

          <div className="relative p-2 sm:p-2.5">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/35 bg-background/55 px-2 py-0.5 text-[9px] font-medium text-muted-foreground backdrop-blur-sm">
                  <CoastyIcon className="size-3" />
                  {currentSlide.label}
                </span>
                {currentSlideCompanion ? (
                  <span className="hidden max-w-[10rem] truncate sm:inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-background/55 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                    {currentSlideCompanion}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-1">
                <span className="hidden text-[9px] text-muted-foreground sm:inline">
                  {activeSlide + 1}/{guideSlides.length}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={goToPreviousSlide}
                  aria-label="Previous guide card"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={goToNextSlide}
                  aria-label="Next guide card"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </motion.div>

            <AnimatePresence initial={false} mode="wait">
              {currentSlide.id === "quickstart" ? (
                <QuickStartSlide
                  title={userName ? `${userName}, start here.` : "Start here."}
                  hasMachineSelection={hasMachineSelection}
                  hasAvailableMachines={hasAvailableMachines}
                  hasCredentials={hasCredentials}
                  onCreateMachine={() => setShowCreateDialog(true)}
                />
              ) : null}

              {currentSlide.id === "desktop" ? (
                <FeatureSlide
                  id="desktop"
                  title="Run locally. Check in from your phone."
                  description="Download Coasty for your own desktop, then remote-control it from mobile."
                  cards={desktopCards}
                  action={{
                    label: "Download app",
                    href: "/download",
                    variant: "secondary",
                  }}
                />
              ) : null}

              {currentSlide.id === "swarms" ? (
                <FeatureSlide
                  id="swarms"
                  title="Let one job fan out across many machines."
                  description="Launch agent swarms when you want more speed, scale, or parallel research."
                  cards={swarmCards}
                  action={{
                    label: "Open swarms",
                    href: "/swarms",
                    variant: "secondary",
                  }}
                />
              ) : null}

              {currentSlide.id === "schedules" ? (
                <FeatureSlide
                  id="schedules"
                  title="Put recurring work on a timetable."
                  description="Set daily, weekly, or monthly runs and let Coasty work in the background."
                  cards={scheduleCards}
                  action={{
                    label: "Open schedules",
                    href: "/schedules",
                    variant: "secondary",
                  }}
                />
              ) : null}
            </AnimatePresence>

            <div className="mt-2 flex items-center justify-center gap-1">
              {guideSlides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Show ${slide.label}`}
                  onClick={() => setActiveSlide(index)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    index === activeSlide
                      ? "w-4 bg-foreground/55"
                      : "w-1.5 bg-foreground/15 hover:bg-foreground/30"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <CreateMachineDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onMachineCreated={fetchMachines}
      />
    </>
  )
}
