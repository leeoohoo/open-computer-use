import * as React from "react"
import type { SVGProps } from "react"
import { cn } from "@/lib/utils"

export function MacMiniIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  const id = React.useId().replace(/:/g, "")

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      {...props}
    >
      <defs>
        <linearGradient id={`tf${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id={`ff${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.32" />
        </linearGradient>
      </defs>

      {/* Drop shadow */}
      <rect
        x="3" y="25" width="26" height="2" rx="1"
        fill="currentColor" opacity="0.06"
      />

      {/* Front face — thin strip with rounded bottom corners */}
      <path
        d={[
          "M 2 19",
          "L 30 19",
          "L 30 22",
          "Q 30 25, 27 25",
          "L 5 25",
          "Q 2 25, 2 22",
          "Z",
        ].join(" ")}
        fill={`url(#ff${id})`}
        stroke="currentColor"
        strokeWidth="0.9"
        strokeOpacity="0.35"
        strokeLinejoin="round"
      />

      {/* Top face — main body with rounded top corners */}
      <path
        d={[
          "M 5 5",
          "Q 2 5, 2 8",
          "L 2 19",
          "L 30 19",
          "L 30 8",
          "Q 30 5, 27 5",
          "Z",
        ].join(" ")}
        fill={`url(#tf${id})`}
        stroke="currentColor"
        strokeWidth="0.9"
        strokeOpacity="0.35"
        strokeLinejoin="round"
      />

      {/* Seam line between top and front */}
      <line
        x1="2" y1="19" x2="30" y2="19"
        stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.15"
      />

      {/* Top edge highlight — aluminum sheen */}
      <line
        x1="5" y1="6.5" x2="27" y2="6.5"
        stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.08"
      />

      {/* Apple logo circle on top face */}
      <circle
        cx="16" cy="12.5" r="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeOpacity="0.12"
      />

      {/* Power LED on front face */}
      <circle
        cx="26" cy="22" r="0.7"
        fill="currentColor" opacity="0.45"
      />
    </svg>
  )
}
