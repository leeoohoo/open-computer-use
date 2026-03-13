"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Lightning,
  Users,
  CircleNotch,
  CheckCircle,
  Circle,
  Cpu,
  Sliders,
  PaperPlaneRight,
  MagnifyingGlass,
  Briefcase,
  MapPin,
  EnvelopeSimple,
  ShareNetwork,
  TestTube,
  Export,
  Lock,
  ArrowRight,
  ToggleRight,
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

const useCases = [
  {
    icon: MagnifyingGlass,
    title: "Parallel research",
    description: "Research 5 competitors simultaneously, one per machine",
    accent: "text-cyan-600 dark:text-cyan-400",
    accentBg: "bg-cyan-500/[0.04] dark:bg-cyan-400/[0.06]",
  },
  {
    icon: Briefcase,
    title: "Bulk applications",
    description: "Apply to jobs on different platforms at the same time",
    accent: "text-sky-600 dark:text-sky-400",
    accentBg: "bg-sky-500/[0.04] dark:bg-sky-400/[0.06]",
  },
  {
    icon: MapPin,
    title: "Multi-city search",
    description: "Search for listings in 5 cities at once",
    accent: "text-emerald-600 dark:text-emerald-400",
    accentBg: "bg-emerald-500/[0.04] dark:bg-emerald-400/[0.06]",
  },
  {
    icon: EnvelopeSimple,
    title: "Parallel outreach",
    description: "Send personalized emails to different segments simultaneously",
    accent: "text-violet-600 dark:text-violet-400",
    accentBg: "bg-violet-500/[0.04] dark:bg-violet-400/[0.06]",
  },
  {
    icon: ShareNetwork,
    title: "Cross-platform posting",
    description: "Post content to 5 platforms at the same time",
    accent: "text-amber-600 dark:text-amber-400",
    accentBg: "bg-amber-500/[0.04] dark:bg-amber-400/[0.06]",
  },
  {
    icon: TestTube,
    title: "Distributed testing",
    description: "Test your app on multiple scenarios in parallel",
    accent: "text-orange-600 dark:text-orange-400",
    accentBg: "bg-orange-500/[0.04] dark:bg-orange-400/[0.06]",
  },
]

const machines = [
  {
    id: 1,
    status: "completed" as const,
    summary: "Found 12 companies in Austin, TX",
  },
  {
    id: 2,
    status: "completed" as const,
    summary: "Found 8 companies in Denver, CO",
  },
  {
    id: 3,
    status: "running" as const,
    summary: "Searching for companies in Seattle...",
  },
  {
    id: 4,
    status: "running" as const,
    summary: "Opening browser...",
  },
  {
    id: 5,
    status: "pending" as const,
    summary: "Waiting...",
  },
]

/* ─── helper components ─── */

function StatusIcon({ status }: { status: "completed" | "running" | "pending" }) {
  if (status === "completed") {
    return <CheckCircle size={18} weight="duotone" className="text-emerald-500 dark:text-emerald-400 shrink-0" />
  }
  if (status === "running") {
    return <CircleNotch size={18} weight="bold" className="text-blue-500 dark:text-blue-400 shrink-0 animate-spin" />
  }
  return <Circle size={18} weight="regular" className="text-muted-foreground/30 shrink-0" />
}

function StatusLabel({ status }: { status: "completed" | "running" | "pending" }) {
  if (status === "completed") {
    return <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">Completed</span>
  }
  if (status === "running") {
    return <span className="text-blue-600 dark:text-blue-400 text-xs font-medium">Running</span>
  }
  return <span className="text-muted-foreground/40 text-xs font-medium">Pending</span>
}

/* ─── main export ─── */

export function SwarmModeTab({ inApp }: { inApp: boolean }) {
  return (
    <div className="space-y-0">

      {/* ── Section 1: What is Swarm Mode? ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className="mb-12 sm:mb-16"
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-4"
        >
          Swarm Mode
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-4"
        >
          What is Swarm Mode?
        </motion.h2>

        <motion.p
          variants={fade}
          custom={2}
          className="text-sm sm:text-base text-foreground font-semibold leading-relaxed mb-3 max-w-2xl"
        >
          Run the same task on multiple machines simultaneously &mdash; 10x the output in the same time.
        </motion.p>

        <motion.p
          variants={fade}
          custom={3}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed max-w-2xl mb-4"
        >
          Swarm mode spins up 2&ndash;10 temporary VMs and runs your task on each one in parallel.
          Each machine works independently, handling its own slice of the work. When all machines
          finish, results are collected in one place.
        </motion.p>

        <motion.div
          variants={fade}
          custom={4}
          className="rounded-xl border border-border/40 bg-card/50 p-4 sm:p-5 max-w-2xl"
        >
          <p className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed">
            <span className="text-foreground font-medium">Example:</span> Instead of sending
            10 cold emails one by one, swarm mode sends 10 simultaneously &mdash; each from a
            separate machine.
          </p>
        </motion.div>
      </motion.section>

      {/* ── Section 2: How to Enable Swarm Mode ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className="mb-12 sm:mb-16"
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Getting started
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
        >
          How to Enable Swarm Mode
        </motion.h2>

        {/* Steps */}
        <motion.div variants={stagger} className="space-y-4 mb-8">
          {[
            {
              step: 1,
              title: "Go to the homepage chat",
              description: "Swarm mode is available from the homepage chat — not inside an existing conversation.",
            },
            {
              step: 2,
              title: "Toggle Swarm Mode on",
              description: "Click the toggle to enable swarm mode for your next task.",
            },
            {
              step: 3,
              title: "Set the number of machines",
              description: "Use the slider to choose how many machines (2–10) will run in parallel.",
            },
            {
              step: 4,
              title: "Type your task and send",
              description: "Write your prompt as usual, then hit send. All machines will start simultaneously.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              variants={fade}
              custom={i + 2}
              className="flex items-start gap-4"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] dark:bg-foreground/[0.08] text-xs font-bold text-foreground/70">
                {item.step}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-[13px] text-muted-foreground/60 mt-0.5 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Mock: Toggle */}
        <motion.div
          variants={fade}
          custom={6}
          className="mb-4 rounded-xl border border-border/40 bg-card/50 p-4 inline-flex items-center gap-3"
        >
          <ToggleRight size={28} weight="duotone" className="text-blue-500 dark:text-blue-400" />
          <span className="text-sm font-medium text-foreground">Swarm Mode</span>
          <span className="ml-2 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-400/10 px-2 py-0.5 rounded-full">
            ON
          </span>
        </motion.div>

        {/* Mock: Slider */}
        <motion.div
          variants={fade}
          custom={7}
          className="mb-6 rounded-xl border border-border/40 bg-card/50 p-4 max-w-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Machines</span>
            <span className="text-sm font-bold text-foreground">5</span>
          </div>
          <div className="relative h-2 rounded-full bg-border/40">
            <div className="absolute inset-y-0 left-0 w-[37.5%] rounded-full bg-blue-500 dark:bg-blue-400" />
            <div className="absolute top-1/2 left-[37.5%] -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-foreground border-2 border-background shadow-sm" />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] text-muted-foreground/40">2</span>
            <span className="text-[11px] text-muted-foreground/40">10</span>
          </div>
        </motion.div>

        {/* Mock: Full chat input area */}
        <motion.div
          variants={fade}
          custom={8}
          className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden max-w-2xl"
        >
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 bg-card/30">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-400/10 px-2.5 py-1 rounded-full">
              <Lightning size={12} weight="duotone" />
              Swarm Mode: ON
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60 bg-foreground/[0.03] px-2.5 py-1 rounded-full">
              <Cpu size={12} weight="duotone" />
              Machines: 5
            </span>
          </div>

          {/* Input area */}
          <div className="flex items-end gap-3 p-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground/80 leading-relaxed">
                Find SaaS companies in 5 different cities and compile a list for each
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
              <PaperPlaneRight size={14} weight="bold" />
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 3: Monitoring Swarm Execution ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className="mb-12 sm:mb-16"
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Live monitoring
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-4"
        >
          Monitoring Swarm Execution
        </motion.h2>

        <motion.p
          variants={fade}
          custom={2}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed mb-8 max-w-2xl"
        >
          Once your swarm is running, a live panel shows the status of every machine in real time.
          You can see which machines have completed, which are still working, and what each one
          is currently doing.
        </motion.p>

        {/* Mock: Swarm Panel */}
        <motion.div
          variants={fade}
          custom={3}
          className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden max-w-2xl"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-400/10">
                <Users size={16} weight="duotone" className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Swarm Run &mdash; 5 Machines</h3>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">Started 2 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-400/10 px-2.5 py-1 rounded-full">
                <CircleNotch size={10} weight="bold" className="animate-spin" />
                Running
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="px-5 py-3 border-b border-border/20 bg-card/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground/60">Progress</span>
              <span className="text-xs font-semibold text-foreground">3/5 completed</span>
            </div>
            <div className="h-1.5 rounded-full bg-border/30">
              <div className="h-full w-[60%] rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500" />
            </div>
          </div>

          {/* Machine list */}
          <div className="divide-y divide-border/20">
            {machines.map((machine) => (
              <div
                key={machine.id}
                className={cn(
                  "flex items-center gap-3 px-5 py-3.5 transition-colors",
                  machine.status === "running" && "bg-blue-500/[0.02] dark:bg-blue-400/[0.02]",
                  machine.status === "pending" && "opacity-50"
                )}
              >
                <StatusIcon status={machine.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">
                      Machine {machine.id}
                    </span>
                    <StatusLabel status={machine.status} />
                  </div>
                  <p className="text-[12px] text-muted-foreground/50 mt-0.5 truncate">
                    {machine.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 4: Best Use Cases ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className="mb-12 sm:mb-16"
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Use cases
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
        >
          Best Use Cases for Swarm
        </motion.h2>

        <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {useCases.map((uc, i) => {
            const Icon = uc.icon
            return (
              <motion.div
                key={i}
                variants={fade}
                custom={i + 2}
                className="rounded-2xl border border-border/40 bg-card/50 p-5 sm:p-6"
              >
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl mb-3",
                  uc.accentBg,
                  uc.accent,
                )}>
                  <Icon size={18} weight="duotone" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">
                  {uc.title}
                </h3>
                <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
                  {uc.description}
                </p>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.section>

      {/* ── Section 5: Swarm Results ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className="mb-12 sm:mb-16"
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Results
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-4"
        >
          Swarm Results
        </motion.h2>

        <motion.p
          variants={fade}
          custom={2}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed mb-8 max-w-2xl"
        >
          Results from all machines are collected in one place. Each machine&apos;s output is
          summarized in a card you can expand for full details.
        </motion.p>

        {/* Mock: Results view */}
        <motion.div
          variants={fade}
          custom={3}
          className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden max-w-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-400/10">
                <CheckCircle size={16} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Swarm Complete</h3>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">5/5 Machines Finished</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-400/10 px-2.5 py-1 rounded-full">
              <CheckCircle size={10} weight="bold" />
              Done
            </span>
          </div>

          {/* Result cards */}
          <div className="divide-y divide-border/20">
            {[
              { id: 1, city: "Austin, TX", count: 12 },
              { id: 2, city: "Denver, CO", count: 8 },
              { id: 3, city: "Seattle, WA", count: 15 },
              { id: 4, city: "Portland, OR", count: 6 },
              { id: 5, city: "Nashville, TN", count: 10 },
            ].map((result) => (
              <div key={result.id} className="flex items-center gap-3 px-5 py-3.5">
                <CheckCircle size={16} weight="duotone" className="text-emerald-500/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-foreground">
                    Machine {result.id}
                  </span>
                  <p className="text-[12px] text-muted-foreground/50 mt-0.5">
                    Found {result.count} SaaS companies in {result.city}
                  </p>
                </div>
                <button className="text-[11px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-foreground/[0.03]">
                  Expand
                </button>
              </div>
            ))}
          </div>

          {/* Export button */}
          <div className="px-5 py-4 border-t border-border/30 bg-card/20">
            <button className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity">
              <Export size={14} weight="bold" />
              Export All Results
            </button>
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 6: Availability ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className="mb-12 sm:mb-16"
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Availability
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
        >
          Plan Requirements
        </motion.h2>

        <motion.div variants={stagger} className="space-y-4 max-w-2xl">
          {/* Free tier */}
          <motion.div
            variants={fade}
            custom={2}
            className="rounded-xl border border-border/40 bg-card/50 p-4 sm:p-5 flex items-center gap-4"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.04] dark:bg-foreground/[0.06]">
              <Lock size={16} weight="duotone" className="text-muted-foreground/50" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Free Plan</p>
              <p className="text-[13px] text-muted-foreground/50 mt-0.5">
                Swarm mode is not available on the free plan.
              </p>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground/40 bg-foreground/[0.03] px-2.5 py-1 rounded-full shrink-0">
              Not available
            </span>
          </motion.div>

          {/* Starter+ tier */}
          <motion.div
            variants={fade}
            custom={3}
            className="rounded-xl border border-emerald-500/15 dark:border-emerald-400/15 bg-emerald-500/[0.03] dark:bg-emerald-400/[0.04] p-4 sm:p-5 flex items-center gap-4"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 dark:bg-emerald-400/10">
              <Sliders size={16} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Starter+ Plans</p>
              <p className="text-[13px] text-muted-foreground/60 mt-0.5">
                Available with a max of 2x your plan&apos;s machine limit.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-400/10 px-2.5 py-1 rounded-full shrink-0">
              <CheckCircle size={10} weight="bold" />
              Available
            </span>
          </motion.div>
        </motion.div>

        {/* Note */}
        <motion.div
          variants={fade}
          custom={4}
          className="rounded-xl border border-border/40 bg-card/50 p-4 sm:p-5 mt-6 max-w-2xl"
        >
          <p className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed">
            <span className="text-foreground font-medium">Note:</span> Swarm machines are
            temporary &mdash; they&apos;re created for the task and deleted when done. No extra
            charges beyond credit usage.
          </p>
        </motion.div>
      </motion.section>

      {/* ── CTA ── */}
      {inApp && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="rounded-2xl border border-border/40 bg-card/30 text-center p-6 sm:p-8 mb-8"
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
            Try it now
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-3">
            Ready to run your first swarm?
          </h2>
          <p className="text-sm text-muted-foreground/60 max-w-lg mx-auto mb-6">
            Go to the homepage, enable Swarm Mode, and send a task to see parallel execution in action.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Start a swarm
            <ArrowRight size={14} weight="bold" />
          </a>
        </motion.section>
      )}
    </div>
  )
}
