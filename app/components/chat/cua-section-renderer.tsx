"use client"

import { Markdown } from "@/components/prompt-kit/markdown"
import { cn } from "@/lib/utils"
import {
  CheckCircle,
  XCircle,
  CaretRight,
  CircleNotch,
  Eye,
  Code,
  Brain,
  Lightning,
  Terminal,
  MagnifyingGlass,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
import { memo, useMemo, useState } from "react"

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

// ── Primitives ──

function DetailRow({
  icon: Icon,
  label,
  children,
  defaultOpen = false,
}: {
  icon: React.ElementType
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

function StepCard({ step, index }: { step: StepGroup; index: number }) {
  const actionText = step.action ? stripAgentCode(step.action) : ""
  const hasDetails = step.observation || step.code || step.results.length > 0

  if (!actionText && !hasDetails) return null

  return (
    <div className="group/step relative pl-6 pb-1">
      {/* Timeline dot */}
      <div className="absolute left-0 top-[10px] flex items-center justify-center">
        {step.results.some(r => r.status === "error") ? (
          <span className="size-2 rounded-full bg-red-500/60 ring-2 ring-red-500/10" />
        ) : step.results.length > 0 ? (
          <span className="size-2 rounded-full bg-emerald-500/60 ring-2 ring-emerald-500/10" />
        ) : (
          <span className="size-2 rounded-full bg-muted-foreground/25 ring-2 ring-muted-foreground/5" />
        )}
      </div>

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

function ItemRenderer({ item, index }: { item: TopLevelItem; index: number }) {
  switch (item.kind) {
    case "step":
      return <StepCard step={item} index={index} />

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

// ── Exported ──

export function hasCuaSections(content: string): boolean {
  return /<cua-section\s/.test(content)
}

export const CuaSectionRenderer = memo(function CuaSectionRenderer({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const items = useMemo(() => {
    const sections = parseSections(content)
    return buildTopLevel(sections)
  }, [content])

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {/* Thin timeline line behind dots */}
      <div className="relative">
        <div className="absolute left-[3.5px] top-2 bottom-2 w-px bg-border/30" />
        <div className="relative flex flex-col">
          {items.map((item, i) => (
            <ItemRenderer key={i} item={item} index={i} />
          ))}
        </div>
      </div>
    </div>
  )
})
