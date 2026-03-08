import * as React from "react"
import type { SVGProps } from "react"

/**
 * Custom Agent icon — a clean professional silhouette with a subtle pulse/spark indicator.
 * Used across the Agents feature (sidebar nav, header button, cards, dialogs).
 *
 * Accepts standard SVG props including className for sizing (e.g. "size-4", "h-4 w-4").
 * Uses `currentColor` so it inherits text color from parent.
 */
export function AgentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Head */}
      <circle cx="12" cy="7.5" r="3.5" />
      {/* Body/shoulders */}
      <path d="M5.5 21v-2a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v2" />
      {/* AI spark — small diamond at top-right */}
      <path
        d="M18.5 3l.75 1.5 1.5.75-1.5.75L18.5 7.5l-.75-1.5-1.5-.75 1.5-.75z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

/**
 * Filled variant for compact/badge usage (e.g. sidebar badges).
 * Slightly bolder with filled head for better readability at small sizes.
 */
export function AgentIconFilled(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      {/* Head */}
      <circle cx="12" cy="7.5" r="3.5" />
      {/* Body */}
      <path d="M5.5 21v-2a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v2H5.5z" />
      {/* AI spark */}
      <path d="M18.5 3l.75 1.5 1.5.75-1.5.75L18.5 7.5l-.75-1.5-1.5-.75 1.5-.75z" />
    </svg>
  )
}
