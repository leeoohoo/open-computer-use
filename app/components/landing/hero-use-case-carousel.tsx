"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Video, Play } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

const DEMO_VIDEO_IDS = [
  "icxgLDephHE", "qTvmGfg3HVw", "Wbo2o74hVIo",
  "mH-csaCa508", "AnHJuRMLCnE", "A_OvNh51Npg",
]

const DEMO_VIDEO_KEYS = [
  "marketing", "goToMarket", "qaTesting",
  "jobApplication", "formFilling", "socialMedia",
] as const

const USE_CASE_KEYS = [
  "computerAgent", "competitorIntel", "qaTesting", "seoAnalysis",
  "dataExtraction", "leadGeneration", "siteAudit", "emailOutreach", "marketResearch",
] as const

export function HeroUseCaseCarousel({ isMobile }: { isMobile: boolean }) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0)
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pillContainerRef = useRef<HTMLDivElement>(null)
  const t = useTranslations("hero")
  const tc = useTranslations("common")

  // Build translated arrays
  const DEMO_VIDEOS = DEMO_VIDEO_IDS.map((id, i) => ({
    id,
    label: t(`demoVideos.${DEMO_VIDEO_KEYS[i]}.label`),
    task: t(`demoVideos.${DEMO_VIDEO_KEYS[i]}.task`),
  }))

  const USE_CASES = USE_CASE_KEYS.map((key) => ({
    label: t(`useCases.${key}.label`),
    headline: t(`useCases.${key}.headline`),
    outcome: t(`useCases.${key}.outcome`),
  }))

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

  // Scroll active pill to center
  useEffect(() => {
    const container = pillContainerRef.current
    if (!container) return
    const activeBtn = container.querySelector<HTMLElement>(`[data-pill-index="${activeIndex}"]`)
    if (!activeBtn) return
    const scrollLeft = activeBtn.offsetLeft - container.offsetWidth / 2 + activeBtn.offsetWidth / 2
    container.scrollTo({ left: scrollLeft, behavior: "smooth" })
  }, [activeIndex])

  const activeCase = USE_CASES[activeIndex]

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* ─── Hero text ─── */}
      <div className={cn("relative z-10 text-center", isMobile ? "mb-6" : "mb-14")}>
        {/* Badge */}
        <div className={cn("flex justify-center", isMobile ? "mb-5" : "mb-8")}>
          <div className="inline-flex items-center gap-2.5 rounded-full border border-border/40 bg-card/40 backdrop-blur-sm px-4 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <span className="h-1 w-1 rounded-full bg-foreground/30" />
            <span className="text-xs font-medium text-muted-foreground tracking-wide">
              {t("badge", { score: "82%" }).split("82%")[0]}<span className="text-foreground font-semibold">82% OSWorld</span>
            </span>
          </div>
        </div>

        {/* Headline */}
        <h1 className={cn(
          "font-bold tracking-tight",
          isMobile ? "text-3xl leading-[1.2]" : "text-4xl sm:text-5xl lg:text-6xl leading-[1.08]"
        )}>
          <span className="block text-foreground">{t("headline")}</span>
          <span className="relative block mt-1">
            {/* Invisible sizer — reserves height for the tallest headline */}
            <span className="invisible block" aria-hidden="true">
              {USE_CASES.reduce((longest, uc) => uc.headline.length > longest.length ? uc.headline : longest, "")}
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={activeIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-0 top-0 text-muted-foreground/60"
              >
                {activeCase.headline}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>

        {/* ─── Use Case Carousel ─── */}
        <div
          className={cn(isMobile ? "mt-4" : "mt-10")}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Pill strip */}
          <div className="relative mx-auto max-w-3xl">
            <div
              ref={pillContainerRef}
              className="flex gap-1 py-1 overflow-x-auto no-scrollbar"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="shrink-0 w-[calc(50%-2rem)]" />
              {USE_CASES.map((uc, i) => {
                const isActive = i === activeIndex
                return (
                  <button
                    key={uc.label}
                    data-pill-index={i}
                    onClick={() => setActiveIndex(i)}
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium whitespace-nowrap cursor-pointer border shrink-0 transition-all duration-300 ease-out",
                      isActive
                        ? "bg-foreground text-background border-foreground/90 shadow-sm"
                        : "border-transparent text-muted-foreground/35 hover:text-muted-foreground/60"
                    )}
                  >
                    {uc.label}
                  </button>
                )
              })}
              <div className="shrink-0 w-[calc(50%-2rem)]" />
            </div>
          </div>

          {/* Outcome text */}
          <div className={cn(isMobile ? "mt-3" : "mt-5", "flex justify-center")} style={{ minHeight: isMobile ? "3rem" : "2.5rem" }}>
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
          isMobile ? "mt-5 flex-col" : "mt-10"
        )}>
          <Link href="/auth">
            <motion.button
              className={cn(
                "inline-flex items-center gap-2.5 rounded-full font-semibold cursor-pointer bg-foreground text-background",
                isMobile ? "px-6 py-3 text-sm" : "px-8 py-3.5 text-[15px]"
              )}
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.1)" }}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              {tc("tryCoastyFree")}
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </Link>
          <a href="https://cal.com/coasty/15min" target="_blank" rel="noopener noreferrer">
            <motion.button
              className={cn(
                "inline-flex items-center gap-2 rounded-full font-medium cursor-pointer text-muted-foreground/70 hover:text-foreground transition-colors duration-300",
                isMobile ? "px-5 py-3 text-sm" : "px-6 py-3.5 text-[15px]"
              )}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Video className="h-4 w-4" />
              {tc("bookDemo")}
            </motion.button>
          </a>
        </div>
      </div>

      {/* ─── Demo Videos ─── */}
      <div className="relative z-10">
        {/* Ambient glow beneath video */}
        <div
          className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[60%] h-[40%] rounded-full blur-[100px] opacity-[0.03] dark:opacity-[0.06] pointer-events-none bg-foreground"
        />

        {/* Browser frame */}
        <div className={cn(
          "relative rounded-xl overflow-hidden",
          "border border-border/40 dark:border-border/25",
          "bg-card/30",
          "shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_2px_4px_rgba(0,0,0,0.03),0_12px_40px_-8px_rgba(0,0,0,0.08)]",
          "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_2px_4px_rgba(0,0,0,0.15),0_12px_40px_-8px_rgba(0,0,0,0.35)]",
        )}>
          {/* Browser chrome bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/25 bg-card/60 dark:bg-card/40">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-foreground/[0.08] dark:bg-foreground/[0.12]" />
              <div className="w-2.5 h-2.5 rounded-full bg-foreground/[0.08] dark:bg-foreground/[0.12]" />
              <div className="w-2.5 h-2.5 rounded-full bg-foreground/[0.08] dark:bg-foreground/[0.12]" />
            </div>
            <div className="flex-1 mx-8">
              <div className="h-5 rounded-md bg-foreground/[0.04] dark:bg-foreground/[0.06] max-w-[240px] mx-auto" />
            </div>
          </div>

          {/* Video content */}
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
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]"
                  />
                  {/* Subtle overlay */}
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors duration-500" />

                  {/* Play button */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.div
                      className={cn(
                        "relative flex items-center justify-center rounded-full",
                        "bg-white/95 shadow-[0_4px_24px_rgba(0,0,0,0.12)] backdrop-blur-sm",
                        "group-hover:scale-105 transition-transform duration-500 ease-out",
                        isMobile ? "h-12 w-12" : "h-16 w-16"
                      )}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Play className={cn(
                        "text-neutral-900 fill-neutral-900 ml-[2px]",
                        isMobile ? "h-4 w-4" : "h-5 w-5"
                      )} />
                    </motion.div>

                    {/* Task label */}
                    <motion.div
                      className="mt-3 px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-md"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.4 }}
                    >
                      <span className={cn(
                        "font-medium text-white/85",
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

        {/* Video selector thumbnails */}
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
                  ? "border-foreground/25 shadow-md"
                  : "border-transparent hover:border-border/40 opacity-50 hover:opacity-90",
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
