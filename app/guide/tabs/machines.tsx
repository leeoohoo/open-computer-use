"use client"

import { Fragment } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Desktop,
  Globe,
  Terminal,
  FolderOpen,
  GearSix,
  Trash,
  Play,
  Stop,
  Clock,
  CaretDown,
  Spinner,
  CircleNotch,
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

interface MachineCard {
  name: string
  status: "running" | "stopped" | "creating"
  cpu: number
  ram: string
  storage: string
  autoShutdown?: string
}

const machines: MachineCard[] = [
  {
    name: "Research Machine",
    status: "running",
    cpu: 2,
    ram: "4GB",
    storage: "30GB",
    autoShutdown: "45m remaining",
  },
  {
    name: "Email Machine",
    status: "stopped",
    cpu: 2,
    ram: "4GB",
    storage: "30GB",
  },
  {
    name: "Testing VM",
    status: "creating",
    cpu: 4,
    ram: "8GB",
    storage: "50GB",
  },
]

const lifecycleSteps = [
  { label: "Creating", color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400", description: "VM is being provisioned (30\u201360 seconds)" },
  { label: "Starting", color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400", description: "Booting up the desktop environment" },
  { label: "Running", color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400", description: "Ready for tasks \u2014 Coasty can connect" },
  { label: "Stopping", color: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400", description: "Saving state and shutting down" },
  { label: "Stopped", color: "bg-neutral-400", textColor: "text-muted-foreground", description: "No charges. Start anytime." },
]

const preInstalled = [
  { icon: Globe, label: "Chrome Browser", description: "Full Chrome with extensions support" },
  { icon: Terminal, label: "Terminal", description: "Bash shell with common CLI tools" },
  { icon: FolderOpen, label: "File System", description: "Full filesystem \u2014 create, edit, organize files" },
  { icon: Desktop, label: "Desktop Apps", description: "LibreOffice, text editors, and more" },
]

const planLimits = [
  { plan: "Free", machines: "0 persistent (temporary only)", swarm: "Not available" },
  { plan: "Starter", machines: "1 persistent machine", swarm: "2 parallel (2\u00d7)" },
  { plan: "Plus", machines: "2 persistent machines", swarm: "4 parallel (2\u00d7)" },
  { plan: "Pro", machines: "3 persistent machines", swarm: "6 parallel (2\u00d7)" },
]

/* ─── status helpers ─── */

function statusDot(status: MachineCard["status"]) {
  if (status === "running") return "bg-emerald-500"
  if (status === "creating") return "bg-blue-500"
  return "bg-neutral-400"
}

function statusLabel(status: MachineCard["status"]) {
  if (status === "running") return "Running"
  if (status === "creating") return "Creating"
  return "Stopped"
}

/* ─── mock components ─── */

function MockMachineCard({ machine }: { machine: MachineCard }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">{machine.name}</h4>
        <div className="flex items-center gap-1.5">
          {machine.status === "creating" ? (
            <CircleNotch size={12} weight="bold" className="text-blue-500 animate-spin" />
          ) : (
            <span className={cn("h-2 w-2 rounded-full", statusDot(machine.status))} />
          )}
          <span className="text-xs text-muted-foreground/70">{statusLabel(machine.status)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
        <span>CPU: {machine.cpu}</span>
        <span>\u00b7</span>
        <span>RAM: {machine.ram}</span>
        <span>\u00b7</span>
        <span>Storage: {machine.storage}</span>
      </div>

      {machine.autoShutdown && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
          <Clock size={12} weight="duotone" />
          <span>Auto-shutdown: {machine.autoShutdown}</span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {machine.status === "running" ? (
          <button className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border/40 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <Stop size={12} weight="duotone" />
            Stop
          </button>
        ) : machine.status === "stopped" ? (
          <button className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border/40 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <Play size={12} weight="duotone" />
            Start
          </button>
        ) : null}
        <button className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border/40 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <GearSix size={12} weight="duotone" />
          Settings
        </button>
        <button className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border/40 text-[11px] text-red-400/70 hover:text-red-400 transition-colors">
          <Trash size={12} weight="duotone" />
          Delete
        </button>
      </div>
    </div>
  )
}

/* ─── main export ─── */

export function MachinesTab({ inApp }: { inApp: boolean }) {
  return (
    <div className="space-y-0">

      {/* ── Section 1: Your Virtual Computers ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className="mb-14 sm:mb-20"
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Virtual Machines
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
        >
          Your Virtual Computers
        </motion.h2>
        <motion.p
          variants={fade}
          custom={2}
          className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed max-w-2xl mb-8"
        >
          Each machine is a full Ubuntu desktop with Chrome, terminal, and desktop apps &mdash; isolated and secure.
          Coasty connects to these machines to execute your tasks.
        </motion.p>

        <motion.div
          variants={fade}
          custom={3}
          className="rounded-2xl border border-border/40 bg-card/50 p-4 sm:p-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {machines.map((m) => (
              <MockMachineCard key={m.name} machine={m} />
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 2: Machine Lifecycle ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className="mb-14 sm:mb-20"
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Lifecycle
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
        >
          Machine Lifecycle
        </motion.h2>

        {/* Horizontal flow on desktop, vertical on mobile */}
        <motion.div
          variants={fade}
          custom={2}
          className="rounded-2xl border border-border/40 bg-card/50 p-5 sm:p-8"
        >
          {/* Desktop: horizontal */}
          <div className="hidden sm:flex items-start gap-0">
            {lifecycleSteps.map((step, i) => (
              <div key={step.label} className="flex items-start flex-1">
                <div className="flex flex-col items-center text-center flex-1">
                  <span className={cn("h-3 w-3 rounded-full mb-2", step.color)} />
                  <span className={cn("text-sm font-semibold mb-1", step.textColor)}>
                    {step.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground/50 leading-snug px-2">
                    {step.description}
                  </span>
                </div>
                {i < lifecycleSteps.length - 1 && (
                  <span className="text-muted-foreground/30 mt-0.5 text-lg shrink-0">&rarr;</span>
                )}
              </div>
            ))}
          </div>

          {/* Mobile: vertical */}
          <div className="flex flex-col gap-4 sm:hidden">
            {lifecycleSteps.map((step, i) => (
              <div key={step.label}>
                <div className="flex items-center gap-3">
                  <span className={cn("h-3 w-3 rounded-full shrink-0", step.color)} />
                  <span className={cn("text-sm font-semibold", step.textColor)}>
                    {step.label}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground/50 leading-snug ml-6 mt-1">
                  {step.description}
                </p>
                {i < lifecycleSteps.length - 1 && (
                  <div className="ml-[5px] mt-2 mb-0 h-3 border-l border-border/40" />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 3: Auto-Shutdown ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className="mb-14 sm:mb-20"
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Cost Saving
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
        >
          Auto-Shutdown
        </motion.h2>
        <motion.p
          variants={fade}
          custom={2}
          className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed max-w-2xl mb-8"
        >
          Machines auto-shutdown after a period of inactivity to save credits. You won&apos;t be charged while a machine is stopped.
        </motion.p>

        <motion.div
          variants={fade}
          custom={3}
          className="rounded-2xl border border-border/40 bg-card/50 p-5 sm:p-6"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/[0.06] dark:bg-amber-400/[0.08]">
              <Clock size={24} weight="duotone" className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground tracking-tight font-mono">
                Auto-shutdown in 45:00
              </p>
              <p className="text-[12px] text-muted-foreground/50 mt-0.5">
                Research Machine
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/30 bg-background/50 p-3.5">
            <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
              Default is 60 minutes. Running a task resets the timer. You can also manually stop a machine at any time from the Machines page.
            </p>
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 4: Selecting a Machine for Tasks ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className="mb-14 sm:mb-20"
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Task Setup
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
        >
          Selecting a Machine for Tasks
        </motion.h2>
        <motion.p
          variants={fade}
          custom={2}
          className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed max-w-2xl mb-8"
        >
          When starting a task, choose which machine Coasty should connect to using the VM selector in the chat input.
        </motion.p>

        <motion.div
          variants={fade}
          custom={3}
          className="rounded-2xl border border-border/40 bg-card/50 p-5 sm:p-6"
        >
          {/* Mock dropdown */}
          <div className="max-w-xs">
            <div className="rounded-xl border border-border/40 bg-background/80 overflow-hidden">
              {/* Dropdown header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/30">
                <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                  Select Machine
                </span>
                <CaretDown size={12} weight="bold" className="text-muted-foreground/40" />
              </div>

              {/* Option 1 */}
              <div className="flex items-center gap-3 px-3.5 py-3 hover:bg-foreground/[0.02] transition-colors border-b border-border/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground">Research Machine</span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Running</span>
              </div>

              {/* Option 2 */}
              <div className="flex items-center gap-3 px-3.5 py-3 hover:bg-foreground/[0.02] transition-colors opacity-60">
                <span className="h-2 w-2 rounded-full bg-neutral-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground">Email Machine</span>
                </div>
                <span className="text-[10px] text-muted-foreground/50 font-medium">Stopped</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/30 bg-background/50 p-3.5 mt-4">
            <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
              Only running machines can be selected. Start a stopped machine from the Machines page before assigning it to a task.
            </p>
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 5: What's Inside Each Machine ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className="mb-14 sm:mb-20"
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Pre-Installed
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
        >
          What&apos;s Inside Each Machine
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {preInstalled.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.label}
                variants={fade}
                custom={i + 2}
                className="rounded-2xl border border-border/40 bg-card/50 p-5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.04] dark:bg-foreground/[0.06] mb-3">
                  <Icon size={18} weight="duotone" className="text-foreground/70" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{item.label}</h3>
                <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </motion.section>

      {/* ── Section 6: Machine Limits by Plan ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
        className="mb-14 sm:mb-20"
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Plans
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
        >
          Machine Limits by Plan
        </motion.h2>

        <motion.div
          variants={fade}
          custom={2}
          className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden"
        >
          <div className="grid grid-cols-3 gap-px bg-border/20">
            <div className="bg-card/80 px-4 py-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Plan
            </div>
            <div className="bg-card/80 px-4 py-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Persistent Machines
            </div>
            <div className="bg-card/80 px-4 py-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Swarm Mode
            </div>
            {planLimits.map((row) => (
              <Fragment key={row.plan}>
                <div className="bg-background/50 px-4 py-3 text-sm font-medium text-foreground">
                  {row.plan}
                </div>
                <div className="bg-background/50 px-4 py-3 text-sm text-muted-foreground/70">
                  {row.machines}
                </div>
                <div className={cn(
                  "bg-background/50 px-4 py-3 text-sm",
                  row.swarm === "Not available" ? "text-muted-foreground/40" : "text-muted-foreground/70"
                )}>
                  {row.swarm}
                </div>
              </Fragment>
            ))}
          </div>
        </motion.div>

        <motion.div
          variants={fade}
          custom={3}
          className="rounded-xl border border-border/30 bg-background/50 p-3.5 mt-4"
        >
          <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
            Swarm mode lets you run tasks on multiple machines in parallel. The limit is 2× your plan&apos;s persistent machine count. Swarm machines are temporary and auto-delete after the task completes.
          </p>
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
          Ready to spin up a machine?
        </h2>
        <p className="text-sm text-muted-foreground/60 max-w-lg mx-auto mb-6">
          Go to the Machines page to create, manage, and connect to your virtual computers.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/machines"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to Machines
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
