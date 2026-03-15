"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import {
  Lightning,
  Check,
  X,
  Coins,
  CreditCard,
  ArrowRight,
  ArrowSquareOut,
  Clock,
  ShoppingCart,
  Question,
  Star,
  Cube,
  Rocket,
  Crown,
  VideoCamera,
} from "@phosphor-icons/react"

/* ─── animation variants ─── */

const fade = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.05, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

/* ─── data ─── */

interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  name: string
  price: string
  period: string
  icon: React.ElementType
  accent: string
  accentText: string
  accentBorder: string
  popular?: boolean
  features: PlanFeature[]
  cta: string
}

const plans: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    icon: Cube,
    accent: "bg-zinc-500/[0.04] dark:bg-zinc-400/[0.06]",
    accentText: "text-zinc-600 dark:text-zinc-400",
    accentBorder: "border-border/40",
    features: [
      { text: "100 credits/month", included: true },
      { text: "1 temporary machine (2 hrs)", included: true },
      { text: "Full AI computer-use agent", included: true },
      { text: "File upload & download", included: true },
      { text: "Persistent machines", included: false },
      { text: "Swarm mode", included: false },
    ],
    cta: "Start Free",
  },
  {
    name: "Starter",
    price: "$19",
    period: "/mo",
    icon: Rocket,
    accent: "bg-sky-500/[0.04] dark:bg-sky-400/[0.06]",
    accentText: "text-sky-600 dark:text-sky-400",
    accentBorder: "border-sky-500/10 dark:border-sky-400/10",
    features: [
      { text: "200 credits/month", included: true },
      { text: "1 persistent machine, no limits", included: true },
      { text: "Swarm mode (3x parallel)", included: true },
      { text: "Advanced web search & extraction", included: true },
      { text: "Standard support (real humans)", included: true },
      { text: "SLA guarantee", included: false },
    ],
    cta: "Start with Starter",
  },
  {
    name: "Plus",
    price: "$50",
    period: "/mo",
    icon: Star,
    accent: "bg-violet-500/[0.04] dark:bg-violet-400/[0.06]",
    accentText: "text-violet-600 dark:text-violet-400",
    accentBorder: "border-violet-500/20 dark:border-violet-400/20",
    popular: true,
    features: [
      { text: "600 credits/month", included: true },
      { text: "2 persistent machines, no limits", included: true },
      { text: "Swarm mode (3x parallel)", included: true },
      { text: "Advanced data extraction at scale", included: true },
      { text: "Priority support, 24hr response", included: true },
      { text: "Full API access (coming soon)", included: true },
    ],
    cta: "Go Plus",
  },
  {
    name: "Pro",
    price: "$100",
    period: "/mo",
    icon: Crown,
    accent: "bg-amber-500/[0.04] dark:bg-amber-400/[0.06]",
    accentText: "text-amber-600 dark:text-amber-400",
    accentBorder: "border-amber-500/10 dark:border-amber-400/10",
    features: [
      { text: "1,500 credits/month", included: true },
      { text: "3 persistent machines, no limits", included: true },
      { text: "Swarm mode (3x parallel)", included: true },
      { text: "Early access to new features", included: true },
      { text: "SLA guarantee, 99.9% uptime", included: true },
      { text: "Premium support, 12hr response", included: true },
    ],
    cta: "Get Pro",
  },
]

const addons = [
  { name: "Small Boost", credits: 100 },
  { name: "Medium Boost", credits: 250 },
  { name: "Large Boost", credits: 500 },
  { name: "Mega Pack", credits: "1,000" },
]

const usageRows = [
  { task: "Research competitor pricing", duration: "8 min", credits: "80" },
  { task: "Send 5 cold emails", duration: "12 min", credits: "120" },
  { task: "Fill out 3 job applications", duration: "15 min", credits: "150" },
]

const faqs = [
  {
    question: "How are credits charged?",
    answer: "Credits are deducted per minute of agent execution time (10 credits/min), rounded up. Your balance is checked every 30 seconds during a session.",
  },
  {
    question: "Do unused credits roll over?",
    answer: "Credits reset each billing cycle. Use them or lose them.",
  },
  {
    question: "What happens when I run out?",
    answer: "You need at least 20 credits to start a task. Below 50 credits you'll see a low-balance warning. If you hit 0, the task pauses — buy an add-on to continue.",
  },
  {
    question: "Is there a max session length?",
    answer: "Individual sessions are capped at 6 hours to prevent runaway usage.",
  },
  {
    question: "Can I downgrade?",
    answer: "Yes, changes take effect at the end of your current billing period.",
  },
]

/* ─── billing tab ─── */

export function BillingTab({ inApp }: { inApp: boolean }) {
  return (
    <div className="space-y-0">

      {/* ── Section 1: How Credits Work ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className={cn(inApp ? "mb-12 sm:mb-16" : "mb-20 sm:mb-28")}
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Credits
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
        >
          How Credits Work
        </motion.h2>
        <motion.p
          variants={fade}
          custom={2}
          className="text-sm sm:text-base text-muted-foreground/60 max-w-xl leading-relaxed mb-6"
        >
          Credits are the currency for Coasty tasks. You&apos;re charged 10 credits per minute of agent
          execution time, billed per minute and rounded up.
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div
            variants={fade}
            custom={3}
            className="rounded-2xl border border-border/40 bg-card/30 p-5 sm:p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/[0.06] dark:bg-emerald-400/[0.08]">
                <Lightning size={18} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">
                Rate
              </span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground mb-1">
              10 credits per minute
            </p>
            <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
              of agent execution time — billed per minute, rounded up. 1 credit = $0.01.
            </p>
          </motion.div>

          <motion.div
            variants={fade}
            custom={4}
            className="rounded-2xl border border-border/40 bg-card/30 p-5 sm:p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/[0.06] dark:bg-sky-400/[0.08]">
                <Clock size={18} weight="duotone" className="text-sky-600 dark:text-sky-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">
                Example
              </span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground mb-1">
              10-minute task = 100 credits
            </p>
            <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
              Minimum 20 credits required to start a session. Warning at 50 credits remaining.
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* ── Section 2: Plans ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className={cn(inApp ? "mb-12 sm:mb-16" : "mb-20 sm:mb-28")}
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Pricing
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
        >
          Plans
        </motion.h2>
        <motion.p
          variants={fade}
          custom={2}
          className="text-sm sm:text-base text-muted-foreground/60 max-w-xl mb-8"
        >
          Choose the plan that fits your workload. Upgrade or downgrade anytime.
        </motion.p>

        <motion.div
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {plans.map((plan, i) => {
            const PlanIcon = plan.icon
            return (
              <motion.div
                key={plan.name}
                variants={fade}
                custom={i + 3}
                className={cn(
                  "relative rounded-2xl border bg-card/50 backdrop-blur-sm p-5 sm:p-6 flex flex-col",
                  plan.popular
                    ? "border-violet-500/30 dark:border-violet-400/30 shadow-sm"
                    : plan.accentBorder
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 dark:bg-violet-400/10 border border-violet-500/20 dark:border-violet-400/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-violet-600 dark:text-violet-400">
                      <Star size={10} weight="fill" />
                      Popular
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl",
                      plan.accent,
                      plan.accentText,
                    )}
                  >
                    <PlanIcon size={18} weight="duotone" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                  </div>
                </div>

                <div className="mb-5">
                  <span className="text-2xl sm:text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground/50">{plan.period}</span>
                </div>

                <div className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((feat, fi) => (
                    <div key={fi} className="flex items-start gap-2.5">
                      {feat.included ? (
                        <Check size={14} weight="bold" className="text-emerald-500 mt-0.5 shrink-0" />
                      ) : (
                        <X size={14} weight="bold" className="text-muted-foreground/25 mt-0.5 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "text-[13px] leading-snug",
                          feat.included ? "text-foreground/70" : "text-muted-foreground/35"
                        )}
                      >
                        {feat.text}
                      </span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/billing"
                  className={cn(
                    "flex items-center justify-center rounded-xl py-2.5 text-sm font-medium transition-colors",
                    plan.popular
                      ? "bg-foreground text-background hover:opacity-90"
                      : "border border-border/50 text-foreground/70 bg-background/50 hover:bg-foreground/[0.04]"
                  )}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.section>

      {/* ── Section 3: Credit Add-ons ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className={cn(inApp ? "mb-12 sm:mb-16" : "mb-20 sm:mb-28")}
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Add-ons
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-3"
        >
          Credit Add-ons
        </motion.h2>
        <motion.p
          variants={fade}
          custom={2}
          className="text-sm text-muted-foreground/60 max-w-lg mb-6"
        >
          Need more credits? Buy add-on packs anytime. They stack on top of your plan.
        </motion.p>

        <motion.div
          variants={stagger}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {addons.map((addon, i) => (
            <motion.div
              key={addon.name}
              variants={fade}
              custom={i + 3}
              className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 sm:p-5 text-center"
            >
              <div className="flex h-9 w-9 mx-auto items-center justify-center rounded-xl bg-foreground/[0.04] dark:bg-foreground/[0.06] mb-3">
                <ShoppingCart size={16} weight="duotone" className="text-foreground/60" />
              </div>
              <p className="text-[13px] font-semibold text-foreground mb-1">{addon.name}</p>
              <p className="text-lg sm:text-xl font-bold text-foreground">{addon.credits}</p>
              <p className="text-[11px] text-muted-foreground/50">credits</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* ── Section 4: Understanding Credit Usage ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className={cn(inApp ? "mb-12 sm:mb-16" : "mb-20 sm:mb-28")}
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Usage
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-6"
        >
          Understanding Credit Usage
        </motion.h2>

        <motion.div
          variants={fade}
          custom={2}
          className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden"
        >
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 sm:px-6 py-3.5 border-b border-border/30 bg-foreground/[0.02]">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">
              Task
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 text-right w-16 sm:w-20">
              Duration
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 text-right w-16 sm:w-20">
              Credits
            </span>
          </div>

          {/* Table rows */}
          {usageRows.map((row, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-[1fr_auto_auto] gap-4 px-5 sm:px-6 py-3.5",
                i < usageRows.length - 1 && "border-b border-border/20"
              )}
            >
              <span className="text-[13px] text-foreground/70">{row.task}</span>
              <span className="text-[13px] text-muted-foreground/50 text-right w-16 sm:w-20">
                {row.duration}
              </span>
              <span className="text-[13px] font-medium text-foreground/70 text-right w-16 sm:w-20">
                {row.credits}
              </span>
            </div>
          ))}

          {/* Total row */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 sm:px-6 py-3.5 border-t border-border/40 bg-foreground/[0.02]">
            <span className="text-[13px] font-semibold text-foreground">Total today</span>
            <span className="text-[13px] text-muted-foreground/50 text-right w-16 sm:w-20">
              35 min
            </span>
            <span className="text-[13px] font-bold text-foreground text-right w-16 sm:w-20">
              350
            </span>
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 5: Where to Check Your Balance ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className={cn(inApp ? "mb-12 sm:mb-16" : "mb-20 sm:mb-28")}
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Balance
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-6"
        >
          Where to Check Your Balance
        </motion.h2>

        <div className="space-y-4">
          {/* Mock sidebar credit badge */}
          <motion.div
            variants={fade}
            custom={2}
            className="rounded-2xl border border-border/40 bg-card/30 p-5 sm:p-6"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mb-3">
              Sidebar
            </p>
            <div className="inline-flex items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Coins size={16} weight="duotone" className="text-amber-500" />
                <span className="text-sm font-semibold text-foreground">142 credits</span>
              </div>
              <div className="h-5 w-px bg-border/40" />
              <span className="text-[12px] font-medium text-violet-600 dark:text-violet-400 cursor-default select-none">
                Buy
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground/50 mt-3">
              Click &quot;Buy&quot; next to your balance to purchase more credits
            </p>
          </motion.div>

          {/* Mock insufficient credits modal */}
          <motion.div
            variants={fade}
            custom={3}
            className="rounded-2xl border border-border/40 bg-card/30 p-5 sm:p-6"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mb-3">
              When you run low
            </p>
            <div className="max-w-[320px] rounded-2xl border border-dashed border-border/60 bg-card/40 p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/[0.06] dark:bg-rose-400/[0.08]">
                <CreditCard size={20} weight="duotone" className="text-rose-500 dark:text-rose-400" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Not enough credits</p>
              <p className="text-[12px] text-muted-foreground/50 mb-4">
                You need at least 20 credits to start a new task.
              </p>
              <div className="inline-flex items-center gap-2 rounded-xl bg-foreground/90 px-5 py-2 text-sm font-medium text-background cursor-default select-none">
                Upgrade Plan
                <ArrowRight size={14} weight="bold" />
              </div>
            </div>
          </motion.div>

          {/* Link to billing */}
          <motion.div variants={fade} custom={4}>
            <Link
              href="/account?section=billing"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground/70 hover:text-foreground transition-colors"
            >
              Manage billing
              <ArrowSquareOut size={13} weight="bold" className="shrink-0" />
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* ── Section 6: Billing FAQ ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className={cn(inApp ? "mb-8" : "mb-20 sm:mb-28")}
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          FAQ
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-6"
        >
          Billing FAQ
        </motion.h2>

        <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              variants={fade}
              custom={i + 2}
              className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-5 sm:p-6"
            >
              <div className="flex items-start gap-3 mb-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.04] dark:bg-foreground/[0.06] mt-0.5">
                  <Question size={14} weight="duotone" className="text-foreground/60" />
                </div>
                <p className="text-[13px] sm:text-sm font-semibold text-foreground leading-snug pt-1">
                  {faq.question}
                </p>
              </div>
              <p className="text-[13px] text-muted-foreground/60 leading-relaxed pl-10">
                {faq.answer}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* ── CTA ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="rounded-2xl border border-border/40 bg-card/30 text-center p-6 sm:p-8"
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
          Try it now
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-3">
          Ready to get started?
        </h2>
        <p className="text-sm text-muted-foreground/60 max-w-lg mx-auto mb-6">
          Check your current balance, upgrade your plan, or buy credit add-ons from the billing page.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/billing"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to Billing
            <ArrowRight size={14} weight="bold" />
          </Link>
          <a
            href="https://cal.com/coasty/15min"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all"
          >
            <VideoCamera size={16} weight="duotone" />
            Talk to Cofounders
          </a>
        </div>
      </motion.section>

    </div>
  )
}
