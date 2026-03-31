"use client"

import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Monitor,
  KeyRound,
  MessageSquareText,
  Smartphone,
  Workflow,
  CalendarDays,
  Clock,
  Download,
  Zap,
  ArrowRight,
  Play,
  ChevronLeft,
  ChevronRight,
  MessageSquareDashed,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Caveat } from "next/font/google"
import { CreateMachineDialog } from "@/app/components/machines/create-machine-dialog"
import type { UserMachine } from "@/types/machines.types"
import { useTranslations } from "next-intl"
import { useGuideStore } from "@/lib/guide-store"

const handwriting = Caveat({ subsets: ["latin"], weight: ["600"] })

/* ─── Types ──────────────────────────────────────────────────────────── */

interface QuickStartGuideProps {
  userName?: string
  selectedVMId: string | null
  isUserAuthenticated: boolean
  hasCredentials: boolean | null
}

type Tone = "ready" | "pending" | "optional" | "neutral"
type SlideId = "quickstart" | "desktop" | "swarms" | "schedules"

const selectableStatuses = new Set(["running", "creating", "starting", "stopped"])

/* ─── Step data ──────────────────────────────────────────────────────── */

interface StepData {
  icon: LucideIcon
  label: string
  description: string
  tone: Tone
  href?: string
  onClick?: () => void
}

interface SlideData {
  id: SlideId
  tab: string
  tabIcon: LucideIcon
  items: StepData[] | ((ctx: SlideContext) => StepData[])
  cta?: { text: string; href: string }
}

interface SlideContext {
  hasMachine: boolean
  hasAvailable: boolean
  hasCredentials: boolean | null
  onCreateMachine: () => void
}

/* ─── Tone styling — icon-only color, no box ───────────────────────── */

const toneStyles: Record<Tone, string> = {
  ready: "text-emerald-500 dark:text-emerald-400",
  pending: "text-amber-500 dark:text-amber-400",
  optional: "text-sky-500 dark:text-sky-400",
  neutral: "text-foreground/30 dark:text-foreground/40",
}

/* ─── Slide definitions ──────────────────────────────────────────────── */

function buildSlides(t: ReturnType<typeof useTranslations>): SlideData[] {
  return [
    {
      id: "quickstart",
      tab: t("tabs.start"),
      tabIcon: Play,
      items: (ctx) => [
        {
          icon: Monitor,
          label: ctx.hasMachine ? t("items.computerReady") : ctx.hasAvailable ? t("items.pickComputer") : t("items.createComputer"),
          description: ctx.hasMachine ? t("items.computerReadyDesc") : ctx.hasAvailable ? t("items.pickComputerDesc") : t("items.createComputerDesc"),
          tone: ctx.hasMachine ? "ready" : "pending",
          onClick: ctx.hasAvailable ? undefined : ctx.onCreateMachine,
        },
        {
          icon: KeyRound,
          label: ctx.hasCredentials ? t("items.loginsSaved") : t("items.addLogins"),
          description: ctx.hasCredentials ? t("items.loginsSavedDesc") : t("items.addLoginsDesc"),
          tone: ctx.hasCredentials ? "ready" : "optional",
          href: "/secrets",
        },
        {
          icon: MessageSquareText,
          label: t("items.askAnything"),
          description: t("items.askAnythingDesc"),
          tone: ctx.hasMachine ? "ready" : "neutral",
        },
      ],
    },
    {
      id: "desktop",
      tab: t("tabs.desktop"),
      tabIcon: Monitor,
      items: [
        { icon: Monitor, label: t("items.macWindows"), description: t("items.macWindowsDesc"), tone: "ready" },
        { icon: Smartphone, label: t("items.mobileRemote"), description: t("items.mobileRemoteDesc"), tone: "optional" },
        { icon: Download, label: t("items.freeDownload"), description: t("items.freeDownloadDesc"), tone: "ready", href: "/download" },
      ],
      cta: { text: t("cta.downloadApp"), href: "/download" },
    },
    {
      id: "swarms",
      tab: t("tabs.swarms"),
      tabIcon: Workflow,
      items: [
        { icon: MessageSquareDashed, label: t("items.onePrompt"), description: t("items.onePromptDesc"), tone: "neutral" },
        { icon: Workflow, label: t("items.manyAgents"), description: t("items.manyAgentsDesc"), tone: "ready" },
        { icon: Zap, label: t("items.combinedResult"), description: t("items.combinedResultDesc"), tone: "pending" },
      ],
      cta: { text: t("cta.trySwarms"), href: "/swarms" },
    },
    {
      id: "schedules",
      tab: t("tabs.schedules"),
      tabIcon: CalendarDays,
      items: [
        { icon: CalendarDays, label: t("items.setCadence"), description: t("items.setCadenceDesc"), tone: "optional" },
        { icon: Play, label: t("items.autoRuns"), description: t("items.autoRunsDesc"), tone: "ready" },
        { icon: Clock, label: t("items.recurringResults"), description: t("items.recurringResultsDesc"), tone: "pending" },
      ],
      cta: { text: t("cta.setUp"), href: "/schedules" },
    },
  ]
}

/* ─── Step component — compact & refined ────────────────────────────── */

function Step({
  icon: Icon,
  label,
  description,
  tone,
  href,
  onClick,
  delay,
}: StepData & { delay: number }) {
  const Wrapper = href ? Link : onClick ? "button" : "div"
  const wrapperProps = href
    ? { href }
    : onClick
      ? { type: "button" as const, onClick }
      : {}
  const iconColor = toneStyles[tone]

  return (
    <Wrapper
      {...(wrapperProps as any)}
      className={cn(
        "group relative flex flex-col items-center text-center gap-1.5 py-2.5 px-1 rounded-lg transition-all duration-200",
        (href || onClick) && "cursor-pointer hover:bg-foreground/[0.03]",
      )}
    >
      {/* Icon — no box, just color */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "transition-transform duration-200",
          (href || onClick) && "group-hover:scale-110",
        )}
      >
        <Icon className={cn("h-5 w-5", iconColor)} strokeWidth={1.4} />
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.05, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-px"
      >
        <span
          className={cn(
            "text-[10.5px] font-semibold leading-tight tracking-tight transition-colors duration-150",
            (href || onClick) ? "text-foreground/70 group-hover:text-foreground/90" : "text-foreground/65",
          )}
        >
          {label}
        </span>
        <p className="text-[9.5px] text-muted-foreground/50 leading-snug line-clamp-2 max-w-[8rem]">
          {description}
        </p>
      </motion.div>

      {/* Hover arrow */}
      {(href || onClick) && (
        <ArrowRight className="h-2.5 w-2.5 text-foreground/30 opacity-0 group-hover:opacity-100 transition-all duration-150 -mt-0.5" />
      )}
    </Wrapper>
  )
}

/* ─── Slide content ─────────────────────────────────────────────────── */

function SlideContent({
  items,
  cta,
}: {
  items: StepData[]
  variant: SlideId
  cta?: { text: string; href: string }
}) {
  return (
    <div>
      <div>
        <div className="grid grid-cols-3">
          {items.map((item, i) => (
            <Step key={item.label} {...item} delay={0.02 + i * 0.05} />
          ))}
        </div>
      </div>

      {cta && (
        <div className="mt-2 px-1">
          <Link
            href={cta.href}
            className="flex items-center justify-center gap-1 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] hover:bg-foreground/[0.06] hover:border-foreground/15 py-1.5 text-[9.5px] font-semibold text-foreground/45 hover:text-foreground/70 transition-all duration-200"
          >
            {cta.text}
            <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        </div>
      )}
    </div>
  )
}

/* ─── Main ───────────────────────────────────────────────────────────── */

export function QuickStartGuide({
  userName,
  selectedVMId,
  isUserAuthenticated,
  hasCredentials,
}: QuickStartGuideProps) {
  const [machines, setMachines] = useState<UserMachine[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [active, setActive] = useState(0)
  const [direction, setDirection] = useState(0)
  const t = useTranslations("quickStart")
  const slides = useMemo(() => buildSlides(t), [t])

  const goTo = useCallback((index: number) => {
    setDirection(index > active ? 1 : -1)
    setActive(index)
  }, [active])

  const goPrev = useCallback(() => {
    setDirection(-1)
    setActive((p) => (p === 0 ? slides.length - 1 : p - 1))
  }, [slides.length])

  const goNext = useCallback(() => {
    setDirection(1)
    setActive((p) => (p === slides.length - 1 ? 0 : p + 1))
  }, [slides.length])

  const fetchMachines = useCallback(async () => {
    if (!isUserAuthenticated) return
    try {
      const res = await fetch("/api/machines")
      if (!res.ok) return
      const data = await res.json()
      setMachines(
        (data.machines || []).filter((m: UserMachine) => {
          if (m.settings?.provider === "electron") return true
          if (m.settings?.isLocal && m.settings?.provider !== "docker") return false
          return selectableStatuses.has(m.status)
        })
      )
    } catch { /* silent */ }
  }, [isUserAuthenticated])

  useEffect(() => {
    fetchMachines()
    const iv = setInterval(fetchMachines, 10000)
    return () => clearInterval(iv)
  }, [fetchMachines])

  const hasMachine = Boolean(selectedVMId)
  const hasAvailable = machines.length > 0
  const slide = slides[active]

  const ctx: SlideContext = useMemo(() => ({
    hasMachine,
    hasAvailable,
    hasCredentials,
    onCreateMachine: () => setShowCreateDialog(true),
  }), [hasMachine, hasAvailable, hasCredentials])

  const items = typeof slide.items === "function" ? slide.items(ctx) : slide.items

  return (
    <>
      <div className="mx-auto w-full max-w-[26rem] px-2">
        {/* ─ Greeting ─ */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-3"
        >
          <h2 className={cn("text-xl sm:text-2xl text-primary -rotate-[0.8deg]", handwriting.className)}>
            {userName ? t("greetingName", { name: userName }) : t("greetingDefault")}
          </h2>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5 tracking-wide">
            {t("subtitle")}
          </p>
        </motion.div>

        <div className="relative">
          {/* ─ Close ─ */}
          <button
            type="button"
            onClick={useGuideStore.getState().toggle}
            className="absolute -top-1.5 -right-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-foreground/10 bg-background/90 backdrop-blur-sm text-foreground/35 hover:text-foreground/65 hover:border-foreground/20 hover:bg-background transition-all duration-150 shadow-sm"
          >
            <X className="h-2.5 w-2.5" strokeWidth={2.5} />
          </button>

          {/* ─ Card ─ */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-foreground/[0.08] bg-background/70 dark:bg-background/50 backdrop-blur-xl overflow-hidden pt-2.5 pb-2 shadow-sm dark:shadow-none"
          >
            {/* ─ Tab header ─ */}
            <div className="flex items-center justify-center px-2 mb-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={slide.id}
                  initial={{ opacity: 0, x: direction * 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -14 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-1.5"
                >
                  {(() => { const TabIcon = slide.tabIcon; return <TabIcon className="h-3 w-3 text-foreground/40" strokeWidth={1.6} /> })()}
                  <span className="text-[9.5px] font-semibold text-foreground/45 tracking-widest uppercase">
                    {slide.tab}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ─ Steps ─ */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={slide.id}
                initial={{ opacity: 0, x: direction * 36 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -36 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="px-2"
              >
                <SlideContent items={items} variant={slide.id} cta={slide.cta} />
              </motion.div>
            </AnimatePresence>

            {/* ─ Nav: prev · dots · next ─ */}
            <div className="flex items-center justify-center gap-2.5 mt-2 px-2">
              <button
                type="button"
                onClick={goPrev}
                className="flex h-5 w-5 items-center justify-center rounded-md text-foreground/25 hover:text-foreground/50 hover:bg-foreground/[0.05] transition-all duration-150 active:scale-90"
              >
                <ChevronLeft className="h-3 w-3" strokeWidth={2} />
              </button>

              <div className="flex items-center gap-1">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goTo(i)}
                    className="group/dot p-0.5"
                  >
                    <motion.div
                      className={cn(
                        "rounded-full transition-colors duration-200",
                        i === active
                          ? "bg-foreground/35"
                          : "bg-foreground/10 group-hover/dot:bg-foreground/20",
                      )}
                      animate={{
                        width: i === active ? 12 : 4,
                        height: 4,
                      }}
                      transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={goNext}
                className="flex h-5 w-5 items-center justify-center rounded-md text-foreground/25 hover:text-foreground/50 hover:bg-foreground/[0.05] transition-all duration-150 active:scale-90"
              >
                <ChevronRight className="h-3 w-3" strokeWidth={2} />
              </button>
            </div>
          </motion.div>
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
