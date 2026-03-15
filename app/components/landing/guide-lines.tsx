"use client"

/**
 * Vertical guide lines that frame the page content.
 * Use as a direct child of a `relative` container that wraps the full page.
 */
export function GuideLines() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[1]" aria-hidden="true">
      <div className="mx-auto h-full max-w-7xl px-4 sm:px-6 relative">
        {/* Left double lines */}
        <div className="absolute left-4 sm:left-6 top-0 bottom-0 w-px bg-border/50 dark:bg-border/35" />
        <div className="absolute left-5 sm:left-[32px] top-0 bottom-0 w-px bg-border/30 dark:bg-border/20" />
        {/* Right double lines */}
        <div className="absolute right-5 sm:right-[32px] top-0 bottom-0 w-px bg-border/30 dark:bg-border/20" />
        <div className="absolute right-4 sm:right-6 top-0 bottom-0 w-px bg-border/50 dark:bg-border/35" />
      </div>
    </div>
  )
}

/**
 * Horizontal divider with diamond cross-marks aligned to guide lines.
 */
export function SectionDivider() {
  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6" aria-hidden="true">
      <div className="relative h-px">
        {/* Horizontal line */}
        <div className="absolute inset-x-0 h-px bg-border/30 dark:bg-border/20" />
        {/* Left cross marks */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2">
          <div className="w-[7px] h-[7px] rotate-45 border border-border/40 dark:border-border/25 bg-background" />
        </div>
        <div className="absolute left-[4px] sm:left-[8px] top-1/2 -translate-y-1/2 -translate-x-1/2">
          <div className="w-[5px] h-[5px] rotate-45 border border-border/25 dark:border-border/15 bg-background" />
        </div>
        {/* Right cross marks */}
        <div className="absolute right-[4px] sm:right-[8px] top-1/2 -translate-y-1/2 translate-x-1/2">
          <div className="w-[5px] h-[5px] rotate-45 border border-border/25 dark:border-border/15 bg-background" />
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
          <div className="w-[7px] h-[7px] rotate-45 border border-border/40 dark:border-border/25 bg-background" />
        </div>
      </div>
    </div>
  )
}
