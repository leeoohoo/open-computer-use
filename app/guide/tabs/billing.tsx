"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Lightning,
  Star,
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

/* ─── CSS animations ─── */

const billingAnimations = `
@keyframes gv-gauge-fill {
  0% { stroke-dashoffset: 251; }
  100% { stroke-dashoffset: 63; }
}
@keyframes gv-tick {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
@keyframes gv-progress-deplete {
  0% { width: 100%; }
  100% { width: 0%; }
}
@keyframes gv-credit-count {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes gv-pulse-ring {
  0% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.15); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
}
.gv-gauge-fill {
  animation: gv-gauge-fill 2s ease-out forwards;
  stroke-dasharray: 251;
  stroke-dashoffset: 251;
}
.gv-tick-1 { animation: gv-tick 2s ease-in-out infinite; }
.gv-tick-2 { animation: gv-tick 2s ease-in-out 0.3s infinite; }
.gv-tick-3 { animation: gv-tick 2s ease-in-out 0.6s infinite; }
.gv-progress-deplete { animation: gv-progress-deplete 4s linear infinite; }
.gv-credit-count { animation: gv-credit-count 0.5s ease-out 0.8s both; }
.gv-pulse-ring { animation: gv-pulse-ring 2s ease-out infinite; }
`

/* ─── plans data ─── */

const plans = [
  { name: "Free", price: "$0", credits: "100", vms: "1 temp", feature: "Basic search" },
  { name: "Lite", price: "$9", credits: "100", vms: "1 always-on", feature: "2 parallel agents" },
  { name: "Starter", price: "$19", credits: "200", vms: "1 always-on", feature: "Advanced search" },
  { name: "Plus", price: "$50", credits: "600", vms: "2 always-on", feature: "Priority support", popular: true },
  { name: "Pro", price: "$100", credits: "1,500", vms: "3 always-on", feature: "SLA guarantee" },
]

/* ─── FAQ data ─── */

const faqs = [
  {
    q: "How are credits charged?",
    a: "10 credits per minute of agent execution, rounded up. Checked every 30 seconds during a session.",
  },
  {
    q: "What happens when I run out?",
    a: "You need at least 20 credits to start a task. Hit 0 and the task pauses — buy an add-on to continue.",
  },
  {
    q: "Do unused credits roll over?",
    a: "Credits reset each billing cycle. Use them or lose them.",
  },
]

/* ─── main component ─── */

export function BillingTab({ inApp }: { inApp: boolean }) {
  return (
    <div className="space-y-16 sm:space-y-20">
      <style dangerouslySetInnerHTML={{ __html: billingAnimations }} />

      {/* ── Section 1: Hero — Credits Visual ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.h2
          variants={fade}
          custom={0}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-2 text-center"
        >
          Credits
        </motion.h2>
        <motion.p
          variants={fade}
          custom={1}
          className="text-sm text-foreground/50 text-center mb-10"
        >
          Time is the only metric.
        </motion.p>

        <motion.div
          variants={fade}
          custom={2}
          className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center"
        >
          {/* Left: Credit gauge */}
          <div className="flex flex-col items-center">
            <div className="relative w-[180px] h-[180px]">
              {/* Background ring */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-foreground/[0.06]"
                />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="text-foreground/50 gv-gauge-fill"
                />
              </svg>
              {/* Pulse ring */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[100px] h-[100px] rounded-full border border-foreground/[0.06] gv-pulse-ring" />
              </div>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] font-medium text-foreground/30 mb-1">Rate</span>
                <span className="text-2xl font-bold text-foreground/70 gv-credit-count">10</span>
                <span className="text-[10px] text-foreground/30 mt-0.5">credits/min</span>
              </div>
            </div>
            {/* Tick marks */}
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-1">
                <div className="gv-tick-1 w-1 h-3 rounded-full bg-foreground/20" />
                <div className="gv-tick-2 w-1 h-3 rounded-full bg-foreground/20" />
                <div className="gv-tick-3 w-1 h-3 rounded-full bg-foreground/20" />
              </div>
              <span className="text-[11px] text-foreground/30">metered every 30s</span>
            </div>
          </div>

          {/* Right: Example */}
          <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/30 mb-5">
              Example
            </p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold text-foreground/70">8</span>
              <span className="text-sm text-foreground/30">min task</span>
            </div>

            {/* Progress bar */}
            <div className="relative w-full h-2 rounded-full bg-foreground/[0.06] mb-3 overflow-hidden">
              <div className="gv-progress-deplete absolute inset-y-0 left-0 rounded-full bg-foreground/20" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-foreground/30">Start: 600 credits</span>
              <span className="text-[11px] text-foreground/30">End: 520 credits</span>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-xl bg-foreground/[0.03] px-4 py-3">
              <Lightning size={16} weight="duotone" className="text-foreground/40" />
              <div>
                <p className="text-sm font-semibold text-foreground/60">80 credits used</p>
                <p className="text-[11px] text-foreground/30">8 min x 10 credits/min</p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 2: Plans ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.h2
          variants={fade}
          custom={0}
          className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-8 text-center"
        >
          Plans
        </motion.h2>

        <motion.div
          variants={stagger}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              variants={fade}
              custom={i + 1}
              className={`relative rounded-2xl border p-4 text-center transition-colors ${
                plan.popular
                  ? "border-foreground/[0.15] bg-foreground/[0.04]"
                  : "border-foreground/[0.06] bg-foreground/[0.02]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] border border-foreground/[0.1] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-foreground/50">
                    <Star size={8} weight="fill" />
                    Popular
                  </span>
                </div>
              )}

              <p className="text-[12px] font-semibold text-foreground/60 mb-1 mt-1">{plan.name}</p>
              <p className="text-xl font-bold text-foreground/70 mb-3">{plan.price}<span className="text-[11px] font-normal text-foreground/30">/mo</span></p>

              <div className="space-y-2 text-[11px] text-foreground/40">
                <p><span className="font-semibold text-foreground/55">{plan.credits}</span> credits</p>
                <p>{plan.vms} VM{plan.vms !== "1 temp" && plan.vms !== "1 always-on" ? "s" : ""}</p>
                <p className="text-foreground/35">{plan.feature}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* ── Section 3: FAQ ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.h2
          variants={fade}
          custom={0}
          className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-8 text-center"
        >
          FAQ
        </motion.h2>

        <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              variants={fade}
              custom={i + 1}
              className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-5"
            >
              <p className="text-[13px] font-semibold text-foreground/60 mb-2">{faq.q}</p>
              <p className="text-[12px] text-foreground/35 leading-relaxed">{faq.a}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* ── CTA ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex justify-center"
      >
        <Link
          href="/billing"
          className="inline-flex items-center gap-2.5 h-11 px-6 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Go to Billing
          <ArrowRight size={15} weight="bold" />
        </Link>
      </motion.div>
    </div>
  )
}
