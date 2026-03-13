"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  ArrowRight,
  ArrowsOutSimple,
  AppWindow,
  Camera,
  CaretDown,
  Check,
  Desktop,
  DownloadSimple,
  FolderOpen,
  Globe,
  Lightning,
  Minus,
  ShieldCheck,
  Terminal,
  UserCircle,
  WifiHigh,
  X,
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

function MockCompactPill() {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="inline-flex items-center gap-3 rounded-full border border-dashed border-border/60 bg-card/50 px-5 py-2.5 shadow-sm">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground/[0.08]">
          <span className="text-[11px] font-bold text-foreground/70">C</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[12px] font-medium text-foreground/70">Ready</span>
        </div>
        <CaretDown size={12} weight="bold" className="text-muted-foreground/40" />
      </div>
    </div>
  )
}

function MockExpandedPanel() {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="w-full max-w-[300px] rounded-2xl border border-dashed border-border/60 bg-card/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/[0.08]">
              <span className="text-[9px] font-bold text-foreground/70">C</span>
            </div>
            <span className="text-[12px] font-semibold text-foreground/80">Coasty</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-foreground/[0.04]">
              <Minus size={10} weight="bold" className="text-muted-foreground/40" />
            </div>
            <div className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-foreground/[0.04]">
              <X size={10} weight="bold" className="text-muted-foreground/40" />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-2.5 p-3">
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground/[0.06] px-3 py-2">
              <p className="text-[11px] text-foreground/70">Open my resume and update the work experience section</p>
            </div>
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-dashed border-border/30 bg-card/30 px-3 py-2">
            <p className="text-[11px] text-foreground/60">I&apos;ll open your resume file and update the work experience. Let me find it first...</p>
          </div>
          <div className="max-w-[85%] rounded-xl border border-dashed border-border/30 bg-card/20 px-2.5 py-1.5 flex items-center gap-1.5">
            <FolderOpen size={10} weight="duotone" className="text-muted-foreground/40" />
            <span className="text-[10px] text-muted-foreground/50">Reading ~/Documents/resume.docx</span>
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border/30 p-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-border/30 bg-background/50 px-2.5 py-1.5 text-[11px] text-muted-foreground/40">
              Describe your task...
            </div>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground/90">
              <ArrowRight size={10} weight="bold" className="text-background" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── capability cards data ─── */

const capabilities = [
  {
    icon: Globe,
    title: "Browser",
    description: "Control Chrome, Edge, or Brave on your machine — navigate, click, fill forms",
  },
  {
    icon: FolderOpen,
    title: "Files",
    description: "Read, write, edit files anywhere on your computer",
  },
  {
    icon: Terminal,
    title: "Terminal",
    description: "Run shell commands — PowerShell on Windows, bash on macOS/Linux",
  },
  {
    icon: Desktop,
    title: "Desktop",
    description: "Click, type, scroll anywhere on your screen",
  },
  {
    icon: Camera,
    title: "Screenshots",
    description: "Capture your screen to understand what's visible",
  },
  {
    icon: AppWindow,
    title: "Apps",
    description: "Open and interact with any installed application",
  },
]

/* ─── comparison data ─── */

const comparisonRows = [
  { feature: "Isolation", cloud: "Fully sandboxed", desktop: "Your machine", cloudCheck: true, desktopCheck: false },
  { feature: "Local files", cloud: "Upload needed", desktop: "Direct access", cloudCheck: false, desktopCheck: true },
  { feature: "Installed apps", cloud: "Pre-installed only", desktop: "All your apps", cloudCheck: false, desktopCheck: true },
  { feature: "Browser sessions", cloud: "Fresh browser", desktop: "Your logged-in sessions", cloudCheck: false, desktopCheck: true },
  { feature: "Security", cloud: "Maximum", desktop: "Standard", cloudCheck: true, desktopCheck: false },
  { feature: "Best for", cloud: "Sensitive tasks, testing", desktop: "Local file work, app automation", cloudCheck: false, desktopCheck: false },
]

/* ─── connection steps ─── */

const connectionSteps = [
  {
    icon: UserCircle,
    title: "Sign in",
    description: "Google OAuth, same account as web app",
  },
  {
    icon: WifiHigh,
    title: "Connect",
    description: "Secure WebSocket to Coasty backend",
  },
  {
    icon: Lightning,
    title: "Execute",
    description: "Commands run directly on your machine",
  },
]

/* ─── main component ─── */

export function DesktopAppTab({ inApp }: { inApp: boolean }) {
  return (
    <div className="space-y-12 sm:space-y-16">

      {/* ── Section 1: Coasty on Your Desktop ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.div variants={fade} custom={0} className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
            Desktop App
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Coasty on Your Desktop
          </h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5 max-w-lg leading-relaxed">
            The desktop app lets Coasty control YOUR local computer — your browser, files, and apps — instead of a remote VM.
          </p>
        </motion.div>

        <motion.div
          variants={fade}
          custom={1}
          className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/[0.08] dark:bg-amber-400/[0.1] mt-0.5">
              <ArrowsOutSimple size={16} weight="duotone" className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground/80 mb-1">Key difference</p>
              <p className="text-[12px] sm:text-[13px] text-muted-foreground/70 leading-relaxed">
                <span className="font-medium text-foreground/70">Cloud VM</span> = isolated remote computer.{" "}
                <span className="font-medium text-foreground/70">Desktop App</span> = your actual machine.
                Use the desktop app when you need Coasty to work with your local files, installed apps, or logged-in browser sessions.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 2: The Floating Overlay ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.div variants={fade} custom={0} className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
            Interface
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            The Floating Overlay
          </h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5 max-w-lg leading-relaxed">
            The app runs as a small floating pill at the top of your screen, always accessible on top of other windows.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Compact mode */}
          <motion.div
            variants={fade}
            custom={1}
            className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-4 sm:p-5"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/50 mb-3">
              Compact Mode
            </p>
            <MockCompactPill />
            <p className="text-[12px] text-muted-foreground/50 text-center mt-2">
              Click to expand. Always visible on top of other windows.
            </p>
          </motion.div>

          {/* Expanded mode */}
          <motion.div
            variants={fade}
            custom={2}
            className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-4 sm:p-5"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/50 mb-3">
              Expanded Mode
            </p>
            <MockExpandedPanel />
            <p className="text-[12px] text-muted-foreground/50 text-center mt-2">
              Full chat interface. Give tasks just like in the web app.
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* ── Section 3: What It Can Do Locally ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.div variants={fade} custom={0} className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
            Capabilities
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            What It Can Do Locally
          </h2>
        </motion.div>

        <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {capabilities.map((cap, i) => {
            const Icon = cap.icon
            return (
              <motion.div
                key={cap.title}
                variants={fade}
                custom={i + 1}
                className={cn(
                  "group rounded-2xl border border-border/30 bg-card/30 p-4 transition-all duration-200",
                  "hover:bg-card/60 hover:border-border/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] dark:bg-foreground/[0.08]">
                    <Icon size={18} weight="duotone" className="text-foreground/60" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground/80 mb-0.5">{cap.title}</p>
                    <p className="text-[12px] text-muted-foreground/60 leading-relaxed">{cap.description}</p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.section>

      {/* ── Section 4: Installation ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.div variants={fade} custom={0} className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
            Get Started
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Installation
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {/* Windows */}
          <motion.div
            variants={fade}
            custom={1}
            className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-5"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.05] dark:bg-foreground/[0.08]">
                <Desktop size={18} weight="duotone" className="text-foreground/60" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground/80">Windows</p>
                <p className="text-[11px] text-muted-foreground/50">Windows 10+, 64-bit</p>
              </div>
            </div>

            <div className="space-y-2.5 mb-4">
              <div className="flex items-center gap-2">
                <DownloadSimple size={12} weight="duotone" className="text-muted-foreground/40 shrink-0" />
                <span className="text-[12px] text-muted-foreground/60">.exe installer (NSIS)</span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-amber-500/[0.04] dark:bg-amber-400/[0.05] border border-amber-500/10 dark:border-amber-400/10 px-3 py-2.5">
              <ShieldCheck size={13} weight="duotone" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                Windows SmartScreen may show a warning — click &ldquo;More info&rdquo; then &ldquo;Run anyway&rdquo;
              </p>
            </div>
          </motion.div>

          {/* macOS */}
          <motion.div
            variants={fade}
            custom={2}
            className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-5"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.05] dark:bg-foreground/[0.08]">
                <AppWindow size={18} weight="duotone" className="text-foreground/60" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground/80">macOS</p>
                <p className="text-[11px] text-muted-foreground/50">macOS Catalina+</p>
              </div>
            </div>

            <div className="space-y-2.5 mb-4">
              <div className="flex items-center gap-2">
                <DownloadSimple size={12} weight="duotone" className="text-muted-foreground/40 shrink-0" />
                <span className="text-[12px] text-muted-foreground/60">.dmg installer</span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-amber-500/[0.04] dark:bg-amber-400/[0.05] border border-amber-500/10 dark:border-amber-400/10 px-3 py-2.5">
              <ShieldCheck size={13} weight="duotone" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                Grant Screen Recording and Accessibility permissions when prompted — required for desktop automation
              </p>
            </div>
          </motion.div>
        </div>

        <motion.div variants={fade} custom={3}>
          <Link
            href="/download"
            className="inline-flex items-center gap-2 rounded-xl bg-foreground/90 px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground"
          >
            <DownloadSimple size={16} weight="bold" />
            Download Coasty Desktop
            <ArrowRight size={14} weight="bold" />
          </Link>
        </motion.div>
      </motion.section>

      {/* ── Section 5: Cloud vs Desktop ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.div variants={fade} custom={0} className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
            Comparison
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Cloud vs Desktop — When to Use Each
          </h2>
        </motion.div>

        <motion.div
          variants={fade}
          custom={1}
          className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden"
        >
          {/* Table header */}
          <div className="grid grid-cols-3 border-b border-border/30">
            <div className="px-4 py-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/50">
                Feature
              </span>
            </div>
            <div className="px-4 py-3 border-l border-border/20">
              <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/50">
                Cloud VM
              </span>
            </div>
            <div className="px-4 py-3 border-l border-border/20">
              <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/50">
                Desktop App
              </span>
            </div>
          </div>

          {/* Table rows */}
          {comparisonRows.map((row, i) => (
            <div
              key={row.feature}
              className={cn(
                "grid grid-cols-3",
                i < comparisonRows.length - 1 && "border-b border-border/20",
                i % 2 === 1 && "bg-foreground/[0.01] dark:bg-foreground/[0.02]"
              )}
            >
              <div className="px-4 py-3">
                <span className="text-[12px] font-medium text-foreground/70">{row.feature}</span>
              </div>
              <div className="px-4 py-3 border-l border-border/20">
                <div className="flex items-center gap-1.5">
                  {row.cloudCheck && (
                    <Check size={12} weight="bold" className="text-emerald-500 shrink-0" />
                  )}
                  {!row.cloudCheck && row.desktopCheck && (
                    <X size={12} weight="bold" className="text-muted-foreground/30 shrink-0" />
                  )}
                  <span className="text-[12px] text-muted-foreground/60">{row.cloud}</span>
                </div>
              </div>
              <div className="px-4 py-3 border-l border-border/20">
                <div className="flex items-center gap-1.5">
                  {row.desktopCheck && (
                    <Check size={12} weight="bold" className="text-emerald-500 shrink-0" />
                  )}
                  {!row.desktopCheck && row.cloudCheck && (
                    <X size={12} weight="bold" className="text-muted-foreground/30 shrink-0" />
                  )}
                  <span className="text-[12px] text-muted-foreground/60">{row.desktop}</span>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </motion.section>

      {/* ── Section 6: How It Connects ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.div variants={fade} custom={0} className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
            Under the hood
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            How It Connects
          </h2>
        </motion.div>

        <motion.div variants={stagger} className="space-y-0">
          {connectionSteps.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div key={step.title} variants={fade} custom={i + 1} className="relative">
                {/* Connector line */}
                {i < connectionSteps.length - 1 && (
                  <div className="absolute left-[19px] top-[44px] bottom-[-4px] w-px bg-gradient-to-b from-border/40 to-border/20" />
                )}

                <div className="flex items-start gap-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.06] dark:bg-foreground/[0.08] border border-border/30 z-10">
                    <Icon size={18} weight="duotone" className="text-foreground/60" />
                  </div>
                  <div className="pt-1">
                    <p className="text-[13px] font-semibold text-foreground/80 mb-0.5">
                      {i + 1}. {step.title}
                    </p>
                    <p className="text-[12px] text-muted-foreground/60 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        <motion.div
          variants={fade}
          custom={4}
          className="mt-5 flex items-start gap-2 rounded-xl bg-foreground/[0.02] dark:bg-foreground/[0.03] border border-border/30 px-3.5 py-2.5"
        >
          <ShieldCheck size={14} weight="duotone" className="text-muted-foreground/50 mt-0.5 shrink-0" />
          <p className="text-[12px] sm:text-[13px] text-muted-foreground/60 leading-relaxed">
            The overlay auto-hides during desktop automation so it doesn&apos;t interfere with clicks.
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
          Ready to try the desktop app?
        </h2>
        <p className="text-sm text-muted-foreground/60 max-w-lg mx-auto mb-6">
          Download the Coasty desktop app and let it control your local computer directly.
        </p>
        <Link
          href="/download"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Download Desktop App
          <ArrowRight size={14} weight="bold" />
        </Link>
      </motion.section>
    </div>
  )
}
