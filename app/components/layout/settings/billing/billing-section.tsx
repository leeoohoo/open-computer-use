"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { useCredits } from "@/lib/hooks/use-credits"
import { useUser } from "@/lib/user-store/provider"
import {
  ShoppingCart,
  ArrowUp,
  CheckCircle,
  XCircle,
  Spinner,
  CreditCard,
  Receipt,
  Coins,
  TrendUp,
  TrendDown,
  CalendarBlank,
  Lightning,
  Clock,
  ChartLine,
  Funnel,
  Export,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import {
  Check,
  Zap,
  ArrowRight,
  HardDrive,
  ChevronDown,
  Activity,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { CoastyIcon } from "@/components/icons/coasty"
import { motion } from "framer-motion"

// ─── Plan & Package Data ────────────────────────────────────────────────────

const subscriptionPlans = [
  {
    id: "lite",
    name: "Lite",
    tier: "lite",
    price: 9,
    monthlyCredits: 100,
    machines: 1,
    swarm: 2,
    description: "Light daily automation",
    features: [
      "1 VM (deleted after inactivity)",
      "2 agents in parallel",
      "Basic search",
      "Standard support (real humans)",
    ],
    popular: false,
  },
  {
    id: "starter",
    name: "Starter",
    tier: "starter",
    price: 19,
    monthlyCredits: 200,
    machines: 1,
    swarm: 3,
    description: "Automate tasks every day",
    features: [
      "1 always-on VM",
      "3 agents in parallel",
      "Advanced search & extraction",
      "Standard support (real humans)",
    ],
    popular: false,
  },
  {
    id: "professional",
    name: "Plus",
    tier: "professional",
    price: 50,
    monthlyCredits: 600,
    machines: 2,
    swarm: 6,
    description: "Scale complex workflows",
    features: [
      "2 always-on VMs",
      "6 agents in parallel",
      "Advanced search & extraction",
      "Priority support, 24hr response",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Pro",
    tier: "enterprise",
    price: 100,
    monthlyCredits: 1500,
    machines: 3,
    swarm: 9,
    description: "Unlimited heavy automation",
    features: [
      "3 always-on VMs",
      "9 agents in parallel",
      "Advanced search & extraction",
      "Premium support, 12hr response",
    ],
    popular: false,
  },
]

const additionalCreditPackages = [
  {
    id: "boost-small",
    name: "Small Boost",
    credits: 100,
    price: 9,
    agentMinutes: 10,
    description: "Quick top-up",
  },
  {
    id: "boost-medium",
    name: "Medium Boost",
    credits: 300,
    price: 25,
    agentMinutes: 30,
    description: "Standard refill",
    savings: "8% savings",
  },
  {
    id: "boost-large",
    name: "Large Boost",
    credits: 600,
    price: 45,
    agentMinutes: 60,
    description: "Bulk purchase",
    savings: "17% savings",
  },
]

// ─── Types ──────────────────────────────────────────────────────────────────

interface Transaction {
  id: string
  type: "purchase" | "usage" | "refund" | "bonus" | "subscription" | "subscription_grant" | "subscription_renewal" | "subscription_reactivation"
  amount: number
  balance_after: number
  created_at: string
  usage_description?: string
  price_paid?: number
}

interface UserSubscription {
  id: string
  status: string
  tier?: string
  current_period_end?: string
  cancel_at_period_end: boolean
  created_at?: string
}

type TimeRange = "7d" | "30d" | "90d" | "all"
type TransactionFilter = "all" | "purchase" | "usage" | "refund" | "bonus" | "subscription"

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTimeRangeDate(range: TimeRange): Date | null {
  if (range === "all") return null
  const now = new Date()
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatShortDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function formatRelativeDate(dateString: string) {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return formatShortDate(dateString)
}

// ─── Custom SVG Chart ───────────────────────────────────────────────────────

interface ChartDataPoint {
  date: string
  earned: number
  spent: number
  balance: number
}

function formatAxisValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return value.toLocaleString()
}

function computeNiceTicks(maxVal: number, count: number): number[] {
  if (maxVal <= 0) return [0]
  const rough = maxVal / count
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const residual = rough / mag
  const nice = residual <= 1.5 ? 1 : residual <= 3 ? 2 : residual <= 7 ? 5 : 10
  const step = nice * mag
  const ticks: number[] = []
  for (let v = 0; v <= maxVal + step * 0.01; v += step) {
    ticks.push(Math.round(v))
  }
  return ticks
}

// Build a smooth cubic bezier spline through points
function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(i + 2, pts.length - 1)]
    const tension = 0.3
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

function UsageChart({
  data,
  height = 240,
  chartView = "area",
}: {
  data: ChartDataPoint[]
  height?: number
  chartView?: "area" | "bar"
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (data.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center text-muted-foreground/30 gap-2"
        style={{ height }}
      >
        <ChartLine className="h-8 w-8" weight="thin" />
        <span className="text-xs">No activity in this period</span>
      </div>
    )
  }

  const vbW = 640
  const vbH = height
  const padding = { top: 20, right: 20, bottom: 36, left: 54 }
  const chartH = vbH - padding.top - padding.bottom
  const chartW = vbW - padding.left - padding.right

  const maxVal = Math.max(...data.map((d) => Math.max(d.earned, d.spent, 1)), 1)

  // ── Shared axis rendering ──
  const renderYAxis = (ticks: number[], axisMax: number) =>
    ticks.map((tick) => {
      const y = padding.top + chartH - (tick / axisMax) * chartH
      return (
        <g key={tick}>
          <line
            x1={padding.left}
            x2={vbW - padding.right}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeOpacity={tick === 0 ? 0.15 : 0.08}
            strokeWidth={0.5}
          />
          <text
            x={padding.left - 10}
            y={y + 3.5}
            textAnchor="end"
            fontSize={9.5}
            fill="currentColor"
            fillOpacity={0.5}
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight={400}
          >
            {formatAxisValue(tick)}
          </text>
        </g>
      )
    })

  const renderXAxis = () => {
    const step = Math.max(1, Math.ceil(data.length / 8))
    return data.map((d, i) => {
      if (i % step !== 0 && i !== data.length - 1) return null
      const x = chartView === "bar"
        ? padding.left + (i + 0.5) * (chartW / data.length)
        : padding.left + (i / Math.max(data.length - 1, 1)) * chartW
      return (
        <text
          key={i}
          x={x}
          y={vbH - 10}
          textAnchor="middle"
          fontSize={9}
          fill="currentColor"
          fillOpacity={0.5}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight={400}
        >
          {formatShortDate(d.date)}
        </text>
      )
    })
  }

  const renderTooltip = (leftPct: number, topPx: number, d: ChartDataPoint, showBalance: boolean) => (
    <div
      className="absolute z-20 pointer-events-none"
      style={{ left: `${leftPct}%`, top: topPx, transform: "translateX(-50%)" }}
    >
      <div className="bg-popover/95 backdrop-blur-md border border-border/40 rounded-xl shadow-xl shadow-black/5 px-3.5 py-2.5 text-xs space-y-1.5 min-w-[130px]">
        <div className="font-medium text-foreground/70 text-[10px] uppercase tracking-wider">
          {formatShortDate(d.date)}
        </div>
        {showBalance && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span className="text-muted-foreground/70">Balance</span>
            </div>
            <span className="font-semibold text-foreground tabular-nums">{d.balance.toLocaleString()}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground/70">Earned</span>
          </div>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">+{d.earned.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-muted-foreground/70">Used</span>
          </div>
          <span className="font-semibold text-rose-500 dark:text-rose-400 tabular-nums">-{d.spent.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )

  // ── Bar chart ──
  if (chartView === "bar") {
    const ticks = computeNiceTicks(maxVal, 4)
    const axisMax = ticks[ticks.length - 1] || maxVal
    const barGroupWidth = chartW / data.length
    const barW = Math.min(barGroupWidth * 0.32, 14)
    const gap = Math.max(barW * 0.2, 1.5)

    return (
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
          <defs>
            <linearGradient id="barEarnedGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="rgb(52, 211, 153)" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="barSpentGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgb(225, 29, 72)" stopOpacity={0.75} />
              <stop offset="100%" stopColor="rgb(251, 113, 133)" stopOpacity={0.95} />
            </linearGradient>
          </defs>

          {renderYAxis(ticks, axisMax)}

          {data.map((d, i) => {
            const cx = padding.left + (i + 0.5) * barGroupWidth
            const earnedH = (d.earned / axisMax) * chartH
            const spentH = (d.spent / axisMax) * chartH
            const isHovered = hoveredIndex === i

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                <rect x={cx - barGroupWidth / 2} y={padding.top} width={barGroupWidth} height={chartH} fill="transparent" />
                {isHovered && (
                  <rect x={cx - barGroupWidth / 2} y={padding.top} width={barGroupWidth} height={chartH} fill="currentColor" fillOpacity={0.04} rx={4} />
                )}
                {/* Earned */}
                <rect
                  x={cx - gap / 2 - barW}
                  y={padding.top + chartH - earnedH}
                  width={barW}
                  height={Math.max(earnedH, 0)}
                  rx={barW / 3}
                  fill="url(#barEarnedGrad)"
                  fillOpacity={isHovered ? 1 : 0.85}
                  style={{ transition: "fill-opacity 0.15s ease" }}
                />
                {/* Spent */}
                <rect
                  x={cx + gap / 2}
                  y={padding.top + chartH - spentH}
                  width={barW}
                  height={Math.max(spentH, 0)}
                  rx={barW / 3}
                  fill="url(#barSpentGrad)"
                  fillOpacity={isHovered ? 1 : 0.8}
                  style={{ transition: "fill-opacity 0.15s ease" }}
                />
              </g>
            )
          })}

          {renderXAxis()}
        </svg>

        {hoveredIndex !== null && data[hoveredIndex] && renderTooltip(
          ((padding.left + (hoveredIndex + 0.5) * barGroupWidth) / vbW) * 100,
          6,
          data[hoveredIndex],
          false,
        )}
      </div>
    )
  }

  // ── Area chart (default) ──
  const maxBalance = Math.max(...data.map((d) => d.balance), 1)
  const balanceTicks = computeNiceTicks(maxBalance, 4)
  const balanceAxisMax = balanceTicks[balanceTicks.length - 1] || maxBalance

  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padding.top + chartH - (d.balance / balanceAxisMax) * chartH,
  }))

  const smoothLine = buildSmoothPath(points)
  const lastPt = points[points.length - 1]
  const firstPt = points[0]
  const smoothArea = `${smoothLine} L ${lastPt.x} ${padding.top + chartH} L ${firstPt.x} ${padding.top + chartH} Z`

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
        <defs>
          <linearGradient id="fadeMask" gradientUnits="userSpaceOnUse" x1="0" y1={padding.top} x2="0" y2={padding.top + chartH}>
            <stop offset="0%" stopColor="white" />
            <stop offset="50%" stopColor="white" stopOpacity={0.5} />
            <stop offset="85%" stopColor="white" stopOpacity={0.1} />
            <stop offset="100%" stopColor="white" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(129, 140, 248)" />
            <stop offset="50%" stopColor="rgb(99, 102, 241)" />
            <stop offset="100%" stopColor="rgb(79, 70, 229)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {renderYAxis(balanceTicks, balanceAxisMax)}

        {/* Area fill */}
        <mask id="areaMask">
          <rect x={padding.left} y={padding.top} width={chartW} height={chartH} fill="url(#fadeMask)" />
        </mask>
        <path d={smoothArea} fill="#818cf8" opacity={0.35} mask="url(#areaMask)" />

        {/* Glow line */}
        <path
          d={smoothLine}
          fill="none"
          stroke="rgb(99, 102, 241)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.2}
          filter="url(#glow)"
        />

        {/* Main line */}
        <path
          d={smoothLine}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={1}
        />

        {/* Hover interaction layer */}
        {points.map((p, i) => (
          <g
            key={i}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="cursor-pointer"
          >
            <rect
              x={p.x - chartW / data.length / 2}
              y={padding.top}
              width={chartW / data.length}
              height={chartH}
              fill="transparent"
            />
            {hoveredIndex === i && (
              <>
                <line
                  x1={p.x} x2={p.x}
                  y1={p.y} y2={padding.top + chartH}
                  stroke="rgb(99, 102, 241)"
                  strokeOpacity={0.3}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {/* Outer glow ring */}
                <circle cx={p.x} cy={p.y} r={8} fill="rgb(99, 102, 241)" fillOpacity={0.18} />
                {/* Dot */}
                <circle cx={p.x} cy={p.y} r={4.5} fill="rgb(99, 102, 241)" stroke="white" strokeWidth={2} />
              </>
            )}
          </g>
        ))}

        {renderXAxis()}
      </svg>

      {hoveredIndex !== null && data[hoveredIndex] && renderTooltip(
        (points[hoveredIndex].x / vbW) * 100,
        Math.max((points[hoveredIndex].y / vbH) * height - 12, 0),
        data[hoveredIndex],
        true,
      )}
    </div>
  )
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  trendLabel,
  accent = "default",
}: {
  label: string
  value: string
  subtext?: string
  icon: React.ElementType
  trend?: "up" | "down" | "neutral"
  trendLabel?: string
  accent?: "default" | "green" | "red" | "blue" | "purple"
}) {
  const accentMap = {
    default: { icon: "text-foreground/50", bg: "bg-foreground/[0.04]" },
    green: { icon: "text-emerald-500", bg: "bg-emerald-500/[0.08]" },
    red: { icon: "text-rose-500", bg: "bg-rose-500/[0.08]" },
    blue: { icon: "text-blue-500", bg: "bg-blue-500/[0.08]" },
    purple: { icon: "text-indigo-500", bg: "bg-indigo-500/[0.08]" },
  }
  const a = accentMap[accent]

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4 flex flex-col min-h-[120px]">
      <div className="flex items-center justify-between mb-auto">
        <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
          {label}
        </span>
        <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", a.bg)}>
          <Icon className={cn("h-3.5 w-3.5", a.icon)} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[22px] font-bold tracking-tight text-foreground leading-none">
            {value}
          </span>
          {subtext && (
            <span className="text-[11px] text-muted-foreground/50 leading-none">{subtext}</span>
          )}
        </div>
        <div className="h-4 mt-1.5">
          {trend && trendLabel ? (
            <div className="flex items-center gap-1">
              {trend === "up" ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              ) : trend === "down" ? (
                <ArrowDownRight className="h-3 w-3 text-rose-500" />
              ) : (
                <Activity className="h-3 w-3 text-muted-foreground/40" />
              )}
              <span
                className={cn(
                  "text-[10px] leading-none",
                  trend === "up"
                    ? "text-emerald-600 dark:text-emerald-500"
                    : trend === "down"
                    ? "text-rose-600 dark:text-rose-500"
                    : "text-muted-foreground/50"
                )}
              >
                {trendLabel}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Transaction Row ────────────────────────────────────────────────────────

function TransactionRow({ transaction, isLast }: { transaction: Transaction; isLast: boolean }) {
  const isPositive = transaction.amount > 0

  const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    purchase: { icon: ShoppingCart, color: "text-green-500 bg-green-500/10", label: "Credit Purchase" },
    usage: { icon: Activity, color: "text-blue-500 bg-blue-500/10", label: "Agent Usage" },
    refund: { icon: ArrowDownRight, color: "text-amber-500 bg-amber-500/10", label: "Refund" },
    bonus: { icon: Lightning, color: "text-purple-500 bg-purple-500/10", label: "Bonus Reward" },
    subscription: { icon: CreditCard, color: "text-indigo-500 bg-indigo-500/10", label: "Subscription" },
    subscription_grant: { icon: Zap, color: "text-indigo-500 bg-indigo-500/10", label: "Subscription Grant" },
    subscription_renewal: { icon: Clock, color: "text-indigo-500 bg-indigo-500/10", label: "Renewal Credits" },
    subscription_reactivation: { icon: CheckCircle, color: "text-green-500 bg-green-500/10", label: "Reactivation" },
  }

  const config = typeConfig[transaction.type] || {
    icon: Coins,
    color: "text-muted-foreground bg-muted",
    label: transaction.type,
  }
  const Icon = config.icon

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors",
        !isLast && "border-b border-border/30"
      )}
    >
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", config.color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground/50">
            {formatRelativeDate(transaction.created_at)}
          </span>
          {transaction.usage_description && (
            <>
              <span className="text-muted-foreground/20">·</span>
              <span className="text-[11px] text-muted-foreground/50 truncate">
                {transaction.usage_description}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={cn(
            "text-sm font-semibold tabular-nums",
            isPositive
              ? "text-green-600 dark:text-green-500"
              : "text-red-500 dark:text-red-400"
          )}
        >
          {isPositive ? "+" : ""}
          {transaction.amount.toLocaleString()}
        </div>
        {transaction.price_paid ? (
          <div className="text-[11px] text-muted-foreground/40 tabular-nums">
            ${transaction.price_paid}
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground/30 tabular-nums">
            bal {transaction.balance_after?.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function BillingSection() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { credits, loading: creditsLoading, refetch: refetchCredits } = useCredits()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(true)
  const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(true)
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState(2)

  // Chart & filter state
  const [timeRange, setTimeRange] = useState<TimeRange>("30d")
  const [typeFilter, setTypeFilter] = useState<TransactionFilter>("all")
  const [showAllTransactions, setShowAllTransactions] = useState(false)
  const [chartView, setChartView] = useState<"area" | "bar">("area")

  // Fetch subscription status
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user) return
      try {
        const response = await fetch("/api/subscription/status")
        if (response.ok) {
          const data = await response.json()
          setSubscription(data.subscription)
        }
      } catch (error) {
        console.error("Error fetching subscription:", error)
      } finally {
        setLoadingSubscription(false)
      }
    }
    fetchSubscription()
  }, [user])

  // Check for success/cancel from Stripe
  useEffect(() => {
    const success = searchParams.get("payment_success")
    const canceled = searchParams.get("payment_canceled")
    const subscriptionSuccess = searchParams.get("subscription_success")

    if (success === "true") {
      toast.success("Payment successful! Your credits have been added.")
      refetchCredits()
      window.history.replaceState({}, "", window.location.pathname)
    } else if (subscriptionSuccess === "true") {
      toast.success("Subscription activated successfully!")
      refetchCredits()
      window.location.reload()
    } else if (canceled === "true") {
      toast.error("Payment was canceled. No charges were made.")
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [searchParams, refetchCredits])

  // Fetch all transactions (up to 500 for chart)
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) return
      try {
        const response = await fetch("/api/credits/history?limit=500")
        if (!response.ok) throw new Error("Failed to fetch transactions")
        const data = await response.json()
        setTransactions(data.transactions)
      } catch (error) {
        console.error("Error fetching transactions:", error)
      } finally {
        setLoadingTransactions(false)
      }
    }
    fetchTransactions()
  }, [user])

  // ─── Computed data ──────────────────────────────────────────────────────

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions]
    const rangeDate = getTimeRangeDate(timeRange)
    if (rangeDate) {
      filtered = filtered.filter((t) => new Date(t.created_at) >= rangeDate)
    }
    if (typeFilter !== "all") {
      filtered = filtered.filter((t) => {
        if (typeFilter === "subscription") {
          return t.type.startsWith("subscription")
        }
        return t.type === typeFilter
      })
    }
    return filtered
  }, [transactions, timeRange, typeFilter])

  const chartData = useMemo<ChartDataPoint[]>(() => {
    const rangeDate = getTimeRangeDate(timeRange)
    const relevant = rangeDate
      ? transactions.filter((t) => new Date(t.created_at) >= rangeDate)
      : transactions

    if (relevant.length === 0) return []

    // Group by day
    const dayMap = new Map<string, { earned: number; spent: number; balance: number }>()
    // Sort ascending for balance tracking
    const sorted = [...relevant].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    for (const t of sorted) {
      const day = new Date(t.created_at).toISOString().split("T")[0]
      const existing = dayMap.get(day) || { earned: 0, spent: 0, balance: 0 }
      if (t.amount > 0) {
        existing.earned += t.amount
      } else {
        existing.spent += Math.abs(t.amount)
      }
      existing.balance = t.balance_after
      dayMap.set(day, existing)
    }

    // Fill gaps for smoother chart
    const days = Array.from(dayMap.keys()).sort()
    if (days.length === 0) return []

    const result: ChartDataPoint[] = []
    const start = new Date(days[0])
    const end = new Date(days[days.length - 1])
    let lastBalance = dayMap.get(days[0])?.balance || 0

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0]
      const entry = dayMap.get(key)
      if (entry) {
        lastBalance = entry.balance
        result.push({ date: key, ...entry })
      } else {
        result.push({ date: key, earned: 0, spent: 0, balance: lastBalance })
      }
    }

    return result
  }, [transactions, timeRange])

  const stats = useMemo(() => {
    const rangeDate = getTimeRangeDate(timeRange)
    const relevant = rangeDate
      ? transactions.filter((t) => new Date(t.created_at) >= rangeDate)
      : transactions

    const totalEarned = relevant.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
    const totalSpent = relevant.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const netChange = totalEarned - totalSpent
    const avgDailyUsage =
      relevant.length > 0
        ? totalSpent / Math.max(chartData.length, 1)
        : 0

    // Estimate days remaining at current rate
    const currentBalance = credits?.balance || 0
    const daysRemaining = avgDailyUsage > 0 ? Math.floor(currentBalance / avgDailyUsage) : null

    // Usage sessions count
    const usageSessions = relevant.filter((t) => t.type === "usage").length

    return { totalEarned, totalSpent, netChange, avgDailyUsage, daysRemaining, usageSessions }
  }, [transactions, timeRange, chartData, credits])

  // Subscription plan info
  const activePlan = subscription
    ? subscriptionPlans.find((p) => p.tier === subscription.tier)
    : null

  const creditUsagePercent = activePlan
    ? Math.min(
        100,
        ((activePlan.monthlyCredits - (credits?.balance || 0)) / activePlan.monthlyCredits) * 100
      )
    : 0

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleSubscribe = async (planId: string, tier: string, price: number) => {
    if (!user) {
      toast.error("Please sign in to subscribe")
      return
    }
    try {
      setSubscribingPlan(planId)
      const response = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, tier, price }),
      })
      if (!response.ok) throw new Error("Failed to create subscription checkout")
      const { url } = await response.json()
      if (url) window.location.href = url
    } catch (error) {
      console.error("Error creating subscription checkout:", error)
      toast.error("Failed to start subscription checkout. Please try again.")
    } finally {
      setSubscribingPlan(null)
    }
  }

  const handlePurchaseCredits = async (packageId: string, credits: number, price: number) => {
    if (!user) {
      toast.error("Please sign in to purchase credits")
      return
    }
    if (!subscription || subscription.status !== "active") {
      toast.error("You need an active subscription to purchase additional credits")
      return
    }
    try {
      setPurchasingPackage(packageId)
      const response = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, credits, price }),
      })
      if (!response.ok) throw new Error("Failed to create checkout session")
      const { url } = await response.json()
      if (url) window.location.href = url
    } catch (error) {
      console.error("Error creating checkout session:", error)
      toast.error("Failed to start checkout. Please try again.")
    } finally {
      setPurchasingPackage(null)
    }
  }

  const handleManageSubscription = async () => {
    try {
      const response = await fetch("/api/subscription/portal", { method: "POST" })
      if (!response.ok) throw new Error("Failed to create portal session")
      const { url } = await response.json()
      if (url) window.location.href = url
    } catch (error) {
      console.error("Error creating portal session:", error)
      toast.error("Failed to open subscription management. Please try again.")
    }
  }

  const handleExportCSV = useCallback(() => {
    if (filteredTransactions.length === 0) return
    const headers = "Date,Type,Amount,Balance After,Description,Price Paid"
    const rows = filteredTransactions.map((t) =>
      [
        new Date(t.created_at).toISOString(),
        t.type,
        t.amount,
        t.balance_after,
        `"${(t.usage_description || "").replace(/"/g, '""')}"`,
        t.price_paid || "",
      ].join(",")
    )
    const csv = [headers, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `coasty-transactions-${timeRange}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Transactions exported")
  }, [filteredTransactions, timeRange])

  const plan = subscriptionPlans[selectedPlan]

  // ─── Animation helpers ──────────────────────────────────────────────────

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const },
  })

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ─── Overview Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          <StatCard
            key="balance"
            label="Balance"
            value={creditsLoading ? "..." : (credits?.balance || 0).toLocaleString()}
            subtext="credits"
            icon={Wallet}
            accent="purple"
            trend={stats.netChange > 0 ? "up" : stats.netChange < 0 ? "down" : "neutral"}
            trendLabel={stats.daysRemaining !== null ? `~${stats.daysRemaining}d at current rate` : undefined}
          />,
          <StatCard
            key="earned"
            label="Earned"
            value={`+${stats.totalEarned.toLocaleString()}`}
            subtext={timeRange === "all" ? "all time" : `last ${timeRange.replace("d", " days")}`}
            icon={TrendUp}
            accent="green"
          />,
          <StatCard
            key="used"
            label="Used"
            value={stats.totalSpent.toLocaleString()}
            subtext={`${stats.usageSessions} sessions`}
            icon={Activity}
            accent="red"
            trend={stats.avgDailyUsage > 0 ? "neutral" : undefined}
            trendLabel={stats.avgDailyUsage > 0 ? `~${Math.round(stats.avgDailyUsage)}/day avg` : undefined}
          />,
          <StatCard
            key="plan"
            label="Plan"
            value={activePlan?.name || "Free"}
            subtext={activePlan ? `$${activePlan.price}/mo` : "No plan"}
            icon={CoastyIcon}
            accent="blue"
            trend={subscription?.cancel_at_period_end ? "down" : undefined}
            trendLabel={subscription?.cancel_at_period_end ? "Canceling" : undefined}
          />,
        ].map((card, i) => (
          <motion.div key={i} {...fadeUp(i * 0.06)}>
            {card}
          </motion.div>
        ))}
      </div>

      {/* ─── Usage Progress (subscribed users) ───────────────────────────── */}
      {activePlan && (
        <motion.div {...fadeUp(0.25)} className="rounded-xl border border-border/40 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-sm font-medium">Monthly Credit Usage</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {(credits?.balance || 0).toLocaleString()} / {activePlan.monthlyCredits.toLocaleString()} remaining
            </span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-muted/60 overflow-hidden">
            <motion.div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                creditUsagePercent > 90
                  ? "bg-red-500"
                  : creditUsagePercent > 70
                  ? "bg-amber-500"
                  : "bg-primary"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${creditUsagePercent}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-muted-foreground/50">
              {Math.round(creditUsagePercent)}% used this period
            </span>
            {subscription?.current_period_end && (
              <span className="text-[11px] text-muted-foreground/50">
                Renews {formatDate(subscription.current_period_end)}
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── Subscription / Plans / Buy Credits ──────────────────────────── */}
      {!subscription || subscription.status !== "active" ? (
        <motion.div {...fadeUp(0.3)}>
          <h4 className="text-base font-semibold mb-1">Choose Your Plan</h4>
          <p className="text-sm text-muted-foreground mb-6">
            Subscribe to unlock AI features and get monthly credits
          </p>

          {/* Plan pills */}
          <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
            {subscriptionPlans.map((p, i) => (
              <button
                key={p.name}
                onClick={() => setSelectedPlan(i)}
                className={cn(
                  "relative rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 px-4 py-2.5",
                  selectedPlan === i
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {p.name}
                <span
                  className={cn(
                    "text-xs font-normal",
                    selectedPlan === i
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground/60"
                  )}
                >
                  ${p.price}
                </span>
                {p.popular && selectedPlan !== i && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Savings pill */}
          {(() => {
            const humanCost =
              plan.price === 9
                ? 1000
                : plan.price === 19
                ? 1500
                : plan.price === 50
                ? 3000
                : 5000
            const moneySaved = (humanCost - plan.price).toLocaleString()
            const timeSaved =
              plan.price === 9
                ? "3-6 hrs"
                : plan.price === 19
                ? "6-12 hrs"
                : plan.price === 50
                ? "18-24 hrs"
                : "24-36 hrs"
            const multiplier =
              plan.price === 9
                ? "111x"
                : plan.price === 19
                ? "79x"
                : plan.price === 50
                ? "60x"
                : "50x"
            return (
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-3 rounded-full border border-border bg-muted/40 px-4 py-2 flex-wrap justify-center">
                  <span className="text-xs text-muted-foreground">
                    Save{" "}
                    <span className="font-semibold text-foreground">
                      ${moneySaved}/mo
                    </span>{" "}
                    vs human
                  </span>
                  <span className="h-3 w-px bg-border hidden sm:block" />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{timeSaved}</span>{" "}
                    saved monthly
                  </span>
                  <span className="h-3 w-px bg-border hidden sm:block" />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{multiplier}</span>{" "}
                    cheaper
                  </span>
                </div>
              </div>
            )
          })()}

          {/* Plan card */}
          <div
            className={cn(
              "relative rounded-xl border p-6",
              plan.popular
                ? "border-primary/30 bg-gradient-to-b from-primary/[0.06] to-primary/[0.02] shadow-sm shadow-primary/10"
                : "border-border"
            )}
          >
            {plan.popular && (
              <div className="absolute -top-2.5 left-4">
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                  Most Popular
                </span>
              </div>
            )}

            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <CoastyIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-primary">
                    Coasty {plan.name}
                  </h3>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-foreground">
                    ${plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2 rounded-lg bg-primary/[0.08] border border-primary/10 px-3 py-2">
              <Zap className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="text-sm font-medium text-foreground">
                {plan.monthlyCredits.toLocaleString()} credits
                <span className="text-muted-foreground font-normal">/month</span>
              </span>
            </div>

            <div className="mb-5 flex items-center gap-2 rounded-lg bg-violet-500/[0.08] border border-violet-500/15 px-3 py-2">
              <HardDrive className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
              <span className="text-sm font-medium text-foreground">
                {plan.id === "lite"
                  ? "1 VM (deleted after inactivity)"
                  : `${plan.machines} always-on VM${plan.machines > 1 ? "s" : ""}`}
              </span>
            </div>

            <Button
              className={cn(
                "w-full mb-5",
                !plan.popular && "hover:bg-primary hover:text-primary-foreground"
              )}
              variant={plan.popular ? "default" : "outline"}
              size="sm"
              onClick={() => handleSubscribe(plan.id, plan.tier, plan.price)}
              disabled={subscribingPlan === plan.id}
            >
              {subscribingPlan === plan.id ? (
                <>
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Subscribe to {plan.name}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {plan.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Active Subscription Card */}
          <motion.div {...fadeUp(0.3)} className="rounded-xl border border-green-500/20 bg-gradient-to-b from-green-500/[0.04] to-transparent p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">
                    {activePlan?.name || "Active Plan"}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    ${activePlan?.price || 0}/month
                    {activePlan && (
                      <span className="text-muted-foreground/50">
                        {" · "}{activePlan.monthlyCredits} credits/mo
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleManageSubscription}
                className="hover:bg-primary hover:text-primary-foreground w-full sm:w-auto"
              >
                <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                Manage
              </Button>
            </div>

            <div className="mt-4 pt-3 border-t border-green-500/10 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                {subscription.cancel_at_period_end ? (
                  <>
                    <XCircle className="h-3 w-3 text-yellow-600" />
                    <span className="text-yellow-600">
                      Cancels{" "}
                      {subscription.current_period_end
                        ? new Date(subscription.current_period_end).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="text-green-600">
                      Renews{" "}
                      {subscription.current_period_end
                        ? new Date(subscription.current_period_end).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </>
                )}
              </div>
            </div>

            <details className="mt-3 group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                View plan features
                <ArrowRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activePlan?.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="h-3 w-3 text-green-500 mt-0.5" />
                    <span className="text-xs text-muted-foreground">{feature}</span>
                  </div>
                )) || []}
              </div>
            </details>
          </motion.div>

          {/* Additional Credits */}
          <motion.div {...fadeUp(0.4)}>
            <h4 className="text-base font-semibold mb-1">Need More Credits?</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Purchase additional credits anytime
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {additionalCreditPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">
                      {pkg.name}
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      ${pkg.price}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      {pkg.credits.toLocaleString()} credits
                    </span>
                    {pkg.savings && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20 ml-1"
                      >
                        {pkg.savings}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {pkg.description}
                  </p>
                  <Button
                    size="sm"
                    className="w-full hover:bg-primary hover:text-primary-foreground"
                    variant="outline"
                    onClick={() =>
                      handlePurchaseCredits(pkg.id, pkg.credits, pkg.price)
                    }
                    disabled={purchasingPackage === pkg.id}
                  >
                    {purchasingPackage === pkg.id ? (
                      <>
                        <Spinner className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Add Credits
                        <ArrowRight className="ml-1.5 h-3 w-3" />
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}

      {/* ─── Usage Chart ─────────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0.45)} className="rounded-xl border border-border/30 bg-card/20 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-5 pb-1">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-indigo-500/[0.08] flex items-center justify-center shrink-0">
              <ChartLine className="h-3.5 w-3.5 text-indigo-500" weight="bold" />
            </div>
            <span className="text-sm font-semibold">Credit Activity</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Chart view toggle */}
            <div className="flex items-center rounded-lg bg-muted/30 p-0.5">
              {(["area", "bar"] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setChartView(view)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-medium rounded-md transition-all duration-150 capitalize",
                    chartView === view
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground/40 hover:text-muted-foreground/70"
                  )}
                >
                  {view}
                </button>
              ))}
            </div>
            {/* Time range pills */}
            <div className="flex items-center rounded-lg bg-muted/30 p-0.5">
              {(["7d", "30d", "90d", "all"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-medium rounded-md transition-all duration-150",
                    timeRange === range
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground/40 hover:text-muted-foreground/70"
                  )}
                >
                  {range === "all" ? "All" : range}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 sm:gap-5 px-5 pb-1 pt-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            <span className="text-[10px] text-muted-foreground/60 font-medium">Balance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-muted-foreground/60 font-medium">Earned</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-[10px] text-muted-foreground/60 font-medium">Used</span>
          </div>
        </div>

        <div className="px-1 pb-3">
          {loadingTransactions ? (
            <div className="flex items-center justify-center h-[240px]">
              <Spinner className="h-5 w-5 animate-spin text-muted-foreground/20" />
            </div>
          ) : (
            <UsageChart data={chartData} height={240} chartView={chartView} />
          )}
        </div>
      </motion.div>

      {/* ─── Transaction History ──────────────────────────────────────────── */}
      <motion.div {...fadeUp(0.55)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground/50 shrink-0" weight="bold" />
            <span className="text-sm font-semibold">Transactions</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {filteredTransactions.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* Type filter */}
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TransactionFilter)}>
              <SelectTrigger size="sm" className="h-7 text-[11px] gap-1.5 min-w-0 w-auto">
                <Funnel className="h-3 w-3 text-muted-foreground/50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="usage">Usage</SelectItem>
                <SelectItem value="purchase">Purchases</SelectItem>
                <SelectItem value="subscription">Subscription</SelectItem>
                <SelectItem value="bonus">Bonuses</SelectItem>
                <SelectItem value="refund">Refunds</SelectItem>
              </SelectContent>
            </Select>

            {/* Export */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] px-2"
              onClick={handleExportCSV}
              disabled={filteredTransactions.length === 0}
            >
              <Export className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "rounded-xl border border-border/40 overflow-hidden",
            showAllTransactions && "max-h-[500px] overflow-y-auto"
          )}
        >
          {loadingTransactions ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-5 w-5 animate-spin text-muted-foreground/30" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <Receipt className="h-5 w-5 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground/60">No transactions found</p>
              <p className="text-xs text-muted-foreground/40 mt-1">
                {typeFilter !== "all"
                  ? "Try changing the filter"
                  : "Transactions will appear here as you use Coasty"}
              </p>
            </div>
          ) : (
            <div>
              {(showAllTransactions ? filteredTransactions : filteredTransactions.slice(0, 8)).map(
                (transaction, i, arr) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    isLast={i === arr.length - 1}
                  />
                )
              )}
            </div>
          )}
        </div>

        {/* Show more / less */}
        {filteredTransactions.length > 8 && (
          <div className="flex justify-center mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground"
              onClick={() => setShowAllTransactions(!showAllTransactions)}
            >
              {showAllTransactions
                ? "Show less"
                : `Show all ${filteredTransactions.length} transactions`}
              <ChevronDown
                className={cn(
                  "h-3 w-3 ml-1 transition-transform",
                  showAllTransactions && "rotate-180"
                )}
              />
            </Button>
          </div>
        )}
      </motion.div>

    </div>
  )
}
