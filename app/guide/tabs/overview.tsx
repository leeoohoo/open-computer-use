"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import {
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
  ChatText,
  Lightning,
  TreeStructure,
  ShieldCheck,
  Eye,
  Keyboard,
  CursorClick,
  ArrowRight,
  ArrowSquareOut,
  CaretDown,
  Key,
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

const cardReveal = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

/* ─── data ─── */

interface UseCase {
  title: string
  description: string
}

interface Category {
  name: string
  tagline: string
  icon: React.ElementType
  accent: string
  accentText: string
  accentBorder: string
  useCases: UseCase[]
}

const categories: Category[] = [
  {
    name: "Sales & Outreach",
    tagline: "Find leads, send emails, close deals — hands-free.",
    icon: Crosshair,
    accent: "bg-rose-500/[0.04] dark:bg-rose-400/[0.06]",
    accentText: "text-rose-600 dark:text-rose-400",
    accentBorder: "border-rose-500/10 dark:border-rose-400/10",
    useCases: [
      {
        title: "Prospect on LinkedIn at scale",
        description: "Find 50 leads matching your ICP, extract their name, role, company, and email, then add each one to your CRM with notes.",
      },
      {
        title: "Send personalized cold emails",
        description: "Research each prospect's company and recent news, write a tailored email referencing specifics, then send via Gmail — one by one.",
      },
      {
        title: "Build a competitor pricing matrix",
        description: "Visit every competitor's pricing page, extract plan names, prices, and feature lists, then compile a formatted comparison spreadsheet.",
      },
      {
        title: "Follow up with stale leads",
        description: "Check your CRM for leads who haven't replied in 3+ days, draft a fresh follow-up with a new angle, and send it.",
      },
    ],
  },
  {
    name: "Marketing & Social Media",
    tagline: "Create, publish, and promote content everywhere.",
    icon: Megaphone,
    accent: "bg-amber-500/[0.04] dark:bg-amber-400/[0.06]",
    accentText: "text-amber-600 dark:text-amber-400",
    accentBorder: "border-amber-500/10 dark:border-amber-400/10",
    useCases: [
      {
        title: "Publish blog posts to WordPress",
        description: "Write a full blog post, add a hero image, set categories and tags, optimize the SEO metadata, and hit publish.",
      },
      {
        title: "Post across every platform",
        description: "Take one piece of content and adapt it for Reddit, Twitter/X, LinkedIn, and Hacker News — respecting each platform's format and culture.",
      },
      {
        title: "Monitor brand mentions",
        description: "Search social platforms and forums for mentions of your brand, compile every result into a daily report with links and sentiment.",
      },
      {
        title: "Schedule a week of content",
        description: "Create 7 days of social media posts with varied formats, schedule them across platforms, and preview each one before queuing.",
      },
    ],
  },
  {
    name: "Job Applications & Career",
    tagline: "Apply smarter. Prepare faster. Land more interviews.",
    icon: Briefcase,
    accent: "bg-sky-500/[0.04] dark:bg-sky-400/[0.06]",
    accentText: "text-sky-600 dark:text-sky-400",
    accentBorder: "border-sky-500/10 dark:border-sky-400/10",
    useCases: [
      {
        title: "Apply to 20 jobs in one session",
        description: "Search LinkedIn, Indeed, and Glassdoor for matching roles, tailor your resume for each, fill out every application form, and submit.",
      },
      {
        title: "Complete long-form applications",
        description: "Fill out the entire Y Combinator application — 30+ fields across multiple pages — pulling context from your docs and prior answers.",
      },
      {
        title: "Prep interview briefing docs",
        description: "Research the company's product, funding, team, recent news, and Glassdoor reviews, then compile a structured briefing document.",
      },
      {
        title: "Optimize your LinkedIn profile",
        description: "Rewrite your headline, about section, and experience bullets to target a specific role, then update everything on LinkedIn directly.",
      },
    ],
  },
  {
    name: "Email & Communication",
    tagline: "Inbox zero without lifting a finger.",
    icon: EnvelopeSimple,
    accent: "bg-violet-500/[0.04] dark:bg-violet-400/[0.06]",
    accentText: "text-violet-600 dark:text-violet-400",
    accentBorder: "border-violet-500/10 dark:border-violet-400/10",
    useCases: [
      {
        title: "Draft replies to your entire inbox",
        description: "Read every unread email, understand the context, draft a reply matching your tone and style, and queue them for your review or send directly.",
      },
      {
        title: "Bulk personalized outreach",
        description: "Import a list of 100 contacts from a spreadsheet, write a unique email for each one referencing their details, and send via your email client.",
      },
      {
        title: "Unsubscribe from everything",
        description: "Scan your inbox for marketing emails, find the unsubscribe link in each one, click it, confirm the unsubscription, and report back.",
      },
      {
        title: "Organize by project and priority",
        description: "Sort your inbox into folders by project name, flag urgent items, archive old threads, and label everything consistently.",
      },
    ],
  },
  {
    name: "Data Entry & Spreadsheets",
    tagline: "Move data between apps without the tedium.",
    icon: Table,
    accent: "bg-emerald-500/[0.04] dark:bg-emerald-400/[0.06]",
    accentText: "text-emerald-600 dark:text-emerald-400",
    accentBorder: "border-emerald-500/10 dark:border-emerald-400/10",
    useCases: [
      {
        title: "Transfer data between web apps",
        description: "Copy records from one web application, navigate to another, paste the data into the correct fields, and verify each entry was saved.",
      },
      {
        title: "Research and build spreadsheets",
        description: "Visit 20+ websites, extract specific data points (prices, contacts, specs), and assemble a clean, formatted spreadsheet from scratch.",
      },
      {
        title: "Clean messy CSV data",
        description: "Open a messy CSV, fix inconsistent date formats, normalize name casing, remove duplicate rows, fill in missing fields where possible, and export.",
      },
      {
        title: "Fill out compliance forms",
        description: "Take data from your source system and fill out repetitive government, tax, or compliance forms — field by field, page by page.",
      },
    ],
  },
  {
    name: "Research & Analysis",
    tagline: "Hours of research compressed into minutes.",
    icon: MagnifyingGlass,
    accent: "bg-cyan-500/[0.04] dark:bg-cyan-400/[0.06]",
    accentText: "text-cyan-600 dark:text-cyan-400",
    accentBorder: "border-cyan-500/10 dark:border-cyan-400/10",
    useCases: [
      {
        title: "Deep-dive research reports",
        description: "Research a topic across 20+ sources — articles, papers, forums — and compile a structured report with key findings, citations, and a summary.",
      },
      {
        title: "Competitor monitoring",
        description: "Visit competitor websites daily, detect changes in pricing, features, or positioning, and send you an alert with a before/after comparison.",
      },
      {
        title: "Aggregate listings from multiple sites",
        description: "Search real estate, job, or product listings across multiple platforms, filter by your criteria, and compile everything into one spreadsheet.",
      },
      {
        title: "Sentiment analysis from reviews",
        description: "Extract product reviews from Amazon or G2, categorize them by theme, analyze the overall sentiment, and produce a summary with quotes.",
      },
    ],
  },
  {
    name: "QA & Software Testing",
    tagline: "Test every flow. Catch every bug. Automatically.",
    icon: Bug,
    accent: "bg-orange-500/[0.04] dark:bg-orange-400/[0.06]",
    accentText: "text-orange-600 dark:text-orange-400",
    accentBorder: "border-orange-500/10 dark:border-orange-400/10",
    useCases: [
      {
        title: "Test signup and onboarding flows",
        description: "Walk through your signup flow with different email types, edge-case names, and various inputs — screenshotting and logging every step.",
      },
      {
        title: "Fuzz every form on your site",
        description: "Find every form on your website, submit them with edge-case data (empty fields, special characters, huge inputs), and report any errors.",
      },
      {
        title: "Full site health check",
        description: "Navigate every page on your site, check for broken links, missing images, console errors, and layout issues — then compile a report.",
      },
      {
        title: "End-to-end checkout testing",
        description: "Test your checkout flow from product selection through payment, order confirmation, and email receipt — verifying every step works.",
      },
    ],
  },
  {
    name: "HR & Recruiting",
    tagline: "Source, screen, and reach out — all on autopilot.",
    icon: UsersThree,
    accent: "bg-pink-500/[0.04] dark:bg-pink-400/[0.06]",
    accentText: "text-pink-600 dark:text-pink-400",
    accentBorder: "border-pink-500/10 dark:border-pink-400/10",
    useCases: [
      {
        title: "Source candidates on LinkedIn",
        description: "Search LinkedIn for profiles matching your job description, evaluate each one against your requirements, and compile a ranked shortlist.",
      },
      {
        title: "Personalized recruiter outreach",
        description: "Send 50 personalized InMails or emails to potential candidates, referencing their specific experience and why they'd be a fit.",
      },
      {
        title: "Post jobs across all boards",
        description: "Take one job description and post it to LinkedIn, Indeed, AngelList, and your careers page — adapting the format for each platform.",
      },
      {
        title: "Screen and rank applicants",
        description: "Review resumes from your ATS, score each candidate against your requirements, and rank them with notes on strengths and gaps.",
      },
    ],
  },
  {
    name: "Customer Support",
    tagline: "Faster responses. Happier customers. Less burnout.",
    icon: Headset,
    accent: "bg-teal-500/[0.04] dark:bg-teal-400/[0.06]",
    accentText: "text-teal-600 dark:text-teal-400",
    accentBorder: "border-teal-500/10 dark:border-teal-400/10",
    useCases: [
      {
        title: "Draft support ticket responses",
        description: "Monitor your support inbox, understand each issue, reference your knowledge base, and draft accurate replies for your review.",
      },
      {
        title: "Update help center articles",
        description: "Analyze common ticket themes, identify gaps in your help docs, and write or update articles to address the most frequent issues.",
      },
      {
        title: "Process refund requests",
        description: "Verify the order details, check your refund policy, apply the refund in your system, and send a confirmation email to the customer.",
      },
      {
        title: "Weekly complaint digest",
        description: "Compile a report of the top customer complaints and feature requests from the past week, grouped by theme with ticket counts.",
      },
    ],
  },
  {
    name: "Personal Productivity",
    tagline: "Automate the errands you never have time for.",
    icon: Rocket,
    accent: "bg-indigo-500/[0.04] dark:bg-indigo-400/[0.06]",
    accentText: "text-indigo-600 dark:text-indigo-400",
    accentBorder: "border-indigo-500/10 dark:border-indigo-400/10",
    useCases: [
      {
        title: "Plan and book travel",
        description: "Search flights on Kayak and Google Flights, compare hotels on Booking.com, pick the best options by price and rating, and book everything.",
      },
      {
        title: "Pay bills and manage finances",
        description: "Log into your bank, pay upcoming bills, transfer funds between accounts, and download your latest statements.",
      },
      {
        title: "Order groceries online",
        description: "Open your preferred grocery store, add items from your saved shopping list to the cart, apply any available coupons, and place the order.",
      },
      {
        title: "Schedule across calendars",
        description: "Find available time slots across multiple calendars, book appointments, and send confirmation emails to all participants.",
      },
    ],
  },
]

const howItWorks = [
  {
    icon: ChatText,
    title: "Describe the task",
    description: "Tell Coasty what you need in plain English. No scripts, no config, no setup.",
  },
  {
    icon: TreeStructure,
    title: "Coasty plans the steps",
    description: "It breaks your task into a sequence of actions — what to open, click, type, and verify.",
  },
  {
    icon: CursorClick,
    title: "Executes autonomously",
    description: "Coasty controls a real browser and desktop — clicking, typing, navigating, and adapting in real time.",
  },
]

const differentiators = [
  {
    icon: Eye,
    title: "Works like a human",
    description: "Sees the screen, reads the content, clicks buttons, types text, and navigates pages — exactly like you would.",
  },
  {
    icon: ChatText,
    title: "No scripts or setup",
    description: "Describe the task in plain English. Coasty figures out which sites to visit, what to click, and how to get it done.",
  },
  {
    icon: Lightning,
    title: "Handles the unexpected",
    description: "CAPTCHAs, cookie banners, login walls, layout changes — Coasty adapts in real time instead of breaking.",
  },
  {
    icon: ShieldCheck,
    title: "Runs in isolation",
    description: "Every session gets its own sandboxed virtual machine. Your data stays safe. Nothing leaks between sessions.",
  },
]

/* ─── components ─── */

function CategoryCard({ category, index }: { category: Category; index: number }) {
  const [expanded, setExpanded] = useState(index < 2)
  const Icon = category.icon

  return (
    <motion.div
      variants={cardReveal}
      className={cn(
        "group relative rounded-2xl border transition-all duration-300",
        "bg-card/50 backdrop-blur-sm",
        category.accentBorder,
        expanded ? "shadow-sm" : "hover:shadow-sm"
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-px rounded-t-2xl", category.accent)} />

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-5 sm:p-6 text-left"
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
            category.accent,
            category.accentText,
          )}
        >
          <Icon size={20} weight="duotone" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-foreground leading-tight">
            {category.name}
          </h3>
          <p className="text-sm text-muted-foreground/70 mt-0.5 leading-snug">
            {category.tagline}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-5 sm:px-6 pb-5 sm:pb-6">
          {category.useCases.map((uc, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border border-border/30 p-4 transition-all duration-200",
                "bg-background/50 hover:bg-background/80 hover:border-border/50",
              )}
            >
              <p className="text-[13px] sm:text-sm font-medium text-foreground leading-snug">
                {uc.title}
              </p>
              <p className="text-[12px] sm:text-[13px] text-muted-foreground/60 mt-1.5 leading-relaxed">
                {uc.description}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── overview tab ─── */

export function OverviewTab({ inApp }: { inApp: boolean }) {
  return (
    <div className="space-y-0">

      {/* ── how it works ── */}
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
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-6"
        >
          How it works
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {howItWorks.map((step, i) => {
            const StepIcon = step.icon
            return (
              <motion.div
                key={i}
                variants={fade}
                custom={i + 1}
                className="relative rounded-2xl border border-border/40 bg-card/30 p-5 sm:p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/[0.04] dark:bg-foreground/[0.06]">
                    <StepIcon size={16} weight="duotone" className="text-foreground/70" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">
                  {step.title}
                </h3>
                <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </motion.section>

      {/* ── credentials callout ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className={cn(
          "rounded-2xl border border-amber-500/15 dark:border-amber-400/15 bg-amber-500/[0.03] dark:bg-amber-400/[0.04] p-5 sm:p-6",
          inApp ? "mb-12 sm:mb-16" : "mb-20 sm:mb-28"
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 dark:bg-amber-400/10">
            <Key size={20} weight="duotone" className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">
              Save your credentials first
            </h3>
            <p className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed">
              For tasks that require logging into websites (Gmail, LinkedIn, your CRM, etc.), save your
              credentials in the{" "}
              <a
                href="/secrets"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2 decoration-border hover:decoration-foreground/40 transition-colors"
              >
                Saved Credentials
                <ArrowSquareOut size={13} weight="bold" className="shrink-0" />
              </a>{" "}
              page. Coasty will use them securely during execution — they&apos;re encrypted and never
              leave your session&apos;s isolated VM.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── categories ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        variants={stagger}
        className={cn(inApp ? "mb-12 sm:mb-16" : "mb-20 sm:mb-28")}
      >
        <motion.div variants={fade} custom={0} className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
            What Coasty can do
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            40+ tasks across 10 categories
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground/60 mt-2 max-w-xl">
            Each example below is something Coasty has actually done. Click any category to see the specific tasks.
          </p>
        </motion.div>

        <motion.div variants={stagger} className="space-y-3">
          {categories.map((cat, i) => (
            <CategoryCard key={cat.name} category={cat} index={i} />
          ))}
        </motion.div>
      </motion.section>

      {/* ── the difference ── */}
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
          Why Coasty
        </motion.p>
        <motion.h2
          variants={fade}
          custom={1}
          className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
        >
          Not a chatbot. Not an RPA script.
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {differentiators.map((d, i) => {
            const DIcon = d.icon
            return (
              <motion.div
                key={i}
                variants={fade}
                custom={i + 2}
                className="rounded-2xl border border-border/40 bg-card/30 p-5 sm:p-6"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.04] dark:bg-foreground/[0.06] mb-3">
                  <DIcon size={18} weight="duotone" className="text-foreground/70" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">
                  {d.title}
                </h3>
                <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
                  {d.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </motion.section>

      {/* ── cta ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className={cn(
          "relative rounded-2xl border border-border/40 bg-card/30 text-center overflow-hidden",
          inApp ? "p-6 sm:p-8 mb-8" : "p-8 sm:p-12"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.01] via-transparent to-foreground/[0.02] pointer-events-none" />

        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
            {inApp ? "Ready?" : "Get started"}
          </p>
          <h2 className={cn(
            "font-bold text-foreground tracking-tight mb-3",
            inApp ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
          )}>
            {inApp ? "Pick any task above and try it now" : "Ready to put Coasty to work?"}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground/60 max-w-lg mx-auto mb-8">
            {inApp
              ? "Copy any example from this guide, paste it as your task, and watch Coasty handle it end to end."
              : "Start with the free tier. Describe any task from this guide and watch Coasty handle it end to end."
            }
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {inApp ? (
              <Link
                href="/"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Start a new task
                <ArrowRight size={14} weight="bold" />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Start free
                  <ArrowRight size={14} weight="bold" />
                </Link>
                <a
                  href="https://cal.com/coasty/15min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all"
                >
                  <VideoCamera size={16} weight="duotone" />
                  Talk to Cofounders
                </a>
                <Link
                  href="/download"
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all"
                >
                  <Keyboard size={16} weight="duotone" />
                  Get the desktop app
                </Link>
              </>
            )}
          </div>
        </div>
      </motion.section>

    </div>
  )
}
