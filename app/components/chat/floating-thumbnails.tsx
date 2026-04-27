"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "motion/react"

const VIDEO_IDS = [
  "icxgLDephHE",
  "qTvmGfg3HVw",
  "Wbo2o74hVIo",
  "mH-csaCa508",
  "AnHJuRMLCnE",
  "A_OvNh51Npg",
]

interface ThumbnailConfig {
  videoId: string
  side: "left" | "right"
  inset: number
  y: number
  driftX: number
  driftY: number
  durationX: number
  durationY: number
  rotation: number
  scale: number
  opacity: number
  enterFrom: { x: number; y: number; rotate: number }
}

// Strict mirror pairs — every magnitude (rotation, opacity, drift, duration,
// enterFrom) is identical within a pair; only the SIGN flips. Right-side thumbs
// are anchored with `right:` and their horizontal drift is negated at render
// time so each pair breathes outward/inward together instead of drifting in the
// same direction. Combined with `left:`/`right:` anchoring at equal `inset`,
// this guarantees pixel-perfect symmetry from the chat-input edges at every
// viewport width.
const DESKTOP_THUMBNAILS: ThumbnailConfig[] = [
  // Top corners
  {
    videoId: VIDEO_IDS[0],
    side: "left", inset: 2, y: 10,
    driftX: 14, driftY: 10,
    durationX: 30, durationY: 24,
    rotation: -3, scale: 1, opacity: 0.65,
    enterFrom: { x: -120, y: -80, rotate: -40 },
  },
  {
    videoId: VIDEO_IDS[1],
    side: "right", inset: 2, y: 10,
    driftX: 14, driftY: 10,
    durationX: 30, durationY: 24,
    rotation: 3, scale: 1, opacity: 0.65,
    enterFrom: { x: 120, y: -80, rotate: 40 },
  },
  // Bottom corners
  {
    videoId: VIDEO_IDS[2],
    side: "left", inset: 1, y: 58,
    driftX: 14, driftY: 12,
    durationX: 28, durationY: 26,
    rotation: 2, scale: 1, opacity: 0.6,
    enterFrom: { x: -100, y: 100, rotate: 45 },
  },
  {
    videoId: VIDEO_IDS[3],
    side: "right", inset: 1, y: 58,
    driftX: 14, driftY: 12,
    durationX: 28, durationY: 26,
    rotation: -2, scale: 1, opacity: 0.6,
    enterFrom: { x: 100, y: 100, rotate: -45 },
  },
  // Mid-side accents
  {
    videoId: VIDEO_IDS[4],
    side: "left", inset: 4, y: 32,
    driftX: 10, driftY: 9,
    durationX: 32, durationY: 30,
    rotation: -1.5, scale: 0.8, opacity: 0.4,
    enterFrom: { x: -140, y: 20, rotate: -30 },
  },
  {
    videoId: VIDEO_IDS[5],
    side: "right", inset: 4, y: 32,
    driftX: 10, driftY: 9,
    durationX: 32, durationY: 30,
    rotation: 1.5, scale: 0.8, opacity: 0.4,
    enterFrom: { x: 140, y: 20, rotate: 30 },
  },
]

// ── Mobile: 4 corner thumbnails only, smaller + tighter to edges ──
// Mid-side ones are dropped — on narrow screens they'd sit on top of greeting text.
// Negative inset on both sides bleeds the 120px thumbnails symmetrically off-edge.
const MOBILE_THUMBNAILS: ThumbnailConfig[] = [
  {
    videoId: VIDEO_IDS[0],
    side: "left", inset: -4, y: 14,
    driftX: 8, driftY: 6,
    durationX: 28, durationY: 22,
    rotation: -4, scale: 1, opacity: 0.55,
    enterFrom: { x: -80, y: -60, rotate: -35 },
  },
  {
    videoId: VIDEO_IDS[1],
    side: "right", inset: -4, y: 14,
    driftX: 8, driftY: 6,
    durationX: 28, durationY: 22,
    rotation: 4, scale: 1, opacity: 0.55,
    enterFrom: { x: 80, y: -60, rotate: 35 },
  },
  {
    videoId: VIDEO_IDS[2],
    side: "left", inset: -6, y: 64,
    driftX: 9, driftY: 7,
    durationX: 26, durationY: 24,
    rotation: 3, scale: 1, opacity: 0.5,
    enterFrom: { x: -70, y: 70, rotate: 35 },
  },
  {
    videoId: VIDEO_IDS[3],
    side: "right", inset: -6, y: 64,
    driftX: 9, driftY: 7,
    durationX: 26, durationY: 24,
    rotation: -3, scale: 1, opacity: 0.5,
    enterFrom: { x: 70, y: 70, rotate: -35 },
  },
]

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [breakpoint])
  return isMobile
}

export function FloatingThumbnails({ visible, skipEntrance = false }: { visible: boolean; skipEntrance?: boolean }) {
  const isMobile = useIsMobile()
  const thumbnails = isMobile ? MOBILE_THUMBNAILS : DESKTOP_THUMBNAILS

  useEffect(() => {
    VIDEO_IDS.forEach((id) => {
      const img = new window.Image()
      img.src = `https://img.youtube.com/vi/${id}/mqdefault.jpg`
    })
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 overflow-hidden pointer-events-none z-[1]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeOut" } }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes ft-drift-x {
              0%, 100% { transform: translateX(0); }
              50% { transform: translateX(var(--drift-x)); }
            }
            @keyframes ft-drift-y {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(var(--drift-y)); }
            }
            .ft-x { animation: ft-drift-x var(--dur-x) ease-in-out infinite; }
            .ft-y { animation: ft-drift-y var(--dur-y) ease-in-out infinite; }
          ` }} />

          {thumbnails.map((thumb, i) => (
            <FloatingThumb key={thumb.videoId} config={thumb} index={i} skipEntrance={skipEntrance} isMobile={isMobile} />
          ))}

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, var(--background) 80%)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function FloatingThumb({ config, index, skipEntrance = false, isMobile }: { config: ThumbnailConfig; index: number; skipEntrance?: boolean; isMobile: boolean }) {
  const positionStyle: React.CSSProperties =
    config.side === "left"
      ? { left: `${config.inset}%`, top: `${config.y}%` }
      : { right: `${config.inset}%`, top: `${config.y}%` }

  return (
    <motion.div
      className="absolute"
      initial={
        skipEntrance
          ? false
          : {
              x: config.enterFrom.x,
              y: config.enterFrom.y,
              rotate: config.enterFrom.rotate,
              scale: 0.3,
              opacity: 0,
            }
      }
      animate={{
        x: 0,
        y: 0,
        rotate: config.rotation,
        scale: config.scale,
        opacity: config.opacity,
      }}
      transition={{
        duration: 1.2,
        delay: 0.08 + index * 0.1,
        ease: [0.34, 1.56, 0.64, 1],
      }}
      style={positionStyle}
    >
      <div
        className="ft-x"
        style={{
          "--drift-x": `${config.side === "right" ? -config.driftX : config.driftX}px`,
          "--dur-x": `${config.durationX}s`,
        } as React.CSSProperties}
      >
        <div
          className="ft-y"
          style={{ "--drift-y": `${config.driftY}px`, "--dur-y": `${config.durationY}s` } as React.CSSProperties}
        >
          <div className={`${isMobile ? "w-[120px]" : "w-[180px] sm:w-[220px]"} aspect-video rounded-xl overflow-hidden shadow-md ring-1 ring-foreground/[0.06]`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://img.youtube.com/vi/${config.videoId}/mqdefault.jpg`}
              alt=""
              width={320}
              height={180}
              decoding="async"
              draggable={false}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-background/10 dark:bg-background/20 mix-blend-normal" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
