"use client"

import * as React from "react"
import type { SVGProps } from "react"
import { useTheme } from "next-themes"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

export function CoastyIcon(props: SVGProps<SVGSVGElement>) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Use dark theme as default during hydration to match the defaultTheme="dark" in layout.tsx
  // This prevents the flash from light to dark logo
  const logoSrc = mounted && resolvedTheme === "light" ? "/logo_dark.svg" : "/logo_light.svg"
  
  // Extract size from className or use default
  const className = props.className || ""
  let width = 80
  let height = 80
  
  // Parse size classes like "size-4", "w-6 h-6", etc.
  if (className.includes("size-4")) {
    width = 16
    height = 16
  } else if (className.includes("size-6")) {
    width = 24
    height = 24
  } else if (className.includes("size-8")) {
    width = 32
    height = 32
  } else if (className.includes("w-") && className.includes("h-")) {
    // Extract width and height from w-* and h-* classes
    const widthMatch = className.match(/w-(\d+)/)
    const heightMatch = className.match(/h-(\d+)/)
    if (widthMatch) width = parseInt(widthMatch[1]) * 4
    if (heightMatch) height = parseInt(heightMatch[1]) * 4
  }
  
  return (
    <Image
      src={logoSrc}
      alt="Coasty Logo"
      width={width}
      height={height}
      className={cn("object-contain", className)}
      style={props.style}
      suppressHydrationWarning
    />
  )
}
