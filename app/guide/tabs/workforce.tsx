"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  UsersThree,
  UserPlus,
  Clock,
  CalendarCheck,
  TreeStructure,
  Brain,
  Lightning,
  Gear,
  ArrowRight,
  ArrowSquareOut,
  CaretDown,
  CheckCircle,
  CircleNotch,
  Circle,
  Play,
  Pause,
  Key,
  Repeat,
  ArrowsClockwise,
  ChatText,
  Briefcase,
  Megaphone,
  MagnifyingGlass,
  HeadphonesIcon,
  ShoppingCart,
  Code,
  Rocket,
  Target,
  Buildings,
  Crown,
  Sparkle,
  PencilSimple,
  VideoCamera,
  Warning,
  Check,
  Database,
  ShareNetwork,
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

interface EmployeeExample {
  name: string
  role: string
  frequency: string
  frequencyLabel: string
}

interface TeamTemplateData {
  name: string
  tier: "starter" | "plus" | "pro"
  icon: React.ElementType
  tagline: string
  employees: EmployeeExample[]
  accent: string
  accentBg: string
  accentBorder: string
}

const teamTemplates: TeamTemplateData[] = [
  {
    name: "Content Operations",
    tier: "starter",
    icon: PencilSimple,
    tagline: "Publish consistently without lifting a finger",
    employees: [
      { name: "Atlas", role: "Content Writer", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Echo", role: "SEO Analyst", frequency: "weekly", frequencyLabel: "Every week" },
      { name: "Nova", role: "Social Distributor", frequency: "every_12_hours", frequencyLabel: "Every 12 hours" },
    ],
    accent: "text-violet-600 dark:text-violet-400",
    accentBg: "bg-violet-500/[0.04] dark:bg-violet-400/[0.06]",
    accentBorder: "border-violet-500/10 dark:border-violet-400/10",
  },
  {
    name: "Customer Support",
    tier: "starter",
    icon: HeadphonesIcon,
    tagline: "24/7 support coverage from 3 employees",
    employees: [
      { name: "Sage", role: "Inbox Monitor", frequency: "every_30_minutes", frequencyLabel: "Every 30 min" },
      { name: "Iris", role: "Knowledge Base Manager", frequency: "weekly", frequencyLabel: "Every week" },
      { name: "Milo", role: "Feedback Analyst", frequency: "daily", frequencyLabel: "Every day" },
    ],
    accent: "text-teal-600 dark:text-teal-400",
    accentBg: "bg-teal-500/[0.04] dark:bg-teal-400/[0.06]",
    accentBorder: "border-teal-500/10 dark:border-teal-400/10",
  },
  {
    name: "Marketing Department",
    tier: "plus",
    icon: Megaphone,
    tagline: "A full marketing team in two machines",
    employees: [
      { name: "Atlas", role: "Content Strategist", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Nova", role: "Social Media Manager", frequency: "every_6_hours", frequencyLabel: "Every 6 hours" },
      { name: "Echo", role: "SEO Specialist", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Pixel", role: "Email Campaign Manager", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Scout", role: "Competitor Analyst", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Dash", role: "Ad Campaign Monitor", frequency: "every_12_hours", frequencyLabel: "Every 12 hours" },
      { name: "Iris", role: "Analytics Reporter", frequency: "weekly", frequencyLabel: "Every week" },
    ],
    accent: "text-amber-600 dark:text-amber-400",
    accentBg: "bg-amber-500/[0.04] dark:bg-amber-400/[0.06]",
    accentBorder: "border-amber-500/10 dark:border-amber-400/10",
  },
  {
    name: "E-Commerce Operations",
    tier: "plus",
    icon: ShoppingCart,
    tagline: "Run your store while you sleep",
    employees: [
      { name: "Cleo", role: "Product Lister", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Onyx", role: "Price Monitor", frequency: "every_6_hours", frequencyLabel: "Every 6 hours" },
      { name: "Luna", role: "Inventory Tracker", frequency: "every_12_hours", frequencyLabel: "Every 12 hours" },
      { name: "Sage", role: "Review Manager", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Dash", role: "Ad Campaign Optimizer", frequency: "every_12_hours", frequencyLabel: "Every 12 hours" },
      { name: "Flux", role: "Email Marketer", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Wren", role: "Analytics Reporter", frequency: "weekly", frequencyLabel: "Every week" },
    ],
    accent: "text-sky-600 dark:text-sky-400",
    accentBg: "bg-sky-500/[0.04] dark:bg-sky-400/[0.06]",
    accentBorder: "border-sky-500/10 dark:border-sky-400/10",
  },
  {
    name: "Engineering Team",
    tier: "plus",
    icon: Code,
    tagline: "Automate the boring parts of engineering",
    employees: [
      { name: "Rune", role: "Code Reviewer", frequency: "every_6_hours", frequencyLabel: "Every 6 hours" },
      { name: "Koda", role: "Dependency Monitor", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Aria", role: "Doc Writer", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Blaze", role: "Test Monitor", frequency: "every_12_hours", frequencyLabel: "Every 12 hours" },
      { name: "Frost", role: "Deploy Monitor", frequency: "every_6_hours", frequencyLabel: "Every 6 hours" },
      { name: "Neon", role: "Uptime & Log Watcher", frequency: "every_30_minutes", frequencyLabel: "Every 30 min" },
    ],
    accent: "text-emerald-600 dark:text-emerald-400",
    accentBg: "bg-emerald-500/[0.04] dark:bg-emerald-400/[0.06]",
    accentBorder: "border-emerald-500/10 dark:border-emerald-400/10",
  },
  {
    name: "Full Business Operations",
    tier: "pro",
    icon: Buildings,
    tagline: "An entire company, fully automated",
    employees: [
      { name: "Atlas", role: "Lead Generator", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Dash", role: "CRM Manager", frequency: "every_6_hours", frequencyLabel: "Every 6 hours" },
      { name: "Scout", role: "Proposal Writer", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Nova", role: "Content Marketer", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Sage", role: "Support Lead", frequency: "every_30_minutes", frequencyLabel: "Every 30 min" },
      { name: "Milo", role: "Data Analyst", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Quinn", role: "Operations Coordinator", frequency: "weekly", frequencyLabel: "Every week" },
    ],
    accent: "text-rose-600 dark:text-rose-400",
    accentBg: "bg-rose-500/[0.04] dark:bg-rose-400/[0.06]",
    accentBorder: "border-rose-500/10 dark:border-rose-400/10",
  },
  {
    name: "Growth & Acquisition",
    tier: "pro",
    icon: Rocket,
    tagline: "Aggressive growth on full autopilot",
    employees: [
      { name: "Blaze", role: "Outbound Prospector", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Flux", role: "Email Outreach", frequency: "every_6_hours", frequencyLabel: "Every 6 hours" },
      { name: "Orion", role: "LinkedIn Outreach", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Coral", role: "Content Creator", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Vale", role: "Ad Campaign Manager", frequency: "every_12_hours", frequencyLabel: "Every 12 hours" },
      { name: "Haze", role: "Funnel Analyst", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Kit", role: "Growth Reporter", frequency: "daily", frequencyLabel: "Every day" },
    ],
    accent: "text-orange-600 dark:text-orange-400",
    accentBg: "bg-orange-500/[0.04] dark:bg-orange-400/[0.06]",
    accentBorder: "border-orange-500/10 dark:border-orange-400/10",
  },
  {
    name: "SaaS Operations",
    tier: "pro",
    icon: Target,
    tagline: "Run your SaaS like a well-oiled machine",
    employees: [
      { name: "Luna", role: "Customer Success Monitor", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Sage", role: "Onboarding Assistant", frequency: "every_6_hours", frequencyLabel: "Every 6 hours" },
      { name: "Ivy", role: "Churn Preventer", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Neon", role: "Bug & Issue Monitor", frequency: "every_30_minutes", frequencyLabel: "Every 30 min" },
      { name: "Frost", role: "Revenue Analyst", frequency: "daily", frequencyLabel: "Every day" },
      { name: "Zara", role: "Competitor Tracker", frequency: "weekly", frequencyLabel: "Every week" },
    ],
    accent: "text-indigo-600 dark:text-indigo-400",
    accentBg: "bg-indigo-500/[0.04] dark:bg-indigo-400/[0.06]",
    accentBorder: "border-indigo-500/10 dark:border-indigo-400/10",
  },
]

const frequencyOptions = [
  { value: "every_30_minutes", label: "Every 30 minutes", description: "High-frequency monitoring — inbox scanning, uptime checks" },
  { value: "hourly", label: "Every hour", description: "Regular checks — social media moderation, lead qualification" },
  { value: "every_6_hours", label: "Every 6 hours", description: "Shift-style coverage — outreach campaigns, ad monitoring" },
  { value: "every_12_hours", label: "Every 12 hours", description: "Twice daily — inventory checks, report compilation" },
  { value: "daily", label: "Once per day", description: "Most common — content creation, research, analytics" },
  { value: "weekly", label: "Once per week", description: "Big-picture tasks — reports, audits, strategy reviews" },
]

const concepts = [
  {
    icon: UsersThree,
    title: "Employees",
    description: "Automated AI agents that run tasks on a schedule. Each employee has a name, a role (task prompt), and a frequency. Think of them as tireless team members who work 24/7.",
    accent: "text-blue-600 dark:text-blue-400",
    accentBg: "bg-blue-500/10 dark:bg-blue-400/10",
  },
  {
    icon: Briefcase,
    title: "Teams",
    description: "Groups of employees that work together toward a shared goal. Teams have shared instructions that guide every member and shared memory for cross-employee communication.",
    accent: "text-violet-600 dark:text-violet-400",
    accentBg: "bg-violet-500/10 dark:bg-violet-400/10",
  },
  {
    icon: Brain,
    title: "Shared Memory",
    description: "A team-level knowledge base that every employee can read from and write to. Use it to pass data between employees — like a shared Notion doc for your AI team.",
    accent: "text-emerald-600 dark:text-emerald-400",
    accentBg: "bg-emerald-500/10 dark:bg-emerald-400/10",
  },
  {
    icon: Lightning,
    title: "Triggers",
    description: "Chain employees together by triggering one when another completes (or fails). For example: when Scout finishes research, automatically trigger Atlas to write a blog post about it.",
    accent: "text-amber-600 dark:text-amber-400",
    accentBg: "bg-amber-500/10 dark:bg-amber-400/10",
  },
  {
    icon: ShareNetwork,
    title: "Delegates",
    description: "Employees can delegate sub-tasks to other employees during execution. A manager employee can break down complex work and assign pieces to specialists.",
    accent: "text-pink-600 dark:text-pink-400",
    accentBg: "bg-pink-500/10 dark:bg-pink-400/10",
  },
  {
    icon: TreeStructure,
    title: "Org Chart",
    description: "A visual map of your entire workforce — company, teams, and employees — showing the hierarchy and delegation relationships between agents.",
    accent: "text-cyan-600 dark:text-cyan-400",
    accentBg: "bg-cyan-500/10 dark:bg-cyan-400/10",
  },
]

/* ─── sub-components ─── */

function TierBadge({ tier }: { tier: "starter" | "plus" | "pro" }) {
  const config = {
    starter: { label: "Starter", icon: Lightning, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 dark:bg-emerald-400/10" },
    plus: { label: "Plus", icon: Sparkle, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 dark:bg-blue-400/10" },
    pro: { label: "Pro", icon: Crown, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 dark:bg-amber-400/10" },
  }
  const c = config[tier]
  const Icon = c.icon
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", c.bg, c.color)}>
      <Icon size={10} weight="fill" />
      {c.label}
    </span>
  )
}

function TeamTemplateCard({ template, index }: { template: TeamTemplateData; index: number }) {
  const [expanded, setExpanded] = useState(index < 1)
  const Icon = template.icon

  return (
    <motion.div
      variants={fade}
      custom={index + 2}
      className={cn(
        "group relative rounded-2xl border transition-all duration-300",
        "bg-card/50 backdrop-blur-sm",
        template.accentBorder,
        expanded ? "shadow-sm" : "hover:shadow-sm"
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-px rounded-t-2xl", template.accentBg)} />

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-5 sm:p-6 text-left"
      >
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200", template.accentBg, template.accent)}>
          <Icon size={20} weight="duotone" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-base sm:text-lg font-semibold text-foreground leading-tight">
              {template.name}
            </h3>
            <TierBadge tier={template.tier} />
          </div>
          <p className="text-sm text-muted-foreground/70 leading-snug">
            {template.tagline}
          </p>
        </div>

        <div className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/50 transition-all duration-200",
          expanded ? "rotate-180 bg-foreground/[0.03]" : "group-hover:border-border"
        )}>
          <CaretDown size={14} weight="bold" className="text-muted-foreground/60" />
        </div>
      </button>

      <motion.div
        initial={expanded ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        animate={expanded ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="overflow-hidden"
      >
        <div className="px-5 sm:px-6 pb-5 sm:pb-6">
          {/* Employee list */}
          <div className="space-y-2">
            {template.employees.map((emp) => (
              <div
                key={emp.name}
                className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/50 hover:bg-background/80 hover:border-border/50 transition-all duration-200 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] dark:bg-foreground/[0.08]">
                  <span className="text-xs font-bold text-foreground/60">
                    {emp.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground">{emp.name}</span>
                    <span className="text-[11px] text-muted-foreground/50">&middot;</span>
                    <span className="text-[12px] text-muted-foreground/60">{emp.role}</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/50 bg-foreground/[0.03] px-2 py-0.5 rounded-full shrink-0">
                  <Clock size={10} weight="duotone" />
                  {emp.frequencyLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function MockEmployeeCard() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-400/10">
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">A</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Atlas</p>
            <p className="text-[11px] text-muted-foreground/50">Content Writer</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Active</span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50 mb-3">
        <span className="flex items-center gap-1">
          <Clock size={10} weight="duotone" />
          Runs daily at 9:00 AM
        </span>
        <span className="flex items-center gap-1">
          <Repeat size={10} weight="duotone" />
          47 runs
        </span>
      </div>
      <div className="rounded-lg border border-border/30 bg-background/50 px-3 py-2 text-[12px] text-muted-foreground/60 leading-relaxed">
        &quot;Write a blog post about the latest trends in AI automation, publish to WordPress, and share on social media&quot;
      </div>
      <div className="flex items-center gap-2 mt-3">
        <div className="flex items-center gap-1.5 rounded-lg bg-foreground/90 px-3 py-1.5 text-xs font-medium text-background cursor-default select-none">
          <Play size={10} weight="fill" />
          Run Now
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground/60 cursor-default select-none">
          <Pause size={10} weight="fill" />
          Pause
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground/60 cursor-default select-none">
          <Gear size={10} weight="duotone" />
          Edit
        </div>
      </div>
    </div>
  )
}

function MockCreateEmployee() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-5">
      <p className="text-sm font-semibold text-foreground mb-4">New Employee</p>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Name</label>
            <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground/70">
              Atlas
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Frequency</label>
            <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground/70">
              Daily
            </div>
          </div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Role / Task Prompt</label>
          <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground/70 leading-relaxed min-h-[60px]">
            Write a blog post about the latest AI news, optimize for SEO, and publish to WordPress
          </div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Machine</label>
          <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground/70 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            My Machine (Running)
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Time</label>
            <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground/70">
              09:00 AM
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Timezone</label>
            <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground/70">
              America/New_York
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="rounded-lg bg-foreground/90 px-4 py-1.5 text-xs font-medium text-background cursor-default select-none">
            Create Employee
          </div>
        </div>
      </div>
    </div>
  )
}

function MockTeamView() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 overflow-hidden">
      {/* Team header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-dashed border-border/40">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 dark:bg-violet-400/10">
            <UsersThree size={18} weight="duotone" className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Content Operations</p>
            <p className="text-[11px] text-muted-foreground/50">3 employees &middot; 1 machine</p>
          </div>
        </div>
        <TierBadge tier="starter" />
      </div>

      {/* Team instructions */}
      <div className="px-5 py-3 border-b border-dashed border-border/30 bg-card/20">
        <p className="text-[11px] font-medium text-muted-foreground/60 mb-1">Team Instructions</p>
        <p className="text-[12px] text-muted-foreground/50 leading-relaxed">
          You are part of the Content Operations team. Coordinate via shared memory. Always write in the brand voice. Prioritize quality over quantity.
        </p>
      </div>

      {/* Members */}
      <div className="divide-y divide-dashed divide-border/30">
        {[
          { name: "Atlas", role: "Content Writer", freq: "Daily", status: "active" as const },
          { name: "Echo", role: "SEO Analyst", freq: "Weekly", status: "active" as const },
          { name: "Nova", role: "Social Distributor", freq: "Every 12h", status: "running" as const },
        ].map((m) => (
          <div key={m.name} className={cn("flex items-center gap-3 px-5 py-3", m.status === "running" && "bg-blue-500/[0.02]")}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground/[0.05]">
              <span className="text-[11px] font-bold text-foreground/50">{m.name.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-foreground">{m.name}</span>
                <span className="text-[11px] text-muted-foreground/40">{m.role}</span>
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground/40">{m.freq}</span>
            {m.status === "running" ? (
              <CircleNotch size={14} weight="bold" className="text-blue-500 animate-spin shrink-0" />
            ) : (
              <CheckCircle size={14} weight="duotone" className="text-emerald-500/60 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Add member */}
      <div className="px-5 py-3 border-t border-dashed border-border/40">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground/50 cursor-default">
          <UserPlus size={14} weight="duotone" />
          Add employee to team
        </div>
      </div>
    </div>
  )
}

function MockTriggerChain() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-5">
      <p className="text-[11px] font-medium text-muted-foreground/60 mb-4 uppercase tracking-wider">Trigger Chain Example</p>
      <div className="space-y-2">
        {/* Step 1 */}
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] px-4 py-3">
          <CheckCircle size={16} weight="fill" className="text-emerald-500 shrink-0" />
          <div className="flex-1">
            <span className="text-[13px] font-semibold text-foreground">Scout</span>
            <span className="text-[12px] text-muted-foreground/50 ml-2">researches competitors</span>
          </div>
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Completed</span>
        </div>

        {/* Arrow */}
        <div className="flex items-center gap-2 pl-6">
          <div className="h-6 w-px bg-border/40" />
          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
            on_complete &rarr; passes output
          </span>
        </div>

        {/* Step 2 */}
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/[0.03] px-4 py-3">
          <CircleNotch size={16} weight="bold" className="text-blue-500 shrink-0 animate-spin" />
          <div className="flex-1">
            <span className="text-[13px] font-semibold text-foreground">Atlas</span>
            <span className="text-[12px] text-muted-foreground/50 ml-2">writes blog post from research</span>
          </div>
          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Running</span>
        </div>

        {/* Arrow */}
        <div className="flex items-center gap-2 pl-6">
          <div className="h-6 w-px bg-border/40" />
          <span className="text-[10px] font-medium text-muted-foreground/40 bg-foreground/[0.03] px-2 py-0.5 rounded-full">
            on_complete &rarr; passes output
          </span>
        </div>

        {/* Step 3 */}
        <div className="flex items-center gap-3 rounded-lg border border-border/30 bg-background/50 px-4 py-3 opacity-50">
          <Circle size={16} weight="regular" className="text-muted-foreground/30 shrink-0" />
          <div className="flex-1">
            <span className="text-[13px] font-semibold text-foreground">Nova</span>
            <span className="text-[12px] text-muted-foreground/50 ml-2">publishes to social media</span>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground/40">Waiting</span>
        </div>
      </div>
    </div>
  )
}

function MockSharedMemory() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dashed border-border/40 bg-card/20">
        <Database size={14} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
        <span className="text-xs font-semibold text-foreground">Shared Memory</span>
        <span className="text-[11px] text-muted-foreground/40 ml-auto">Content Operations Team</span>
      </div>
      <div className="divide-y divide-dashed divide-border/30">
        {[
          { key: "latest_blog_url", value: "https://blog.example.com/ai-trends-2026", writtenBy: "Atlas", time: "2 hours ago" },
          { key: "seo_keywords_q1", value: "AI automation, computer use, RPA alternative, agent workforce", writtenBy: "Echo", time: "1 day ago" },
          { key: "[CAMPAIGN] current_theme", value: "AI for small businesses — run through March", writtenBy: "Nova", time: "3 days ago" },
        ].map((entry) => (
          <div key={entry.key} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-mono font-medium text-foreground">{entry.key}</span>
              <span className="text-[10px] text-muted-foreground/40">{entry.time}</span>
            </div>
            <p className="text-[12px] text-muted-foreground/60 leading-relaxed mb-1">{entry.value}</p>
            <p className="text-[10px] text-muted-foreground/40">Written by {entry.writtenBy}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MockOrgChart() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-5">
      <p className="text-[11px] font-medium text-muted-foreground/60 mb-4 uppercase tracking-wider">Org Chart</p>

      {/* Company */}
      <div className="flex flex-col items-center">
        <div className="rounded-xl border border-border/50 bg-foreground/[0.04] px-5 py-2.5 text-center mb-2">
          <p className="text-[13px] font-semibold text-foreground">My Company</p>
          <p className="text-[10px] text-muted-foreground/40">2 teams &middot; 6 employees</p>
        </div>
        <div className="h-6 w-px bg-border/40" />

        {/* Teams row */}
        <div className="flex gap-8 items-start">
          {/* Team 1 */}
          <div className="flex flex-col items-center">
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] px-4 py-2 text-center mb-2">
              <p className="text-[12px] font-semibold text-foreground">Content Ops</p>
              <p className="text-[10px] text-muted-foreground/40">3 employees</p>
            </div>
            <div className="h-4 w-px bg-border/30" />
            <div className="flex gap-2 mt-1">
              {["A", "E", "N"].map((initial) => (
                <div key={initial} className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground/[0.05] border border-border/30 text-[10px] font-bold text-foreground/50">
                  {initial}
                </div>
              ))}
            </div>
          </div>

          {/* Team 2 */}
          <div className="flex flex-col items-center">
            <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.04] px-4 py-2 text-center mb-2">
              <p className="text-[12px] font-semibold text-foreground">Support</p>
              <p className="text-[10px] text-muted-foreground/40">3 employees</p>
            </div>
            <div className="h-4 w-px bg-border/30" />
            <div className="flex gap-2 mt-1">
              {["S", "I", "M"].map((initial) => (
                <div key={initial} className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground/[0.05] border border-border/30 text-[10px] font-bold text-foreground/50">
                  {initial}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockCalendar() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-dashed border-border/40 bg-card/20">
        <div className="flex items-center gap-2">
          <CalendarCheck size={14} weight="duotone" className="text-foreground/60" />
          <span className="text-xs font-semibold text-foreground">March 2026</span>
        </div>
        <span className="text-[11px] text-muted-foreground/40">Schedule Calendar</span>
      </div>
      <div className="p-3">
        {/* Mini calendar grid */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="text-[10px] font-medium text-muted-foreground/40 py-1">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
            const hasTask = [1, 2, 3, 5, 8, 9, 10, 12, 15, 16, 17, 19, 22, 23, 24, 26, 29, 30, 31].includes(day)
            const isToday = day === 13
            return (
              <div
                key={day}
                className={cn(
                  "text-[11px] py-1 rounded-md relative",
                  isToday && "bg-foreground text-background font-bold",
                  !isToday && hasTask && "text-foreground font-medium",
                  !isToday && !hasTask && "text-muted-foreground/30",
                )}
              >
                {day}
                {hasTask && !isToday && (
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-500/60" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MockHistory() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dashed border-border/40 bg-card/20">
        <ArrowsClockwise size={14} weight="duotone" className="text-foreground/60" />
        <span className="text-xs font-semibold text-foreground">Execution History</span>
      </div>
      <div className="divide-y divide-dashed divide-border/30">
        {[
          { employee: "Atlas", task: "Published blog post", status: "success" as const, time: "2h ago", duration: "4m 32s", credits: "0.12" },
          { employee: "Nova", task: "Posted to Twitter & LinkedIn", status: "success" as const, time: "6h ago", duration: "2m 15s", credits: "0.08" },
          { employee: "Sage", task: "Replied to 3 support emails", status: "success" as const, time: "8h ago", duration: "5m 47s", credits: "0.15" },
          { employee: "Scout", task: "Competitor check — no changes", status: "success" as const, time: "12h ago", duration: "1m 38s", credits: "0.05" },
          { employee: "Echo", task: "SEO audit failed — site down", status: "failed" as const, time: "1d ago", duration: "0m 12s", credits: "0.01" },
        ].map((entry, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            {entry.status === "success" ? (
              <CheckCircle size={14} weight="fill" className="text-emerald-500/60 shrink-0" />
            ) : (
              <Warning size={14} weight="fill" className="text-red-500/60 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-foreground">{entry.employee}</span>
                <span className="text-[11px] text-muted-foreground/40">{entry.time}</span>
              </div>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">{entry.task}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] text-muted-foreground/40">{entry.duration}</p>
              <p className="text-[10px] text-muted-foreground/30">{entry.credits} credits</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── main export ─── */

export function WorkforceTab({ inApp }: { inApp: boolean }) {
  return (
    <div className="space-y-0">

      {/* ── Section 1: What is Workforce? ── */}
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
          Workforce
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-4"
        >
          What is Workforce?
        </motion.h2>

        <motion.p
          variants={fade}
          custom={2}
          className="text-sm sm:text-base text-foreground font-semibold leading-relaxed mb-3 max-w-2xl"
        >
          Build a team of AI employees that work for you around the clock &mdash; on autopilot.
        </motion.p>

        <motion.p
          variants={fade}
          custom={3}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed max-w-2xl mb-4"
        >
          Workforce lets you create named AI employees, each with a specific role and schedule.
          Group them into teams, connect them with triggers and shared memory, and let them
          run your business while you sleep. Think of it as hiring a full department of AI
          workers that execute tasks on your virtual machines every day, every hour, or every
          30 minutes.
        </motion.p>

        <motion.div
          variants={fade}
          custom={4}
          className="rounded-xl border border-border/40 bg-card/50 p-4 sm:p-5 max-w-2xl"
        >
          <p className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed">
            <span className="text-foreground font-medium">Example:</span> Create a &quot;Content Operations&quot;
            team with 3 employees: Atlas writes blog posts daily, Echo audits SEO weekly, and Nova
            distributes content to social media every 12 hours. They coordinate through shared memory
            and trigger each other automatically.
          </p>
        </motion.div>
      </motion.section>

      {/* ── Section 2: Core Concepts ── */}
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
          Core Concepts
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
        >
          How Workforce is organized
        </motion.h2>

        <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {concepts.map((concept, i) => {
            const Icon = concept.icon
            return (
              <motion.div
                key={concept.title}
                variants={fade}
                custom={i + 2}
                className="rounded-2xl border border-border/40 bg-card/50 p-5 sm:p-6"
              >
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl mb-3", concept.accentBg)}>
                  <Icon size={18} weight="duotone" className={concept.accent} />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">
                  {concept.title}
                </h3>
                <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
                  {concept.description}
                </p>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.section>

      {/* ── Section 3: Creating Your First Employee ── */}
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
          Getting Started
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
        >
          Creating Your First Employee
        </motion.h2>

        {/* Steps */}
        <motion.div variants={stagger} className="space-y-4 mb-8">
          {[
            {
              step: 1,
              title: "Go to the Workforce page",
              description: "Click \"Workforce\" in the sidebar (or navigate to /schedules). This is your workforce dashboard.",
            },
            {
              step: 2,
              title: "Click \"+ New Employee\"",
              description: "Opens the employee creation dialog where you'll configure the role, schedule, and machine.",
            },
            {
              step: 3,
              title: "Give your employee a name and role",
              description: "The name is how you'll identify this employee (e.g., \"Atlas\"). The role is the task prompt — what the employee actually does each time it runs.",
            },
            {
              step: 4,
              title: "Set the frequency and time",
              description: "Choose how often the employee runs: every 30 minutes, hourly, every 6 hours, every 12 hours, daily, or weekly. Pick a time and timezone.",
            },
            {
              step: 5,
              title: "Assign a machine",
              description: "Select which virtual machine this employee will use. The machine must be running when the employee's scheduled time arrives.",
            },
            {
              step: 6,
              title: "Create and activate",
              description: "Hit create. Your employee is now live and will automatically run at the next scheduled time. You can also trigger it manually with \"Run Now\".",
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

        {/* Mock: Create employee form */}
        <motion.div variants={fade} custom={8} className="max-w-lg">
          <MockCreateEmployee />
        </motion.div>

        {/* Pro tip */}
        <motion.div
          variants={fade}
          custom={9}
          className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/[0.04] dark:bg-amber-400/[0.05] border border-amber-500/10 dark:border-amber-400/10 px-3.5 py-2.5 max-w-lg"
        >
          <Key size={14} weight="duotone" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[12px] sm:text-[13px] text-muted-foreground/70 leading-relaxed">
            <span className="font-medium text-foreground/70">Don&apos;t forget credentials:</span> If your employee
            needs to log into websites (Gmail, LinkedIn, etc.), save those credentials in the{" "}
            <a href="/secrets" className="font-medium text-foreground underline underline-offset-2 decoration-border hover:decoration-foreground/40 transition-colors">
              Saved Credentials
            </a>{" "}
            page first.
          </p>
        </motion.div>
      </motion.section>

      {/* ── Section 4: Employee Management ── */}
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
          Employee Management
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-4"
        >
          Managing your employees
        </motion.h2>

        <motion.p
          variants={fade}
          custom={2}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed mb-8 max-w-2xl"
        >
          Once created, each employee shows as a card on your Workforce dashboard. You can run them
          manually, pause them, edit their schedule, or view their execution history.
        </motion.p>

        <motion.div variants={fade} custom={3} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
          <MockEmployeeCard />
          <MockHistory />
        </motion.div>

        <motion.div variants={fade} custom={4} className="mt-6 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">
            Schedule Frequencies
          </p>
          <div className="space-y-2">
            {frequencyOptions.map((freq) => (
              <div key={freq.value} className="flex items-start gap-3 rounded-xl border border-border/30 bg-card/30 p-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground/[0.04] mt-0.5">
                  <Clock size={12} weight="duotone" className="text-foreground/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{freq.label}</p>
                  <p className="text-[12px] text-muted-foreground/50 mt-0.5">{freq.description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 5: Building Teams ── */}
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
          Teams
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-4"
        >
          Building Teams
        </motion.h2>

        <motion.p
          variants={fade}
          custom={2}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed mb-4 max-w-2xl"
        >
          Teams group related employees under shared instructions and shared memory.
          Every employee in a team receives the team&apos;s instructions as context before
          executing their task, ensuring consistent behavior across the group.
        </motion.p>

        <motion.p
          variants={fade}
          custom={3}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed mb-8 max-w-2xl"
        >
          You can create a team from scratch or use one of the pre-built templates. Templates
          come with named employees, roles, recommended schedules, and team instructions &mdash;
          ready to deploy in one click.
        </motion.p>

        {/* Steps to create a team */}
        <motion.div variants={stagger} className="space-y-4 mb-8">
          {[
            {
              step: 1,
              title: "Switch to the Teams tab",
              description: "On the Workforce page, toggle from the \"Employees\" view to the \"Teams\" view.",
            },
            {
              step: 2,
              title: "Choose a template or start from scratch",
              description: "Templates give you a pre-built team with employees and instructions. Starting from scratch lets you fully customize.",
            },
            {
              step: 3,
              title: "Configure team instructions",
              description: "Write shared instructions that every employee in this team will follow — brand voice, escalation rules, tagging conventions, etc.",
            },
            {
              step: 4,
              title: "Add employees",
              description: "Assign existing employees to the team, or the template will create them for you. Each employee keeps their individual schedule.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              variants={fade}
              custom={i + 4}
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

        {/* Mock: Team view */}
        <motion.div variants={fade} custom={8} className="max-w-lg">
          <MockTeamView />
        </motion.div>
      </motion.section>

      {/* ── Section 6: Triggers & Chains ── */}
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
          Triggers & Chains
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-4"
        >
          Chain employees together
        </motion.h2>

        <motion.p
          variants={fade}
          custom={2}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed mb-4 max-w-2xl"
        >
          Triggers let you automatically start one employee when another finishes (or fails).
          You can also pass the output of the first employee to the next one, creating powerful
          multi-step workflows.
        </motion.p>

        <motion.div
          variants={fade}
          custom={3}
          className="mb-6 max-w-2xl"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400 mb-2">
                on_complete
              </p>
              <p className="text-[12px] text-muted-foreground/60 leading-relaxed">
                Fires when the source employee finishes successfully.
              </p>
            </div>
            <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-red-600 dark:text-red-400 mb-2">
                on_failure
              </p>
              <p className="text-[12px] text-muted-foreground/60 leading-relaxed">
                Fires when the source employee encounters an error.
              </p>
            </div>
            <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.03] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400 mb-2">
                on_any
              </p>
              <p className="text-[12px] text-muted-foreground/60 leading-relaxed">
                Fires regardless of outcome — success or failure.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.p
          variants={fade}
          custom={4}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed mb-8 max-w-2xl"
        >
          <span className="text-foreground font-medium">Pass output:</span> When enabled, the triggered
          employee receives the previous employee&apos;s output as context. This is how you build pipelines
          &mdash; research flows into writing, writing flows into publishing.
        </motion.p>

        {/* Mock: Trigger chain */}
        <motion.div variants={fade} custom={5} className="max-w-lg">
          <MockTriggerChain />
        </motion.div>

        {/* Real examples */}
        <motion.div variants={fade} custom={6} className="mt-8 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">
            Example Trigger Chains
          </p>
          <div className="space-y-3">
            {[
              {
                chain: "Scout (research) → Atlas (write) → Nova (publish)",
                description: "Scout researches a topic, Atlas writes a blog post from the findings, Nova publishes it to social media.",
              },
              {
                chain: "Sage (monitor inbox) → Iris (update docs)",
                description: "When Sage resolves a new type of support issue, it triggers Iris to update the knowledge base.",
              },
              {
                chain: "Onyx (price check) → Cleo (update listings)",
                description: "When Onyx detects a competitor price change, Cleo updates your product listings to stay competitive.",
              },
              {
                chain: "Neon (error detected) → Rune (investigate)",
                description: "When Neon finds a production error, Rune automatically reviews the relevant code and creates an incident report.",
              },
            ].map((example, i) => (
              <div key={i} className="rounded-xl border border-border/30 bg-card/30 p-4">
                <p className="text-[13px] font-semibold text-foreground mb-1 font-mono">{example.chain}</p>
                <p className="text-[12px] text-muted-foreground/50 leading-relaxed">{example.description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* ── Section 7: Shared Memory ── */}
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
          Shared Memory
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-4"
        >
          Cross-employee communication
        </motion.h2>

        <motion.p
          variants={fade}
          custom={2}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed mb-4 max-w-2xl"
        >
          Shared memory is a key-value store that every employee in a team can read and write.
          It&apos;s how employees coordinate without you being in the loop. Think of it as
          a shared doc that your AI team uses to stay aligned.
        </motion.p>

        <motion.p
          variants={fade}
          custom={3}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed mb-8 max-w-2xl"
        >
          <span className="text-foreground font-medium">Best practice:</span> Use consistent key naming
          and tags like <code className="text-[12px] bg-foreground/[0.04] px-1.5 py-0.5 rounded">[CAMPAIGN]</code>,{" "}
          <code className="text-[12px] bg-foreground/[0.04] px-1.5 py-0.5 rounded">[ALERT]</code>, or{" "}
          <code className="text-[12px] bg-foreground/[0.04] px-1.5 py-0.5 rounded">[ESCALATION]</code>{" "}
          in your team instructions so employees know how to tag entries for each other.
        </motion.p>

        <motion.div variants={fade} custom={4} className="max-w-lg">
          <MockSharedMemory />
        </motion.div>
      </motion.section>

      {/* ── Section 8: Org Chart & Calendar ── */}
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
          Visualization
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-4"
        >
          Org Chart & Calendar
        </motion.h2>

        <motion.p
          variants={fade}
          custom={2}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed mb-8 max-w-2xl"
        >
          The Workforce page includes two visualization tools: an org chart showing your
          company&apos;s team structure and delegation relationships, and a calendar view
          showing when each employee is scheduled to run.
        </motion.p>

        <motion.div variants={fade} custom={3} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
          <MockOrgChart />
          <MockCalendar />
        </motion.div>
      </motion.section>

      {/* ── Section 9: Team Templates ── */}
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
          Templates
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-4"
        >
          Pre-built Team Templates
        </motion.h2>

        <motion.p
          variants={fade}
          custom={2}
          className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed mb-4 max-w-2xl"
        >
          Don&apos;t want to build from scratch? Choose a template to deploy an entire team
          with pre-configured employees, roles, schedules, and team instructions. Templates
          are available across three tiers based on your plan.
        </motion.p>

        {/* Tier overview */}
        <motion.div variants={fade} custom={3} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 max-w-3xl">
          {[
            { tier: "starter" as const, machines: "1 machine", employees: "Up to 3 employees", price: "$19/mo" },
            { tier: "plus" as const, machines: "2 machines", employees: "Up to 10 employees", price: "$50/mo" },
            { tier: "pro" as const, machines: "3 machines", employees: "Up to 50 employees", price: "$100/mo" },
          ].map((t) => (
            <div key={t.tier} className="rounded-xl border border-border/40 bg-card/50 p-4 text-center">
              <TierBadge tier={t.tier} />
              <p className="text-sm font-semibold text-foreground mt-2">{t.machines}</p>
              <p className="text-[12px] text-muted-foreground/50 mt-0.5">{t.employees}</p>
              <p className="text-[13px] font-semibold text-foreground mt-2">{t.price}</p>
            </div>
          ))}
        </motion.div>

        {/* Template cards */}
        <motion.div variants={stagger} className="space-y-3">
          {teamTemplates.map((template, i) => (
            <TeamTemplateCard key={template.name} template={template} index={i} />
          ))}
        </motion.div>
      </motion.section>

      {/* ── Section 10: Tips & Best Practices ── */}
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
          Best Practices
        </motion.p>

        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
        >
          Tips for a productive workforce
        </motion.h2>

        <motion.div variants={fade} custom={2} className="space-y-4 max-w-2xl">
          {/* Do / Don't comparisons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check size={14} weight="bold" className="text-emerald-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400">Do</span>
              </div>
              <p className="text-[13px] text-foreground leading-relaxed">
                Write detailed role prompts with specific instructions, URLs, and expected outputs.
              </p>
            </div>
            <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Warning size={14} weight="bold" className="text-red-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-red-600 dark:text-red-400">Don&apos;t</span>
              </div>
              <p className="text-[13px] text-muted-foreground/70 leading-relaxed">
                Use vague prompts like &quot;handle marketing&quot; — employees need specific, actionable tasks.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check size={14} weight="bold" className="text-emerald-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400">Do</span>
              </div>
              <p className="text-[13px] text-foreground leading-relaxed">
                Start with 1-2 employees and add more as you learn what works. Test before scaling.
              </p>
            </div>
            <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Warning size={14} weight="bold" className="text-red-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-red-600 dark:text-red-400">Don&apos;t</span>
              </div>
              <p className="text-[13px] text-muted-foreground/70 leading-relaxed">
                Deploy 10 employees at once without testing &mdash; start small, verify outputs, then scale.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check size={14} weight="bold" className="text-emerald-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400">Do</span>
              </div>
              <p className="text-[13px] text-foreground leading-relaxed">
                Use shared memory tags consistently (e.g., [ALERT], [ESCALATION]) so employees can find and act on critical entries.
              </p>
            </div>
            <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Warning size={14} weight="bold" className="text-red-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-red-600 dark:text-red-400">Don&apos;t</span>
              </div>
              <p className="text-[13px] text-muted-foreground/70 leading-relaxed">
                Forget to check execution history &mdash; review results regularly to catch errors and refine prompts.
              </p>
            </div>
          </div>

          {/* Additional tips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {[
              {
                icon: Key,
                title: "Save credentials first",
                description: "Employees that log into websites need credentials saved in advance. Missing credentials = failed runs.",
              },
              {
                icon: Clock,
                title: "Keep machines running",
                description: "Employees need their assigned machine to be running when their schedule fires. Use always-on machines for critical employees.",
              },
              {
                icon: Lightning,
                title: "Use triggers wisely",
                description: "Trigger chains are powerful but can cascade failures. Start with on_complete triggers and add on_failure handlers later.",
              },
              {
                icon: Brain,
                title: "Write clear team instructions",
                description: "Team instructions shape how every employee behaves. Include brand voice, escalation rules, and coordination protocols.",
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
          </div>
        </motion.div>
      </motion.section>

      {/* ── CTA ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="rounded-2xl border border-border/40 bg-card/30 text-center p-6 sm:p-8 mb-8"
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
          Get started
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-3">
          Ready to build your workforce?
        </h2>
        <p className="text-sm text-muted-foreground/60 max-w-lg mx-auto mb-6">
          Head to the Workforce page, pick a template or create your first employee from scratch,
          and let your AI team start working for you 24/7.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/schedules"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Open Workforce
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
