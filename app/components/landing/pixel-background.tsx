"use client"

import { useEffect, useRef, useCallback } from "react"

interface PixelBackgroundProps {
  className?: string
}

export function PixelBackground({ className }: PixelBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const pixelsRef = useRef<{
    x: number
    y: number
    opacity: number
    targetOpacity: number
    speed: number
    size: number
    hue: number
    saturation: number
    lightness: number
    phase: number
  }[]>([])
  const timeRef = useRef(0)

  const init = useCallback((canvas: HTMLCanvasElement) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext("2d")
    if (ctx) ctx.scale(dpr, dpr)

    const cellSize = 10
    const cols = Math.ceil(rect.width / cellSize)
    const rows = Math.ceil(rect.height / cellSize)
    const pixels: typeof pixelsRef.current = []

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // ~18% density — much more prevalent
        if (Math.random() > 0.18) continue

        const x = col * cellSize
        const y = row * cellSize

        // Distance from center for radial intensity
        const cx = rect.width / 2
        const cy = rect.height * 0.4
        const dist = Math.sqrt((x - cx) ** 2 + ((y - cy) * 1.2) ** 2)
        const maxDist = Math.sqrt(cx ** 2 + (rect.height * 0.6) ** 2)
        const distFactor = 1 - Math.min(dist / (maxDist * 0.95), 1)

        if (distFactor < 0.02) continue

        // Layered brightness: bright core fading outward
        const coreBrightness = Math.pow(distFactor, 0.6)

        pixels.push({
          x,
          y,
          opacity: 0,
          targetOpacity: coreBrightness * (0.25 + Math.random() * 0.55),
          speed: 0.2 + Math.random() * 0.8,
          size: Math.random() > 0.7 ? cellSize - 1 : cellSize - 2,
          // Wider color palette: cyans, teals, blues, with occasional purple accent
          hue: Math.random() > 0.92 ? 260 + Math.random() * 30 : 185 + Math.random() * 50,
          saturation: 55 + Math.random() * 25,
          lightness: 55 + Math.random() * 20,
          phase: Math.random() * Math.PI * 2,
        })
      }
    }

    pixelsRef.current = pixels
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    init(canvas)

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const animate = () => {
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      timeRef.current += 0.016
      const t = timeRef.current

      for (const pixel of pixelsRef.current) {
        // Multi-frequency pulsing for organic feel
        const wave1 = Math.sin(t * pixel.speed + pixel.phase) * 0.5 + 0.5
        const wave2 = Math.sin(t * pixel.speed * 0.3 + pixel.x * 0.005) * 0.5 + 0.5
        const pulse = wave1 * 0.7 + wave2 * 0.3

        const targetNow = pixel.targetOpacity * (0.4 + pulse * 0.6)

        // Faster lerp for more responsive animation
        pixel.opacity += (targetNow - pixel.opacity) * 0.04

        if (pixel.opacity < 0.01) continue

        // More frequent sparks for liveliness
        const spark = Math.random() > 0.998 ? 0.4 : 0
        const finalOpacity = Math.min(pixel.opacity + spark, 0.85)

        // Render pixel with subtle glow
        const glowSize = pixel.size + 2
        const glowOpacity = finalOpacity * 0.15
        ctx.fillStyle = `hsla(${pixel.hue}, ${pixel.saturation}%, ${pixel.lightness}%, ${glowOpacity})`
        ctx.fillRect(
          Math.round(pixel.x) - 1,
          Math.round(pixel.y) - 1,
          glowSize,
          glowSize
        )

        // Main pixel
        ctx.fillStyle = `hsla(${pixel.hue}, ${pixel.saturation}%, ${pixel.lightness}%, ${finalOpacity})`
        ctx.fillRect(
          Math.round(pixel.x),
          Math.round(pixel.y),
          pixel.size,
          pixel.size
        )
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      init(canvas)
    }
    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener("resize", handleResize)
    }
  }, [init])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        maskImage: "radial-gradient(ellipse 85% 75% at 50% 38%, black 0%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 85% 75% at 50% 38%, black 0%, transparent 100%)",
      }}
    />
  )
}
