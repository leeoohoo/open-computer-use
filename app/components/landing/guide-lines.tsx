"use client"

import { cn } from "@/lib/utils"

/**
 * Vertical guide lines that frame the page content.
 *
 * Each side renders as a "rail" of two elements:
 *   • Outer rail — a 7px-wide *horizontal* gradient with a crisp 1px peak
 *     and a soft ~3px halo on each side. Built as a single gradient instead
 *     of a hairline + box-shadow so the same vertical mask can fade the
 *     line and its halo together at the page edges (box-shadow ignores
 *     mask, so a halo painted that way would bleed past the masked tip and
 *     betray the trick).
 *   • Inner rail — a dimmer 1px hairline echo for visual depth.
 *
 * Both elements share an identical vertical mask (transparent at the very
 * top/bottom 1.5%, opaque through the middle), so over a tall page the
 * lines feel atmospheric rather than chrome.
 *
 * Use as a direct child of a `relative` container that wraps the full page.
 */

// Soft top + bottom fade. Tuned so on a multi-viewport-tall page the fade
// zones are visible but not melodramatic — about 1.5% of total length.
const FADE_MASK =
  "linear-gradient(to bottom, transparent 0%, #000 1.5%, #000 98.5%, transparent 100%)"

// Horizontal gradient that paints a "lit thread": near-zero at the edges,
// 4% halo at 28/72% (the soft penumbra), bright 18% peak at center. Uses
// `color-mix` with the page foreground so the same definition reads
// correctly in both light and dark mode.
const OUTER_GRADIENT = `linear-gradient(to right,
  transparent 0%,
  color-mix(in srgb, var(--foreground) 4%, transparent) 28%,
  color-mix(in srgb, var(--foreground) 18%, transparent) 50%,
  color-mix(in srgb, var(--foreground) 4%, transparent) 72%,
  transparent 100%)`

export function GuideLines() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[1]" aria-hidden="true">
      <div className="mx-auto h-full max-w-7xl px-4 sm:px-6 relative">
        <GuideRail side="left" />
        <GuideRail side="right" />
      </div>
    </div>
  )
}

function GuideRail({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left"
  // Outer rail anchor — same coordinates the SectionDivider's outer diamond
  // uses, so the diamond lands exactly on the rail's bright center. On
  // small viewports the rails sit slightly further from the edge (20px vs
  // 16px) so they feel like a deliberate frame instead of touching the
  // bezel; sm+ keeps the original 24px offset.
  const outerOffset = isLeft ? "left-5 sm:left-6" : "right-5 sm:right-6"
  // Inner echo — 4px in from the outer rail on every breakpoint.
  const innerOffset = isLeft ? "left-[24px] sm:left-[32px]" : "right-[24px] sm:right-[32px]"
  // Pull the 7px-wide outer rail back by 3px so its bright peak sits on
  // the line position, not on its left/right edge.
  const haloShift = isLeft ? { marginLeft: -3 } : { marginRight: -3 }

  return (
    <>
      {/* Outer rail — lit thread (1px bright peak + soft 3px halo each side). */}
      <div
        className={cn("absolute top-0 bottom-0", outerOffset)}
        style={{
          width: 7,
          background: OUTER_GRADIENT,
          maskImage: FADE_MASK,
          WebkitMaskImage: FADE_MASK,
          ...haloShift,
        }}
      />
      {/* Inner rail — dimmer hairline echo. */}
      <div
        className={cn(
          "absolute top-0 bottom-0 w-px bg-foreground/[0.07] dark:bg-foreground/[0.05]",
          innerOffset
        )}
        style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
      />
    </>
  )
}

/**
 * Horizontal divider with diamond cross-marks aligned to the guide lines.
 *
 * The outer 7px diamonds land on the outer rail's bright peak; the inner
 * 5px diamonds land on the inner echo. Combined with the rails' top/bottom
 * mask fades, this gives every section a subtle "framed" quality at its
 * upper and lower boundaries.
 */
export function SectionDivider() {
  return (
    // Wrapper padding bumped from `px-4` to `px-5` on mobile so the diamonds
    // (`left-0` / `left-[4px]`) land precisely on the new mobile rail
    // positions (20px / 24px). sm+ keeps `px-6` to match the unchanged
    // desktop rail offsets.
    <div className="relative max-w-7xl mx-auto px-5 sm:px-6" aria-hidden="true">
      <div className="relative h-px">
        {/* Horizontal hairline — slightly stronger than the rails so the
            cross-marks read as punctuation, not just intersections. */}
        <div className="absolute inset-x-0 h-px bg-foreground/[0.10] dark:bg-foreground/[0.07]" />
        {/* Left diamonds — outer (on rail's bright peak) + inner (on echo). */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2">
          <div className="w-[7px] h-[7px] rotate-45 border border-foreground/25 dark:border-foreground/20 bg-background" />
        </div>
        <div className="absolute left-[4px] sm:left-[8px] top-1/2 -translate-y-1/2 -translate-x-1/2">
          <div className="w-[5px] h-[5px] rotate-45 border border-foreground/15 dark:border-foreground/10 bg-background" />
        </div>
        {/* Right diamonds — mirror of left. */}
        <div className="absolute right-[4px] sm:right-[8px] top-1/2 -translate-y-1/2 translate-x-1/2">
          <div className="w-[5px] h-[5px] rotate-45 border border-foreground/15 dark:border-foreground/10 bg-background" />
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
          <div className="w-[7px] h-[7px] rotate-45 border border-foreground/25 dark:border-foreground/20 bg-background" />
        </div>
      </div>
    </div>
  )
}
