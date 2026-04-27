"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Video, ChevronDown } from "lucide-react"
import Link from "next/link"
import NextImage from "next/image"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

/* ─── stat helpers (count-up + value parsing) ───
 * Numbers in the resource-saved row count up on first viewport entry.
 * `parseStat` splits "$3,200" / "30 hrs" / "10×" / "0" into prefix/num/suffix
 * so we can animate the integer part while preserving formatting (commas,
 * units, multiplier glyph). */

function parseStat(raw: string): { prefix: string; num: number; suffix: string } {
  const m = raw.match(/^(\D*?)([\d,]+)(.*)$/)
  if (!m) return { prefix: "", num: 0, suffix: raw }
  return {
    prefix: m[1],
    num: parseInt(m[2].replace(/,/g, ""), 10),
    suffix: m[3],
  }
}

function useCountUp(target: number, durationMs: number, start: boolean): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!start) return
    if (target === 0) { setVal(0); return }
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs)
      // ease-out cubic for a confident settle
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, start])
  return val
}

function StatCell({
  rawValue,
  label,
  sublabel,
  delay,
  isMobile,
}: {
  rawValue: string
  label: string
  sublabel: string
  delay: number
  isMobile: boolean
}) {
  const { prefix, num, suffix } = useMemo(() => parseStat(rawValue), [rawValue])
  const [inView, setInView] = useState(false)
  const animated = useCountUp(num, 1500, inView)
  const display = num === 0
    ? `${prefix}0${suffix}`
    : `${prefix}${animated.toLocaleString()}${suffix}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      onViewportEnter={() => setInView(true)}
      viewport={{ once: true, amount: 0.45 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative flex flex-col items-center text-center",
        isMobile ? "px-2 py-1" : "px-4 py-1",
      )}
    >
      {/* Number — gradient text, animated count-up. White tones for
          legibility against the photographic card backdrop. */}
      <div
        className={cn(
          "font-semibold tabular-nums tracking-[-0.04em] leading-none",
          "bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent",
          "drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)]",
          isMobile ? "text-[1.6rem]" : "text-[1.85rem] lg:text-[2.05rem]",
        )}
      >
        {display}
      </div>

      {/* Hairline underline — draws in beneath the number once it's in
          view; the single signature element of the row. */}
      <motion.div
        aria-hidden="true"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={inView ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
        transition={{ duration: 0.9, delay: delay + 0.15, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "mt-2 h-px w-9 origin-center",
          "bg-gradient-to-r from-transparent via-white/55 to-transparent",
          "transition-[width,opacity] duration-300 group-hover:w-12 group-hover:via-white/85",
        )}
      />

      {/* Label */}
      <div
        className={cn(
          "font-medium leading-tight tracking-tight transition-colors duration-200",
          "text-white/75 group-hover:text-white/95",
          "drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]",
          isMobile ? "mt-1.5 text-[10.5px]" : "mt-2 text-[11.5px]",
        )}
      >
        {label}
      </div>

      {/* Sublabel */}
      {!isMobile && (
        <div className="mt-0.5 text-[10px] leading-tight text-white/55 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
          {sublabel}
        </div>
      )}
    </motion.div>
  )
}

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
const ROW_OFFSETS = [0, 3, 1, 5, 2, 4, 1]

export function HeroVideoMatrix({ isMobile }: { isMobile: boolean }) {
  const cols = isMobile ? 9 : 11
  const rows = isMobile ? 7 : 7
  const gap = isMobile ? 3 : 6

  const containerRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const vignetteRef = useRef<HTMLDivElement>(null)
  const bottomFadeRef = useRef<HTMLDivElement>(null)
  const scrollIndRef = useRef<HTMLDivElement>(null)
  const bgLayerRef = useRef<HTMLDivElement>(null)

  const centerCol = Math.floor(cols / 2)
  const centerRow = Math.floor(rows / 2)

  const t = useTranslations("hero")
  const tc = useTranslations("common")
  // Resource-saved stats — money / time / output / effort. Lives under
  // `hero.resourceStats` in messages so it's hero-scoped (the generic
  // `stats` namespace below the hero used different keys).
  const RESOURCE_STAT_KEYS = ["money", "time", "speed", "effort"] as const
  const [headlineIndex, setHeadlineIndex] = useState(0)
  const HEADLINES = HEADLINE_KEYS.map((key) => t(`useCases.${key}.headline`))

  // Auto-rotate headlines
  useEffect(() => {
    const interval = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % HEADLINES.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [HEADLINES.length])

  // Preload/decode thumbnails on mount — Safari defers lazy decode inside
  // transformed parents and dumps the work mid-scroll, causing visible stutter.
  useEffect(() => {
    VIDEO_IDS.forEach((id) => {
      const img = new window.Image()
      img.decoding = "async"
      img.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`
    })
  }, [])

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

  // ─── Scroll-driven animation via continuous rAF loop ───
  // We run a rAF loop instead of `scroll` events because Safari coalesces
  // scroll events during momentum scroll and can even stop updating
  // window.scrollY mid-gesture — which causes visible jumps.
  //
  // Performance note: we READ `window.scrollY` (cached by the browser, no
  // layout) and subtract a CACHED container offset. Previously this loop
  // called getBoundingClientRect() every frame, which forced a layout
  // recalc after each style write — a classic 60fps→30fps thrash on older
  // hardware. We recompute the cache only on resize.
  //
  // An IntersectionObserver pauses the loop while the hero is offscreen.
  useEffect(() => {
    const container = containerRef.current
    const grid = gridRef.current
    const overlay = overlayRef.current
    const vignette = vignetteRef.current
    const bottomFade = bottomFadeRef.current
    const scrollInd = scrollIndRef.current
    const bgLayer = bgLayerRef.current
    if (!container || !grid) return

    // Cache external DOM lookups once — avoids getElementById per frame
    const header = document.getElementById("landing-header-wrap")
    const guides = document.getElementById("guide-lines-wrap")
    const beamsEl = document.getElementById("beams-bg")
    const crossfade = document.getElementById("hero-crossfade")

    // Cached geometry — recomputed only on resize / ResizeObserver fire.
    // Measured via getBoundingClientRect ONCE, outside the rAF loop.
    let containerTop = 0
    let scrollable = 0
    const measure = () => {
      const r = container.getBoundingClientRect()
      containerTop = r.top + window.scrollY
      scrollable = container.offsetHeight - window.innerHeight
    }
    measure()

    const maxScale = cols
    let rafId = 0
    let isActive = true
    let lastP = -1
    const EPS = 0.0005

    // Track discrete states to avoid redundant DOM writes that thrash layers
    let gridHidden = false
    let overlayHidden = false
    let headerDisabled = false

    const update = () => {
      if (!isActive) {
        rafId = 0
        return
      }
      rafId = requestAnimationFrame(update)

      if (scrollable <= 0) return

      // window.scrollY is cached by the browser — reading it does not force
      // layout, unlike getBoundingClientRect() after style writes.
      const scrolled = Math.max(0, window.scrollY - containerTop)
      const p = Math.min(1, scrolled / scrollable) // linear 0 → 1

      // Skip DOM writes when progress is unchanged — Safari still invalidates
      // composited layers on no-op writes, which contributes to flicker.
      if (Math.abs(p - lastP) < EPS) return
      lastP = p

      // ── Phase 1: Zoom-out (first 65% of scroll) ──
      const zoomP = Math.min(1, p / 0.65)
      const zoomEased = 1 - Math.pow(1 - zoomP, 3) // cubic ease-out
      const minScale = 1.5
      const currentScale = +(maxScale - zoomEased * (maxScale - minScale)).toFixed(3)

      // ── Phase 2: Dissolve (last 35%) ──
      // Use the full remaining scroll range (0.65→1.0) so the grid dissolve
      // ends exactly when the next section enters — no blank gap.
      const dissolveP = Math.min(1, Math.max(0, (p - 0.65) / 0.35))
      const dissolveEased = Math.min(1, dissolveP * dissolveP * 1.1)

      const gridOpacity = 1 - dissolveEased
      grid.style.transform = `translate3d(0,0,0) scale3d(${currentScale}, ${currentScale}, 1)`
      grid.style.setProperty("--tile-opacity", String(Math.min(1, p * 3.3)))
      grid.style.opacity = String(gridOpacity)
      const shouldHideGrid = gridOpacity < 0.005
      if (shouldHideGrid !== gridHidden) {
        grid.style.visibility = shouldHideGrid ? "hidden" : "visible"
        gridHidden = shouldHideGrid
      }

      if (overlay) {
        const s = +(currentScale / maxScale).toFixed(3)
        const overlayOpacity = 1 - dissolveEased
        overlay.style.transform = `translate3d(0,0,0) scale3d(${s},${s},1)`
        overlay.style.opacity = String(overlayOpacity)
        const shouldHideOverlay = overlayOpacity < 0.005
        if (shouldHideOverlay !== overlayHidden) {
          overlay.style.visibility = shouldHideOverlay ? "hidden" : "visible"
          overlayHidden = shouldHideOverlay
        }
      }

      if (scrollInd) {
        scrollInd.style.opacity = String(Math.max(0, 1 - p * 8))
      }

      if (vignette) {
        const vignetteIn = Math.min(1, p * 4)
        const vignetteOut = Math.max(0, 1 - zoomEased * 1.4)
        vignette.style.opacity = String(vignetteIn * vignetteOut)
      }

      if (bottomFade) {
        const base = Math.max(0, Math.min(1, zoomEased * 2 - 0.5))
        bottomFade.style.opacity = String(base * (1 - dissolveEased))
      }

      const uiFadeOut = Math.min(1, p * 10)
      const uiFadeIn = dissolveP * dissolveP
      const uiOpacity = String(Math.max(0, Math.min(1, 1 - uiFadeOut + uiFadeOut * uiFadeIn)))

      if (header) {
        header.style.opacity = uiOpacity
        const shouldDisable = parseFloat(uiOpacity) < 0.5
        if (shouldDisable !== headerDisabled) {
          header.style.pointerEvents = shouldDisable ? "none" : ""
          headerDisabled = shouldDisable
        }
      }
      if (guides) {
        guides.style.opacity = uiOpacity
      }

      const beamsFadeOut = Math.min(1, p * 4)
      const beamsFadeIn = dissolveP
      const beamsOpacity = String(Math.max(0, Math.min(1, 1 - beamsFadeOut + beamsFadeOut * beamsFadeIn)))
      if (beamsEl) {
        beamsEl.style.opacity = beamsOpacity
      }

      // Separate composited background layer — avoids repainting the sticky
      // element itself (which on Safari causes the sticky+transform jitter bug).
      // Fades in early (p 0.01→0.05) and holds during zoom/dissolve, then
      // fades OUT near the end (p 0.93→1.0) so the hero becomes transparent
      // and the beams + content below show through — no black gap.
      if (bgLayer) {
        const bgIn = Math.min(1, Math.max(0, (p - 0.01) * 25))
        const bgOut = Math.min(1, Math.max(0, (1 - p) / 0.07))
        bgLayer.style.opacity = String(Math.min(bgIn, bgOut))
      }

      // Cross-fade: content section fades IN as the hero grid fades OUT.
      // Uses the second half of the dissolve so the grid is already mostly
      // gone before content appears — avoids a messy double-exposure.
      if (crossfade) {
        const contentOpacity = Math.max(0, Math.min(1, dissolveEased * 2 - 1))
        crossfade.style.opacity = String(contentOpacity)
        crossfade.style.pointerEvents = contentOpacity > 0.3 ? "" : "none"
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        const nowActive = entries[0]?.isIntersecting ?? true
        if (nowActive && !isActive) {
          isActive = true
          lastP = -1
          if (!rafId) rafId = requestAnimationFrame(update)
        } else if (!nowActive && isActive) {
          isActive = false
        }
      },
      { rootMargin: "200px 0px" }
    )
    io.observe(container)

    // Re-measure on viewport changes. ResizeObserver covers content-driven
    // size changes (font-load reflows, image decodes); the resize event
    // covers viewport-driven changes that ResizeObserver misses.
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    const onResize = () => measure()
    window.addEventListener("resize", onResize, { passive: true })

    rafId = requestAnimationFrame(update)

    return () => {
      isActive = false
      if (rafId) cancelAnimationFrame(rafId)
      io.disconnect()
      ro.disconnect()
      window.removeEventListener("resize", onResize)
      // Use cached refs — no getElementById in cleanup
      if (header) { header.style.opacity = "1"; header.style.pointerEvents = "" }
      if (guides) guides.style.opacity = "1"
      if (beamsEl) beamsEl.style.opacity = "1"
      if (crossfade) { crossfade.style.opacity = "1"; crossfade.style.pointerEvents = "" }
    }
  }, [cols])

  return (
    <section
      id="hero"
      ref={containerRef}
      style={{ height: "250vh" }}
      className="relative"
    >
      <div
        ref={stickyRef}
        className="sticky top-0 h-screen overflow-hidden flex items-center justify-center"
        style={{
          // Promote the sticky element to its own compositor layer.
          // Works around a WebKit bug where child transforms cause the sticky
          // element to jitter by a few pixels during scroll.
          willChange: "transform",
          transform: "translateZ(0)",
        }}
      >
        {/* ─── Background fader (separate layer — avoids repainting sticky) ─── */}
        <div
          ref={bgLayerRef}
          className="absolute inset-0 bg-background pointer-events-none"
          style={{ opacity: 0.001, zIndex: 0, willChange: "opacity", transform: "translateZ(0)" }}
          aria-hidden="true"
        />
        {/* ─── Video tile grid ─── */}
        <div
          ref={gridRef}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap,
            // Ensure center tile fills viewport on ALL aspect ratios:
            // - 110vw covers width (with buffer for inter-tile gaps)
            // - 200vh * 9/16 = 112.5vh covers height on tall screens (MacBooks, iPads, phones)
            width: "max(110vw, 200vh)",
            transform: `scale3d(${cols}, ${cols}, 1)`,
            transformOrigin: "center center",
            willChange: "transform, opacity",
          }}
        >
          {tiles.map((tile, i) => (
            <div
              key={i}
              className={cn(
                "relative overflow-hidden aspect-video rounded-[2px]",
                tile.isCenter ? "bg-transparent" : "bg-neutral-900"
              )}
              style={
                tile.isCenter
                  ? undefined
                  : ({
                      opacity: "var(--tile-opacity, 0)",
                    } as React.CSSProperties)
              }
            >
              {!tile.isCenter && (
                <>
                  <NextImage
                    src={`https://img.youtube.com/vi/${tile.videoId}/hqdefault.jpg`}
                    alt=""
                    fill
                    // Tiles are tiny once the grid zooms out — pin sizes to
                    // ~12vw so Next/Image picks the smallest variant. Six
                    // unique URLs across 77 tiles → only 6 actual fetches.
                    sizes="(max-width: 768px) 12vw, 10vw"
                    draggable={false}
                    unoptimized
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/15 dark:bg-black/25" />
                </>
              )}
            </div>
          ))}
        </div>

        {/* ─── Vignette: page bg bleeds in from edges ─── */}
        {/* Uses a radial-gradient background instead of mask-image because
            Safari re-rasterizes masks on every opacity change, causing flicker. */}
        <div
          ref={vignetteRef}
          className="absolute inset-0 pointer-events-none z-[5]"
          style={{
            background:
              "radial-gradient(ellipse 55% 45% at 50% 50%, transparent 20%, var(--background) 75%)",
            willChange: "opacity",
            transform: "translateZ(0)",
          }}
        />

        {/* ─── Bottom gradient for transition to content ─── */}
        <div
          ref={bottomFadeRef}
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none z-[6] bg-gradient-to-t from-background via-background/60 to-transparent"
          style={{ opacity: 0.001, willChange: "opacity", transform: "translateZ(0)" }}
        />

        {/* ─── Hero text — separate overlay, scales in sync with grid ─── */}
        <div
          ref={overlayRef}
          className={cn(
            "absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none",
            isMobile ? "pt-20 pb-16" : "pt-24 pb-20"
          )}
          style={{
            transform: "translateZ(0)",
            willChange: "transform, opacity",
            transformOrigin: "center center",
          }}
        >
          <div
            className={cn(
              "pointer-events-auto text-center w-full",
              isMobile ? "px-5 max-w-[440px]" : "px-10 max-w-[900px]"
            )}
          >
            {/* Headline */}
            <h1
              className={cn(
                "font-semibold tracking-[-0.04em] text-foreground",
                isMobile
                  ? "text-[1.65rem] leading-[1.12]"
                  : "text-[2.5rem] md:text-[3rem] lg:text-[3.5rem] leading-[1.08]"
              )}
            >
              {t("headline")}
            </h1>

            {/* Rotating subheadline */}
            <div
              className={cn(
                "relative overflow-hidden",
                isMobile ? "mt-0.5 pb-1" : "mt-2 pb-2"
              )}
            >
              <span
                className={cn(
                  "invisible block font-medium tracking-[-0.03em]",
                  isMobile
                    ? "text-[1.25rem] leading-[1.3]"
                    : "text-[1.75rem] md:text-[2rem] lg:text-[2.25rem] leading-[1.3]"
                )}
                aria-hidden="true"
              >
                {HEADLINES.reduce(
                  (a, b) => (b.length > a.length ? b : a),
                  ""
                )}
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={headlineIndex}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  className={cn(
                    "absolute inset-x-0 top-0 font-medium tracking-[-0.03em] text-foreground/50 dark:text-white/55",
                    isMobile
                      ? "text-[1.25rem] leading-[1.3]"
                      : "text-[1.75rem] md:text-[2rem] lg:text-[2.25rem] leading-[1.3]"
                  )}
                >
                  {HEADLINES[headlineIndex]}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Description */}
            <p
              className={cn(
                "mx-auto text-foreground/55 dark:text-white/60 leading-relaxed",
                isMobile
                  ? "mt-2.5 text-[12.5px] max-w-[320px]"
                  : "mt-3.5 text-[15px] sm:text-[16px] max-w-[480px]"
              )}
            >
              {t("useCases.computerAgent.outcome")}
            </p>

            {/* ─── Resources saved — money / time / output / effort.
                Four hard numbers, count-up animated on viewport entry,
                presented inside one unified hairline-bordered card.
                No internal dividers — whitespace + a single signature
                top-edge gradient hairline keep the row reading as one
                cohesive surface, not four split columns. */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "relative mx-auto",
                isMobile ? "mt-5 max-w-[340px]" : "mt-6 max-w-[760px]",
              )}
              aria-label="Resources saved per workflow"
            >
              {/* Outer card — hairline border, photographic backdrop. */}
              <div
                className={cn(
                  "relative rounded-[18px] overflow-hidden isolate",
                  "border border-white/[0.10]",
                  "shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_18px_44px_-22px_rgba(0,0,0,0.55)]",
                )}
              >
                {/* Photographic backdrop. Sits below all content; the
                    overlays above tune contrast for legibility. */}
                <NextImage
                  src="/lucas-calloch-P-yzuyWFEIk-unsplash.jpg"
                  alt=""
                  fill
                  sizes="(max-width: 768px) 360px, 760px"
                  priority
                  draggable={false}
                  className="-z-10 object-cover select-none"
                />

                {/* Legibility tint — vertical gradient that anchors text
                    contrast without flattening the photograph. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/35 via-black/45 to-black/55"
                />

                {/* Soft radial vignette — keeps the figures crisp at
                    center, lets the photograph breathe at the edges. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_90%_at_50%_50%,transparent_30%,rgba(0,0,0,0.35)_100%)]"
                />

                {/* Signature top hairline — the one decorative flourish. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
                />

                <div
                  className={cn(
                    "relative grid",
                    isMobile
                      ? "grid-cols-2 gap-y-4 px-4 py-4"
                      : "grid-cols-4 gap-x-1 px-6 py-5",
                  )}
                >
                  {RESOURCE_STAT_KEYS.map((key, i) => (
                    <StatCell
                      key={key}
                      isMobile={isMobile}
                      delay={0.45 + i * 0.08}
                      rawValue={t(`resourceStats.${key}.value`)}
                      label={t(`resourceStats.${key}.label`)}
                      sublabel={t(`resourceStats.${key}.sublabel`)}
                    />
                  ))}
                </div>
              </div>

              {/* Faint outer halo — single signature flourish behind the
                  card. Desktop only; mobile keeps the card edge crisp. */}
              {!isMobile && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-x-10 -inset-y-6 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.06),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.10),transparent_60%)] blur-2xl"
                />
              )}
            </motion.div>

            {/* CTAs */}
            <div
              className={cn(
                "flex items-center justify-center",
                isMobile ? "mt-5 gap-3 flex-col" : "mt-6 gap-5"
              )}
            >
              <Link href="/auth">
                <motion.button
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full font-medium cursor-pointer",
                    "bg-foreground text-background",
                    isMobile
                      ? "px-6 py-3 text-sm"
                      : "px-7 py-3 text-[15px]"
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
                    "text-foreground/50 hover:text-foreground/75 dark:text-white/60 dark:hover:text-white/90 transition-colors duration-300",
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
        </div>

        {/* ─── Scroll indicator (independent, does not scale) ─── */}
        <div
          ref={scrollIndRef}
          className={cn(
            "absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 text-foreground/30 dark:text-white/30",
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
    </section>
  )
}
