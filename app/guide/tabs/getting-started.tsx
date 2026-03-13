"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  ArrowRight,
  ArrowSquareOut,
  Copy,
  Desktop,
  GoogleLogo,
  Lock,
  PaperPlaneTilt,
  Play,
  ShieldCheck,
  CircleNotch,
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

/* ─── mock UI components ─── */

function MockSignUp() {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="w-full max-w-[280px] rounded-2xl border border-dashed border-border/60 bg-card/40 p-6 text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/[0.06]">
          <span className="text-lg font-bold text-foreground/80">C</span>
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">Welcome to Coasty</p>
        <p className="text-[11px] text-muted-foreground/50 mb-5">Sign in to get started</p>
        <div className="flex items-center justify-center gap-2.5 rounded-xl border border-border/50 bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground/80 cursor-default select-none">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/[0.06] text-[11px] font-bold text-foreground/60">G</span>
          Sign in with Google
        </div>
        <p className="mt-4 text-[10px] text-muted-foreground/40">Free tier available — no credit card required</p>
      </div>
    </div>
  )
}

function MockCreateMachine() {
  return (
    <div className="space-y-4 py-2">
      {/* Create dialog */}
      <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-5">
        <p className="text-sm font-semibold text-foreground mb-4">New Machine</p>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Machine Name</label>
            <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground/70">
              My First Machine
            </div>
          </div>
          <div className="flex justify-end">
            <div className="rounded-lg bg-foreground/90 px-4 py-1.5 text-xs font-medium text-background cursor-default select-none">
              Create
            </div>
          </div>
        </div>
      </div>

      {/* Machine card after creation */}
      <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Desktop size={16} weight="duotone" className="text-foreground/60" />
            <span className="text-sm font-medium text-foreground">My First Machine</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Running</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground/50 mb-3">
          <span>CPU: 2 cores</span>
          <span>Memory: 4 GB</span>
          <span>Storage: 30 GB</span>
        </div>
        <div className="flex justify-end">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-foreground/70 cursor-default select-none">
            <Play size={12} weight="fill" className="text-foreground/50" />
            Connect
          </div>
        </div>
      </div>
    </div>
  )
}

function MockCredentials() {
  return (
    <div className="space-y-4 py-2">
      {/* Credential form */}
      <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-5">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Service</label>
            <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground/70">
              linkedin.com
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Username</label>
              <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground/70">
                you@email.com
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Password</label>
              <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground/70">
                ••••••••••
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="rounded-lg bg-foreground/90 px-4 py-1.5 text-xs font-medium text-background cursor-default select-none">
              Save
            </div>
          </div>
        </div>
      </div>

      {/* Saved credentials */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Lock size={12} weight="duotone" className="text-emerald-500" />
            <span className="text-xs font-medium text-foreground">gmail.com</span>
          </div>
          <p className="text-[11px] text-muted-foreground/50">user@gmail.com</p>
          <p className="text-[11px] text-muted-foreground/40">••••••••</p>
        </div>
        <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Lock size={12} weight="duotone" className="text-emerald-500" />
            <span className="text-xs font-medium text-foreground">linkedin.com</span>
          </div>
          <p className="text-[11px] text-muted-foreground/50">you@email.com</p>
          <p className="text-[11px] text-muted-foreground/40">••••••••</p>
        </div>
      </div>
    </div>
  )
}

function MockChat() {
  return (
    <div className="space-y-3 py-2">
      {/* Chat messages */}
      <div className="space-y-3">
        {/* User message */}
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-foreground/[0.06] px-4 py-2.5">
            <p className="text-[13px] text-foreground/80">
              Find 10 SaaS companies in Austin, TX and add them to my spreadsheet
            </p>
          </div>
        </div>

        {/* Assistant response */}
        <div className="space-y-2.5">
          <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-dashed border-border/40 bg-card/30 px-4 py-2.5">
            <p className="text-[13px] text-foreground/70">
              I&apos;ll find SaaS companies in Austin and add them to your spreadsheet. Let me start by searching...
            </p>
          </div>

          {/* Tool call */}
          <div className="max-w-[85%] rounded-xl border border-dashed border-border/40 bg-card/20 px-3 py-2 flex items-center gap-2">
            <CircleNotch size={12} weight="bold" className="text-muted-foreground/40 animate-spin" />
            <span className="text-[12px] text-muted-foreground/60">
              Searching Google for &quot;SaaS companies Austin TX&quot;...
            </span>
          </div>

          {/* Screenshot placeholder */}
          <div className="max-w-[85%] aspect-video rounded-xl border border-dashed border-border/40 bg-muted/30 flex items-center justify-center">
            <div className="text-center">
              <Desktop size={24} weight="duotone" className="text-muted-foreground/30 mx-auto mb-1" />
              <p className="text-[11px] text-muted-foreground/30">Desktop Screenshot</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat input bar */}
      <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/30 bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground/50">
            <Desktop size={11} weight="duotone" />
            My First Machine
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-border/30 bg-background/50 px-3 py-2 text-[12px] text-muted-foreground/40">
            Describe your task...
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/90 cursor-default">
            <ArrowRight size={14} weight="bold" className="text-background" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── step data ─── */

const steps = [
  {
    number: 1,
    title: "Sign Up",
    description: "Create your account with Google in one click",
    note: "Free tier available — no credit card required",
    mock: MockSignUp,
  },
  {
    number: 2,
    title: "Create a Machine",
    description: "Spin up a virtual computer for your AI agent to use",
    tip: "Machines auto-shutdown after 60 minutes of inactivity to save credits",
    mock: MockCreateMachine,
  },
  {
    number: 3,
    title: "Save Your Credentials",
    description: "Store logins for sites Coasty will access (Gmail, LinkedIn, CRM, etc.)",
    tip: "Credentials are encrypted end-to-end and never leave your session's isolated VM",
    link: { href: "/secrets", label: "Manage credentials" },
    mock: MockCredentials,
  },
  {
    number: 4,
    title: "Give Coasty a Task",
    description: "Type what you need in the chat and watch it work",
    tip: "Be specific! The more detail you give, the better Coasty performs",
    mock: MockChat,
  },
]

const quickPrompts = [
  "Apply to 10 matching jobs on LinkedIn with my resume",
  "Research competitor pricing and build a comparison spreadsheet",
  "Write and publish a blog post about [topic] on WordPress",
  "Unsubscribe me from all marketing emails in Gmail",
  "Test the signup flow on my website and report any bugs",
  "Find 50 leads matching [ICP] on LinkedIn and add to my CRM",
]

/* ─── main component ─── */

export function GettingStartedTab({ inApp }: { inApp: boolean }) {
  return (
    <div className="space-y-12 sm:space-y-16">

      {/* ── steps ── */}
      {steps.map((step, idx) => {
        const MockComponent = step.mock
        return (
          <motion.div
            key={step.number}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="relative"
          >
            {/* connector line between steps */}
            {idx < steps.length - 1 && (
              <div className="absolute left-[19px] top-[48px] bottom-[-48px] w-px bg-gradient-to-b from-border/40 to-transparent hidden sm:block" />
            )}

            <motion.div variants={fade} custom={0} className="flex items-start gap-4 mb-4">
              {/* step badge */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.06] dark:bg-foreground/[0.08] border border-border/30">
                <span className="text-sm font-bold text-foreground/70">{step.number}</span>
              </div>

              <div className="pt-0.5">
                <h3 className="text-base sm:text-lg font-semibold text-foreground leading-tight">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground/60 mt-0.5 leading-snug">
                  {step.description}
                </p>
              </div>
            </motion.div>

            {/* mock UI */}
            <motion.div
              variants={fade}
              custom={1}
              className="sm:ml-14 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-4 sm:p-5"
            >
              <MockComponent />
            </motion.div>

            {/* pro tip / note / link */}
            <motion.div variants={fade} custom={2} className="sm:ml-14 mt-3 space-y-2">
              {"tip" in step && step.tip && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-500/[0.04] dark:bg-amber-400/[0.05] border border-amber-500/10 dark:border-amber-400/10 px-3.5 py-2.5">
                  <ShieldCheck size={14} weight="duotone" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[12px] sm:text-[13px] text-muted-foreground/70 leading-relaxed">
                    <span className="font-medium text-foreground/70">Pro tip:</span> {step.tip}
                  </p>
                </div>
              )}

              {"note" in step && step.note && (
                <p className="text-[12px] text-muted-foreground/50 pl-1">{step.note}</p>
              )}

              {"link" in step && step.link && (
                <Link
                  href={step.link.href}
                  className="inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] font-medium text-foreground/70 hover:text-foreground transition-colors pl-1"
                >
                  {step.link.label}
                  <ArrowSquareOut size={13} weight="bold" className="shrink-0" />
                </Link>
              )}
            </motion.div>
          </motion.div>
        )
      })}

      {/* ── quick prompts ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.div variants={fade} custom={0} className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
            Quick prompts to try
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Copy, paste, and go
          </h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5 max-w-lg">
            These are real tasks Coasty can handle. Paste any of them into the chat to get started.
          </p>
        </motion.div>

        <motion.div
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {quickPrompts.map((prompt, i) => (
            <motion.div
              key={i}
              variants={fade}
              custom={i + 1}
              className={cn(
                "group relative rounded-xl border border-border/30 bg-card/30 p-4 transition-all duration-200",
                "hover:bg-card/60 hover:border-border/50 cursor-default"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground/[0.04] mt-0.5">
                  <PaperPlaneTilt size={12} weight="duotone" className="text-foreground/40" />
                </div>
                <p className="text-[13px] text-foreground/70 leading-relaxed flex-1">
                  {prompt}
                </p>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                  <Copy size={14} weight="duotone" className="text-muted-foreground/40" />
                </div>
              </div>
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
          Ready to start your first task?
        </h2>
        <p className="text-sm text-muted-foreground/60 max-w-lg mx-auto mb-6">
          Head to the chat, describe what you need done, and watch Coasty handle it end-to-end.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Start a task
          <ArrowRight size={14} weight="bold" />
        </Link>
      </motion.section>
    </div>
  )
}
