"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus, Copy, Check, Trash2, Key, Code2, MoreHorizontal, BarChart3,
  Shield, Terminal, BookOpen, Braces, Send, MousePointerClick, Zap
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageLoader } from "@/components/common/page-loader"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { fetchClient } from "@/lib/fetch"
import { APITab } from "@/app/guide/tabs/api"

/* ─── Constants ─── */

const EASE = [0.22, 1, 0.36, 1] as const

/* ─── Types ─── */

interface APIKey {
  id: string
  name: string
  tier: string
  scopes: string[]
  created_at: string
  last_used_at: string | null
  key_prefix: string
}

interface Stats {
  keyCount: number
  totalRequests: number
  totalCredits: number
  requests24h: number
  requests7d: number
  credits7d: number
  avgCreditsPerRequest: number
  peakHour: number | null
  balance: number
  tier: string
}

interface DailyPoint {
  date: string
  requests: number
  credits: number
}

interface RecentRequest {
  endpoint: string
  credits: number
  time: string
}

/* ─── Helpers ─── */

function timeAgo(date: string | null) {
  if (!date) return "Never"
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

/* ─── Activity Chart — always looks good, any data level ─── */

function ActivityChart({ daily }: { daily: DailyPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const hasData = daily.some(d => d.requests > 0)
  const totalReqs = daily.reduce((s, d) => s + d.requests, 0)
  const totalCreds = daily.reduce((s, d) => s + d.credits, 0)

  // SVG dimensions with padding so dots/curves never clip
  const W = 400
  const H = 80
  const TOP = 8   // room for dots + bezier overshoot at top
  const BOT = 4   // small bottom margin above the baseline

  const chartH = H - TOP - BOT
  const maxVal = Math.max(...daily.map(d => d.requests), 1)

  // Scale each day into SVG coordinates
  const scaled = daily.map((d, i) => {
    const x = daily.length > 1 ? (i / (daily.length - 1)) * W : W / 2
    // Active points get at least 18% of chart height so even 1 request is visible
    const norm = d.requests > 0
      ? Math.max(d.requests / maxVal, 0.18)
      : 0.02
    const sy = H - BOT - norm * chartH
    return { x, sy, data: d }
  })

  // Smooth cubic bezier — clamp control points inside the viewBox
  function smoothPath(pts: typeof scaled): string {
    if (pts.length < 2) return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.sy}`).join(" ")
    const clampY = (v: number) => Math.max(TOP - 2, Math.min(H - BOT + 2, v))
    let d = `M ${pts[0].x} ${pts[0].sy}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(i + 2, pts.length - 1)]
      const t = 0.25
      const cp1y = clampY(p1.sy + (p2.sy - p0.sy) * t)
      const cp2y = clampY(p2.sy - (p3.sy - p1.sy) * t)
      d += ` C ${p1.x + (p2.x - p0.x) * t} ${cp1y}, ${p2.x - (p3.x - p1.x) * t} ${cp2y}, ${p2.x} ${p2.sy}`
    }
    return d
  }

  const linePath = smoothPath(scaled)
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`

  return (
    <div className="relative rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent" />
      <div className="px-5 pt-4 pb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-baseline gap-3">
            <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">Activity</span>
            {hasData && (
              <span className="text-[10px] text-muted-foreground/30 tabular-nums">
                {totalReqs} request{totalReqs !== 1 ? "s" : ""} &middot; {totalCreds} credits
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/35">14 days</span>
        </div>

        {/* SVG chart */}
        <div className="relative h-24 mt-2">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-full text-foreground"
          >
            <defs>
              <linearGradient id="act-area-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={hasData ? 0.1 : 0.04} />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="act-line-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.06" />
                <stop offset="20%" stopColor="currentColor" stopOpacity={hasData ? 0.25 : 0.08} />
                <stop offset="80%" stopColor="currentColor" stopOpacity={hasData ? 0.25 : 0.08} />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.06" />
              </linearGradient>
            </defs>

            {/* Area fill */}
            <path d={areaPath} fill="url(#act-area-fill)" />

            {/* Smooth line */}
            <path d={linePath} fill="none" stroke="url(#act-line-grad)" strokeWidth="1.5" />

            {/* Data markers on active days */}
            {hasData && scaled.map((p, i) => (
              p.data.requests > 0 && (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.sy}
                  r={hovered === i ? 3 : 1.5}
                  fill={hovered === i ? "currentColor" : "none"}
                  fillOpacity={hovered === i ? 0.35 : 0}
                  stroke="currentColor"
                  strokeWidth={hovered === i ? 1.5 : 1}
                  strokeOpacity={hovered === i ? 0.4 : 0.15}
                  className="transition-all duration-200"
                />
              )
            ))}
          </svg>

          {/* Hover zones */}
          <div className="absolute inset-0 flex">
            {daily.map((d, i) => (
              <div
                key={d.date}
                className="flex-1 relative"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {hovered === i && d.requests > 0 && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-foreground text-background text-[9px] font-medium whitespace-nowrap z-10 pointer-events-none shadow-lg">
                    <span className="tabular-nums">{d.requests}</span> req &middot; <span className="tabular-nums">{d.credits}</span> cr
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Empty state message */}
          {!hasData && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] text-muted-foreground/25 font-medium">
                Your API activity will appear here
              </span>
            </div>
          )}
        </div>

        {/* Date labels */}
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] text-muted-foreground/25 tabular-nums">{daily[0]?.date.slice(5)}</span>
          <span className="text-[9px] text-muted-foreground/25 tabular-nums">Today</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Stat Card — big underflowing icon ─── */

function StatCard({ label, value, subtext, icon: Icon, detail, sparkData }: {
  label: string
  value: string
  subtext?: string
  icon: typeof Key
  detail?: string
  sparkData?: number[]
}) {
  return (
    <div className="relative rounded-xl border border-border/40 bg-card/30 p-4 flex flex-col min-h-[120px] overflow-hidden">
      {/* Big icon — underflowing in bottom-right */}
      <Icon
        className="absolute -bottom-3 -right-3 h-20 w-20 text-foreground/[0.04] pointer-events-none"
        strokeWidth={1}
      />

      <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-auto relative z-[1]">
        {label}
      </span>
      <div className="relative z-[1]">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[22px] font-bold tracking-tight text-foreground leading-none">
            {value}
          </span>
          {subtext && (
            <span className="text-[11px] text-muted-foreground/50 leading-none">{subtext}</span>
          )}
        </div>
        <div className="h-4 mt-1.5 flex items-center gap-2">
          {detail && (
            <span className="text-[10px] leading-none text-muted-foreground/40">{detail}</span>
          )}
          {sparkData && sparkData.length > 0 && (
            <div className="flex items-end gap-[1px] h-2.5 ml-auto">
              {sparkData.map((v, i) => {
                const max = Math.max(...sparkData, 1)
                return (
                  <div
                    key={i}
                    className={cn(
                      "w-[3px] rounded-[1px]",
                      v > 0 ? "bg-foreground/20" : "bg-foreground/[0.04]"
                    )}
                    style={{ height: `${Math.max((v / max) * 100, v > 0 ? 15 : 5)}%` }}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Created Key Snippet (shown in the key-created dialog) ─── */

const SNIPPET_LANGS = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "curl", label: "cURL" },
] as const

type SnippetLangId = (typeof SNIPPET_LANGS)[number]["id"]

function getSnippetCode(lang: SnippetLangId, key: string, forCopy: boolean): string {
  // forCopy=true: inline the full key for clipboard
  // forCopy=false: use a variable so it fits on screen
  switch (lang) {
    case "python":
      return forCopy
        ? `import requests, base64

API_KEY = "${key}"
img = base64.b64encode(open("screen.png", "rb").read()).decode()

r = requests.post(
    "https://coasty.ai/api/v1/cua/predict",
    headers={"X-API-Key": API_KEY},
    json={
        "screenshot": img,
        "instruction": "Click the login button",
    },
)
for action in r.json()["actions"]:
    print(action["action_type"], action["params"])`
        : `import requests, base64

API_KEY = "${key}"
img = base64.b64encode(
    open("screen.png", "rb").read()
).decode()

r = requests.post(
    "https://coasty.ai/api/v1/cua/predict",
    headers={"X-API-Key": API_KEY},
    json={
        "screenshot": img,
        "instruction": "Click the login button",
    },
)
for action in r.json()["actions"]:
    print(action["action_type"], action["params"])`
    case "javascript":
      return `const API_KEY = "${key}";
const screenshot = fs.readFileSync("screen.png")
  .toString("base64");

const res = await fetch(
  "https://coasty.ai/api/v1/cua/predict",
  {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      screenshot,
      instruction: "Click the login button",
    }),
  }
);
const { actions } = await res.json();`
    case "curl":
      return `API_KEY="${key}"

curl -X POST \\
  https://coasty.ai/api/v1/cua/predict \\
  -H "X-API-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "screenshot": "'$(base64 -w0 screen.png)'",
    "instruction": "Click the login button"
  }'`
  }
}

function CreatedKeySnippet({ apiKey, onCopy }: { apiKey: string; onCopy: (text: string) => Promise<void> }) {
  const [snippetLang, setSnippetLang] = useState<SnippetLangId>("python")
  const displayCode = getSnippetCode(snippetLang, apiKey, false)
  const copyCode = getSnippetCode(snippetLang, apiKey, true)

  return (
    <div className="border-t border-border/20 bg-foreground/[0.015]">
      <div className="px-4 sm:px-6 pt-3 sm:pt-4 pb-3">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[10px] sm:text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">Quick start</p>
          <button
            onClick={() => onCopy(copyCode).then(() => toast.success("Snippet copied"))}
            className="text-[10px] text-muted-foreground/30 hover:text-foreground/50 transition-colors"
          >
            Copy
          </button>
        </div>

        {/* Language tabs */}
        <div className="flex items-center gap-0.5 sm:gap-1 mb-2.5 overflow-x-auto scrollbar-invisible">
          {SNIPPET_LANGS.map(l => (
            <button
              key={l.id}
              onClick={() => setSnippetLang(l.id)}
              className={cn(
                "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-medium transition-all duration-150 shrink-0",
                snippetLang === l.id
                  ? "bg-background shadow-sm text-foreground border border-border/30"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-foreground/[0.03]"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Code */}
        <div className="rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] overflow-hidden">
          <pre className="px-3 sm:px-3.5 py-2.5 sm:py-3 text-[10px] sm:text-[11px] leading-relaxed font-mono text-foreground/60 overflow-x-auto scrollbar-invisible">
            <code>{displayCode}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}

/* ─── Aurora Thumbnail (same pattern as machine-card-thumbnail.tsx) ─── */

const PALETTES = [
  { a: "#6366f1", b: "#a78bfa", c: "#818cf8" },
  { a: "#3b82f6", b: "#8b5cf6", c: "#60a5fa" },
  { a: "#06b6d4", b: "#6366f1", c: "#22d3ee" },
  { a: "#8b5cf6", b: "#ec4899", c: "#c084fc" },
  { a: "#f43f5e", b: "#f97316", c: "#fb7185" },
  { a: "#10b981", b: "#06b6d4", c: "#34d399" },
  { a: "#f59e0b", b: "#ef4444", c: "#fbbf24" },
  { a: "#ec4899", b: "#8b5cf6", c: "#f9a8d4" },
  { a: "#14b8a6", b: "#3b82f6", c: "#2dd4bf" },
  { a: "#a855f7", b: "#f43f5e", c: "#d946ef" },
]

function useKeyVisuals(keyId: string) {
  return useMemo(() => {
    let hash = 0
    for (let i = 0; i < keyId.length; i++) {
      hash = keyId.charCodeAt(i) + ((hash << 5) - hash)
    }
    const r = (seed: number) => {
      const x = Math.sin(seed * 9301 + 49297) * 49297
      return x - Math.floor(x)
    }
    return {
      palette: PALETTES[Math.abs(hash) % PALETTES.length],
      blobPos: {
        x1: 15 + r(hash + 1) * 30,
        y1: 20 + r(hash + 2) * 30,
        x2: 55 + r(hash + 3) * 30,
        y2: 30 + r(hash + 4) * 40,
      },
      uid: keyId.slice(0, 8),
    }
  }, [keyId])
}

/* ─── API Key Card ─── */

function copyToClipboard(text: string): Promise<void> {
  // Try modern API first, fall back to execCommand for HTTP/localhost
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => execCopy(text))
  }
  return execCopy(text)
}

function execCopy(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("textarea")
    el.value = text
    el.style.position = "fixed"
    el.style.left = "-9999px"
    document.body.appendChild(el)
    el.select()
    try {
      const ok = document.execCommand("copy")
      if (ok) resolve(); else reject()
    } catch { reject() }
    finally { document.body.removeChild(el) }
  })
}

function APIKeyCard({ apiKey, index, fullKey, onRevoke }: { apiKey: APIKey; index: number; fullKey?: string; onRevoke: (id: string) => void }) {
  const [copied, setCopied] = useState(false)
  const { palette, blobPos, uid } = useKeyVisuals(apiKey.id)
  const hasFullKey = !!fullKey

  const copyKey = useCallback(() => {
    const text = hasFullKey ? fullKey! : apiKey.key_prefix
    copyToClipboard(text).then(() => {
      setCopied(true)
      toast.success(hasFullKey ? "API key copied" : "Key prefix copied — full key is only shown at creation")
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      toast.error("Copy failed — try selecting the text manually")
    })
  }, [fullKey, apiKey.key_prefix, hasFullKey])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, delay: 0.05 + index * 0.04, ease: EASE }}
      className={cn(
        "group relative h-full flex flex-col rounded-2xl overflow-hidden",
        "bg-card border border-border/40",
        "transition-all duration-300 ease-out",
        "hover:border-border/80 hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/[0.12]",
      )}
    >
      {/* ── Aurora header (machine-card-thumbnail pattern) ── */}
      <div className="relative h-24 w-full overflow-hidden shrink-0">
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes ak-drift-${uid} {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(8px, -6px) scale(1.05); }
            66% { transform: translate(-6px, 8px) scale(0.97); }
          }
          @keyframes ak-drift2-${uid} {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(-10px, 6px) scale(1.04); }
          }
          @keyframes ak-shimmer-${uid} {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        ` }} />

        {/* Base gradient */}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${palette.a}15 0%, transparent 50%, ${palette.b}10 100%)` }}
        />

        {/* Blob 1 */}
        <div
          className="absolute will-change-transform rounded-full"
          style={{
            width: "70%", height: "140%",
            left: `${blobPos.x1}%`, top: `${blobPos.y1 - 40}%`,
            background: `radial-gradient(ellipse at center, ${palette.a}30, transparent 70%)`,
            filter: "blur(24px)",
            animation: `ak-drift-${uid} 10s ease-in-out infinite`,
          }}
        />

        {/* Blob 2 */}
        <div
          className="absolute will-change-transform rounded-full"
          style={{
            width: "60%", height: "120%",
            left: `${blobPos.x2}%`, top: `${blobPos.y2 - 30}%`,
            background: `radial-gradient(ellipse at center, ${palette.b}25, transparent 70%)`,
            filter: "blur(20px)",
            animation: `ak-drift2-${uid} 8s ease-in-out infinite`,
          }}
        />

        {/* Shimmer sweep */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(105deg, transparent 40%, ${palette.c}08 50%, transparent 60%)`,
            animation: `ak-shimmer-${uid} 6s ease-in-out infinite`,
          }}
        />

        {/* Bottom fade into card body */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-col flex-1 px-5 pb-4 pt-0.5 relative">
        {/* Name row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-2 w-2 rounded-full shrink-0 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
            <h3 className="text-[15px] font-semibold truncate text-foreground tracking-[-0.01em]">
              {apiKey.name}
            </h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg text-muted-foreground/30 hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={copyKey} className="gap-2">
                <Copy className="h-3.5 w-3.5" />
                {hasFullKey ? "Copy key" : "Copy prefix"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRevoke(apiKey.id)} className="gap-2 text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                Revoke
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Key (copyable — full key if just created, prefix otherwise) */}
        <button
          onClick={copyKey}
          className={cn(
            "flex items-center gap-2.5 text-left w-full rounded-xl border px-3 py-2 mb-3 group/key transition-colors",
            hasFullKey
              ? "border-emerald-500/20 bg-emerald-500/[0.03] hover:border-emerald-500/30"
              : "border-border/30 hover:border-border/50"
          )}
        >
          <Key className={cn("h-3.5 w-3.5 shrink-0", hasFullKey ? "text-emerald-500/40" : "text-muted-foreground/25")} />
          <span className="text-[11px] font-mono text-muted-foreground/50 truncate flex-1">
            {apiKey.key_prefix}{"••••••••••••"}
          </span>
          {copied && (
            <Check className="h-3 w-3 text-emerald-500 shrink-0" />
          )}
        </button>

        {/* Status meta line */}
        <div className="flex items-center gap-1.5 text-[11px] mb-3">
          <span className="font-medium text-emerald-600 dark:text-emerald-400">Active</span>
          <span className="text-muted-foreground/20">&middot;</span>
          <span className="text-muted-foreground/40">{apiKey.scopes.length} scopes</span>
          {apiKey.last_used_at && (
            <>
              <span className="text-muted-foreground/20">&middot;</span>
              <span className="tabular-nums text-muted-foreground/40">{timeAgo(apiKey.last_used_at)}</span>
            </>
          )}
        </div>

        {/* Scopes */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {apiKey.scopes.map(scope => (
            <span key={scope} className="inline-flex items-center rounded-md border border-border/30 bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/50">
              {scope}
            </span>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-border/30 px-5 py-3 flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
        <span className="text-[11px] text-muted-foreground/40">Created {timeAgo(apiKey.created_at)}</span>
      </div>
    </motion.div>
  )
}

/* ─── Code Block ─── */

/* ═══════════════════════════════════════════════════════════════════
   MAIN CONTENT
   ═══════════════════════════════════════════════════════════════════ */

export function DevelopersContent() {
  const [keys, setKeys] = useState<APIKey[]>([])
  const [stats, setStats] = useState<Stats>({
    keyCount: 0, totalRequests: 0, totalCredits: 0,
    requests24h: 0, requests7d: 0, credits7d: 0,
    avgCreditsPerRequest: 0, peakHour: null, balance: 0, tier: "",
  })
  const [daily, setDaily] = useState<DailyPoint[]>([])
  const [recent, setRecent] = useState<RecentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [rawKeys, setRawKeys] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<"keys" | "traces" | "docs" | "endpoints">("keys")

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetchClient("/api/developers")
      if (res.ok) {
        const data = await res.json()
        setKeys(data.keys ?? [])
        setStats(prev => data.stats ?? prev)
        setDaily(data.daily ?? [])
        setRecent(data.recent ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  const createKey = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const res = await fetchClient("/api/developers", {
        method: "POST",
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setCreatedKey(data.key)
        setRawKeys(prev => ({ ...prev, [data.key_id]: data.key }))
        setShowCreateDialog(false)
        setNewKeyName("")
        fetchKeys()
        toast.success("API key created")
      } else {
        toast.error("Failed to create key")
      }
    } catch {
      toast.error("Failed to create key")
    } finally {
      setCreating(false)
    }
  }

  const revokeKey = async (id: string) => {
    try {
      const res = await fetchClient(`/api/developers/${id}`, { method: "DELETE" })
      if (res.ok) {
        setKeys(prev => prev.filter(k => k.id !== id))
        setRevokeId(null)
        toast.success("API key revoked")
      }
    } catch {
      toast.error("Failed to revoke key")
    }
  }

  return (
    <PageLoader isLoading={loading} title="Developer API" description="Loading your API dashboard.">
    <div className="h-full overflow-y-auto scrollbar-invisible relative bg-transparent">

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-1/4 -right-1/4 h-[600px] w-[600px] rounded-full bg-foreground/[0.02] dark:bg-foreground/[0.04] blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 h-[500px] w-[500px] rounded-full bg-foreground/[0.02] dark:bg-foreground/[0.04] blur-3xl" />
      </div>

      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6 relative">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Developer API</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <p className="text-muted-foreground text-sm">
                Integrate computer-use intelligence into your apps
              </p>
              <Link
                href="/guide?tab=api"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-foreground/[0.05] px-2.5 py-1 text-xs font-medium text-foreground/70 hover:text-foreground hover:border-border hover:bg-foreground/[0.08] transition-all"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Docs
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex h-9 items-center justify-center rounded-xl px-5 text-sm font-medium gap-2 transition-all bg-foreground text-background hover:bg-foreground/90"
            >
              <Plus className="h-4 w-4" />
              Create Key
            </button>
          </div>
        </motion.div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            <StatCard
              key="balance"
              label="Balance"
              value={stats.balance.toLocaleString()}
              subtext="credits"
              icon={Zap}
              detail={stats.tier ? `${stats.tier} plan` : "Shared balance"}
            />,
            <StatCard
              key="requests"
              label="Requests"
              value={stats.totalRequests.toLocaleString()}
              subtext="last 30d"
              icon={Terminal}
              detail={stats.requests24h > 0 ? `${stats.requests24h} today` : undefined}
              sparkData={daily.slice(-7).map(d => d.requests)}
            />,
            <StatCard
              key="credits"
              label="Credits Used"
              value={stats.totalCredits.toLocaleString()}
              subtext="last 30d"
              icon={BarChart3}
              detail={stats.avgCreditsPerRequest > 0 ? `${stats.avgCreditsPerRequest} cr/req avg` : undefined}
              sparkData={daily.slice(-7).map(d => d.credits)}
            />,
            <StatCard
              key="keys"
              label="API Keys"
              value={stats.keyCount.toLocaleString()}
              subtext="active"
              icon={Key}
              detail={stats.peakHour !== null && stats.totalRequests >= 5 ? `Peak at ${String(stats.peakHour).padStart(2, "0")}:00` : undefined}
            />,
          ].map((card, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 + i * 0.06, ease: EASE }}>
              {card}
            </motion.div>
          ))}
        </div>

        {/* ── Tab Navigation ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: EASE }}
          className="flex items-center gap-1 p-1 rounded-xl bg-foreground/[0.03] border border-border/20 w-fit"
        >
          {([
            { id: "keys" as const, label: "API Keys", icon: Key },
            { id: "traces" as const, label: "Traces", icon: BarChart3 },
            { id: "docs" as const, label: "Docs", icon: Code2 },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                activeTab === tab.id
                  ? "bg-background shadow-sm text-foreground border border-border/30"
                  : "text-muted-foreground/60 hover:text-foreground/80"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">

          {/* ════ Keys Tab ════ */}
          {activeTab === "keys" && (
            <motion.div
              key="keys"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              {keys.length === 0 ? (
                /* ── Empty State ── */
                <div className="relative rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-12 right-1/4 h-56 w-56 rounded-full bg-foreground/[0.02] blur-3xl" />
                    <div className="absolute -bottom-12 left-1/4 h-48 w-48 rounded-full bg-foreground/[0.02] blur-3xl" />
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent" />
                  </div>

                  <div className="relative flex flex-col items-center py-14 px-6 text-center">
                    <div className="flex items-center gap-2.5 mb-8">
                      {[Key, Shield, Code2, Terminal, Send, Braces].map((Icon, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: 0.15 + i * 0.04, ease: EASE }}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-background/60 text-muted-foreground/70"
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </motion.div>
                      ))}
                    </div>

                    <h3 className="text-xl font-bold mb-2">Build with Computer Use</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-10">
                      Send a screenshot, get structured mouse and keyboard actions back. Create an API key to start integrating.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10 text-left w-full max-w-lg">
                      {[
                        { icon: MousePointerClick, title: "Screenshot to Actions", desc: "Send any screenshot and get click, type, scroll actions with exact coordinates." },
                        { icon: Shield, title: "Session Memory", desc: "Stateful sessions keep trajectory history across multi-step tasks." },
                        { icon: Zap, title: "Multiple Engines", desc: "Choose V3 for speed or V1 for accuracy. Pay per request from your shared credit balance." },
                      ].map(({ icon: Icon, title, desc }, i) => (
                        <motion.div
                          key={title}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.2 + i * 0.06, ease: EASE }}
                          className="relative flex flex-col gap-2 rounded-xl p-4 overflow-hidden border border-border/30 bg-card/50 backdrop-blur-sm"
                        >
                          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent" />
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <p className="text-xs font-semibold text-foreground/80">{title}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                        </motion.div>
                      ))}
                    </div>

                    <button
                      onClick={() => setShowCreateDialog(true)}
                      className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all text-background bg-foreground hover:bg-foreground/90 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Plus className="h-4 w-4" />
                      Create your first API key
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {keys.map((k, i) => (
                      <APIKeyCard key={k.id} apiKey={k} index={i} fullKey={rawKeys[k.id]} onRevoke={(id) => setRevokeId(id)} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

          {/* ════ Traces Tab ════ */}
          {activeTab === "traces" && (
            <motion.div
              key="traces"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="space-y-5"
            >
              {/* Activity chart */}
              <ActivityChart daily={daily} />

              {/* Request log */}
              <div className="relative rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent" />
                <div className="px-5 py-3 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">Request Log</span>
                  {recent.length > 0 && (
                    <span className="text-[10px] text-muted-foreground/35">Last {recent.length}</span>
                  )}
                </div>

                {recent.length > 0 ? (
                  <div className="divide-y divide-border/10">
                    {recent.map((r, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.03 * i, ease: EASE }}
                        className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-foreground/[0.015]"
                      >
                        <span className={cn(
                          "shrink-0 w-12 text-center text-[10px] font-bold tracking-wider py-0.5 rounded",
                          r.endpoint.startsWith("session") ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : r.endpoint === "ground" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : r.endpoint === "ocr" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}>
                          {r.endpoint === "predict" ? "PRED" : r.endpoint === "session_predict" ? "S/PRED" : r.endpoint === "session_create" ? "S/NEW" : r.endpoint.slice(0, 5).toUpperCase()}
                        </span>
                        <span className="text-[11px] text-muted-foreground/60 flex-1 truncate">{r.endpoint.replace(/_/g, " ")}</span>
                        <span className="text-[10px] text-muted-foreground/40 tabular-nums">{r.credits} cr</span>
                        <span className="text-[10px] text-muted-foreground/30 tabular-nums w-14 text-right">{timeAgo(r.time)}</span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 pb-6 pt-3 flex flex-col items-center text-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/15 mb-3" strokeWidth={1} />
                    <p className="text-[11px] text-muted-foreground/30">
                      API requests will appear here as you make calls
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ════ Docs Tab (shared APITab from guide) ════ */}
          {activeTab === "docs" && (
            <motion.div
              key="docs"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <APITab inApp />
            </motion.div>
          )}


        </AnimatePresence>
      </div>

      {/* ── Create Dialog ── */}
      <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm sm:text-base">Create API Key</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Give your key a name to identify it later. The secret key will only be shown once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 sm:py-3">
            <input
              autoFocus
              type="text"
              placeholder="e.g. Production, My RPA Bot, Testing"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createKey()}
              className={cn(
                "w-full h-9 sm:h-10 px-3 rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm text-xs sm:text-sm",
                "placeholder:text-muted-foreground/50",
                "focus:outline-none focus:ring-1 focus:ring-ring focus:border-border/60",
                "transition-all duration-200"
              )}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs sm:text-sm">Cancel</AlertDialogCancel>
            <Button className="text-xs sm:text-sm" onClick={createKey} disabled={creating || !newKeyName.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Created Key (shown once) ── */}
      <AlertDialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg gap-0 p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4">
            <AlertDialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              Your API key is ready
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-1.5 text-xs sm:text-[13px]">
              Save this key somewhere safe. It won&apos;t be shown again.
            </AlertDialogDescription>
          </div>

          {/* Key + Copy */}
          <div className="px-4 sm:px-6 pb-3 sm:pb-4 space-y-2">
            <input
              readOnly
              value={createdKey ?? ""}
              onFocus={e => e.target.select()}
              className={cn(
                "w-full px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg font-mono text-[10px] sm:text-xs",
                "bg-muted/40 border border-border/30 text-foreground/80",
                "focus:outline-none focus:ring-1 focus:ring-ring cursor-text",
              )}
            />
            <Button
              className="w-full gap-2 text-xs sm:text-sm"
              onClick={() => {
                if (!createdKey) return
                copyToClipboard(createdKey).then(() => {
                  setCopiedKey(true)
                  toast.success("Copied to clipboard")
                  setTimeout(() => setCopiedKey(false), 2000)
                }).catch(() => {
                  const input = document.querySelector<HTMLInputElement>("input[readonly]")
                  if (input) { input.focus(); input.select() }
                  toast.info("Press Ctrl+C to copy")
                })
              }}
            >
              {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedKey ? "Copied" : "Copy API Key"}
            </Button>
          </div>

          {/* Quick start snippet with language selector */}
          <CreatedKeySnippet apiKey={createdKey ?? ""} onCopy={copyToClipboard} />

          {/* Footer */}
          <div className="border-t border-border/20 px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
            <AlertDialogCancel className="text-xs h-8">Close</AlertDialogCancel>
            <AlertDialogAction
              className="gap-1.5 text-xs h-8"
              onClick={() => {
                setCreatedKey(null)
                setActiveTab("docs")
              }}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">View Full</span> Docs
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Revoke Confirm ── */}
      <AlertDialog open={!!revokeId} onOpenChange={(o) => !o && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This key will immediately stop working. Any applications using it will fail. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeId && revokeKey(revokeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
    </PageLoader>
  )
}
