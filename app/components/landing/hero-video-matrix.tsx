"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Video, ChevronDown } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

// Demo video IDs cycled across the grid
const VIDEO_IDS = [
  "icxgLDephHE", "qTvmGfg3HVw", "Wbo2o74hVIo",
  "mH-csaCa508", "AnHJuRMLCnE", "A_OvNh51Npg",
]

const HEADLINE_KEYS = [
  "computerAgent", "competitorIntel", "qaTesting",
  "dataExtraction", "leadGeneration", "emailOutreach",
] as const

// Per-row column offsets prevent adjacent duplicate thumbnails
const ROW_OFFSETS = [0, 3, 1, 4, 2]

export function HeroVideoMatrix({ isMobile }: { isMobile: boolean }) {
  const cols = isMobile ? 5 : 7
  const rows = isMobile ? 3 : 5
  const gap = isMobile ? 6 : 10

  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const vignetteRef = useRef<HTMLDivElement>(null)
  const bottomFadeRef = useRef<HTMLDivElement>(null)

  const centerCol = Math.floor(cols / 2)
  const centerRow = Math.floor(rows / 2)

  const t = useTranslations("hero")
  const tc = useTranslations("common")
  const [headlineIndex, setHeadlineIndex] = useState(0)
  const HEADLINES = HEADLINE_KEYS.map((key) => t(`useCases.${key}.headline`))

  // Auto-rotate headlines
  useEffect(() => {
    const interval = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % HEADLINES.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [HEADLINES.length])

  // Pre-compute tile layout
  const tiles = useMemo(() => {
    return Array.from({ length: cols * rows }, (_, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const videoIdx =
        (col + ROW_OFFSETS[row % ROW_OFFSETS.length]) % VIDEO_IDS.length
      return {
        videoId: VIDEO_IDS[videoIdx],
        isCenter: col === centerCol && row === centerRow,
      }
    })
  }, [cols, rows, centerCol, centerRow])

  // ─── Scroll-driven zoom: direct DOM for zero-jank 60fps ───
  useEffect(() => {
    const container = containerRef.current
    const grid = gridRef.current
    const overlay = overlayRef.current
    const vignette = vignetteRef.current
    const bottomFade = bottomFadeRef.current
    if (!container || !grid) return

    const maxScale = cols

    let ticking = false
    const update = () => {
      const rect = container.getBoundingClientRect()
      const scrollable = container.offsetHeight - window.innerHeight
      if (scrollable <= 0) {
        ticking = false
        return
      }

      const scrolled = Math.max(0, -rect.top)
      const p = Math.min(1, scrolled / scrollable) // linear 0 → 1

      // Cubic ease-out for cinematic deceleration
      const eased = 1 - Math.pow(1 - p, 3)

      // Scale: maxScale → 1
      grid.style.transform = `scale(${maxScale - eased * (maxScale - 1)})`

      // Grid fades in during first ~25% of scroll (Beams visible before this)
      grid.style.opacity = String(Math.min(1, p * 4))

      // Text overlay: fade out in first ~15% of scroll with parallax drift
      if (overlay) {
        overlay.style.opacity = String(Math.max(0, 1 - p * 6.5))
        overlay.style.transform = `scale(${1 + p * 0.4}) translateZ(0)`
      }

      // Vignette dissolves as surrounding tiles are revealed
      if (vignette) {
        vignette.style.opacity = String(Math.max(0, 1 - eased * 1.4))
      }

      // Bottom gradient fades in toward end for smooth content transition
      if (bottomFade) {
        bottomFade.style.opacity = String(
          Math.max(0, Math.min(1, eased * 2 - 0.5))
        )
      }

      // Beams background: visible at start, dims during zoom, returns at end
      const beams = document.getElementById("beams-bg")
      if (beams) {
        // Smooth bell curve: full → dim → full
        beams.style.opacity = String(1 - Math.sin(eased * Math.PI) * 0.85)
        beams.style.transition = "none"
      }

      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    update() // set initial state
    return () => {
      window.removeEventListener("scroll", onScroll)
      // Restore Beams to full opacity on unmount
      const beams = document.getElementById("beams-bg")
      if (beams) beams.style.opacity = "1"
    }
  }, [cols])

  return (
    <section
      id="hero"
      ref={containerRef}
      style={{ height: isMobile ? "250vh" : "300vh" }}
      className="relative"
    >
      <div className="sticky top-0 h-screen overflow-hidden flex items-center justify-center">
        {/* ─── Video tile grid ─── */}
        <div
          ref={gridRef}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap,
            width: "92vw",
            maxWidth: 1800,
            transform: `scale(${cols})`,
            transformOrigin: "center center",
            willChange: "transform, opacity",
            backfaceVisibility: "hidden",
            opacity: 0,
          }}
        >
          {tiles.map((tile, i) => (
            <div
              key={i}
              className="relative overflow-hidden aspect-video bg-neutral-900 rounded-[2px]"
            >
              {tile.isCenter ? (
                <Image
                  src={`https://img.youtube.com/vi/${tile.videoId}/maxresdefault.jpg`}
                  alt=""
                  fill
                  className="object-cover"
                  priority
                  sizes="100vw"
                />
              ) : (
                <>
                  {/* Plain <img> for grid tiles — lighter than next/image */}
                  <img
                    src={`https://img.youtube.com/vi/${tile.videoId}/mqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Subtle darken for visual depth */}
                  <div className="absolute inset-0 bg-black/15 dark:bg-black/25" />
                </>
              )}
            </div>
          ))}
        </div>

        {/* ─── Vignette: page background bleeds in from edges ─── */}
        <div
          ref={vignetteRef}
          className="absolute inset-0 pointer-events-none z-[5] bg-background"
          style={{
            maskImage:
              "radial-gradient(ellipse 55% 45% at 50% 50%, transparent 20%, black 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 55% 45% at 50% 50%, transparent 20%, black 75%)",
          }}
        />

        {/* ─── Bottom gradient for seamless transition to content ─── */}
        <div
          ref={bottomFadeRef}
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none z-[6] bg-gradient-to-t from-background via-background/60 to-transparent"
          style={{ opacity: 0 }}
        />

        {/* ─── Text overlay with scrim ─── */}
        <div
          ref={overlayRef}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center"
          style={{ willChange: "opacity, transform" }}
        >
          {/* Light scrim — subtle enough for Beams to show through at rest */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black/35" />

          <div
            className={cn(
              "relative z-10 text-center max-w-[900px]",
              isMobile ? "px-6" : "px-10"
            )}
          >
            {/* Badge */}
            <div
              className={cn("flex justify-center", isMobile ? "mb-5" : "mb-7")}
            >
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full",
                  "border border-white/[0.12]",
                  "bg-white/[0.08] backdrop-blur-md",
                  "px-4 py-1.5"
                )}
              >
                <span
                  className={cn(
                    "font-medium tracking-wide text-white/70",
                    isMobile ? "text-[11px]" : "text-xs"
                  )}
                >
                  #1 Computer-Use Agent
                </span>
                <span className="h-3 w-px bg-white/[0.2]" />
                <span
                  className={cn(
                    "font-semibold tracking-wide text-white",
                    isMobile ? "text-[11px]" : "text-xs"
                  )}
                >
                  82% OSWorld
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1
              className={cn(
                "font-semibold tracking-[-0.04em] text-white drop-shadow-lg",
                isMobile
                  ? "text-[2.5rem] leading-[1.08]"
                  : "text-[3.5rem] sm:text-[4.25rem] lg:text-[5rem] leading-[1.04]"
              )}
            >
              {t("headline")}
            </h1>

            {/* Rotating subheadline */}
            <div
              className={cn(
                "relative overflow-hidden pb-2",
                isMobile ? "mt-1" : "mt-2"
              )}
            >
              <span
                className={cn(
                  "invisible block font-semibold tracking-[-0.04em] leading-[1.3]",
                  isMobile
                    ? "text-[2.5rem]"
                    : "text-[3.5rem] sm:text-[4.25rem] lg:text-[5rem]"
                )}
                aria-hidden="true"
              >
                {HEADLINES.reduce((a, b) => (b.length > a.length ? b : a), "")}
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={headlineIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  className={cn(
                    "absolute inset-x-0 top-0 font-semibold tracking-[-0.04em] leading-[1.3] text-white/70 drop-shadow-md",
                    isMobile
                      ? "text-[2.5rem]"
                      : "text-[3.5rem] sm:text-[4.25rem] lg:text-[5rem]"
                  )}
                >
                  {HEADLINES[headlineIndex]}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Description */}
            <p
              className={cn(
                "mx-auto max-w-lg text-white/65 leading-relaxed drop-shadow-sm",
                isMobile ? "mt-4 text-[13px]" : "mt-6 text-[17px]"
              )}
            >
              {t("useCases.computerAgent.outcome")}
            </p>

            {/* CTAs */}
            <div
              className={cn(
                "flex items-center justify-center",
                isMobile ? "mt-7 gap-5 flex-col" : "mt-10 gap-6"
              )}
            >
              <Link href="/auth">
                <motion.button
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full font-medium cursor-pointer",
                    "bg-white text-black shadow-lg",
                    isMobile ? "px-6 py-3 text-sm" : "px-7 py-3 text-[15px]"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {tc("tryCoastyFree")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </motion.button>
              </Link>
              <a
                href="https://cal.com/coasty/15min"
                target="_blank"
                rel="noopener noreferrer"
              >
                <motion.button
                  className={cn(
                    "inline-flex items-center gap-1.5 font-medium cursor-pointer",
                    "text-white/60 hover:text-white/90 transition-colors duration-300",
                    isMobile ? "text-sm" : "text-[15px]"
                  )}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Video className="h-3.5 w-3.5" />
                  {tc("bookDemo")}
                </motion.button>
              </a>
            </div>
          </div>

          {/* Scroll indicator */}
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30",
              isMobile ? "bottom-6" : "bottom-10"
            )}
          >
            <span className="text-[10px] font-medium tracking-[0.2em] uppercase">
              Scroll
            </span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <ChevronDown className="h-4 w-4" />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
