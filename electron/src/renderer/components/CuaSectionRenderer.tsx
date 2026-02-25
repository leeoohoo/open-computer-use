import React, { memo, useMemo, useState } from 'react'
import { cn } from '../lib/utils'
import { Markdown } from './Markdown'

// ── Icons (inline SVGs replacing @phosphor-icons/react) ──

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  )
}

function IconXCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
    </svg>
  )
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconCode({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function IconBrain({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A5.5 5.5 0 0 0 4 7.5c0 1.5.6 2.9 1.6 3.9L12 18l6.4-6.6A5.5 5.5 0 0 0 14.5 2a5.5 5.5 0 0 0-5 3.2" />
      <path d="M12 18v4" />
    </svg>
  )
}

function IconLightning({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 2v11h3v9l7-12h-4l4-8z" />
    </svg>
  )
}

function IconTerminal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

// ── Types ──

type SectionType =
  | 'verification'
  | 'analysis'
  | 'next-action'
  | 'grounded-action'
  | 'reflection'
  | 'code-agent-summary'
  | 'code-agent-thought'
  | 'code-agent-result'
  | 'code-agent-done'
  | 'action-result'
  | 'status'

interface ParsedSection {
  type: SectionType
  content: string
  attrs: Record<string, string>
}

interface StepGroup {
  kind: 'step'
  action: string
  observation: string | null
  code: string | null
  results: { content: string; status: string }[]
}

type TopLevelItem =
  | StepGroup
  | { kind: 'status'; content: string; status: string }
  | { kind: 'code-agent-thought'; content: string; step: string; budget: string }
  | { kind: 'code-agent-result'; content: string; step: string }
  | { kind: 'code-agent-done'; content: string; step: string }
  | { kind: 'code-agent-summary'; content: string }
  | { kind: 'text'; content: string }

// ── Parser ──

const TAG_REGEX = /<cua-section\s+([^>]*)>([\s\S]*?)<\/cua-section>/g
const ATTR_REGEX = /(\w[\w-]*)="([^"]*)"/g

function stripAgentCode(text: string): string {
  return text.replace(/```(?:python)?\s*agent\.[\s\S]*?```/g, '').trim()
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
      sections.push({ type: 'next-action' as SectionType, content: before, attrs: { _plain: 'true' } })
    }
    const attrs = parseAttributes(match[1])
    sections.push({
      type: (attrs.type ?? 'next-action') as SectionType,
      content: match[2].trim(),
      attrs,
    })
    lastIndex = match.index + match[0].length
  }

  const trailing = raw.slice(lastIndex).trim()
  if (trailing) {
    sections.push({ type: 'next-action' as SectionType, content: trailing, attrs: { _plain: 'true' } })
  }
  return sections
}

// ── Grouping ──

const OBSERVATION_TYPES = new Set<SectionType>(['verification', 'analysis', 'reflection'])

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
      const merged = parts.join('\n\n')
      if (pendingStep && pendingStep.action) flushStep()
      if (!pendingStep) {
        pendingStep = { kind: 'step', action: '', observation: merged, code: null, results: [] }
      } else {
        pendingStep.observation = pendingStep.observation
          ? pendingStep.observation + '\n\n' + merged
          : merged
      }
      continue
    }

    if (s.type === 'next-action') {
      if (pendingStep && pendingStep.action) flushStep()
      if (!pendingStep) {
        pendingStep = { kind: 'step', action: '', observation: null, code: null, results: [] }
      }
      if (s.attrs._plain === 'true') {
        flushStep()
        items.push({ kind: 'text', content: s.content })
      } else {
        pendingStep.action = s.content
      }
    } else if (s.type === 'grounded-action') {
      if (pendingStep) pendingStep.code = s.content
    } else if (s.type === 'action-result') {
      if (pendingStep) pendingStep.results.push({ content: s.content, status: s.attrs.status || 'success' })
    } else if (s.type === 'status') {
      flushStep()
      items.push({ kind: 'status', content: s.content, status: s.attrs.status || 'completed' })
    } else if (s.type === 'code-agent-thought') {
      flushStep()
      items.push({ kind: 'code-agent-thought', content: s.content, step: s.attrs.step || '', budget: s.attrs.budget || '' })
    } else if (s.type === 'code-agent-result') {
      flushStep()
      items.push({ kind: 'code-agent-result', content: s.content, step: s.attrs.step || '' })
    } else if (s.type === 'code-agent-done') {
      flushStep()
      items.push({ kind: 'code-agent-done', content: s.content, step: s.attrs.step || '' })
    } else if (s.type === 'code-agent-summary') {
      flushStep()
      items.push({ kind: 'code-agent-summary', content: s.content })
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
        className="group/detail flex items-center gap-1.5 py-1 text-[13px] text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <IconChevronRight
          className={cn(
            'w-2.5 h-2.5 shrink-0 transition-transform duration-150',
            open && 'rotate-90'
          )}
        />
        <Icon className="w-3 h-3 shrink-0 opacity-60 group-hover/detail:opacity-100 transition-opacity" />
        <span>{label}</span>
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-150 ease-out',
          open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="ml-[22px] pb-2 text-[13px] leading-relaxed text-neutral-400">
          {children}
        </div>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  if (status === 'success') return <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500/70 shrink-0" />
  if (status === 'error') return <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500/70 shrink-0" />
  return <span className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-500/30 shrink-0" />
}

// ── Step ──

function StepCard({ step }: { step: StepGroup }) {
  const actionText = step.action ? stripAgentCode(step.action) : ''
  const hasDetails = step.observation || step.code || step.results.length > 0

  if (!actionText && !hasDetails) return null

  return (
    <div className="group/step relative pl-6 pb-1">
      {/* Timeline dot */}
      <div className="absolute left-0 top-[10px] flex items-center justify-center">
        {step.results.some((r) => r.status === 'error') ? (
          <span className="w-2 h-2 rounded-full bg-red-500/60 ring-2 ring-red-500/10" />
        ) : step.results.length > 0 ? (
          <span className="w-2 h-2 rounded-full bg-emerald-500/60 ring-2 ring-emerald-500/10" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-neutral-500/25 ring-2 ring-neutral-500/5" />
        )}
      </div>

      {/* Action — the natural language line */}
      {actionText && (
        <p className="text-[15px] leading-relaxed text-neutral-200">
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
                'inline-flex items-center gap-1 text-[11px] leading-none px-1.5 py-0.5 rounded-full',
                r.status === 'success' && 'text-emerald-400/70 bg-emerald-500/10',
                r.status === 'error' && 'text-red-400/70 bg-red-500/10',
                r.status !== 'success' && r.status !== 'error' && 'text-neutral-500 bg-neutral-500/5'
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
            <DetailRow icon={IconEye} label="Observation">
              <Markdown>{step.observation}</Markdown>
            </DetailRow>
          )}
          {step.code && (
            <DetailRow icon={IconCode} label="Grounded action">
              <Markdown>{step.code}</Markdown>
            </DetailRow>
          )}
        </div>
      )}
    </div>
  )
}

// ── Item Renderer ──

function ItemRenderer({ item }: { item: TopLevelItem }) {
  switch (item.kind) {
    case 'step':
      return <StepCard step={item} />

    case 'status': {
      const done = item.status === 'completed'
      return (
        <div className="relative pl-6 py-1.5">
          <div className="absolute left-0 top-[12px]">
            {done ? (
              <IconCheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <IconXCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
          <p className={cn(
            'text-[14px] font-medium',
            done ? 'text-emerald-400' : 'text-red-400'
          )}>
            {item.content}
          </p>
        </div>
      )
    }

    case 'code-agent-thought': {
      const label = 'Thinking'
      return (
        <div className="pl-6">
          <DetailRow icon={IconBrain} label={label}>
            <Markdown>{item.content}</Markdown>
          </DetailRow>
        </div>
      )
    }

    case 'code-agent-result': {
      const label = 'Result'
      return (
        <div className="pl-6">
          <DetailRow icon={IconLightning} label={label} defaultOpen>
            <Markdown>{item.content}</Markdown>
          </DetailRow>
        </div>
      )
    }

    case 'code-agent-done':
      return (
        <div className="relative pl-6 py-0.5">
          <div className="absolute left-0 top-[8px]">
            <IconCheckCircle className="w-3.5 h-3.5 text-emerald-500/60" />
          </div>
          <span className="text-[12px] text-emerald-400/50">{item.content}</span>
        </div>
      )

    case 'code-agent-summary':
      return (
        <div className="pl-6">
          <DetailRow icon={IconTerminal} label="Summary" defaultOpen>
            <Markdown>{item.content}</Markdown>
          </DetailRow>
        </div>
      )

    case 'text': {
      const cleaned = stripAgentCode(item.content)
      if (!cleaned) return null
      return (
        <div className="pl-6 py-0.5 text-[15px] leading-relaxed text-neutral-300">
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
    <div className={cn('flex flex-col gap-0.5', className)}>
      {/* Thin timeline line behind dots */}
      <div className="relative">
        <div className="absolute left-[3.5px] top-2 bottom-2 w-px bg-neutral-700/30" />
        <div className="relative flex flex-col">
          {items.map((item, i) => (
            <ItemRenderer key={i} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
})
