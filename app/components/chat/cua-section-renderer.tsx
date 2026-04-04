"use client"

import { Markdown } from "@/components/prompt-kit/markdown"
import { cn } from "@/lib/utils"
import {
  CheckCircle,
  XCircle,
  CaretRight,
  Eye,
  Code,
  Brain,
  Lightning,
  Terminal,
  MagnifyingGlass,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
import { memo, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

// ── Types ──

type SectionType =
  | "verification"
  | "analysis"
  | "next-action"
  | "grounded-action"
  | "reflection"
  | "code-agent-summary"
  | "code-agent-thought"
  | "code-agent-result"
  | "code-agent-done"
  | "action-result"
  | "status"
  | "search-results"

interface ParsedSection {
  type: SectionType
  content: string
  attrs: Record<string, string>
}

interface StepGroup {
  kind: "step"
  action: string
  observation: string | null
  code: string | null
  results: { content: string; status: string }[]
}

type TopLevelItem =
  | StepGroup
  | { kind: "status"; content: string; status: string }
  | { kind: "code-agent-thought"; content: string; step: string; budget: string }
  | { kind: "code-agent-result"; content: string; step: string }
  | { kind: "code-agent-done"; content: string; step: string }
  | { kind: "code-agent-summary"; content: string }
  | { kind: "search-results"; query: string; content: string }
  | { kind: "text"; content: string }

// ── Parser ──

const TAG_REGEX = /<cua-section\s+([^>]*)>([\s\S]*?)<\/cua-section>/g
const ATTR_REGEX = /(\w[\w-]*)="([^"]*)"/g

function stripAgentCode(text: string): string {
  return text.replace(/```(?:python)?\s*agent\.[\s\S]*?```/g, "").trim()
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  let m: RegExpExecArray | null
  while ((m = ATTR_REGEX.exec(attrString)) !== null) {
    attrs[m[1]] = m[2]
  }
  return attrs
}

function parseSections(raw: string): ParsedSection[] {
  const sections: ParsedSection[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  TAG_REGEX.lastIndex = 0

  while ((match = TAG_REGEX.exec(raw)) !== null) {
    const before = raw.slice(lastIndex, match.index).trim()
    if (before) {
      sections.push({ type: "next-action" as SectionType, content: before, attrs: { _plain: "true" } })
    }
    const attrs = parseAttributes(match[1])
    sections.push({
      type: (attrs.type ?? "next-action") as SectionType,
      content: match[2].trim(),
      attrs,
    })
    lastIndex = match.index + match[0].length
  }

  const trailing = raw.slice(lastIndex).trim()
  if (trailing) {
    sections.push({ type: "next-action" as SectionType, content: trailing, attrs: { _plain: "true" } })
  }
  return sections
}

// ── Grouping ──

const OBSERVATION_TYPES = new Set<SectionType>(["verification", "analysis", "reflection"])

function buildTopLevel(sections: ParsedSection[]): TopLevelItem[] {
  const items: TopLevelItem[] = []
  let i = 0
  let pendingStep: StepGroup | null = null

  function flushStep() {
    if (pendingStep) {
      items.push(pendingStep)
      pendingStep = null
    }
  }

  while (i < sections.length) {
    const s = sections[i]

    if (OBSERVATION_TYPES.has(s.type)) {
      const parts: string[] = []
      while (i < sections.length && OBSERVATION_TYPES.has(sections[i].type)) {
        parts.push(sections[i].content)
        i++
      }
      const merged = parts.join("\n\n")
      if (pendingStep && pendingStep.action) flushStep()
      if (!pendingStep) {
        pendingStep = { kind: "step", action: "", observation: merged, code: null, results: [] }
      } else {
        pendingStep.observation = pendingStep.observation
          ? pendingStep.observation + "\n\n" + merged
          : merged
      }
      continue
    }

    if (s.type === "next-action") {
      if (pendingStep && pendingStep.action) flushStep()
      if (!pendingStep) {
        pendingStep = { kind: "step", action: "", observation: null, code: null, results: [] }
      }
      if (s.attrs._plain === "true") {
        flushStep()
        items.push({ kind: "text", content: s.content })
      } else {
        pendingStep.action = s.content
      }
    } else if (s.type === "grounded-action") {
      if (pendingStep) pendingStep.code = s.content
    } else if (s.type === "action-result") {
      if (pendingStep) pendingStep.results.push({ content: s.content, status: s.attrs.status || "success" })
    } else if (s.type === "status") {
      flushStep()
      items.push({ kind: "status", content: s.content, status: s.attrs.status || "completed" })
    } else if (s.type === "code-agent-thought") {
      flushStep()
      items.push({ kind: "code-agent-thought", content: s.content, step: s.attrs.step || "", budget: s.attrs.budget || "" })
    } else if (s.type === "code-agent-result") {
      flushStep()
      items.push({ kind: "code-agent-result", content: s.content, step: s.attrs.step || "" })
    } else if (s.type === "code-agent-done") {
      flushStep()
      items.push({ kind: "code-agent-done", content: s.content, step: s.attrs.step || "" })
    } else if (s.type === "code-agent-summary") {
      flushStep()
      items.push({ kind: "code-agent-summary", content: s.content })
    } else if (s.type === "search-results") {
      flushStep()
      items.push({ kind: "search-results", query: s.attrs.query || "", content: s.content })
    }

    i++
  }

  flushStep()
  return items
}

// ── Screenshot Lightbox ──

function ScreenshotLightbox({
  src,
  onClose,
}: {
  src: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
      onClick={onClose}
    >
      <motion.img
        src={src}
        alt="Screenshot"
        initial={{ scale: 0.92 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>,
    document.body
  )
}

// ── Screenshot Thumbnail (replaces timeline dot) ──

function ScreenshotDot({ src }: { src: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <>
      <motion.div
        className="absolute -left-[11px] top-[4px] z-[2] cursor-pointer"
        whileHover={{ scale: 1.18 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
        onClick={() => setLightboxOpen(true)}
      >
        <div className="size-[28px] rounded-[6px] overflow-hidden ring-1 ring-border/40">
          <img src={src} alt="" className="size-full object-cover" draggable={false} />
        </div>
      </motion.div>

      <AnimatePresence>
        {lightboxOpen && (
          <ScreenshotLightbox src={src} onClose={() => setLightboxOpen(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Plain Timeline Dot (no screenshot) ──

function PlainDot({ status }: { status: "success" | "error" | "pending" }) {
  return (
    <div className="absolute left-0 top-[10px] flex items-center justify-center">
      {status === "error" ? (
        <span className="size-2 rounded-full bg-red-500/60 ring-2 ring-red-500/10" />
      ) : status === "success" ? (
        <span className="size-2 rounded-full bg-emerald-500/60 ring-2 ring-emerald-500/10" />
      ) : (
        <span className="size-2 rounded-full bg-muted-foreground/25 ring-2 ring-muted-foreground/5" />
      )}
    </div>
  )
}

// ── Primitives ──

function DetailRow({
  icon: Icon,
  label,
  children,
  defaultOpen = false,
}: {
  icon: React.ComponentType<any>
  label: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group/detail flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <CaretRight
          weight="bold"
          className={cn(
            "size-2.5 shrink-0 transition-transform duration-150",
            open && "rotate-90"
          )}
        />
        <Icon className="size-3 shrink-0 opacity-60 group-hover/detail:opacity-100 transition-opacity" />
        <span>{label}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="ml-[22px] pb-2 text-[13px] leading-relaxed text-muted-foreground/80">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  if (status === "success") return <span className="inline-block size-1.5 rounded-full bg-emerald-500/70 shrink-0" />
  if (status === "error") return <span className="inline-block size-1.5 rounded-full bg-red-500/70 shrink-0" />
  return <span className="inline-block size-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
}

// ── Step ──

function StepCard({
  step,
  screenshot,
}: {
  step: StepGroup
  screenshot?: string | null
}) {
  const actionText = step.action ? stripAgentCode(step.action) : ""
  const hasDetails = step.observation || step.code || step.results.length > 0

  if (!actionText && !hasDetails) return null

  const hasError = step.results.some(r => r.status === "error")
  const isDone = step.results.length > 0
  const status: "success" | "error" | "pending" = hasError
    ? "error"
    : isDone
      ? "success"
      : "pending"
  const hasScreenshot = !!screenshot

  return (
    <div className={cn("group/step relative pb-1", hasScreenshot ? "pl-8" : "pl-6")}>
      {hasScreenshot ? (
        <ScreenshotDot src={screenshot!} />
      ) : (
        <PlainDot status={status} />
      )}

      {/* Action — the natural language line */}
      {actionText && (
        <p className="text-[15px] leading-relaxed text-foreground/90">
          {actionText}
        </p>
      )}

      {/* Inline result badges */}
      {step.results.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {step.results.map((r, j) => (
            <span
              key={j}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] leading-none px-1.5 py-0.5 rounded-full",
                r.status === "success" && "text-emerald-600/80 dark:text-emerald-400/70 bg-emerald-500/8",
                r.status === "error" && "text-red-500/80 dark:text-red-400/70 bg-red-500/8",
                r.status !== "success" && r.status !== "error" && "text-muted-foreground/50 bg-muted-foreground/5",
              )}
            >
              <StatusDot status={r.status} />
              {r.content}
            </span>
          ))}
        </div>
      )}

      {/* Expandable details */}
      {(step.observation || step.code) && (
        <div className="mt-0.5">
          {step.observation && (
            <DetailRow icon={Eye} label="Observation">
              <Markdown>{step.observation}</Markdown>
            </DetailRow>
          )}
          {step.code && (
            <DetailRow icon={Code} label="Grounded action">
              <Markdown>{step.code}</Markdown>
            </DetailRow>
          )}
        </div>
      )}
    </div>
  )
}

// ── Item Renderer ──

function ItemRenderer({
  item,
  screenshot,
}: {
  item: TopLevelItem
  screenshot?: string | null
}) {
  switch (item.kind) {
    case "step":
      return <StepCard step={item} screenshot={screenshot} />

    case "status": {
      const done = item.status === "completed"
      return (
        <div className="relative pl-6 py-1.5">
          <div className="absolute left-0 top-[12px]">
            {done ? (
              <CheckCircle className="size-4 text-emerald-500" weight="fill" />
            ) : (
              <XCircle className="size-4 text-red-500" weight="fill" />
            )}
          </div>
          <p className={cn(
            "text-[14px] font-medium",
            done ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
          )}>
            {item.content}
          </p>
        </div>
      )
    }

    case "code-agent-thought": {
      const label = "Thinking"
      return (
        <div className="pl-6">
          <DetailRow icon={Brain} label={label}>
            <Markdown>{item.content}</Markdown>
          </DetailRow>
        </div>
      )
    }

    case "code-agent-result": {
      const label = "Result"
      return (
        <div className="pl-6">
          <DetailRow icon={Lightning} label={label} defaultOpen>
            <Markdown>{item.content}</Markdown>
          </DetailRow>
        </div>
      )
    }

    case "code-agent-done":
      return (
        <div className="relative pl-6 py-0.5">
          <div className="absolute left-0 top-[8px]">
            <CheckCircle className="size-3.5 text-emerald-500/60" weight="fill" />
          </div>
          <span className="text-[12px] text-emerald-600/60 dark:text-emerald-400/50">{item.content}</span>
        </div>
      )

    case "code-agent-summary":
      return (
        <div className="pl-6">
          <DetailRow icon={Terminal} label="Summary" defaultOpen>
            <Markdown>{item.content}</Markdown>
          </DetailRow>
        </div>
      )

    case "search-results": {
      const label = item.query ? `Search: ${item.query}` : "Web search"
      return (
        <div className="pl-6">
          <DetailRow icon={MagnifyingGlass} label={label} defaultOpen>
            <Markdown>{item.content}</Markdown>
          </DetailRow>
        </div>
      )
    }

    case "text": {
      const cleaned = stripAgentCode(item.content)
      if (!cleaned) return null
      return (
        <div className="pl-6 py-0.5 text-[15px] leading-relaxed text-foreground/80">
          <Markdown>{cleaned}</Markdown>
        </div>
      )
    }

    default:
      return null
  }
}

// ── Screenshot extraction helper ──

function toDataUri(raw: string): string | null {
  const clean = raw.trim()
  if (!clean) return null
  if (clean.startsWith("data:image/")) return clean
  if (clean.startsWith("/9j/")) return `data:image/jpeg;base64,${clean}`
  if (clean.startsWith("iVBOR")) return `data:image/png;base64,${clean}`
  return `data:image/jpeg;base64,${clean}`
}

/** Extract all screenshots from message parts in order */
export function extractScreenshots(
  parts?: Array<{ type: string; toolInvocation?: any }>
): string[] {
  if (!parts) return []
  const screenshots: string[] = []

  for (const part of parts) {
    if (part.type !== "tool-invocation" || !part.toolInvocation) continue
    const inv = part.toolInvocation as any

    // DB-persisted format
    if (inv.frontendScreenshot && typeof inv.frontendScreenshot === "string") {
      const uri = toDataUri(inv.frontendScreenshot)
      if (uri) {
        screenshots.push(uri)
        continue
      }
    }

    // Streaming format
    if (
      inv.state === "result" &&
      inv.result &&
      typeof inv.result === "object" &&
      "frontendScreenshot" in inv.result
    ) {
      const uri = toDataUri(inv.result.frontendScreenshot)
      if (uri) {
        screenshots.push(uri)
        continue
      }
    }
  }

  return screenshots
}

// ── Exported ──

export function hasCuaSections(content: string): boolean {
  return /<cua-section\s/.test(content)
}

export const CuaSectionRenderer = memo(function CuaSectionRenderer({
  content,
  className,
  screenshots,
}: {
  content: string
  className?: string
  screenshots?: string[]
}) {
  const items = useMemo(() => {
    const sections = parseSections(content)
    return buildTopLevel(sections)
  }, [content])

  // Map screenshots to step items only (skip non-step items)
  const stepScreenshotMap = useMemo(() => {
    if (!screenshots || screenshots.length === 0) return new Map<number, string>()
    const map = new Map<number, string>()
    let screenshotIdx = 0
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "step" && screenshotIdx < screenshots.length) {
        map.set(i, screenshots[screenshotIdx])
        screenshotIdx++
      }
    }
    return map
  }, [items, screenshots])

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="relative">
        <div className="absolute left-[3.5px] top-2 bottom-2 w-px bg-border/30" />
        <div className="relative flex flex-col">
          {items.map((item, i) => (
            <ItemRenderer
              key={i}
              item={item}
              screenshot={stepScreenshotMap.get(i)}
            />
          ))}
        </div>
      </div>
    </div>
  )
})
