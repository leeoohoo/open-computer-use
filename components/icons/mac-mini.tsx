import * as React from "react"
import type { SVGProps } from "react"
import { cn } from "@/lib/utils"

export function MacMiniIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0", className)}
      {...props}
    >
      {/* Main body — rounded rectangle */}
      <rect
        x="2"
        y="7"
        width="20"
        height="10"
        rx="2.5"
        ry="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Top subtle highlight line */}
      <line
        x1="4.5"
        y1="9.5"
        x2="19.5"
        y2="9.5"
        stroke="currentColor"
        strokeWidth="0.75"
        opacity="0.25"
      />
      {/* Bottom divider line */}
      <line
        x1="2"
        y1="14.5"
        x2="22"
        y2="14.5"
        stroke="currentColor"
        strokeWidth="0.75"
        opacity="0.4"
      />
      {/* Power indicator dot */}
      <circle
        cx="19"
        cy="16"
        r="0.75"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  )
}
