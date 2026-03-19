"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import {
  ChatText,
  TreeStructure,
  CursorClick,
  ArrowRight,
  Crosshair,
  Megaphone,
  Briefcase,
  EnvelopeSimple,
  Table,
  MagnifyingGlass,
  Bug,
  UsersThree,
  Headset,
  Rocket,
  Eye,
  Lightning,
  ShieldCheck,
  Keyboard,
  VideoCamera,
} from "@phosphor-icons/react"

/* ─── animations ─── */

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
}

/* ─── CSS keyframes for visual illustrations ─── */

const illustrationStyles = `
  @keyframes gv-typing {
    0%, 100% { width: 0 }
    30%, 70% { width: 100% }
  }
  @keyframes gv-cursor-blink {
    0%, 100% { opacity: 1 }
    50% { opacity: 0 }
  }
  @keyframes gv-step-fill {
    0% { transform: scaleX(0) }
    100% { transform: scaleX(1) }
  }
  @keyframes gv-click-ring {
    0% { transform: scale(0.8); opacity: 0 }
    50% { transform: scale(1); opacity: 1 }
    100% { transform: scale(1.8); opacity: 0 }
  }
  @keyframes gv-scan-line {
    0% { top: 10% }
    100% { top: 85% }
  }
  @keyframes gv-check-pop {
    0% { transform: scale(0); opacity: 0 }
    60% { transform: scale(1.2); opacity: 1 }
    100% { transform: scale(1); opacity: 1 }
  }
  @keyframes gv-fade-in {
    0% { opacity: 0; transform: translateY(4px) }
    100% { opacity: 1; transform: translateY(0) }
  }
  @keyframes gv-progress {
    0% { width: 0% }
    100% { width: var(--progress, 75%) }
  }
  @keyframes gv-float {
    0%, 100% { transform: translateY(0) }
    50% { transform: translateY(-3px) }
  }
`

/* ─── step illustrations ─── */

function DescribeVisual() {
  return (
    <div className="relative h-[100px] w-full flex items-center justify-center overflow-hidden">
      {/* Chat input mock */}
      <div className="w-[200px] rounded-lg border border-foreground/10 bg-foreground/[0.03] p-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center h-5">
              <div
                className="text-[11px] text-foreground/60 whitespace-nowrap overflow-hidden font-mono"
                style={{ animation: "gv-typing 4s ease-in-out infinite" }}
              >
                Apply to 10 jobs on LinkedIn...
              </div>
              <div
                className="w-px h-3 bg-foreground/40 ml-px shrink-0"
                style={{ animation: "gv-cursor-blink 1s step-end infinite" }}
              />
            </div>
          </div>
          <div className="h-5 w-5 rounded bg-foreground/10 flex items-center justify-center shrink-0">
            <ArrowRight size={8} className="text-foreground/40" />
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanVisual() {
  return (
    <div className="relative h-[100px] w-full flex items-center justify-center overflow-hidden">
      <div className="space-y-1.5 w-[180px]">
        {["Open browser", "Navigate to LinkedIn", "Search roles", "Fill forms"].map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="h-1.5 w-1.5 rounded-full bg-foreground/40"
              style={{ animation: `gv-check-pop 0.3s ease forwards ${0.8 + i * 0.5}s`, opacity: 0 }}
            />
            <div className="flex-1 h-[1px] bg-foreground/8 relative overflow-hidden rounded-full">
              <div
                className="absolute inset-y-0 left-0 bg-foreground/20 rounded-full origin-left"
                style={{ animation: `gv-step-fill 0.6s ease forwards ${1 + i * 0.5}s`, transform: "scaleX(0)" }}
              />
            </div>
            <span
              className="text-[9px] text-foreground/40 whitespace-nowrap"
              style={{ animation: `gv-fade-in 0.3s ease forwards ${1 + i * 0.5}s`, opacity: 0 }}
            >
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExecuteVisual() {
  return (
    <div className="relative h-[100px] w-full flex items-center justify-center overflow-hidden">
      {/* Mini browser */}
      <div className="w-[180px] rounded-lg border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
        {/* URL bar */}
        <div className="flex items-center gap-1.5 px-2 py-1 border-b border-foreground/5">
          <div className="flex gap-0.5">
            <div className="h-1 w-1 rounded-full bg-foreground/15" />
            <div className="h-1 w-1 rounded-full bg-foreground/15" />
            <div className="h-1 w-1 rounded-full bg-foreground/15" />
          </div>
          <div className="flex-1 h-3 rounded bg-foreground/5 flex items-center px-1.5">
            <span className="text-[7px] text-foreground/30">linkedin.com/jobs</span>
          </div>
        </div>
        {/* Page content with scanning cursor */}
        <div className="relative p-2 h-[55px]">
          <div className="space-y-1">
            <div className="h-1.5 w-[70%] rounded-full bg-foreground/8" />
            <div className="h-1.5 w-[50%] rounded-full bg-foreground/5" />
            <div className="h-1.5 w-[60%] rounded-full bg-foreground/5" />
          </div>
          {/* Click indicator */}
          <div
            className="absolute w-3 h-3 rounded-full border border-foreground/30"
            style={{
              left: "40%",
              top: "30%",
              animation: "gv-click-ring 2s ease-in-out infinite 1.5s",
            }}
          />
        </div>
      </div>
    </div>
  )
}

/* ─── capability categories ─── */

const categories = [
  { icon: Crosshair, name: "Sales", example: "Find 50 leads, send personalized emails" },
  { icon: Megaphone, name: "Marketing", example: "Publish blog posts, schedule social media" },
  { icon: Briefcase, name: "Job Apps", example: "Apply to 20 jobs, tailor each resume" },
  { icon: EnvelopeSimple, name: "Email", example: "Draft replies, bulk outreach, unsubscribe" },
  { icon: Table, name: "Data Entry", example: "Transfer data between apps, build spreadsheets" },
  { icon: MagnifyingGlass, name: "Research", example: "Deep reports, competitor monitoring" },
  { icon: Bug, name: "QA Testing", example: "Test signups, fuzz forms, site health checks" },
  { icon: UsersThree, name: "HR", example: "Source candidates, personalized outreach" },
  { icon: Headset, name: "Support", example: "Draft responses, update help docs" },
  { icon: Rocket, name: "Productivity", example: "Book travel, pay bills, manage calendars" },
]

/* ─── differentiators ─── */

function DiffVisualHuman() {
  return (
    <div className="h-12 flex items-center justify-center">
      <div className="flex items-center gap-1">
        {/* Eye scanning a page */}
        <div className="relative w-[60px] h-8 rounded border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
          <div className="space-y-0.5 p-1">
            <div className="h-0.5 w-[80%] bg-foreground/10" />
            <div className="h-0.5 w-[60%] bg-foreground/10" />
            <div className="h-0.5 w-[70%] bg-foreground/10" />
            <div className="h-0.5 w-[50%] bg-foreground/10" />
          </div>
          <div
            className="absolute left-0 right-0 h-px bg-foreground/20"
            style={{ animation: "gv-scan-line 3s ease-in-out infinite" }}
          />
        </div>
        <ArrowRight size={8} className="text-foreground/20" />
        <div className="w-3 h-3 rounded border border-foreground/20 flex items-center justify-center">
          <CursorClick size={6} className="text-foreground/30" />
        </div>
      </div>
    </div>
  )
}

function DiffVisualNoSetup() {
  return (
    <div className="h-12 flex items-center justify-center">
      <div className="flex items-center gap-2">
        <div className="rounded border border-foreground/10 bg-foreground/[0.03] px-2 py-1">
          <span className="text-[8px] text-foreground/40 font-mono">plain english</span>
        </div>
        <ArrowRight size={8} className="text-foreground/20" />
        <div
          className="text-[8px] text-foreground/30"
          style={{ animation: "gv-check-pop 0.5s ease forwards 1s", opacity: 0 }}
        >
          done
        </div>
      </div>
    </div>
  )
}

function DiffVisualAdapts() {
  return (
    <div className="h-12 flex items-center justify-center">
      <div className="flex items-center gap-1.5">
        {/* Error → adapt → success flow */}
        <div className="rounded border border-foreground/15 bg-foreground/[0.03] px-1.5 py-0.5">
          <span className="text-[7px] text-foreground/30">CAPTCHA</span>
        </div>
        <div
          className="text-[7px] text-foreground/20"
          style={{ animation: "gv-float 2s ease-in-out infinite" }}
        >
          →
        </div>
        <div className="rounded border border-foreground/15 bg-foreground/[0.03] px-1.5 py-0.5">
          <span className="text-[7px] text-foreground/30">adapts</span>
        </div>
        <div className="text-[7px] text-foreground/20">→</div>
        <div
          className="h-2.5 w-2.5 rounded-full border border-foreground/20 flex items-center justify-center"
          style={{ animation: "gv-check-pop 0.5s ease forwards 2s", opacity: 0 }}
        >
          <div className="h-1 w-1 rounded-full bg-foreground/30" />
        </div>
      </div>
    </div>
  )
}

function DiffVisualIsolated() {
  return (
    <div className="h-12 flex items-center justify-center">
      <div className="flex items-center gap-1">
        {/* Sandboxed VM box */}
        <div className="relative w-10 h-8 rounded border border-dashed border-foreground/15 flex items-center justify-center">
          <div className="w-4 h-3 rounded-sm border border-foreground/10 bg-foreground/[0.03]" />
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full border border-foreground/15 bg-background flex items-center justify-center">
            <ShieldCheck size={5} className="text-foreground/30" />
          </div>
        </div>
      </div>
    </div>
  )
}

const differentiators = [
  { title: "Works like a human", description: "Sees, clicks, types, navigates — exactly like you", Visual: DiffVisualHuman },
  { title: "No scripts or setup", description: "Plain English in, results out", Visual: DiffVisualNoSetup },
  { title: "Handles the unexpected", description: "Adapts to CAPTCHAs, popups, layout changes", Visual: DiffVisualAdapts },
  { title: "Runs in isolation", description: "Sandboxed VM per session — nothing leaks", Visual: DiffVisualIsolated },
]

/* ─── main ─── */

export function OverviewTab({ inApp }: { inApp: boolean }) {
  return (
    <div className="space-y-12 sm:space-y-16">
      <style dangerouslySetInnerHTML={{ __html: illustrationStyles }} />

      {/* ── how it works: 3-step visual flow ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        variants={stagger}
      >
        <motion.p variants={fadeUp} className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/50 mb-6">
          How it works
        </motion.p>

        <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: 1, title: "Describe the task", Visual: DescribeVisual },
            { step: 2, title: "Coasty plans the steps", Visual: PlanVisual },
            { step: 3, title: "Executes autonomously", Visual: ExecuteVisual },
          ].map(({ step, title, Visual }) => (
            <motion.div
              key={step}
              variants={fadeUp}
              className="group rounded-2xl border border-border/30 bg-card/30 p-5 hover:border-border/50 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 block">
                Step {step}
              </span>
              <Visual />
              <p className="text-sm font-medium text-foreground mt-3">{title}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* ── capabilities grid ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        variants={stagger}
      >
        <motion.p variants={fadeUp} className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">
          What Coasty can do
        </motion.p>
        <motion.h2 variants={fadeUp} className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-6">
          40+ tasks across 10 categories
        </motion.h2>

        <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {categories.map((cat, i) => {
            const Icon = cat.icon
            return (
              <motion.div
                key={cat.name}
                variants={fadeUp}
                className="group rounded-xl border border-border/20 bg-card/20 p-3 hover:border-border/40 hover:bg-card/40 transition-all cursor-default"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} weight="duotone" className="text-foreground/50 group-hover:text-foreground/70 transition-colors shrink-0" />
                  <span className="text-[12px] font-semibold text-foreground/80">{cat.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/50 leading-relaxed line-clamp-2">
                  {cat.example}
                </p>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.section>

      {/* ── why coasty: visual differentiators ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        variants={stagger}
      >
        <motion.p variants={fadeUp} className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">
          Why Coasty
        </motion.p>
        <motion.h2 variants={fadeUp} className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-6">
          Not a chatbot. Not an RPA script.
        </motion.h2>

        <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {differentiators.map((d, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="rounded-xl border border-border/20 bg-card/20 p-4"
            >
              <d.Visual />
              <p className="text-[13px] font-semibold text-foreground mt-1">{d.title}</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">{d.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* ── cta ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl border border-border/30 bg-card/20 text-center p-6 sm:p-8"
      >
        <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight mb-2">
          {inApp ? "Pick any task and try it" : "Ready to put Coasty to work?"}
        </h2>
        <p className="text-sm text-muted-foreground/50 max-w-md mx-auto mb-5">
          {inApp
            ? "Describe any task from this guide and watch Coasty handle it."
            : "Start free. No credit card required."
          }
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {inApp ? (
            <Link
              href="/"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Start a task
              <ArrowRight size={14} weight="bold" />
            </Link>
          ) : (
            <>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Start free
                <ArrowRight size={14} weight="bold" />
              </Link>
              <Link
                href="/download"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
              >
                <Keyboard size={16} weight="duotone" />
                Desktop app
              </Link>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
