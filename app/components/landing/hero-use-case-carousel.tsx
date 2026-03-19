"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  Video,
  Play,
  Search,
  Bug,
  TrendingUp,
  FileText,
  Mail,
  ShoppingCart,
  Users,
  BarChart3,
  Globe,
  Eye,
  Send,
  MonitorSmartphone,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

const DEMO_VIDEOS = [
  { id: "icxgLDephHE", label: "Marketing", task: "Market your product on Reddit autonomously" },
  { id: "qTvmGfg3HVw", label: "Go-to-Market", task: "Find prospects and send personalized emails" },
  { id: "Wbo2o74hVIo", label: "QA Testing", task: "Test every checkout flow and report bugs" },
  { id: "mH-csaCa508", label: "Job Application", task: "Find roles, tailor resume, and apply" },
  { id: "AnHJuRMLCnE", label: "Form Filling", task: "Fill out the YC S26 application for you" },
  { id: "A_OvNh51Npg", label: "Social Media", task: "Post on Hacker News and engage with comments" },
]

const USE_CASES = [
  {
    label: "Computer-using agent",
    headline: "10x output in 8 minutes",
    outcome: "An AI agent that controls a real computer — browses, clicks, types, and delivers finished work. No setup. No code.",
    icon: MonitorSmartphone,
    color: "emerald",
  },
  {
    label: "Competitor intel",
    headline: "5 competitor reports in 8 min",
    outcome: "5 competitor profiles with pricing, traffic stats, feature matrices, and positioning gaps — exported as a ready-to-share spreadsheet in under 8 minutes.",
    icon: Search,
    color: "emerald",
  },
  {
    label: "QA bug reports",
    headline: "30+ flows tested in 12 min",
    outcome: "30+ user flows tested, 100% of critical paths covered, every bug screenshotted with repro steps — delivered as a prioritized Notion doc in 12 minutes.",
    icon: Bug,
    color: "rose",
  },
  {
    label: "SEO gap analysis",
    headline: "150 keyword gaps in 15 min",
    outcome: "150+ keyword gaps identified, 10 high-impact content briefs drafted, competitor backlink sources mapped — full report in 15 minutes.",
    icon: TrendingUp,
    color: "blue",
  },
  {
    label: "Data extraction",
    headline: "1,000 rows scraped in 6 min",
    outcome: "1,000+ product listings scraped with prices, specs, and images — cleaned, de-duped, and exported as structured CSV in 6 minutes.",
    icon: FileText,
    color: "violet",
  },
  {
    label: "Lead generation",
    headline: "50 qualified leads in 10 min",
    outcome: "50 qualified decision-makers matching your ICP — with verified titles, companies, LinkedIn URLs, and personalized openers — delivered in 10 minutes.",
    icon: Users,
    color: "amber",
  },
  {
    label: "Site audit",
    headline: "200 pages audited in 9 min",
    outcome: "200+ pages scanned, Core Web Vitals scored, 15+ broken links found, accessibility issues ranked by severity — full report with fix priorities in 9 minutes.",
    icon: BarChart3,
    color: "emerald",
  },
  {
    label: "Ad intelligence",
    headline: "25 competitor ads in 11 min",
    outcome: "8 competitor landing pages captured, 25+ ad creatives archived, messaging patterns analyzed — side-by-side teardown delivered in 11 minutes.",
    icon: Eye,
    color: "blue",
  },
  {
    label: "Email outreach",
    headline: "50 cold emails in 7 min",
    outcome: "50 personalized cold emails drafted — each referencing the prospect's company, role, and a specific pain point — ready to send in 7 minutes.",
    icon: Send,
    color: "violet",
  },
  {
    label: "Design review",
    headline: "12 breakpoints tested in 8 min",
    outcome: "12 breakpoints tested across mobile, tablet, and desktop — 20+ layout issues screenshotted with CSS fix suggestions — report in 8 minutes.",
    icon: MonitorSmartphone,
    color: "rose",
  },
  {
    label: "Price monitoring",
    headline: "200 SKUs compared in 10 min",
    outcome: "5 competitor price sheets compared across 200+ SKUs — promotions, availability, and margin gaps flagged in a live spreadsheet in 10 minutes.",
    icon: ShoppingCart,
    color: "amber",
  },
  {
    label: "Market research",
    headline: "40 data points in 14 min",
    outcome: "$2.4B TAM calculated, 12 key players profiled, 3-year growth trend charted — sourced from 40+ data points, compiled in 14 minutes.",
    icon: Globe,
    color: "blue",
  },
  {
    label: "Email campaigns",
    headline: "100 emails personalized in 9 min",
    outcome: "3-email nurture sequence written for 100 prospects — each personalized with company context and pain points — campaign-ready in 9 minutes.",
    icon: Mail,
    color: "emerald",
  },
]

const CAROUSEL_COLORS: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  emerald: { text: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10 dark:bg-emerald-400/10", border: "border-emerald-500/20 dark:border-emerald-400/20", glow: "rgba(16,185,129,0.15)" },
  rose:    { text: "text-rose-500 dark:text-rose-400",       bg: "bg-rose-500/10 dark:bg-rose-400/10",       border: "border-rose-500/20 dark:border-rose-400/20",       glow: "rgba(244,63,94,0.15)" },
  blue:    { text: "text-blue-500 dark:text-blue-400",       bg: "bg-blue-500/10 dark:bg-blue-400/10",       border: "border-blue-500/20 dark:border-blue-400/20",       glow: "rgba(59,130,246,0.15)" },
  violet:  { text: "text-violet-500 dark:text-violet-400",   bg: "bg-violet-500/10 dark:bg-violet-400/10",   border: "border-violet-500/20 dark:border-violet-400/20",   glow: "rgba(139,92,246,0.15)" },
  amber:   { text: "text-amber-500 dark:text-amber-400",     bg: "bg-amber-500/10 dark:bg-amber-400/10",     border: "border-amber-500/20 dark:border-amber-400/20",     glow: "rgba(245,158,11,0.15)" },
}

export function HeroUseCaseCarousel({ isMobile }: { isMobile: boolean }) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0)
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-rotate carousel
  useEffect(() => {
    if (isPaused) return
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % USE_CASES.length)
    }, 3000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPaused])

  const activeCase = USE_CASES[activeIndex]
  const activeColors = CAROUSEL_COLORS[activeCase.color] || CAROUSEL_COLORS.emerald

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
              Computer-Using Agents · #1 State of the Art · <span className="text-foreground font-semibold">82% OSWorld</span>
            </span>
          </div>
        </div>

        {/* Headline */}
        <h1 className={cn(
          "font-bold tracking-tight",
          isMobile ? "text-4xl leading-[1.25]" : "text-5xl sm:text-6xl lg:text-7xl leading-[1.15]"
        )}>
          10x on autopilot.{" "}
          <span className="relative inline-block overflow-hidden pb-[0.15em]" style={{ height: "1.4em", verticalAlign: "bottom" }}>
            {/* Invisible sizer — takes up the width of the longest headline */}
            <span className="invisible whitespace-nowrap">100 emails personalized in 9 min</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={activeIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="absolute left-0 top-0 text-emerald-500 dark:text-emerald-400 whitespace-nowrap"
              >
                {activeCase.headline}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>

        {/* ─── Use Case Carousel ─── */}
        <div
          className={cn(isMobile ? "mt-6" : "mt-10")}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Marquee pill strip */}
          <div className="relative overflow-hidden mx-auto max-w-3xl">
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            <div
              className="flex w-max gap-1 py-1"
              style={{
                animation: isPaused ? "none" : "marquee 30s linear infinite",
              }}
            >
              {/* Duplicate the list for seamless loop */}
              {[...USE_CASES, ...USE_CASES].map((uc, i) => {
                const realIndex = i % USE_CASES.length
                const isActive = realIndex === activeIndex
                const colors = CAROUSEL_COLORS[uc.color] || CAROUSEL_COLORS.emerald
                const Icon = uc.icon
                return (
                  <button
                    key={`${uc.label}-${i}`}
                    onClick={() => setActiveIndex(realIndex)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium whitespace-nowrap cursor-pointer border shrink-0 transition-all duration-400 ease-out",
                      isActive
                        ? cn(colors.bg, colors.border, colors.text)
                        : "border-transparent text-muted-foreground/35 hover:text-muted-foreground/60"
                    )}
                  >
                    <Icon className={cn("size-2.5 transition-transform duration-400", isActive && "scale-110")} />
                    {uc.label}
                  </button>
                )
              })}
            </div>
            <style jsx>{`
              @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
            `}</style>
          </div>

          {/* Outcome text — simple fade */}
          <div className="mt-5 flex justify-center" style={{ minHeight: isMobile ? "3rem" : "2.5rem" }}>
            <AnimatePresence mode="wait">
              <motion.p
                key={activeIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={cn(
                  "text-muted-foreground/50 leading-relaxed max-w-lg text-center",
                  isMobile ? "text-xs" : "text-sm"
                )}
              >
                {activeCase.outcome}
              </motion.p>
            </AnimatePresence>
          </div>
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
              Try Coasty free
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
      </div>

      {/* ─── Demo Videos ─── */}
      <div className="relative z-10">
        {/* Screen glow */}
        <div
          className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[80%] h-[40%] rounded-full blur-[80px] opacity-[0.07] dark:opacity-[0.12] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, currentColor 0%, transparent 70%)" }}
        />

        {/* Featured video */}
        <div className={cn(
          "relative rounded-xl sm:rounded-2xl overflow-hidden",
          "border border-border/40 dark:border-border/30",
          "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08),0_12px_48px_-8px_rgba(0,0,0,0.1)]",
          "dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),0_12px_48px_-8px_rgba(0,0,0,0.4)]",
          "ring-1 ring-white/[0.05] dark:ring-white/[0.03]"
        )}>
          <AnimatePresence mode="wait">
            {playingVideoId ? (
              <motion.div
                key={`playing-${playingVideoId}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative w-full bg-neutral-950"
                style={{ paddingTop: "56.25%" }}
              >
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${playingVideoId}?rel=0&modestbranding=1&showinfo=0&autoplay=1`}
                  title={`Coasty ${DEMO_VIDEOS[activeVideoIndex].label} Demo`}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  style={{ border: "none" }}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`thumb-${activeVideoIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="relative cursor-pointer group"
                onClick={() => setPlayingVideoId(DEMO_VIDEOS[activeVideoIndex].id)}
              >
                <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                  <Image
                    src={`https://img.youtube.com/vi/${DEMO_VIDEOS[activeVideoIndex].id}/maxresdefault.jpg`}
                    alt={`${DEMO_VIDEOS[activeVideoIndex].label} demo`}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                  />
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/35 transition-colors duration-300" />

                  {/* Play button */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.div
                      className={cn(
                        "relative flex items-center justify-center rounded-full",
                        "bg-white/95 shadow-2xl",
                        "group-hover:scale-110 transition-transform duration-300",
                        isMobile ? "h-12 w-12" : "h-16 w-16"
                      )}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Play className={cn(
                        "text-neutral-900 fill-neutral-900 ml-[2px]",
                        isMobile ? "h-4 w-4" : "h-5 w-5"
                      )} />
                    </motion.div>

                    {/* Task label */}
                    <motion.div
                      className="mt-3 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-sm"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.4 }}
                    >
                      <span className={cn(
                        "font-medium text-white/90",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}>
                        {DEMO_VIDEOS[activeVideoIndex].task}
                      </span>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Video selector strip */}
        <div className={cn("mt-3 flex gap-2", isMobile ? "overflow-x-auto px-1 no-scrollbar" : "justify-center")} style={{ scrollbarWidth: "none" }}>
          {DEMO_VIDEOS.map((video, i) => (
            <button
              key={video.id}
              onClick={() => {
                setActiveVideoIndex(i)
                setPlayingVideoId(null)
              }}
              className={cn(
                "group relative flex-shrink-0 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer",
                "border-2",
                i === activeVideoIndex
                  ? "border-emerald-500/60 dark:border-emerald-400/50 shadow-md"
                  : "border-transparent hover:border-border/60 opacity-60 hover:opacity-100",
                isMobile ? "w-20 h-12" : "w-28 h-16"
              )}
            >
              <Image
                src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                alt={video.label}
                fill
                className="object-cover"
              />
              {/* Label overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end">
                <span className={cn(
                  "font-semibold text-white/90 px-1.5 pb-1 leading-tight",
                  isMobile ? "text-[8px]" : "text-[10px]"
                )}>
                  {video.label}
                </span>
              </div>
              {/* Play icon on non-active */}
              {i !== activeVideoIndex && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="h-6 w-6 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="h-3 w-3 text-neutral-900 fill-neutral-900 ml-[1px]" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
