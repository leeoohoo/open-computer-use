"use client"

import { GuideLines } from "@/app/components/landing/guide-lines"
import { Button } from "@/components/ui/button"
import { RainbowButton } from "@/components/magicui/rainbow-button"
import {
  Check,
  X,
  Zap,
  Shield,
  ArrowRight,
  Star,
  HardDrive,
  Clock,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Lock,
  Headphones,
  BarChart3,
  Globe,
  Minus,
  Monitor,
  Layers,
  Network,
  Workflow,

} from "lucide-react"
import { CoastyIcon } from "@/components/icons/coasty"
import Link from "next/link"
import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { LandingHeader } from "@/app/components/landing/landing-header"
import { LandingFooter } from "@/app/components/landing/landing-footer"
import { motion, AnimatePresence, useInView } from "framer-motion"

// ─── Plan data ──────────────────────────────────────────────────────────────

interface Plan {
  name: string
  price: number
  annualPrice: number
  period: string
  tagline: string
  credits: string
  machines: string
  machineCount: number
  swarmCapacity: number
  features: string[]
  highlighted: boolean
  badge?: string
  cta: string
  manualEquivalent: number
  tasksPerMonth: string
}

const plans: Plan[] = [
  {
    name: "Free",
    price: 0,
    annualPrice: 0,
    period: "mo",
    tagline: "Try the #1 computer-use agent",
    credits: "100 credits",
    machines: "1 VM, 2-hour limit",
    machineCount: 0,
    swarmCapacity: 0,
    features: [
      "Full AI computer-use agent",
      "SOTA OSWorld Agent — 82%",
      "One-click remote connection",
      "File upload & download",
      "Full audit trail",
    ],
    highlighted: false,
    cta: "Start Free",
    manualEquivalent: 2000,
    tasksPerMonth: "~10",
  },
  {
    name: "Starter",
    price: 19,
    annualPrice: 15,
    period: "mo",
    tagline: "Automate tasks every day",
    credits: "200 credits",
    machines: "1 persistent machine",
    machineCount: 1,
    swarmCapacity: 3,
    features: [
      "Everything in Free",
      "2x more credits",
      "Swarm mode — 3 parallel agents",
      "Advanced web search & extraction",
      "Standard support (real humans)",
    ],
    highlighted: false,
    cta: "Get Starter",
    manualEquivalent: 4000,
    tasksPerMonth: "~40",
  },
  {
    name: "Plus",
    price: 50,
    annualPrice: 40,
    period: "mo",
    tagline: "Scale complex workflows",
    credits: "600 credits",
    machines: "2 persistent machines",
    machineCount: 2,
    swarmCapacity: 6,
    features: [
      "Everything in Starter",
      "3x more credits than Starter",
      "Swarm mode — 6 parallel agents",
      "API access (coming soon)",
      "Priority support, 24hr response",
    ],
    highlighted: true,
    badge: "Most Popular",
    cta: "Go Plus",
    manualEquivalent: 8000,
    tasksPerMonth: "~120",
  },
  {
    name: "Pro",
    price: 100,
    annualPrice: 80,
    period: "mo",
    tagline: "Unlimited heavy automation",
    credits: "1,500 credits",
    machines: "3 persistent machines",
    machineCount: 3,
    swarmCapacity: 9,
    features: [
      "Everything in Plus",
      "2.5x more credits than Plus",
      "Swarm mode — 9 parallel agents",
      "SLA guarantee, 99.9% uptime",
      "Premium support, 12hr response",
    ],
    highlighted: false,
    cta: "Get Pro",
    manualEquivalent: 12000,
    tasksPerMonth: "~300",
  },
]

// ─── Feature comparison matrix ──────────────────────────────────────────────

interface FeatureCategory {
  name: string
  features: {
    label: string
    free: string | boolean
    starter: string | boolean
    plus: string | boolean
    pro: string | boolean
  }[]
}

const featureMatrix: FeatureCategory[] = [
  {
    name: "AI Agent",
    features: [
      { label: "Computer-use agent", free: true, starter: true, plus: true, pro: true },
      { label: "OSWorld benchmark score", free: "82%", starter: "82%", plus: "82%", pro: "82%" },
      { label: "Monthly credits", free: "100", starter: "200", plus: "600", pro: "1,500" },
      { label: "Swarm mode (parallel agents)", free: false, starter: "3 agents", plus: "6 agents", pro: "9 agents" },
      { label: "Advanced web search", free: false, starter: true, plus: true, pro: true },
      { label: "Data extraction at scale", free: false, starter: false, plus: true, pro: true },
      { label: "API access", free: false, starter: false, plus: "Coming soon", pro: "Coming soon" },
    ],
  },
  {
    name: "Infrastructure",
    features: [
      { label: "Virtual machines", free: "1 (2hr limit)", starter: "1 persistent", plus: "2 persistent", pro: "3 persistent" },
      { label: "Machine time limit", free: "2 hours", starter: "Unlimited", plus: "Unlimited", pro: "Unlimited" },
      { label: "File upload & download", free: true, starter: true, plus: true, pro: true },
      { label: "One-click remote connection", free: true, starter: true, plus: true, pro: true },
      { label: "Full audit trail", free: true, starter: true, plus: true, pro: true },
      { label: "Storage provided", free: true, starter: true, plus: true, pro: true },
    ],
  },
  {
    name: "Support & Guarantees",
    features: [
      { label: "Support type", free: "Community", starter: "Standard (human)", plus: "Priority (24hr)", pro: "Premium (12hr)" },
      { label: "SLA guarantee", free: false, starter: false, plus: false, pro: "99.9% uptime" },
      { label: "Early access to features", free: false, starter: false, plus: false, pro: true },
      { label: "Dedicated setup session", free: false, starter: false, plus: false, pro: false },
    ],
  },
]

// ─── FAQ data ───────────────────────────────────────────────────────────────

const faqs = [
  {
    q: "What counts as a credit?",
    a: "One credit equals roughly one agent action — a click, a form fill, a search query, or a file operation. A typical multi-step task (e.g. 'find this data and put it in a spreadsheet') uses 5–15 credits depending on complexity.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, absolutely. No contracts, no cancellation fees. Cancel from your account page and you keep access through the end of your billing period.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "Your active tasks finish, but new ones won't start until your credits refill on the next billing cycle. You can also upgrade to a higher plan mid-cycle and get the additional credits immediately.",
  },
  {
    q: "Is my data secure?",
    a: "Every task runs in a fully isolated virtual machine that's destroyed after use. Nothing persists between sessions unless you explicitly save files. All connections are encrypted end-to-end and we never store your credentials on our servers.",
  },
  {
    q: "What does 'persistent machine' mean?",
    a: "On paid plans, your VM stays running between tasks — your desktop, files, browser sessions, and installed software all persist. Think of it as your own always-on cloud computer that the AI agent uses.",
  },
  {
    q: "What is swarm mode?",
    a: "Swarm mode lets you split a task across multiple machines running simultaneously. Instead of one agent doing 10 searches sequentially, 10 agents do them in parallel — finishing in minutes instead of hours.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. Coasty runs entirely in the browser. You can also install our lightweight desktop app if you want the AI agent to control your local machine directly, but it's completely optional.",
  },
]

// ─── Testimonials ───────────────────────────────────────────────────────────

const testimonials = [
  {
    quote: "Replaced 3 hours of daily data entry. Coasty pays for itself in the first week.",
    name: "Sarah K.",
    role: "Operations Manager",
    plan: "Plus",
  },
  {
    quote: "The swarm mode is insane. What took my team a full day now runs in 20 minutes.",
    name: "Marcus T.",
    role: "E-commerce Founder",
    plan: "Pro",
  },
  {
    quote: "Finally, an AI tool that actually does things instead of just chatting about them.",
    name: "Jenna L.",
    role: "Marketing Lead",
    plan: "Starter",
  },
]

// ─── Animation variants ─────────────────────────────────────────────────────

const ease = [0.22, 1, 0.36, 1] as const

const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease, staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease } },
}

// ─── Helper Components ──────────────────────────────────────────────────────

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 mx-auto">
        <Check className="h-3.5 w-3.5 text-primary" />
      </div>
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground/30 mx-auto" />
    )
  }
  return <span className="text-sm font-medium text-foreground">{value}</span>
}

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [displayed, setDisplayed] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const duration = 800
    const start = performance.now()
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(eased * value))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [inView, value])

  return (
    <span ref={ref}>
      {prefix}{displayed.toLocaleString()}
    </span>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "AI Agent": true,
    "Infrastructure": false,
    "Support & Guarantees": false,
  })
  const [sliderValue, setSliderValue] = useState(50)

  const toggleCategory = useCallback((name: string) => {
    setExpandedCategories(prev => ({ ...prev, [name]: !prev[name] }))
  }, [])

  // ROI calculator values
  const roiData = useMemo(() => {
    const tasksPerMonth = sliderValue
    const manualCostPerTask = 12 // $12 avg manual labor per task
    const coastyCostPerTask = 0.08
    const manualTotal = tasksPerMonth * manualCostPerTask
    const coastyTotal = tasksPerMonth * coastyCostPerTask
    const savings = manualTotal - coastyTotal
    const recommendedPlan =
      tasksPerMonth <= 10 ? "Free" : tasksPerMonth <= 40 ? "Starter" : tasksPerMonth <= 120 ? "Plus" : "Pro"
    return { manualTotal, coastyTotal, savings, recommendedPlan }
  }, [sliderValue])

  const getPrice = useCallback(
    (plan: Plan) => (isAnnual ? plan.annualPrice : plan.price),
    [isAnnual]
  )

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <GuideLines />
      <LandingHeader />

      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-32 sm:pt-36 md:pt-40 pb-8 sm:pb-12 overflow-hidden">
        {/* Background texture */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(var(--primary-rgb),0.12),transparent)]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(var(--primary-rgb),0.06)_0%,transparent_70%)]" />
        </div>

        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          className="relative max-w-4xl mx-auto px-7 sm:px-10 text-center"
        >
          {/* Urgency badge */}
          <motion.div variants={itemVariants} className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/[0.06] px-4 py-1.5 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">Early-bird pricing — rates increase soon</span>
            </div>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08]"
          >
            Stop paying{" "}
            <span className="relative">
              <span className="text-muted-foreground line-through decoration-muted-foreground/50 decoration-[3px]">$8,000/mo</span>
            </span>
            <br />
            for manual work
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-5 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            The #1 AI computer-use agent automates your tasks for a fraction of the cost.
            Start free, upgrade when you&apos;re ready.
          </motion.p>

          {/* Hero CTA — Start Free */}
          <motion.div variants={itemVariants} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <RainbowButton size="lg" className="text-base px-8 h-12" asChild>
              <Link href="/auth">
                Start Free — No Credit Card
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </RainbowButton>
            <p className="text-xs text-muted-foreground">100 credits included &middot; Ready in 60 seconds</p>
          </motion.div>

          {/* Stats */}
          <motion.div variants={itemVariants} className="mt-10 flex flex-wrap justify-center gap-6 sm:gap-10">
            {[
              { value: "2,000+", sub: "teams automating" },
              { value: "2M+", sub: "tasks completed" },
              { value: "#1", sub: "82% OSWorld" },
            ].map((stat) => (
              <div key={stat.sub} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{stat.value}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Billing toggle ────────────────────────────────────────────── */}
      <section className="pb-4 px-7 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex items-center justify-center gap-3"
        >
          <span className={cn("text-sm font-medium transition-colors", !isAnnual ? "text-foreground" : "text-muted-foreground")}>
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className={cn(
              "relative h-7 w-[52px] rounded-full transition-colors duration-200",
              isAnnual ? "bg-primary" : "bg-muted-foreground/20"
            )}
          >
            <motion.div
              className="absolute top-0.5 h-6 w-6 rounded-full bg-white dark:bg-background shadow-md"
              animate={{ left: isAnnual ? 24 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
          <span className={cn("text-sm font-medium transition-colors", isAnnual ? "text-foreground" : "text-muted-foreground")}>
            Annual
          </span>
          <AnimatePresence>
            {isAnnual && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -8 }}
                className="rounded-full bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400"
              >
                Save 20%
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* ─── Plan Cards ────────────────────────────────────────────────── */}
      <section className="py-8 sm:py-12 px-7 sm:px-10">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-6xl mx-auto"
        >
          {/* Free nudge */}
          <motion.p variants={itemVariants} className="text-center text-sm text-muted-foreground mb-6">
            Not sure yet? <Link href="/auth" className="text-primary font-medium hover:underline underline-offset-4">Start free with 100 credits</Link> — no credit card, cancel anytime.
          </motion.p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-3 items-start">
            {plans.map((plan) => {
              const price = getPrice(plan)
              const savings = plan.manualEquivalent - price

              return (
                <motion.div
                  key={plan.name}
                  variants={cardVariants}
                  className={cn(
                    "relative rounded-2xl border p-5 sm:p-6 flex flex-col transition-all duration-300",
                    plan.highlighted
                      ? "border-primary/40 bg-gradient-to-b from-primary/[0.07] via-primary/[0.03] to-transparent shadow-lg shadow-primary/10 lg:scale-[1.03] lg:-my-2 z-10"
                      : "border-border/60 bg-card/50 hover:border-border hover:shadow-sm"
                  )}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground tracking-wide uppercase">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  {/* Header */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CoastyIcon className="h-5 w-5" />
                      <h3 className="text-sm font-semibold text-foreground">{plan.name}</h3>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold tracking-tight">
                        ${price}
                      </span>
                      <span className="text-sm text-muted-foreground">/{plan.period}</span>
                    </div>

                    {isAnnual && plan.price > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        <span className="line-through">${plan.price}</span>{" "}
                        <span className="text-orange-600 dark:text-orange-400 font-medium">
                          save ${(plan.price - plan.annualPrice) * 12}/yr
                        </span>
                      </div>
                    )}

                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{plan.tagline}</p>
                  </div>

                  {/* Credits pill */}
                  <div className="mb-3 flex items-center gap-2 rounded-lg bg-primary/[0.06] border border-primary/10 px-3 py-2">
                    <Zap className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium">{plan.credits}<span className="text-muted-foreground font-normal">/month</span></span>
                  </div>

                  {/* Machines & Swarms */}
                  {plan.machineCount > 0 ? (
                    <div className="mb-3 rounded-lg border border-orange-500/15 bg-orange-500/[0.04] overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <HardDrive className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        <span className="text-sm font-medium">{plan.machines}</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 border-t border-orange-500/10 bg-orange-500/[0.02]">
                        <Workflow className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                        <span className="text-sm font-medium">
                          Swarm: {plan.swarmCapacity} agents
                          <span className="text-muted-foreground font-normal"> in parallel</span>
                        </span>
                      </div>
                      {/* Mini machine visual */}
                      <div className="px-3 py-2 border-t border-orange-500/10 flex items-center gap-1.5">
                        {Array.from({ length: plan.machineCount }).map((_, i) => (
                          <div key={i} className="flex-1 h-1.5 rounded-full bg-orange-500/30" />
                        ))}
                        {Array.from({ length: 3 - plan.machineCount }).map((_, i) => (
                          <div key={i} className="flex-1 h-1.5 rounded-full bg-border/40" />
                        ))}
                        <span className="text-[10px] text-orange-400 ml-1 font-medium">{plan.machineCount}/3</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3 rounded-lg bg-muted/50 border border-border/50 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium text-muted-foreground">{plan.machines}</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/30">
                        <Workflow className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground/60">No swarm mode</span>
                      </div>
                    </div>
                  )}

                  {/* Anchoring — manual cost comparison */}
                  <div className="mb-4 rounded-lg bg-muted/30 border border-border/40 px-3 py-2.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Manual equivalent</span>
                      <span className="font-semibold text-muted-foreground line-through">${plan.manualEquivalent.toLocaleString()}/mo</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted-foreground">You save</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">${savings.toLocaleString()}/mo</span>
                    </div>
                  </div>

                  {/* CTA */}
                  {plan.highlighted ? (
                    <RainbowButton className="w-full mb-5 h-10 text-sm" asChild>
                      <Link href="/auth">
                        {plan.cta}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </RainbowButton>
                  ) : (
                    <Button
                      className={cn(
                        "w-full mb-5",
                        plan.price === 0
                          ? ""
                          : "hover:bg-primary hover:text-primary-foreground"
                      )}
                      variant={plan.price === 0 ? "default" : "outline"}
                      size="sm"
                      asChild
                    >
                      <Link href="/auth">
                        {plan.cta}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}

                  {/* Feature list */}
                  <div className="space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground leading-snug">{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* Risk reversal */}
                  <p className="mt-4 pt-3 border-t border-border/30 text-xs text-muted-foreground text-center">
                    {plan.price === 0 ? "No credit card required" : "Cancel anytime"}
                  </p>
                </motion.div>
              )
            })}
          </div>

          {/* Enterprise strip */}
          <motion.div
            variants={itemVariants}
            className="mt-6 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-5 sm:p-7"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center gap-2.5 justify-center sm:justify-start">
                  <h3 className="font-semibold text-lg">Enterprise</h3>
                  <span className="rounded-full bg-foreground/5 border border-border/50 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Custom
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Custom credits, dedicated VMs, SLA guarantees, SSO, priority support, and a dedicated setup session.
                </p>
              </div>
              <Button variant="outline" className="flex-shrink-0 gap-2" asChild>
                <Link href="mailto:founders@coasty.ai">
                  Contact Us
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Machines & Swarms Showcase ─────────────────────────────────── */}
      <section className="py-12 sm:py-16 px-7 sm:px-10">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-5xl mx-auto"
        >
          <motion.div variants={itemVariants} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Persistent machines + swarm power
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Your machines stay running between tasks — files, apps, and browser sessions persist.
              Swarm mode multiplies your capacity by running agents in parallel.
            </p>
          </motion.div>

          {/* Visual comparison across tiers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Persistent Machines card */}
            <motion.div
              variants={cardVariants}
              className="rounded-2xl border border-orange-500/20 bg-gradient-to-b from-orange-500/[0.06] to-transparent p-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <HardDrive className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Persistent Machines</h3>
                  <p className="text-xs text-muted-foreground">Always-on cloud computers for your AI agent</p>
                </div>
              </div>

              <div className="space-y-3">
                {plans.map((plan) => (
                  <div
                    key={plan.name}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 transition-all",
                      plan.highlighted
                        ? "bg-orange-500/[0.08] border border-orange-500/20"
                        : "bg-muted/20 border border-border/30"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-semibold w-16",
                      plan.highlighted ? "text-orange-500" : "text-foreground"
                    )}>
                      {plan.name}
                    </span>

                    {/* Machine dots */}
                    <div className="flex items-center gap-1.5 flex-1">
                      {plan.machineCount === 0 ? (
                        <span className="text-xs text-muted-foreground">1 temp VM (2hr)</span>
                      ) : (
                        <>
                          {Array.from({ length: plan.machineCount }).map((_, i) => (
                            <div key={i} className="relative group">
                              <div className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center",
                                plan.highlighted ? "bg-orange-500/20" : "bg-orange-500/10"
                              )}>
                                <Monitor className="h-4 w-4 text-orange-400" />
                              </div>
                            </div>
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">
                            persistent, unlimited
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-orange-500/10">
                <div className="flex items-start gap-2">
                  <Layers className="h-3.5 w-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your desktop, files, browser sessions, and installed software all persist between tasks.
                    Like your own always-on cloud computer.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Swarm Mode card */}
            <motion.div
              variants={cardVariants}
              className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent p-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Network className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Swarm Mode</h3>
                  <p className="text-xs text-muted-foreground">Split tasks across parallel agents</p>
                </div>
              </div>

              <div className="space-y-3">
                {plans.map((plan) => (
                  <div
                    key={plan.name}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 transition-all",
                      plan.highlighted
                        ? "bg-amber-500/[0.08] border border-amber-500/20"
                        : "bg-muted/20 border border-border/30"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-semibold w-16",
                      plan.highlighted ? "text-amber-500" : "text-foreground"
                    )}>
                      {plan.name}
                    </span>

                    {/* Agent dots */}
                    <div className="flex items-center gap-1 flex-1">
                      {plan.swarmCapacity === 0 ? (
                        <span className="text-xs text-muted-foreground">Sequential only</span>
                      ) : (
                        <>
                          {Array.from({ length: plan.swarmCapacity }).map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-6 w-6 rounded-full flex items-center justify-center",
                                plan.highlighted ? "bg-amber-500/20" : "bg-amber-500/10"
                              )}
                            >
                              <Workflow className="h-3 w-3 text-amber-400" />
                            </div>
                          ))}
                          <span className="text-xs text-muted-foreground ml-1.5">
                            in parallel
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-amber-500/10">
                <div className="flex items-start gap-2">
                  <Zap className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    10 searches in parallel instead of sequentially — what takes hours finishes in minutes.
                    Each agent works independently on its own machine.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Start Free nudge */}
          <motion.div variants={itemVariants} className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Try with a free machine first, then unlock persistent machines and swarm mode.
            </p>
            <Button size="sm" className="mt-3" asChild>
              <Link href="/auth">
                Start Free
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Social Proof ──────────────────────────────────────────────── */}
      <section className="py-12 sm:py-16 px-7 sm:px-10">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-5xl mx-auto"
        >
          <motion.p variants={itemVariants} className="text-center text-sm text-muted-foreground mb-8">
            Trusted by <span className="font-semibold text-foreground">2,000+</span> teams automating with Coasty
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                variants={cardVariants}
                className="rounded-xl border border-border/50 bg-card/40 p-5 sm:p-6 flex flex-col"
              >
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    {t.plan} plan
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── ROI Calculator ────────────────────────────────────────────── */}
      <section className="py-12 sm:py-16 px-7 sm:px-10">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-3xl mx-auto"
        >
          <motion.div variants={itemVariants} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Calculate your savings
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
              See how much you save compared to hiring someone to do the same work manually.
            </p>
          </motion.div>

          <motion.div
            variants={cardVariants}
            className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-6 sm:p-8"
          >
            {/* Slider */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-foreground">Tasks per month</label>
                <span className="text-2xl font-bold text-foreground tabular-nums">{sliderValue}</span>
              </div>
              <input
                type="range"
                min={5}
                max={300}
                step={5}
                value={sliderValue}
                onChange={(e) => setSliderValue(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>5</span>
                <span>300</span>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl bg-muted/30 border border-border/40 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Manual labor cost</p>
                <p className="text-2xl font-bold text-muted-foreground line-through decoration-muted-foreground/30">
                  ${roiData.manualTotal.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">per month</p>
              </div>
              <div className="rounded-xl bg-primary/[0.04] border border-primary/10 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Coasty cost</p>
                <p className="text-2xl font-bold text-primary">
                  ${roiData.coastyTotal < 1 ? roiData.coastyTotal.toFixed(2) : roiData.coastyTotal.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">per month</p>
              </div>
              <div className="rounded-xl bg-orange-500/[0.04] border border-orange-500/10 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">You save</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  ${roiData.savings.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">per month</p>
              </div>
            </div>

            {/* Recommended plan */}
            <div className="rounded-xl bg-muted/30 border border-border/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Recommended: <span className="text-primary">{roiData.recommendedPlan}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Based on {sliderValue} tasks/month</p>
                </div>
              </div>
              <Button size="sm" asChild>
                <Link href="/auth">
                  Get Started
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Feature Comparison Table ──────────────────────────────────── */}
      <section className="py-12 sm:py-16 px-7 sm:px-10">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-5xl mx-auto"
        >
          <motion.div variants={itemVariants} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Compare every feature
            </h2>
            <p className="text-muted-foreground mt-3">
              Everything you get at every tier, no hidden limits.
            </p>
          </motion.div>

          <motion.div variants={cardVariants} className="rounded-2xl border border-border/60 overflow-hidden">
            {/* Table header — sticky on desktop */}
            <div className="hidden sm:grid grid-cols-5 bg-muted/40 border-b border-border sticky top-0 z-10">
              <div className="p-4" />
              {plans.map((p) => (
                <div
                  key={p.name}
                  className={cn(
                    "p-4 text-center border-l",
                    p.highlighted ? "border-primary/20 bg-primary/[0.04]" : "border-border/50"
                  )}
                >
                  <p className={cn("text-sm font-semibold", p.highlighted ? "text-primary" : "text-foreground")}>
                    {p.name}
                  </p>
                  <p className={cn("text-lg font-bold mt-0.5", p.highlighted ? "text-primary" : "text-foreground")}>
                    ${getPrice(p)}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Categories */}
            {featureMatrix.map((category) => (
              <div key={category.name}>
                {/* Category header — collapsible */}
                <button
                  onClick={() => toggleCategory(category.name)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 border-b border-border/40 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-sm font-semibold text-foreground">{category.name}</span>
                  {expandedCategories[category.name] ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {expandedCategories[category.name] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] as const }}
                      className="overflow-hidden"
                    >
                      {category.features.map((feature, fi) => (
                        <div key={feature.label}>
                          {/* Desktop row */}
                          <div
                            className={cn(
                              "hidden sm:grid grid-cols-5 border-b border-border/30",
                              fi % 2 === 1 && "bg-muted/10"
                            )}
                          >
                            <div className="p-3.5 px-4 flex items-center">
                              <span className="text-sm text-foreground">{feature.label}</span>
                            </div>
                            {(["free", "starter", "plus", "pro"] as const).map((tier) => (
                              <div
                                key={tier}
                                className={cn(
                                  "p-3.5 flex items-center justify-center border-l text-center",
                                  tier === "plus" ? "border-primary/20 bg-primary/[0.02]" : "border-border/30"
                                )}
                              >
                                <FeatureValue value={feature[tier]} />
                              </div>
                            ))}
                          </div>

                          {/* Mobile row — stacked */}
                          <div className={cn("sm:hidden border-b border-border/30 p-3.5", fi % 2 === 1 && "bg-muted/10")}>
                            <p className="text-sm font-medium text-foreground mb-2">{feature.label}</p>
                            <div className="grid grid-cols-4 gap-2">
                              {(["free", "starter", "plus", "pro"] as const).map((tier) => (
                                <div key={tier} className="text-center">
                                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
                                    {tier === "free" ? "Free" : tier === "starter" ? "Start" : tier === "plus" ? "Plus" : "Pro"}
                                  </p>
                                  <FeatureValue value={feature[tier]} />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Trust Signals ─────────────────────────────────────────────── */}
      <section className="py-10 sm:py-14 px-7 sm:px-10">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-4xl mx-auto"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Shield, label: "Isolated VMs", sub: "Every task sandboxed" },
              { icon: Lock, label: "End-to-end encrypted", sub: "Zero credential storage" },
              { icon: BarChart3, label: "99.9% uptime", sub: "Pro plan SLA" },
              { icon: Headphones, label: "Human support", sub: "Not bots, real people" },
            ].map((signal, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                className="flex flex-col items-center text-center p-4 rounded-xl border border-border/30 bg-card/30"
              >
                <div className="h-10 w-10 rounded-full bg-primary/[0.06] flex items-center justify-center mb-3">
                  <signal.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">{signal.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{signal.sub}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── Try Free CTA ─────────────────────────────────────────────── */}
      <section className="py-10 sm:py-14 px-7 sm:px-10">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-2xl mx-auto"
        >
          <motion.div
            variants={cardVariants}
            className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.05] to-transparent p-6 sm:p-8 text-center"
          >
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
              Try it free — see for yourself
            </h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm sm:text-base leading-relaxed">
              Get 100 credits, a full virtual machine, and access to the #1 AI agent.
              No credit card. No setup. Just sign up and go.
            </p>
            <div className="mt-5">
              <RainbowButton size="lg" className="text-sm sm:text-base px-6 sm:px-8 h-11" asChild>
                <Link href="/auth">
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </RainbowButton>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-primary" />
                100 free credits
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-primary" />
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-primary" />
                Ready in 60 seconds
              </span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────────────── */}
      <section className="py-12 sm:py-16 px-7 sm:px-10">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-3xl mx-auto"
        >
          <motion.div variants={itemVariants} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Frequently asked questions
            </h2>
            <p className="text-muted-foreground mt-3">
              Everything you need to know before getting started
            </p>
          </motion.div>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                className="rounded-xl border border-border/50 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-muted/20 transition-colors"
                >
                  <span className="text-sm sm:text-base font-medium text-foreground pr-4">{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-200",
                      expandedFaq === i && "rotate-180"
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {expandedFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                        <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── Final CTA ─────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-7 sm:px-10">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.div variants={itemVariants}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Your AI agent is 60 seconds away
            </h2>
            <p className="text-muted-foreground mt-4 text-lg max-w-xl mx-auto">
              Sign up, get 100 free credits, and let Coasty handle the work. No credit card needed.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-8 flex flex-col items-center gap-4">
            <RainbowButton size="lg" className="text-base px-10 h-13 sm:h-14 sm:text-lg sm:px-12" asChild>
              <Link href="/auth">
                Start Free
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
            </RainbowButton>
            <div className="flex flex-col sm:flex-row items-center gap-2 text-xs text-muted-foreground">
              <span>No credit card required</span>
              <span className="hidden sm:inline">&middot;</span>
              <span>Cancel anytime</span>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
              <Link href="mailto:founders@coasty.ai">
                Need Enterprise? Talk to us &rarr;
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      <LandingFooter />
    </div>
  )
}
