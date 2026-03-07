"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ─── Neutral accent ───
const ACCENT = "#d4d4d8"
const ACCENT_RGB = "212, 212, 216"

// ─── Use Cases ───
interface UseCase {
  label: string
  headline: string
  task: string
  videoId: string
}

const USE_CASES: UseCase[] = [
  { label: "Marketing", headline: "delivers results.", task: "Market your product on Reddit autonomously", videoId: "icxgLDephHE" },
  { label: "Go-to-Market", headline: "saves you hours.", task: "Find prospects and send them a personalized email", videoId: "qTvmGfg3HVw" },
  { label: "QA Testing", headline: "reports back.", task: "Test every checkout flow and report bugs", videoId: "Wbo2o74hVIo" },
  { label: "Lead Gen", headline: "delivers leads.", task: "Find prospects and reach out via email", videoId: "icxgLDephHE" },
  { label: "Sales", headline: "closes deals.", task: "Research each lead and send a follow-up email", videoId: "qTvmGfg3HVw" },
  { label: "Job Application", headline: "lands interviews.", task: "Find roles, tailor your resume, and apply", videoId: "mH-csaCa508" },
  { label: "Support", headline: "resolves tickets.", task: "Resolve tickets by looking up accounts and replying", videoId: "A_OvNh51Npg" },
  { label: "Form Filling", headline: "submits forms.", task: "Fill out the YC S26 application for you", videoId: "AnHJuRMLCnE" },
  { label: "Social Media", headline: "grows your reach.", task: "Post on Hacker News and engage with comments", videoId: "A_OvNh51Npg" },
  { label: "Recruiting", headline: "finds candidates.", task: "Source candidates on LinkedIn and schedule calls", videoId: "AnHJuRMLCnE" },
]

const CYCLE_MS = 4000

export function HeroUseCaseCarousel({ isMobile }: { isMobile: boolean }) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
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
    elapsed.current = 0
    lastTick.current = Date.now()
  }, [])

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

        {/* Headline */}
        <h1 className={cn(
          "font-bold tracking-tight leading-[1.1] mb-4",
          isMobile ? "text-3xl" : "text-4xl sm:text-5xl lg:text-[3.5rem]"
        )}>
          <span className="text-foreground">AI Employee that </span>
          <span className="inline-block relative">
            <AnimatePresence mode="wait">
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className={cn("inline-block bg-gradient-to-r from-violet-400 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent", !isMobile && "whitespace-nowrap")}
              >
                {current.headline}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>

        {/* Rotating task */}
        <div className={cn(
          "mx-auto",
          isMobile ? "max-w-sm" : "max-w-xl"
        )}>
          <div className={cn("flex items-center justify-center gap-1.5", isMobile ? "min-h-[2.5rem]" : "h-8 whitespace-nowrap")}>
            <span className={cn(
              "text-muted-foreground/50 shrink-0",
              isMobile ? "text-sm" : "text-base sm:text-lg"
            )}>
              e.g.
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-sm" : "text-base sm:text-lg"
                )}
              >
                &ldquo;{current.task}&rdquo;
              </motion.span>
            </AnimatePresence>
          </div>
          <p className={cn(
            "text-muted-foreground/40 mt-2",
            isMobile ? "text-xs" : "text-sm"
          )}>
            Get real results you can review, save, and share — not just promises.
          </p>
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
              Try It Free
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

      {/* ─── Video ─── */}
      <div
        className="relative z-10"
        onMouseEnter={() => { paused.current = true }}
        onMouseLeave={() => { paused.current = false; lastTick.current = Date.now() }}
      >
        <div className="relative rounded-xl overflow-hidden border border-border/50 shadow-2xl shadow-black/20">
          <div className="relative w-full bg-black" style={{ paddingTop: "56.25%" }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={current.videoId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute inset-0"
              >
                <iframe
                  loading="lazy"
                  className="w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${current.videoId}?rel=0&modestbranding=1&showinfo=0`}
                  title="Coasty AI Agent Demo"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  style={{ border: "none" }}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
