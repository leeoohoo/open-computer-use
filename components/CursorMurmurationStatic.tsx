"use client"

/**
 * Cursor murmuration — static SVG fallback for mobile and reduced-motion.
 *
 * Renders ~100 OS-pointer arrows in a single inline SVG, deterministically
 * laid out with a stratified jitter so the layout looks designed rather than
 * random. Per-cursor rotation is sampled from a smooth curl-flow field so
 * neighboring cursors lean in similar directions — a frozen moment of the
 * murmuration the WebGL version animates.
 *
 * Zero JS runtime cost after mount. No layout thrash. No three.js.
 */

import { useMemo } from "react"

// Centered cursor path — bbox center moved to origin so SVG `rotate(deg)`
// pivots around the cursor's visual center rather than its top-left corner.
const CURSOR_PATH =
  "M -6.08 -9.75 L -6.08 7.84 L -1.92 4.36 L 0.47 9.75 L 2.78 8.70 L 0.35 3.38 L 6.08 3.10 Z"

// Default tip points NW (SVG-CW angle 238° from +X). Applying SVG rotate(α)
// moves it to angle (238 + α) mod 360. We want tip ≡ flow direction, so
// α = ψ_flow_svg − 238° = 122° − θ_math_deg.
const TIP_OFFSET_DEG = 122

const VIEWBOX_W = 1600
const VIEWBOX_H = 900
const CURSOR_COUNT = 110

// Mulberry32 — small, fast, deterministic PRNG. Seeded so SSR and CSR
// produce identical markup, no hydration mismatch, no first-paint flash.
function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface StaticCursor {
  x: number
  y: number
  rotationDeg: number
  scale: number
  opacity: number
  haloOpacity: number
}

function generateLayout(): StaticCursor[] {
  const rng = mulberry32(0xc045)

  // Smooth flow field — base direction with two octaves of modulation.
  // Returns a math-sense angle (0 = right, +π/2 = up).
  const flowAt = (x: number, y: number): number => {
    const xn = x / VIEWBOX_W
    const yn = y / VIEWBOX_H
    return (
      0.42 + // base ~24° upward-right drift
      Math.sin(xn * 2.6 + yn * 1.4) * 0.45 +
      Math.cos(yn * 3.1 - xn * 1.7) * 0.28
    )
  }

  const cursors: StaticCursor[] = []
  // 12 columns × 9 rows = 108 stratified cells, plus 2 random extras at the
  // edges so the grid never reads as a grid.
  const COLS = 12
  const ROWS = 9
  for (let i = 0; i < COLS * ROWS; i++) {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const cellW = VIEWBOX_W / COLS
    const cellH = VIEWBOX_H / ROWS
    const x = col * cellW + (0.15 + rng() * 0.7) * cellW
    const y = row * cellH + (0.15 + rng() * 0.7) * cellH

    const flow = flowAt(x, y)
    const jitter = (rng() - 0.5) * 0.45
    const angleMath = flow + jitter
    const rotationDeg = TIP_OFFSET_DEG - (angleMath * 180) / Math.PI

    // Pseudo-depth controls scale + opacity together so the flock has
    // believable parallax without actually computing parallax.
    const z = rng()
    const scale = 0.7 + z * 0.85 // 0.70 → 1.55
    const opacity = 0.22 + z * 0.62 // 0.22 → 0.84
    const haloOpacity = 0.18 + z * 0.22

    cursors.push({ x, y, rotationDeg, scale, opacity, haloOpacity })
  }

  // Add 2 oversized "leaders" at the front of the visual flow — these read
  // as the flock's vanguard and break the otherwise even density.
  const leaders = [
    { fx: 0.62, fy: 0.36 },
    { fx: 0.74, fy: 0.52 },
  ]
  for (const l of leaders) {
    const x = l.fx * VIEWBOX_W
    const y = l.fy * VIEWBOX_H
    const angleMath = flowAt(x, y)
    cursors.push({
      x,
      y,
      rotationDeg: TIP_OFFSET_DEG - (angleMath * 180) / Math.PI,
      scale: 1.85,
      opacity: 0.92,
      haloOpacity: 0.4,
    })
  }

  return cursors
}

export default function CursorMurmurationStatic() {
  const cursors = useMemo(() => generateLayout(), [])

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      {cursors.map((c, i) => (
        <g
          key={i}
          transform={`translate(${c.x.toFixed(2)} ${c.y.toFixed(
            2
          )}) rotate(${c.rotationDeg.toFixed(2)}) scale(${c.scale.toFixed(3)})`}
        >
          {/* Soft halo — same shape, slightly inflated, dark. Gives each
              cursor a rim that survives the invert filter and prevents
              overlapping cursors from merging into white blobs. */}
          <path
            d={CURSOR_PATH}
            fill="#000"
            opacity={c.haloOpacity}
            transform="scale(1.3)"
          />
          <path d={CURSOR_PATH} fill="#fff" opacity={c.opacity} />
        </g>
      ))}
    </svg>
  )
}
