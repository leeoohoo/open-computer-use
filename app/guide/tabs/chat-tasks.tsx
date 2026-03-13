"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  PaperPlaneRight,
  Globe,
  Terminal,
  Desktop,
  CheckCircle,
  CircleNotch,
  Paperclip,
  X,
  Image,
  FileText,
  FileCsv,
  FileCode,
  ChatText,
  Lightbulb,
  Key,
  MagnifyingGlass,
  Eye,
  Keyboard,
  CaretRight,
  ListChecks,
  ArrowRight,
  Monitor,
  Check,
  Warning,
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

/* ─── sub-components ─── */

function ToolPill({ name, status = "success" }: { name: string; status?: "success" | "loading" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]",
        "bg-card/50 backdrop-blur-sm",
        status === "success"
          ? "border-l-2 border-l-emerald-500 border-t-border/30 border-r-border/30 border-b-border/30"
          : "border-l-2 border-l-blue-500 border-t-border/30 border-r-border/30 border-b-border/30"
      )}
    >
      {status === "success" ? (
        <CheckCircle size={15} weight="fill" className="text-emerald-500 shrink-0" />
      ) : (
        <CircleNotch size={15} weight="bold" className="text-blue-500 shrink-0 animate-spin" />
      )}
      <span className="text-muted-foreground font-mono text-xs">{name}</span>
    </div>
  )
}

function MockChatBubble({
  role,
  children,
}: {
  role: "user" | "assistant"
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex gap-3",
        role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-4 py-3 max-w-[85%] text-[13px] leading-relaxed",
          role === "user"
            ? "bg-foreground text-background rounded-br-md"
            : "bg-muted/40 text-foreground rounded-bl-md"
        )}
      >
        {children}
      </div>
    </div>
  )
}

function AgentCard({
  icon: Icon,
  title,
  description,
  tools,
  accent,
  accentBg,
}: {
  icon: React.ElementType
  title: string
  description: string
  tools: string[]
  accent: string
  accentBg: string
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", accentBg)}>
          <Icon size={18} weight="duotone" className={accent} />
        </div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      <p className="text-[13px] text-muted-foreground/60 leading-relaxed mb-3">
        {description}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tools.map((tool) => (
          <span
            key={tool}
            className="inline-flex items-center rounded-md bg-muted/30 border border-border/20 px-2 py-0.5 font-mono text-[11px] text-muted-foreground/70"
          >
            {tool}
          </span>
        ))}
      </div>
    </div>
  )
}

function PromptComparison({
  good,
  bad,
}: {
  good: string
  bad: string
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} weight="bold" className="text-emerald-500" />
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400">
            Do
          </span>
        </div>
        <p className="text-[13px] text-foreground leading-relaxed">{good}</p>
      </div>
      <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Warning size={14} weight="bold" className="text-red-500" />
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-red-600 dark:text-red-400">
            Don&apos;t
          </span>
        </div>
        <p className="text-[13px] text-muted-foreground/70 leading-relaxed">{bad}</p>
      </div>
    </div>
  )
}

/* ─── main export ─── */

export function ChatTasksTab({ inApp }: { inApp: boolean }) {
  return (
    <div className="space-y-16 sm:space-y-20">

      {/* ── Section 1: The Chat Interface ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          The Chat Interface
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
        >
          Your command center
        </motion.h2>
        <motion.p
          variants={fade}
          custom={2}
          className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed mb-8 max-w-2xl"
        >
          The chat interface is the primary way to interact with Coasty. Describe any task in
          plain English, and watch as Coasty breaks it down into steps, executes them, and
          reports back with results and screenshots.
        </motion.p>

        {/* Mock chat UI */}
        <motion.div
          variants={fade}
          custom={3}
          className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-background/60 border border-border/30 px-3 py-1.5">
                <div className="h-2 w-2 rounded-full bg-violet-500" />
                <span className="text-xs font-medium text-foreground">Claude Sonnet 4</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                My Machine (Running)
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="p-4 sm:p-6 space-y-4 bg-background/30">
            <MockChatBubble role="user">
              Go to amazon.com and find the top 5 wireless keyboards under $50. Compare them in a spreadsheet.
            </MockChatBubble>

            <MockChatBubble role="assistant">
              I&apos;ll search Amazon for wireless keyboards and create a comparison. Let me start by opening the browser.
            </MockChatBubble>

            <div className="space-y-2 pl-1">
              <ToolPill name="browser_navigate → amazon.com" status="success" />
              <ToolPill name='browser_search → wireless keyboards under $50' status="success" />
            </div>

            {/* Mock screenshot */}
            <div className="ml-1 rounded-xl border border-border/30 bg-muted/20 overflow-hidden max-w-[280px]">
              <div className="flex items-center justify-center h-36 bg-gradient-to-br from-muted/40 to-muted/20">
                <div className="text-center">
                  <Image size={24} weight="duotone" className="text-muted-foreground/30 mx-auto mb-1.5" />
                  <span className="text-[11px] text-muted-foreground/40 font-medium">
                    Amazon Search Results
                  </span>
                </div>
              </div>
            </div>

            <MockChatBubble role="assistant">
              Found the top results. Now comparing prices and ratings...
            </MockChatBubble>

            <div className="pl-1">
              <ToolPill name="type → entering data into spreadsheet" status="loading" />
            </div>
          </div>

          {/* Input bar */}
          <div className="px-4 py-3 border-t border-border/30 bg-muted/10">
            <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/60 px-4 py-2.5">
              <Paperclip size={16} className="text-muted-foreground/40 shrink-0" />
              <span className="flex-1 text-sm text-muted-foreground/30">
                Describe your task...
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/10">
                <PaperPlaneRight size={14} className="text-muted-foreground/40" />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 2: Understanding Agent Actions ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Understanding Agent Actions
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
        >
          Three specialized agents
        </motion.h2>
        <motion.p
          variants={fade}
          custom={2}
          className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed mb-8 max-w-2xl"
        >
          Coasty automatically assigns the right agent for each step of your task.
          Each agent has specialized tools for its domain.
        </motion.p>

        <motion.div variants={fade} custom={3} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AgentCard
            icon={Globe}
            title="Browser Agent"
            description="Opens Chrome, navigates pages, clicks elements, fills forms, reads content, takes screenshots."
            tools={["browser_navigate", "browser_click", "browser_type", "browser_search"]}
            accent="text-blue-600 dark:text-blue-400"
            accentBg="bg-blue-500/10 dark:bg-blue-400/10"
          />
          <AgentCard
            icon={Terminal}
            title="Terminal Agent"
            description="Runs shell commands, installs software, processes files, runs scripts."
            tools={["terminal_command", "file_read", "file_write"]}
            accent="text-emerald-600 dark:text-emerald-400"
            accentBg="bg-emerald-500/10 dark:bg-emerald-400/10"
          />
          <AgentCard
            icon={Desktop}
            title="Desktop Agent"
            description="Controls the desktop UI — clicks, types, scrolls, opens apps, takes screenshots."
            tools={["screenshot", "mouse_click", "keyboard_type", "scroll"]}
            accent="text-violet-600 dark:text-violet-400"
            accentBg="bg-violet-500/10 dark:bg-violet-400/10"
          />
        </motion.div>
      </motion.section>

      {/* ── Section 3: Writing Good Prompts ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Writing Good Prompts
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
        >
          Be specific, get better results
        </motion.h2>
        <motion.p
          variants={fade}
          custom={2}
          className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed mb-8 max-w-2xl"
        >
          The more detail you provide, the better Coasty performs. Include URLs, exact
          text, numbers, and specific steps for the best outcomes.
        </motion.p>

        <motion.div variants={fade} custom={3} className="space-y-4">
          <PromptComparison
            good="Apply to 10 software engineering jobs on LinkedIn matching my resume. For each, tailor the cover letter to mention their tech stack."
            bad="Apply to jobs"
          />
          <PromptComparison
            good="Go to notion.com, log in with my saved credentials, and create a new page titled 'Q1 Planning' with sections for Goals, Metrics, and Timeline."
            bad="Make a Notion page"
          />
          <PromptComparison
            good="Search Google Flights for round-trip flights from SFO to JFK departing March 20, returning March 25. Sort by price and screenshot the top 3 options."
            bad="Find flights"
          />
        </motion.div>
      </motion.section>

      {/* ── Section 4: File Attachments ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          File Attachments
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
        >
          Upload files for context
        </motion.h2>
        <motion.p
          variants={fade}
          custom={2}
          className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed mb-8 max-w-2xl"
        >
          Attach files to your messages and Coasty will upload them to the VM.
          Reference them in your instructions so the agent knows how to use them.
        </motion.p>

        {/* Mock file attachment bar */}
        <motion.div
          variants={fade}
          custom={3}
          className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Paperclip size={14} className="text-muted-foreground/50" />
            <span className="text-xs font-medium text-muted-foreground/60">Attached files</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-2">
              <FileText size={16} weight="duotone" className="text-red-500/70 shrink-0" />
              <span className="text-[13px] text-foreground font-medium">resume.pdf</span>
              <button className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted/40 transition-colors">
                <X size={10} className="text-muted-foreground/50" />
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-2">
              <FileCsv size={16} weight="duotone" className="text-emerald-500/70 shrink-0" />
              <span className="text-[13px] text-foreground font-medium">contacts.csv</span>
              <button className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted/40 transition-colors">
                <X size={10} className="text-muted-foreground/50" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-muted-foreground/40">
            <span className="flex items-center gap-1.5">
              <FileText size={12} weight="duotone" />
              PDFs
            </span>
            <span className="flex items-center gap-1.5">
              <Image size={12} weight="duotone" />
              Images
            </span>
            <span className="flex items-center gap-1.5">
              <FileCsv size={12} weight="duotone" />
              CSVs
            </span>
            <span className="flex items-center gap-1.5">
              <FileCode size={12} weight="duotone" />
              Code files
            </span>
            <span className="flex items-center gap-1.5">
              <ChatText size={12} weight="duotone" />
              Text files
            </span>
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 5: Monitoring Progress ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Monitoring Progress
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
        >
          Watch every step in real time
        </motion.h2>
        <motion.p
          variants={fade}
          custom={2}
          className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed mb-8 max-w-2xl"
        >
          The Project Navigator panel on the right side shows a live timeline of every
          action Coasty takes. You can follow along as tasks are completed.
        </motion.p>

        {/* Mock navigator panel */}
        <motion.div
          variants={fade}
          custom={3}
          className="max-w-sm rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm"
        >
          {/* Panel header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-muted/20">
            <ListChecks size={16} weight="duotone" className="text-foreground/60" />
            <span className="text-xs font-semibold text-foreground">Execution</span>
            <div className="ml-auto flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2 py-0.5">
              <CircleNotch size={10} weight="bold" className="text-blue-500 animate-spin" />
              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Running</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="p-4 space-y-3">
            {[
              { label: "Opened browser", done: true },
              { label: "Navigated to linkedin.com", done: true },
              { label: "Logged in with saved credentials", done: true },
              { label: 'Searching for "software engineer" roles', done: false },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                {step.done ? (
                  <CheckCircle size={16} weight="fill" className="text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <CircleNotch size={16} weight="bold" className="text-blue-500 shrink-0 mt-0.5 animate-spin" />
                )}
                <span
                  className={cn(
                    "text-[13px] leading-snug",
                    step.done ? "text-muted-foreground/60" : "text-foreground font-medium"
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Mini keyboard visualization */}
          <div className="px-4 pb-4">
            <div className="rounded-xl border border-border/30 bg-muted/10 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Keyboard size={12} weight="duotone" className="text-muted-foreground/40" />
                <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/40">
                  Keyboard Activity
                </span>
              </div>
              <div className="flex gap-1">
                {["S", "o", "f", "t", "w", "a", "r", "e"].map((key, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded border text-[10px] font-mono",
                      i >= 6
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-500"
                        : "border-border/30 bg-background/40 text-muted-foreground/50"
                    )}
                  >
                    {key}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 6: Tips & Tricks ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.p
          variants={fade}
          custom={0}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
        >
          Tips &amp; Tricks
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
        >
          Get the most out of Coasty
        </motion.h2>

        <motion.div variants={fade} custom={2} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              icon: ChatText,
              title: "Chain tasks",
              description:
                "You can send follow-up messages to refine or extend what Coasty is doing. Each message builds on the previous context.",
            },
            {
              icon: Key,
              title: "Use credentials",
              description:
                "Save logins in the Credentials page so Coasty can access your accounts securely during execution.",
            },
            {
              icon: MagnifyingGlass,
              title: "Be specific",
              description:
                "Include URLs, exact text, numbers, and steps for best results. The more detail, the fewer retries.",
            },
            {
              icon: Eye,
              title: "Review results",
              description:
                "Check the screenshots and tool results to verify accuracy. Coasty shows you everything it does.",
            },
          ].map((tip, i) => {
            const TipIcon = tip.icon
            return (
              <motion.div
                key={i}
                variants={fade}
                custom={i + 3}
                className="rounded-2xl border border-border/40 bg-card/30 p-5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.04] dark:bg-foreground/[0.06] mb-3">
                  <TipIcon size={18} weight="duotone" className="text-foreground/70" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{tip.title}</h3>
                <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
                  {tip.description}
                </p>
              </motion.div>
            )
          })}
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
          Ready to chat with Coasty?
        </h2>
        <p className="text-sm text-muted-foreground/60 max-w-lg mx-auto mb-6">
          Open a new chat, describe your task in plain English, and let Coasty take it from there.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Open a chat
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
