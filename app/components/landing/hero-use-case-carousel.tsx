"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Play } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

// ─── Neutral accent ───
const ACCENT_RGB = "212, 212, 216"

// ─── Use Cases ───
interface UseCase {
  label: string
  headline: string
  task: string
  videoId: string
}

const USE_CASES: UseCase[] = [
  { label: "Marketing", headline: "runs your marketing.", task: "Run a Reddit campaign — research, post, engage, and report back", videoId: "icxgLDephHE" },
  { label: "Sales", headline: "works your pipeline.", task: "Research 50 leads, personalize outreach, and send follow-ups", videoId: "qTvmGfg3HVw" },
  { label: "QA", headline: "tests your product.", task: "Run every checkout flow, catch bugs, and file detailed reports", videoId: "Wbo2o74hVIo" },
  { label: "Lead Gen", headline: "fills your pipeline.", task: "Build prospect lists and launch outreach sequences at scale", videoId: "icxgLDephHE" },
  { label: "Recruiting", headline: "hires your team.", task: "Source candidates on LinkedIn, screen profiles, and schedule calls", videoId: "AnHJuRMLCnE" },
  { label: "HR & Admin", headline: "handles the paperwork.", task: "Process applications, fill onboarding forms, and manage documents", videoId: "mH-csaCa508" },
  { label: "Support", headline: "runs your helpdesk.", task: "Resolve tickets 24/7 — look up accounts, draft replies, close issues", videoId: "A_OvNh51Npg" },
  { label: "Finance", headline: "processes your books.", task: "Extract invoice data, reconcile entries, and update spreadsheets", videoId: "AnHJuRMLCnE" },
  { label: "Growth", headline: "grows your channels.", task: "Post across Hacker News, Reddit, and social — engage with every reply", videoId: "A_OvNh51Npg" },
  { label: "Operations", headline: "runs your ops.", task: "Generate weekly reports, sync data across systems, and schedule follow-ups", videoId: "qTvmGfg3HVw" },
]

const CYCLE_MS = 4000

export function HeroUseCaseCarousel({ isMobile }: { isMobile: boolean }) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState<string | null>(null)
  const paused = useRef(false)
  const elapsed = useRef(0)
  const lastTick = useRef(Date.now())
  const current = USE_CASES[index]

  // Auto-cycle with pause support
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now()
      if (!paused.current) {
        elapsed.current += now - lastTick.current
        const p = elapsed.current / CYCLE_MS
        if (p >= 1) {
          elapsed.current = 0
          setIndex((prev) => (prev + 1) % USE_CASES.length)
          setProgress(0)
        } else {
          setProgress(p)
        }
      }
      lastTick.current = now
    }, 30)
    return () => clearInterval(tick)
  }, [])

  const pick = useCallback((i: number) => {
    setIndex(i)
    setProgress(0)
    setPlaying(null)
    elapsed.current = 0
    lastTick.current = Date.now()
  }, [])

  const handlePlay = useCallback(() => {
    paused.current = true
    setPlaying(current.videoId)
  }, [current.videoId])

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* ─── Top section: headline + subtitle ─── */}
      <div className={cn("relative z-10 text-center", isMobile ? "mb-8" : "mb-10")}>
        {/* Trust badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-background/60 backdrop-blur-sm px-4 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-emerald-400"
              />
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"
              />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              #1 State of the Art · <span className="text-foreground font-semibold">82% OSWorld</span>
            </span>
          </div>
        </div>

        {/* Headline — the positioning statement */}
        <h1 className={cn(
          "font-bold tracking-tight leading-[1.08]",
          isMobile ? "text-3xl mb-3" : "text-4xl sm:text-5xl lg:text-[3.25rem] mb-4"
        )}>
          <span className="text-foreground">Run your entire company.</span>
          <br />
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(to right, #f97316, #ec4899, #a855f7, #3b82f6, #06b6d4)' }}>Zero employees.</span>
        </h1>

        {/* Rotating department line */}
        <div className={cn(
          "mx-auto",
          isMobile ? "max-w-sm" : "max-w-2xl"
        )}>
          <div className={cn(
            "flex items-center justify-center gap-2",
            isMobile ? "min-h-[2rem]" : "h-8"
          )}>
            <span className={cn(
              "text-muted-foreground/60 shrink-0",
              isMobile ? "text-sm" : "text-base sm:text-lg"
            )}>
              AI that
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "text-foreground font-medium",
                  isMobile ? "text-sm" : "text-base sm:text-lg",
                  !isMobile && "whitespace-nowrap"
                )}
              >
                {current.headline}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Task example */}
          <div className={cn(
            "flex items-center justify-center gap-1.5 mt-1",
            isMobile ? "min-h-[2rem]" : "h-7"
          )}>
            <AnimatePresence mode="wait">
              <motion.span
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  "text-muted-foreground/50",
                  isMobile ? "text-xs" : "text-sm"
                )}
              >
                {current.task}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* CTA + cost */}
        <div className={cn("mt-8 flex flex-col items-center gap-3", isMobile ? "mt-6" : "mt-8")}>
          <Link href="/auth">
            <motion.button
              className={cn(
                "inline-flex items-center gap-2.5 rounded-full font-semibold cursor-pointer bg-foreground text-background",
                isMobile ? "px-6 py-3 text-sm" : "px-8 py-3.5 text-[15px]"
              )}
              style={{
                boxShadow: `0 8px 30px rgba(0, 0, 0, 0.15)`,
              }}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              Deploy Your Workforce
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </Link>
        </div>
      </div>

      {/* ─── Use case selector pills ─── */}
      <div className={cn(
        "relative z-10 flex flex-wrap justify-center",
        isMobile ? "gap-1 mb-6" : "gap-1.5 mb-8"
      )}>
        {USE_CASES.map((uc, i) => {
          const isActive = i === index
          return (
            <motion.button
              key={uc.label}
              onClick={() => pick(i)}
              layout
              className={cn(
                "relative rounded-full font-medium overflow-hidden transition-all duration-300 cursor-pointer",
                isMobile ? "text-[10px] px-2.5 py-1" : "text-[11px] px-3.5 py-1.5",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70"
              )}
            >
              {/* Active pill background */}
              {isActive && (
                <motion.span
                  layoutId="active-pill"
                  className="absolute inset-0 rounded-full bg-foreground/[0.08] border border-foreground/[0.12]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {/* Progress bar inside active pill */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 h-[2px] rounded-full transition-none"
                  style={{
                    width: `${progress * 100}%`,
                    background: `linear-gradient(90deg, transparent, rgba(${ACCENT_RGB}, 0.6))`,
                  }}
                />
              )}
              <span className="relative z-10">{uc.label}</span>
            </motion.button>
          )
        })}
      </div>

      {/* ─── Video player ─── */}
      <div
        className="relative z-10"
        onMouseEnter={() => { if (!playing) paused.current = true }}
        onMouseLeave={() => { if (!playing) { paused.current = false; lastTick.current = Date.now() } }}
      >
        {/* Screen glow — blurred gradient beneath the player */}
        <div
          className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[80%] h-[40%] rounded-full blur-[80px] opacity-[0.07] dark:opacity-[0.12] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, currentColor 0%, transparent 70%)" }}
        />

        {/* Browser-window chrome */}
        <div className={cn(
          "relative rounded-xl sm:rounded-2xl overflow-hidden",
          "border border-border/40 dark:border-border/30",
          "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08),0_12px_48px_-8px_rgba(0,0,0,0.1)]",
          "dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),0_12px_48px_-8px_rgba(0,0,0,0.4)]",
          "ring-1 ring-white/[0.05] dark:ring-white/[0.03]"
        )}>
          {/* Title bar */}
          <div className="flex items-center px-4 py-2 bg-muted/30 dark:bg-white/[0.03] border-b border-border/20">
            {/* Traffic lights */}
            <div className="flex items-center gap-[6px]">
              <div className="h-[10px] w-[10px] rounded-full bg-foreground/[0.08] dark:bg-white/[0.08]" />
              <div className="h-[10px] w-[10px] rounded-full bg-foreground/[0.08] dark:bg-white/[0.08]" />
              <div className="h-[10px] w-[10px] rounded-full bg-foreground/[0.08] dark:bg-white/[0.08]" />
            </div>
            {/* URL bar */}
            <div className="flex-1 flex justify-center">
              <div className={cn(
                "rounded-md bg-foreground/[0.04] dark:bg-white/[0.04] flex items-center justify-center gap-1.5",
                isMobile ? "px-3 py-[3px] max-w-[200px]" : "px-4 py-[3px] max-w-[300px]"
              )}>
                {/* Lock icon */}
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-muted-foreground/30 shrink-0">
                  <path d="M11.5 7V5a3.5 3.5 0 10-7 0v2M4 7h8a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "text-muted-foreground/35 truncate select-none font-mono",
                      isMobile ? "text-[9px]" : "text-[11px]"
                    )}
                  >
                    coasty.ai/{current.label.toLowerCase().replace(/[\s-]+/g, "-")}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
            {/* Spacer to balance traffic lights */}
            <div className="w-[54px]" />
          </div>

          {/* Video area */}
          <div className="relative w-full bg-neutral-950" style={{ paddingTop: "56.25%" }}>
            <AnimatePresence mode="wait">
              {playing === current.videoId ? (
                /* Iframe — loaded on play */
                <motion.div
                  key={`iframe-${current.videoId}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0"
                >
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube-nocookie.com/embed/${current.videoId}?rel=0&modestbranding=1&showinfo=0&autoplay=1`}
                    title="Coasty AI Agent Demo"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    style={{ border: "none" }}
                  />
                </motion.div>
              ) : (
                /* Thumbnail + play button */
                <motion.div
                  key={`thumb-${current.videoId}`}
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="absolute inset-0 cursor-pointer group"
                  onClick={handlePlay}
                >
                  {/* Thumbnail image */}
                  <Image
                    src={`https://img.youtube.com/vi/${current.videoId}/maxresdefault.jpg`}
                    alt={`${current.label} demo`}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]"
                    sizes="(max-width: 768px) 100vw, 960px"
                    priority={index === 0}
                  />

                  {/* Gradient overlay — cinematic vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-black/5 group-hover:from-black/50 transition-colors duration-500" />

                  {/* Play button — frosted glass */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      className={cn(
                        "relative flex items-center justify-center rounded-full",
                        "bg-white/[0.15] backdrop-blur-md border border-white/20",
                        "group-hover:bg-white/[0.22] group-hover:border-white/30 transition-all duration-400",
                        isMobile ? "h-14 w-14" : "h-[72px] w-[72px]"
                      )}
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.94 }}
                    >
                      <Play
                        className={cn(
                          "text-white fill-white ml-[2px] drop-shadow-sm",
                          isMobile ? "h-5 w-5" : "h-6 w-6"
                        )}
                      />
                    </motion.div>
                  </div>

                  {/* Use case label — bottom left */}
                  <div className={cn("absolute left-0 bottom-0 p-3", isMobile ? "p-2.5" : "p-4")}>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={index}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-white/80 font-medium backdrop-blur-sm bg-white/[0.08] rounded-md border border-white/[0.08]",
                          isMobile ? "text-[10px] px-2 py-1" : "text-xs px-2.5 py-1"
                        )}
                      >
                        <span className="h-1 w-1 rounded-full bg-white/50" />
                        {current.label}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  {/* Watch demo text — bottom right */}
                  <div className={cn("absolute right-0 bottom-0", isMobile ? "p-2.5" : "p-4")}>
                    <span className={cn(
                      "text-white/40 group-hover:text-white/60 transition-colors duration-300",
                      isMobile ? "text-[10px]" : "text-xs"
                    )}>
                      Watch demo &rarr;
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
