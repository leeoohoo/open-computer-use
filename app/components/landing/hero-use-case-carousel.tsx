"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Video, Play } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

// ─── Use Cases ───
interface UseCase {
  label: string
  verb: string
  videoId: string
}

const USE_CASES: UseCase[] = [
  { label: "Support", verb: "resolves tickets", videoId: "A_OvNh51Npg" },
  { label: "Sales", verb: "researches leads", videoId: "qTvmGfg3HVw" },
  { label: "Marketing", verb: "runs campaigns", videoId: "icxgLDephHE" },
  { label: "QA", verb: "tests every flow", videoId: "Wbo2o74hVIo" },
  { label: "Recruiting", verb: "sources candidates", videoId: "AnHJuRMLCnE" },
  { label: "Finance", verb: "processes invoices", videoId: "AnHJuRMLCnE" },
  { label: "Data Entry", verb: "syncs your apps", videoId: "qTvmGfg3HVw" },
]

const CYCLE_MS = 2800

export function HeroUseCaseCarousel({ isMobile }: { isMobile: boolean }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState<string | null>(null)
  const paused = useRef(false)
  const current = USE_CASES[index]

  useEffect(() => {
    const interval = setInterval(() => {
      if (!paused.current) {
        setIndex((prev) => (prev + 1) % USE_CASES.length)
      }
    }, CYCLE_MS)
    return () => clearInterval(interval)
  }, [])

  const handlePlay = useCallback(() => {
    paused.current = true
    setPlaying(current.videoId)
  }, [current.videoId])

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* ─── Hero text ─── */}
      <div className={cn("relative z-10 text-center", isMobile ? "mb-10" : "mb-14")}>
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-background/60 backdrop-blur-sm px-4 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-emerald-400" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              #1 State of the Art · <span className="text-foreground font-semibold">82% OSWorld</span>
            </span>
          </div>
        </div>

        {/* Headline */}
        <h1 className={cn(
          "font-bold tracking-tight",
          isMobile ? "text-4xl leading-[1.2]" : "text-5xl sm:text-6xl lg:text-7xl leading-[1.1]"
        )}>
          <span className="text-foreground">Coasty uses a computer</span>
          <br />
          <span className="text-muted-foreground/40">for you, </span>
          <span className="text-emerald-500 dark:text-emerald-400">safely.</span>
        </h1>

        {/* Sub */}
        <p className={cn(
          "text-muted-foreground/50 mt-5 mx-auto",
          isMobile ? "text-sm max-w-xs" : "text-lg max-w-md"
        )}>
          No MCP servers. No integrations. No setup. It just works.
        </p>

        {/* Rotating verb line */}
        <div className={cn(
          "mt-6 flex items-center justify-center gap-[0.35em]",
          isMobile ? "text-base" : "text-xl"
        )}>
          <span className="text-muted-foreground/50">It</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={index}
              initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="text-foreground font-semibold"
            >
              {current.verb}
            </motion.span>
          </AnimatePresence>
          <span className="text-muted-foreground/50">for you.</span>
        </div>

        {/* CTAs */}
        <div className={cn(
          "flex items-center justify-center gap-3",
          isMobile ? "mt-8 flex-col" : "mt-10"
        )}>
          <Link href="/auth">
            <motion.button
              className={cn(
                "inline-flex items-center gap-2.5 rounded-full font-semibold cursor-pointer bg-foreground text-background",
                isMobile ? "px-6 py-3 text-sm" : "px-8 py-3.5 text-[15px]"
              )}
              style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.15)" }}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              Start Automating
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </Link>
          <a href="https://cal.com/coasty/15min" target="_blank" rel="noopener noreferrer">
            <motion.button
              className={cn(
                "inline-flex items-center gap-2.5 rounded-full font-semibold cursor-pointer border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors",
                isMobile ? "px-6 py-3 text-sm" : "px-8 py-3.5 text-[15px]"
              )}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <Video className="h-4 w-4" />
              Talk to Cofounders
            </motion.button>
          </a>
        </div>

        {/* Use case labels */}
        <div className={cn(
          "flex flex-wrap justify-center",
          isMobile ? "gap-x-4 gap-y-2 mt-8" : "gap-x-5 gap-y-2 mt-10"
        )}>
          {USE_CASES.map((uc, i) => {
            const isActive = i === index
            return (
              <button
                key={uc.label}
                onClick={() => { setIndex(i); setPlaying(null); paused.current = false }}
                className={cn(
                  "relative cursor-pointer transition-colors duration-300",
                  isMobile ? "text-xs" : "text-sm",
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/30 hover:text-muted-foreground/60"
                )}
              >
                {uc.label}
                {isActive && (
                  <motion.span
                    layoutId="hero-underline"
                    className="absolute -bottom-1 left-0 right-0 h-px bg-foreground/40"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── Video player ─── */}
      <div
        className="relative z-10"
        onMouseEnter={() => { if (!playing) paused.current = true }}
        onMouseLeave={() => { if (!playing) { paused.current = false } }}
      >
        {/* Screen glow */}
        <div
          className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[80%] h-[40%] rounded-full blur-[80px] opacity-[0.07] dark:opacity-[0.12] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, currentColor 0%, transparent 70%)" }}
        />

        {/* Browser chrome */}
        <div className={cn(
          "relative rounded-xl sm:rounded-2xl overflow-hidden",
          "border border-border/40 dark:border-border/30",
          "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08),0_12px_48px_-8px_rgba(0,0,0,0.1)]",
          "dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),0_12px_48px_-8px_rgba(0,0,0,0.4)]",
          "ring-1 ring-white/[0.05] dark:ring-white/[0.03]"
        )}>
          {/* Title bar */}
          <div className="flex items-center px-4 py-2 bg-muted/30 dark:bg-white/[0.03] border-b border-border/20">
            <div className="flex items-center gap-[6px]">
              <div className="h-[10px] w-[10px] rounded-full bg-foreground/[0.08] dark:bg-white/[0.08]" />
              <div className="h-[10px] w-[10px] rounded-full bg-foreground/[0.08] dark:bg-white/[0.08]" />
              <div className="h-[10px] w-[10px] rounded-full bg-foreground/[0.08] dark:bg-white/[0.08]" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className={cn(
                "rounded-md bg-foreground/[0.04] dark:bg-white/[0.04] flex items-center justify-center gap-1.5",
                isMobile ? "px-3 py-[3px] max-w-[200px]" : "px-4 py-[3px] max-w-[300px]"
              )}>
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
            <div className="w-[54px]" />
          </div>

          {/* Video area */}
          <div className="relative w-full bg-neutral-950" style={{ paddingTop: "56.25%" }}>
            <AnimatePresence mode="wait">
              {playing === current.videoId ? (
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
                <motion.div
                  key={`thumb-${current.videoId}`}
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="absolute inset-0 cursor-pointer group"
                  onClick={handlePlay}
                >
                  <Image
                    src={`https://img.youtube.com/vi/${current.videoId}/maxresdefault.jpg`}
                    alt={`${current.label} demo`}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]"
                    sizes="(max-width: 768px) 100vw, 960px"
                    priority={index === 0}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-black/5 group-hover:from-black/50 transition-colors duration-500" />

                  {/* Play button */}
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
                      <Play className={cn(
                        "text-white fill-white ml-[2px] drop-shadow-sm",
                        isMobile ? "h-5 w-5" : "h-6 w-6"
                      )} />
                    </motion.div>
                  </div>

                  {/* Label badge */}
                  <div className={cn("absolute left-0 bottom-0", isMobile ? "p-2.5" : "p-4")}>
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

                  {/* Watch demo */}
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
