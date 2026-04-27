"use client"

/**
 * Building blocks for the redesigned landing sections.
 *
 *   • LandingSectionHeader — magazine-style chapter indicator (NN / total ─
 *     SECTION) above an h2, with optional subtitle. Replaces the inconsistent
 *     per-section header treatments.
 *   • LandingProgressRail — slim, fixed-top progress bar with section dots.
 *     Replaces the 176px sticky left rail. Auto-fades in only while the user
 *     is inside the guided range, click any dot to jump.
 *   • LandingSectionTopGlow — subtle hairline + radial accent at the top of
 *     each section so transitions read distinctly without competing chrome.
 */

import { motion } from "framer-motion"
import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

// ── SectionHeader ────────────────────────────────────────────────────────

export function LandingSectionHeader({
  index,
  total,
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
  isMobile = false,
}: {
  index: number // 1-based chapter number
  total: number
  eyebrow: string
  title: ReactNode
  subtitle?: ReactNode
  align?: "center" | "left"
  className?: string
  isMobile?: boolean
}) {
  const idx = String(index).padStart(2, "0")
  const tot = String(total).padStart(2, "0")
  return (
    <motion.header
      initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={isMobile ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        align === "center" ? "text-center" : "text-left",
        "mb-10 sm:mb-14",
        className
      )}
    >
      <div
        className={cn(
          "inline-flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/60",
          align === "center" && "justify-center"
        )}
      >
        <span className="tabular-nums text-foreground/45 dark:text-foreground/35">
          {idx}
          <span className="opacity-40"> / {tot}</span>
        </span>
        <span className="h-px w-7 bg-border/60" aria-hidden />
        <span>{eyebrow}</span>
      </div>
      <h2
        className={cn(
          "mt-4 font-semibold tracking-tight text-foreground",
          "text-[28px] leading-[1.1] sm:text-4xl lg:text-5xl"
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "mt-4 text-muted-foreground",
            "text-sm sm:text-base",
            align === "center" && "max-w-xl mx-auto"
          )}
        >
          {subtitle}
        </p>
      )}
    </motion.header>
  )
}

// ── Top progress rail ────────────────────────────────────────────────────

export function LandingProgressRail({
  sections,
  scrollProgress,
  onJump,
}: {
  sections: readonly { id: string; label: string }[]
  scrollProgress: number // 0..(sections.length - 1), continuous
  onJump: (i: number) => void
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const total = Math.max(1, sections.length - 1)
  const fillPct = Math.max(0, Math.min(1, scrollProgress / total)) * 100
  const activeIdx = Math.round(scrollProgress)
  // Only show while inside the guided range (with a small buffer at each end
  // so it doesn't flicker when the user lands exactly on a boundary).
  const visible = scrollProgress > 0.05 && scrollProgress < total + 0.5

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed left-1/2 -translate-x-1/2 top-[3.5rem] sm:top-[4rem] z-30",
        "transition-[opacity,transform] duration-500 ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
      )}
    >
      <nav
        aria-label="Section navigation"
        className={cn(
          "relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5",
          "rounded-full backdrop-blur-md",
          "bg-background/70 dark:bg-background/60",
          "border border-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)]",
          "dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_24px_-12px_rgba(0,0,0,0.4)]"
        )}
      >
        {/* Connecting hairline behind the dots — sized to match the dot row */}
        <div
          className="pointer-events-none absolute left-3 sm:left-4 right-3 sm:right-4 top-1/2 -translate-y-1/2 h-px bg-foreground/10 dark:bg-foreground/[0.08]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-px bg-foreground/45 dark:bg-foreground/35 transition-[width] duration-300 ease-out"
          style={{
            width: `calc((100% - ${24 + (sections.length - 1) * 8}px) * ${fillPct / 100})`,
          }}
          aria-hidden
        />

        {sections.map((section, i) => {
          const isActive = i === activeIdx
          const isPast = i < activeIdx
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onJump(i)}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              onFocus={() => setHoveredIdx(i)}
              onBlur={() => setHoveredIdx(null)}
              aria-label={`Go to ${section.label}`}
              aria-current={isActive ? "true" : undefined}
              className="group relative flex h-5 w-5 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span
                className={cn(
                  "rounded-full transition-all duration-300",
                  isActive
                    ? "h-2 w-2 bg-foreground shadow-[0_0_0_3px_var(--background),0_0_0_4px_rgba(var(--foreground-rgb,15,23,42),0.15)]"
                    : isPast
                      ? "h-1.5 w-1.5 bg-foreground/55 dark:bg-foreground/40"
                      : "h-1.5 w-1.5 bg-foreground/20 dark:bg-foreground/15 group-hover:bg-foreground/45"
                )}
              />
              {hoveredIdx === i && (
                <motion.span
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-background"
                >
                  {section.label}
                </motion.span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ── Per-section ambient top glow ─────────────────────────────────────────

export function LandingSectionTopGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 flex justify-center",
        className
      )}
    >
      <div className="h-px w-32 bg-gradient-to-r from-transparent via-foreground/20 to-transparent dark:via-foreground/15" />
    </div>
  )
}
