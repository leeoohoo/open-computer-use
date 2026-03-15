"use client"

import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PointerHighlight } from "@/components/ui/pointer-highlight"
// HeroParallaxChat removed — demo section is now static
// SparklesCore available but not used in current hero design
// import { SparklesCore } from "@/components/ui/sparkles"
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid"
import { Globe as GlobeComponent } from "@/components/magicui/globe"
import { Tree, Folder, File, type TreeViewElement } from "@/components/magicui/file-tree"
import { RainbowButton } from "@/components/magicui/rainbow-button"
import { Check, Zap, Shield, Globe, Code, Users, Sparkles, ChevronRight, Star, ArrowRight, Bot, Brain, Rocket, X, MessageSquare, FileText, Search, Terminal, Cloud, Cpu, Monitor, HardDrive, Clock, Infinity, Play, Download, CalendarCheck, RefreshCw, GitFork } from "lucide-react"
import { CoastyIcon } from "@/components/icons/coasty"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { captureUtmParams } from "@/lib/posthog/analytics"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { useSearchParams } from "next/navigation"
import { LandingHeader } from "./landing-header"
import { LandingFooter } from "./landing-footer"
import { HeroUseCaseCarousel } from "./hero-use-case-carousel"
// HeroMachineDemo removed
// MockChatDemo moved out of hero — still available for other sections
// import { MockChatDemo } from "./mock-chat-demo"
// import { MockVMDisplay } from "./mock-vm-display"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { Caveat } from "next/font/google"

const handwriting = Caveat({
  subsets: ["latin"],
  weight: ["600"],
})

const features = [
  {
    icon: Zap,
    title: "Self-Correcting Execution",
    description: "Wrong click? Dead end? The agent detects errors, retries alternative paths, and keeps going until the task is done. Give it a goal and walk away.",
  },
  {
    icon: Shield,
    title: "Full Audit Trail",
    description: "Every click, keystroke, and decision is logged with screenshots. You can replay any session step-by-step to see exactly what the agent did and why.",
  },
  {
    icon: CalendarCheck,
    title: "Schedule & Automate 24/7",
    description: "Set tasks to run on a schedule — hourly, daily, weekly. Coasty works around the clock, processing data, sending follow-ups, and completing tasks while you sleep.",
  },
  {
    icon: Monitor,
    title: "Sandboxed & Secure",
    description: "Every task runs in an isolated virtual machine. Nothing leaks between sessions, your credentials stay private, and each environment is destroyed after use.",
  },
  {
    icon: Star,
    title: "82% OSWorld — #1 AI Agent in the World",
    description: "The highest score ever on the OSWorld benchmark for computer-use agents. Not a chatbot — a real agent that navigates apps, clicks buttons, and completes tasks end-to-end.",
  },
  {
    icon: GitFork,
    title: "Agent Swarms — Parallel Execution",
    description: "Split one task across multiple machines running simultaneously. Each agent works independently, completing work in parallel that would take hours sequentially.",
    href: "/agent-swarms",
  },
]

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "month",
    description: "Try the #1 computer-use agent",
    agentMinutes: "100 credits/month",
    features: [
      "1 virtual machine, 2 hours",
      "SOTA OSWorld Agent 82%",
      "Full AI computer-use agent",
      "One-click remote connection",
      "File upload & download",
      "Full audit trail",
      "No credit card required",
    ],
    limitations: [],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$19",
    period: "month",
    description: "Automate tasks daily",
    agentMinutes: "200 credits/month",
    features: [
      "1 persistent machine, no limits",
      "SOTA OSWorld Agent 82%",
      "Full AI computer-use agent",
      "One-click remote connection",
      "File upload & download",
      "Full audit trail",
      "2x more credits than Free",
      "Swarm mode — 2x your machine limit in parallel",
      "Advanced web search & data extraction",
      "Standard support (real humans, not bots)",
    ],
    limitations: [],
    cta: "Start with Starter",
    highlighted: false,
  },
  {
    name: "Plus",
    price: "$50",
    period: "month",
    description: "Automate complex workflows at scale",
    agentMinutes: "600 credits/month",
    features: [
      "2 persistent machines, no limits",
      "SOTA OSWorld Agent 82%",
      "Full AI computer-use agent",
      "One-click remote connection",
      "File upload & download",
      "Full audit trail",
      "3x more credits than Starter",
      "Swarm mode — 2x your machine limit in parallel",
      "Advanced web search & data extraction",
      "Full API access (coming soon)",
      "Advanced data extraction at scale",
      "Priority support, 24hr response",
    ],
    limitations: [],
    cta: "Go Plus",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Pro",
    price: "$100",
    period: "month",
    description: "Heavy automation, unlimited tasks",
    agentMinutes: "1500 credits/month",
    features: [
      "3 persistent machines, no limits",
      "SOTA OSWorld Agent 82%",
      "Full AI computer-use agent",
      "One-click remote connection",
      "File upload & download",
      "Full audit trail",
      "2.5x more credits than Plus",
      "Swarm mode — 2x your machine limit in parallel",
      "Advanced web search & data extraction",
      "Full API access (coming soon)",
      "Advanced data extraction at scale",
      "Early access to new features",
      "SLA guarantee, 99.9% uptime",
      "Premium support, 12hr response",
    ],
    limitations: [],
    cta: "Get Pro",
    highlighted: false,
  },
]

// Sample file tree for Storage Provided background
const fileTreeElements: TreeViewElement[] = [
  {
    id: "1",
    name: "Projects",
    children: [
      {
        id: "2", 
        name: "my-app",
        children: [
          { id: "3", name: "src", children: [
            { id: "4", name: "index.tsx" },
            { id: "5", name: "App.tsx" },
            { id: "6", name: "styles.css" }
          ]},
          { id: "7", name: "package.json" },
          { id: "8", name: "README.md" }
        ]
      },
      {
        id: "9",
        name: "api-server", 
        children: [
          { id: "10", name: "server.js" },
          { id: "11", name: "routes.js" }
        ]
      }
    ]
  },
  {
    id: "12",
    name: "Documents",
    children: [
      { id: "13", name: "report.pdf" },
      { id: "14", name: "notes.md" }
    ]
  },
  {
    id: "15", 
    name: "Data",
    children: [
      { id: "16", name: "dataset.csv" },
      { id: "17", name: "config.json" }
    ]
  }
]

const demoChatSessions = [
  {
    title: "Coasty on Reddit",
    chatId: "373c1f67-afec-4bd6-adda-3809ecdbdd75",
    description: "Watch Coasty autonomously run a marketing campaign — researching competitors, analyzing trends, and building a strategy deck.",
    tag: "Marketing",
  },
  {
    title: "Finding Prospective Customers",
    chatId: "425d3c49-3a06-41e5-9859-aa00c5b12f3d",
    description: "Coasty finds and researches prospective customers, gathering key details to craft personalized outreach.",
    tag: "Go-to-Market",
  },
  {
    title: "QA Testing Itself",
    chatId: "7ee3e942-c5dd-4e49-93b6-353bb5273b7e",
    description: "Coasty runs quality assurance on its own product — navigating flows, catching bugs, and reporting issues autonomously.",
    tag: "QA Testing",
  },
  {
    title: "Sending an Email on Your Behalf",
    chatId: "60a0722b-fb98-43d6-a4e7-951d80a22363",
    description: "From composing to hitting send — an AI agent drafts and delivers an email entirely on its own.",
    tag: "Communication",
  },
  {
    title: "Applying to a Job",
    chatId: "4ac6f3d2-c273-4a07-bf98-b986d1cbfb88",
    description: "Coasty finds a matching role, tailors your resume, and submits the application — all on its own.",
    tag: "Job Application",
  },
  {
    title: "Posting on Hacker News",
    chatId: "d181de46-b41d-4b87-9648-0374b2b7ec1c",
    description: "Coasty creates and publishes a blog post on Hacker News — writing the content and submitting it autonomously.",
    tag: "Social Media",
  },
]

const faqs = [
  {
    question: "What is Coasty?",
    answer: "Coasty is the world's best computer-use AI agent. You describe a task — research leads, test a website, fill out forms, post on social media — and Coasty opens a real browser, navigates apps, clicks buttons, types text, and completes the task end-to-end. No APIs, no integrations, no code required."
  },
  {
    question: "How is this different from ChatGPT or other AI tools?",
    answer: "ChatGPT generates text. Coasty uses a computer. It doesn't tell you what to do — it opens a browser, navigates to the website, clicks the buttons, fills the forms, and delivers the completed work. It's the difference between getting instructions and having the task done for you."
  },
  {
    question: "What tasks can Coasty automate?",
    answer: "Any task you can do on a computer. Web research, lead generation, data entry, form filling, QA testing, social media posting, email outreach, invoice processing, competitive analysis, recruiting — if it involves a browser or desktop app, Coasty can do it."
  },
  {
    question: "What are credits and how are they used?",
    answer: "Credits are consumed as the agent works on tasks. Longer, more complex tasks use more credits. The Free plan includes 100 credits per month, and paid plans offer significantly more. You can also purchase additional credit packs anytime."
  },
  {
    question: "Can Coasty run on my own computer?",
    answer: "Yes. Our desktop app runs as a lightweight overlay on your machine, controlling your local browser and applications directly. Alternatively, tasks run on isolated cloud machines — your choice."
  },
  {
    question: "Is my data safe?",
    answer: "Every task runs in an isolated sandbox environment. Nothing leaks between sessions. Your credentials stay private, and every action is logged with screenshots in a full audit trail you can review anytime."
  },
]

// Recursive component to render tree items
function TreeItem({ element }: { element: TreeViewElement }) {
  if (element.children && element.children.length > 0) {
    return (
      <Folder element={element.name} value={element.id}>
        {element.children.map((child) => (
          <TreeItem key={child.id} element={child} />
        ))}
      </Folder>
    )
  }
  return (
    <File value={element.id}>
      <span>{element.name}</span>
    </File>
  )
}

export function LandingPage() {
  const [selectedFaq, setSelectedFaq] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()

  const searchParams = useSearchParams()

  // Capture referral code and UTM params from URL
  useEffect(() => {
    const ref = searchParams.get("ref")
    if (ref) {
      localStorage.setItem("coasty_referral_code", ref)
      const url = new URL(window.location.href)
      url.searchParams.delete("ref")
      window.history.replaceState({}, "", url.toString())
    }
    captureUtmParams()
  }, [searchParams])

  // Detect mobile — single mount effect that batches all initial state
  useEffect(() => {
    const isSmallDevice = window.innerWidth < 768
    setIsMobile(isSmallDevice)
    setMounted(true)

    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Animation variants — no motion on mobile (instant reveal)
  const sectionViewport = { once: true, amount: isMobile ? 0.05 : 0.1 }

  const containerVariants = isMobile
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.1, delayChildren: 0.1 }
        }
      }

  const itemVariants = isMobile
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: 30 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: "easeOut" as const }
        }
      }

  // Section divider — cross marks on the guide lines
  const SectionDivider = () => (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6" aria-hidden="true">
      <div className="relative h-px">
        {/* Horizontal line connecting the two verticals */}
        <div className="absolute inset-x-0 h-px bg-border/30 dark:bg-border/20" />
        {/* Left cross marks — on both lines */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2">
          <div className="w-[7px] h-[7px] rotate-45 border border-border/40 dark:border-border/25 bg-background" />
        </div>
        <div className="absolute left-[4px] sm:left-[8px] top-1/2 -translate-y-1/2 -translate-x-1/2">
          <div className="w-[5px] h-[5px] rotate-45 border border-border/25 dark:border-border/15 bg-background" />
        </div>
        {/* Right cross marks — on both lines */}
        <div className="absolute right-[4px] sm:right-[8px] top-1/2 -translate-y-1/2 translate-x-1/2">
          <div className="w-[5px] h-[5px] rotate-45 border border-border/25 dark:border-border/15 bg-background" />
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
          <div className="w-[7px] h-[7px] rotate-45 border border-border/40 dark:border-border/25 bg-background" />
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="min-h-screen bg-background relative">

      {/* Vertical guide lines spanning full page — all devices */}
      <div className="absolute inset-0 pointer-events-none z-[1]" aria-hidden="true">
        <div className="mx-auto h-full max-w-7xl px-4 sm:px-6 relative">
          {/* Left double lines */}
          <div className="absolute left-4 sm:left-6 top-0 bottom-0 w-px bg-border/30 dark:bg-border/20" />
          <div className="absolute left-5 sm:left-[32px] top-0 bottom-0 w-px bg-border/15 dark:bg-border/10" />
          {/* Right double lines */}
          <div className="absolute right-5 sm:right-[32px] top-0 bottom-0 w-px bg-border/15 dark:bg-border/10" />
          <div className="absolute right-4 sm:right-6 top-0 bottom-0 w-px bg-border/30 dark:bg-border/20" />
        </div>
      </div>

      {/* Fixed header */}
      <LandingHeader />

      {/* Main content */}
      <main className={cn("relative", isMobile ? "pt-16" : "pt-20")}>
        {/* Hero Section */}
        <section id="hero" className={cn(
          "relative min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center overflow-hidden",
          isMobile ? "px-4 pt-8 pb-16" : "px-6 pt-16 pb-24"
        )}>

          {/* Orange sunrise glow — constrained to guide lines with inverted-U mask */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full relative">
              <div
                className="absolute inset-y-0 left-4 sm:left-6 right-4 sm:right-6 opacity-[0.1] dark:opacity-[0.13] overflow-hidden"
                style={{
                  background: "linear-gradient(to top, rgb(52,211,153) 0%, rgb(16,185,129) 40%, rgb(5,150,105) 100%)",
                  WebkitMaskImage: "radial-gradient(ellipse 120% 140% at 50% 100%, black 0%, black 40%, transparent 62%)",
                  maskImage: "radial-gradient(ellipse 120% 140% at 50% 100%, black 0%, black 40%, transparent 62%)",
                }}
              />
            </div>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="relative z-10 w-full"
          >
            <motion.div variants={itemVariants}>
              <HeroUseCaseCarousel isMobile={isMobile} />
            </motion.div>
          </motion.div>
        </section>

        <SectionDivider />

        {/* Social Proof Bar */}
        <section className={cn(
          "py-16",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={itemVariants} className={cn(
              "grid text-center",
              isMobile ? "grid-cols-2 gap-6" : "grid-cols-4 gap-0"
            )}>
              {[
                { value: "82%", label: "OSWorld benchmark", sublabel: "#1 computer-use agent globally" },
                { value: "50+", label: "Tools the agent can use", sublabel: "Browser, terminal, desktop, files" },
                { value: "24/7", label: "Runs on schedule", sublabel: "Automate any recurring task" },
                { value: "0", label: "Setup required", sublabel: "No APIs, no integrations, no code" },
              ].map((stat, i) => (
                <div key={stat.label} className={cn(
                  !isMobile && i > 0 && "border-l border-border/30"
                )}>
                  <div className={cn(
                    "font-bold tracking-tight text-foreground",
                    isMobile ? "text-2xl" : "text-3xl"
                  )}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                  <div className="text-xs text-muted-foreground/50 mt-0.5">{stat.sublabel}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        <SectionDivider />

        {/* Why Coasty Section */}
        <section id="why-coasty" className={cn(
          "py-20",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <p className={cn(
                "text-muted-foreground/60 font-medium uppercase tracking-[0.15em] mb-3",
                isMobile ? "text-[10px]" : "text-xs"
              )}>
                Why Coasty
              </p>
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                Not a chatbot. Not an RPA script. Better than{" "}
                <span className="inline-flex items-center gap-1.5 text-red-500">
                  <img src="/openclaw.svg" alt="OpenClaw" className="size-[0.8em] shrink-0 rounded-sm" aria-hidden="true" />
                  OpenClaw
                </span>.
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-2xl mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Better than <span className="inline-flex items-center gap-1 text-red-500 font-medium"><img src="/openclaw.svg" alt="" className="size-4 rounded-sm" />OpenClaw</span>, smarter than traditional automation. Coasty is a real AI employee
                that sees your screen and works like a human — no brittle scripts, no breaking when interfaces change.
              </p>
            </motion.div>

            <div className={cn(
              "grid gap-4",
              isMobile ? "grid-cols-1" : "grid-cols-2"
            )}>
              {[
                {
                  icon: <Monitor className="size-5" />,
                  title: "Works like a human",
                  description: "Sees the screen, reads the content, clicks buttons, types text, and navigates pages — exactly like you would. Not an API wrapper. Real computer control.",
                },
                {
                  icon: <MessageSquare className="size-5" />,
                  title: "No scripts or setup",
                  description: "Describe the task in plain English. Coasty figures out which sites to visit, what to click, and how to get it done. Zero configuration, zero code.",
                },
                {
                  icon: <Zap className="size-5" />,
                  title: "Handles the unexpected",
                  description: "CAPTCHAs, cookie banners, login walls, layout changes — Coasty adapts in real time instead of breaking. Built-in CAPTCHA solving pipeline included.",
                },
                {
                  icon: <Shield className="size-5" />,
                  title: "Runs in isolation",
                  description: "Every session gets its own sandboxed virtual machine. Your data stays safe, your machine stays untouched. Nothing leaks between sessions.",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={itemVariants}
                  className={cn(
                    "group relative rounded-2xl border border-border/40 bg-card/30 p-6 transition-all duration-300 hover:border-border/60 hover:bg-card/50",
                    isMobile ? "p-5" : "p-6"
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/[0.05] mb-4 text-foreground/70 group-hover:text-foreground transition-colors">
                    {item.icon}
                  </div>
                  <h3 className={cn(
                    "font-semibold text-foreground mb-1.5",
                    isMobile ? "text-base" : "text-lg"
                  )}>
                    {item.title}
                  </h3>
                  <p className={cn(
                    "text-muted-foreground/60 leading-relaxed",
                    isMobile ? "text-sm" : "text-[15px]"
                  )}>
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        <SectionDivider />

        {/* How It Works Section */}
        <section id="how-it-works" className={cn(
          "py-20",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                How it works
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Describe a task in plain English. The agent does the rest.
              </p>
            </motion.div>

            <div className={cn(
              "grid gap-8",
              isMobile ? "grid-cols-1" : "grid-cols-3"
            )}>
              {[
                {
                  step: "1",
                  icon: MessageSquare,
                  title: "Describe your task",
                  description: "\"Research 100 leads and add them to HubSpot.\" \"Test every checkout flow on staging.\" \"Post on Reddit and reply to comments.\""
                },
                {
                  step: "2",
                  icon: Monitor,
                  title: "Watch the agent work",
                  description: "Coasty opens a real browser, navigates websites, clicks buttons, fills forms, and types — exactly like a human would. You can watch live or check back later."
                },
                {
                  step: "3",
                  icon: Check,
                  title: "Task complete",
                  description: "Data extracted. Emails sent. Forms filled. Every action is logged with screenshots so you can verify exactly what happened."
                }
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  variants={itemVariants}
                  className="relative"
                >
                  {/* Connector line — desktop only, not on last item */}
                  {!isMobile && i < 2 && (
                    <div className="absolute top-10 left-[calc(50%+2rem)] right-[calc(-50%+2rem)] h-px border-t border-dashed border-border/60" />
                  )}
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                      <item.icon className="h-8 w-8 text-foreground/70" />
                      <span className="absolute -top-2.5 -right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {item.step}
                      </span>
                    </div>
                    <h3 className={cn(
                      "font-semibold tracking-tight",
                      isMobile ? "text-lg" : "text-xl"
                    )}>
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        <SectionDivider />

        {/* Cost Comparison */}
        <section id="cost" className={cn(
          "py-20",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                Why automate with Coasty?
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                The same tasks that take a team hours — Coasty completes in minutes, around the clock.
              </p>
            </motion.div>

            <motion.div variants={itemVariants}>
              <div className={cn(
                "grid",
                isMobile ? "grid-cols-1 gap-4" : "grid-cols-2 gap-5"
              )}>
                {/* Hiring column */}
                <div className="relative rounded-2xl border border-border/30 bg-card/20 overflow-hidden">
                  <div className={cn("border-b border-border/20", isMobile ? "px-5 pt-5 pb-4" : "px-8 pt-8 pb-6")}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
                        <Users className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                      <div>
                        <h3 className={cn("font-semibold text-foreground", isMobile ? "text-sm" : "text-base")}>Doing It Manually</h3>
                        <p className="text-xs text-muted-foreground/50 mt-0.5">You or your team, by hand</p>
                      </div>
                    </div>
                  </div>
                  <div className={cn(isMobile ? "px-5 py-4" : "px-8 py-6")}>
                    {[
                      { label: "Time per task", value: "Hours to days", negative: true },
                      { label: "Availability", value: "Business hours only", negative: true },
                      { label: "Setup time", value: "Learn tools, write SOPs", negative: true },
                      { label: "Error rate", value: "Human mistakes", negative: true },
                      { label: "Scaling", value: "Do more = spend more time", negative: true },
                      { label: "Audit trail", value: "None", negative: true },
                    ].map((row) => (
                      <div key={row.label} className={cn(
                        "flex items-center justify-between py-3",
                        "border-b border-border/10 last:border-0"
                      )}>
                        <span className={cn("text-muted-foreground/70", isMobile ? "text-xs" : "text-sm")}>{row.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-medium text-foreground/50", isMobile ? "text-xs" : "text-sm")}>{row.value}</span>
                          {row.negative && <X className="h-3.5 w-3.5 text-destructive/40" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coasty column */}
                <div className="relative rounded-2xl border border-primary/25 overflow-hidden shadow-lg shadow-primary/5">
                  {/* Subtle gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent" />
                  {/* Top accent line */}
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                  <div className={cn("relative border-b border-primary/15", isMobile ? "px-5 pt-5 pb-4" : "px-8 pt-8 pb-6")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
                          {mounted && (
                            <Image
                              src={resolvedTheme === "dark" ? "/logo_light.svg" : "/logo_dark.svg"}
                              alt="Coasty"
                              width={22}
                              height={22}
                              className="h-[22px] w-[22px] object-contain"
                            />
                          )}
                        </div>
                        <div>
                          <h3 className={cn("font-semibold text-foreground", isMobile ? "text-sm" : "text-base")}>Coasty AI Agent</h3>
                          <p className="text-xs text-muted-foreground/50 mt-0.5">#1 computer-use agent</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-[10px] font-semibold text-primary uppercase tracking-wider">Recommended</span>
                    </div>
                  </div>
                  <div className={cn("relative", isMobile ? "px-5 py-4" : "px-8 py-6")}>
                    {[
                      { label: "Time per task", value: "Minutes" },
                      { label: "Availability", value: "24/7, every day" },
                      { label: "Setup time", value: "60 seconds" },
                      { label: "Error rate", value: "Self-correcting" },
                      { label: "Scaling", value: "Run unlimited tasks in parallel" },
                      { label: "Audit trail", value: "Every click logged + screenshots" },
                    ].map((row) => (
                      <div key={row.label} className={cn(
                        "flex items-center justify-between py-3",
                        "border-b border-primary/8 last:border-0"
                      )}>
                        <span className={cn("text-muted-foreground/70", isMobile ? "text-xs" : "text-sm")}>{row.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-semibold text-primary", isMobile ? "text-xs" : "text-sm")}>{row.value}</span>
                          <Check className="h-3.5 w-3.5 text-primary" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="flex justify-center mt-12">
              <div className={cn(
                "inline-flex items-center gap-4 rounded-full border border-border/40 bg-muted/20 backdrop-blur-sm",
                isMobile ? "px-4 py-2.5" : "px-6 py-3"
              )}>
                <span className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
                  Automate tasks that take <span className="font-bold text-foreground">hours manually</span>
                </span>
                <span className="h-4 w-px bg-border/50" />
                <span className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
                  Starting at <span className="font-bold text-primary">$0/mo</span>
                </span>
              </div>
            </motion.div>
          </motion.div>
        </section>

        <SectionDivider />

        {/* Demo Section */}
        <section id="demo" className={cn(
          "py-20",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                Watch the agent in action
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Real tasks. Real browsers. Every click recorded.
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className={cn(
                "grid gap-4",
                isMobile ? "grid-cols-1" : "grid-cols-2"
              )}
            >
              {demoChatSessions.map((demo) => (
                <Link
                  key={demo.chatId}
                  href={`/share/${demo.chatId}`}
                  target="_blank"
                  className="group relative"
                >
                  <div className={cn(
                    "relative h-full rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden",
                    "transition-all duration-300",
                    "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
                    "hover:-translate-y-1",
                    isMobile ? "p-5" : "p-6"
                  )}>
                    {/* Subtle gradient bg */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="relative h-full flex flex-col gap-4">
                      {/* Tag */}
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                          <span className="h-1 w-1 rounded-full bg-emerald-500" />
                          {demo.tag}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                      </div>

                      {/* Title */}
                      <h3 className={cn(
                        "font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors duration-200",
                        isMobile ? "text-lg" : "text-xl"
                      )}>
                        {demo.title}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                        {demo.description}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center gap-2 pt-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                          <Play className="h-3 w-3" />
                          <span>Watch session</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </motion.div>
          </motion.div>
        </section>

        <SectionDivider />

        {/* Features Section */}
        <section id="features" className={cn(
          "py-20",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                Built for real computer tasks
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Not a chatbot. An AI agent that controls a real computer to complete tasks end-to-end.
              </p>
            </motion.div>
            
            <BentoGrid className={cn(
              "w-full",
              isMobile
                ? "grid-cols-1 auto-rows-[18rem]"
                : "grid-cols-1 sm:grid-cols-2 auto-rows-[20rem]"
            )}>
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  variants={itemVariants}
                  className={cn(index === 0 && !isMobile && "col-span-2")}
                >
                  <BentoCard
                    name={feature.title}
                    className="h-full col-span-1"
                    background={
                      <div className="absolute inset-0 flex items-center justify-center opacity-10">
                        <feature.icon className="h-32 w-32" />
                      </div>
                    }
                    Icon={feature.icon}
                    description={feature.description}
                    href={(feature as any).href || "/auth"}
                    cta={(feature as any).href ? "Learn more" : "Get started"}
                  />
                </motion.div>
              ))}
            </BentoGrid>
          </motion.div>
        </section>

        <SectionDivider />

        {/* OSWorld Benchmark Section */}
        <section className={cn(
          "py-20",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                Benchmarked #1 worldwide
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                82% on OSWorld — the hardest benchmark for AI agents that use real computers
              </p>
            </motion.div>

            {/* Legend */}
            <motion.div variants={itemVariants} className="flex items-center justify-center gap-4 sm:gap-6 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-sky-500/70" />
                <span className="text-xs text-muted-foreground">Agentic Framework</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="text-xs text-muted-foreground">Foundation Model</span>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className={cn(isMobile ? "space-y-3" : "space-y-2.5")}>
              {[
                { name: "Coasty", org: "Ours", score: 82.0, highlight: true, type: "framework" as const },
                { name: "Agent S3", org: "Simular · Opus 4.5 + GPT-5", score: 72.6, type: "framework" as const },
                { name: "Agent S3", org: "Simular · GPT-5", score: 69.9, type: "framework" as const },
                { name: "UiPath Screen Agent", org: "UiPath · Opus 4.5", score: 67.1, type: "framework" as const },
                { name: "Agent S3", org: "Simular · Opus 4.5", score: 66.0, type: "framework" as const },
                { name: "Kimi K2.5", org: "Moonshot AI", score: 63.3, type: "model" as const },
                { name: "Claude Sonnet 4.5", org: "Anthropic", score: 62.9, type: "model" as const },
                { name: "Seed-1.8", org: "ByteDance", score: 61.9, type: "model" as const },
                { name: "Claude Sonnet 4.5", org: "Anthropic · 50 steps", score: 58.1, type: "model" as const },
              ].map((entry, i) => (
                <motion.div
                  key={i}
                  initial={isMobile ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                  animate={isMobile ? { opacity: 1, x: 0 } : undefined}
                  whileInView={isMobile ? undefined : { opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={isMobile ? { duration: 0 } : { delay: i * 0.06, duration: 0.4 }}
                  className={cn(
                    isMobile ? "flex flex-col gap-1" : "flex items-center gap-3",
                    entry.highlight && "py-1"
                  )}
                >
                  {/* Label: stacked above bar on mobile, side-by-side on desktop */}
                  <div className={cn(
                    isMobile
                      ? "flex items-center justify-between text-xs"
                      : "flex-shrink-0 text-right w-44 text-sm"
                  )}>
                    <span className={cn(
                      "font-medium inline-flex items-center gap-1.5",
                      isMobile ? "justify-start" : "justify-end",
                      entry.highlight ? "text-primary" : "text-foreground"
                    )}>
                      {entry.highlight && mounted && (
                        <Image
                          src={resolvedTheme === "dark" ? "/logo_light.svg" : "/logo_dark.svg"}
                          alt="Coasty"
                          width={16}
                          height={16}
                          className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4")}
                        />
                      )}
                      {entry.name}
                      {isMobile && (
                        <span className="text-muted-foreground font-normal ml-1">{entry.org}</span>
                      )}
                    </span>
                    {isMobile && (
                      <span className={cn(
                        "font-semibold tabular-nums",
                        entry.highlight ? "text-primary" : "text-foreground"
                      )}>
                        {entry.score}%
                      </span>
                    )}
                    {!isMobile && (
                      <span className="text-muted-foreground block text-xs">{entry.org}</span>
                    )}
                  </div>
                  {/* Bar */}
                  <div className={cn(
                    "relative rounded-md bg-muted/50 overflow-hidden",
                    isMobile ? "w-full" : "flex-1",
                    entry.highlight
                      ? cn(isMobile ? "h-8" : "h-10", "shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/30")
                      : cn(isMobile ? "h-6" : "h-7")
                  )}>
                    {/* Bar fill */}
                    {isMobile ? (
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-md overflow-hidden",
                          entry.highlight
                            ? "bg-[#0c2d3e]"
                            : entry.type === "framework"
                              ? "bg-sky-500/25"
                              : "bg-muted-foreground/20"
                        )}
                        style={{ width: `${(entry.score / 82) * 100}%` }}
                      >
                        {entry.highlight && (
                          <div
                            className="absolute inset-0"
                            style={{
                              background: "linear-gradient(90deg, #2563eb, #0891b2, #0d9488)",
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(entry.score / 82) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.06 + 0.2, duration: 0.7, ease: "easeOut" }}
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-md overflow-hidden",
                          entry.highlight
                            ? "bg-[#0c2d3e]"
                            : entry.type === "framework"
                              ? "bg-sky-500/25"
                              : "bg-muted-foreground/20"
                        )}
                      >
                        {/* Smoke layers inside the bar — desktop only */}
                        {entry.highlight && (
                          <>
                            <div
                              className="absolute inset-[-40%]"
                              style={{
                                background: "radial-gradient(circle 120px at 20% 50%, #2563eb, transparent), radial-gradient(circle 100px at 80% 50%, #0891b2, transparent)",
                                animation: "coasty-smoke-1 4s ease-in-out infinite alternate",
                              }}
                            />
                            <div
                              className="absolute inset-[-40%]"
                              style={{
                                background: "radial-gradient(circle 90px at 55% 30%, #0d9488, transparent), radial-gradient(circle 110px at 35% 70%, #1d4ed8, transparent)",
                                animation: "coasty-smoke-2 5s ease-in-out infinite alternate",
                              }}
                            />
                            <div
                              className="absolute inset-[-40%]"
                              style={{
                                background: "radial-gradient(circle 100px at 70% 60%, #0e7490, transparent), radial-gradient(circle 80px at 10% 40%, #3b82f6, transparent)",
                                animation: "coasty-smoke-3 3.5s ease-in-out infinite alternate",
                              }}
                            />
                          </>
                        )}
                      </motion.div>
                    )}
                    {/* Score label inside bar — desktop only (mobile shows it in the header row) */}
                    {!isMobile && (
                      <span className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 font-semibold tabular-nums z-10 text-sm",
                        entry.highlight ? "text-white" : "text-foreground"
                      )}>
                        {entry.score}%
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        <SectionDivider />

        {/* Pricing Section — simplified overview */}
        <section id="pricing" className={cn(
          "py-20",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-5xl mx-auto"
          >
            {/* Header */}
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                Start free, scale when ready
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                100 free credits. No credit card. Your AI agent is ready in 60 seconds.
              </p>
            </motion.div>

            {/* Plan cards — simple 4-col grid */}
            <div className={cn(
              "grid gap-3",
              isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-4"
            )}>
              {pricingPlans.map((plan) => (
                <motion.div
                  key={plan.name}
                  variants={itemVariants}
                  className={cn(
                    "relative rounded-xl border p-5 flex flex-col",
                    plan.highlighted
                      ? "border-foreground/20 bg-foreground/[0.03]"
                      : "border-border/50"
                  )}
                >
                  {plan.badge && (
                    <span className="absolute -top-2.5 left-4 rounded-full bg-foreground text-background px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                      {plan.badge}
                    </span>
                  )}

                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-bold tracking-tight">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">/{plan.period}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{plan.description}</p>
                  </div>

                  {/* Key details */}
                  <div className="space-y-2 mb-4 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">{plan.agentMinutes}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <HardDrive className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">
                        {plan.name === "Free" ? "1 VM, 2-hour limit" : `${plan.name === "Starter" ? "1" : plan.name === "Plus" ? "2" : "3"} persistent machine${plan.name !== "Starter" ? "s" : ""}`}
                      </span>
                    </div>
                    {plan.name !== "Free" && (
                      <div className="flex items-center gap-2 text-sm">
                        <Bot className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground">
                          Swarm: {plan.name === "Starter" ? "2" : plan.name === "Plus" ? "4" : "6"} parallel agents
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    size="sm"
                    asChild
                  >
                    <Link href={plan.price === "$0" ? "/auth" : "/pricing"}>
                      {plan.price === "$0" ? "Start Free" : plan.cta}
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </motion.div>
              ))}
            </div>

            {/* Bargain callout — why this is a steal */}
            <motion.div variants={itemVariants} className={cn(
              "mt-10 rounded-xl border border-border/40 overflow-hidden",
              isMobile ? "p-5" : "p-6 sm:p-8"
            )}>
              <div className="text-center max-w-2xl mx-auto">
                <p className={cn(
                  "font-bold tracking-tight",
                  isMobile ? "text-xl" : "text-2xl sm:text-3xl"
                )}>
                  The same work costs <span className="text-muted-foreground line-through decoration-muted-foreground/40">$8,000/mo</span> with manual labor
                </p>
                <p className={cn(
                  "text-muted-foreground mt-3 leading-relaxed",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  A virtual assistant costs $2,000–$4,000/mo. A part-time hire costs more.
                  Coasty does the same work 24/7 starting at $0 — with perfect consistency, full audit trails, and zero training time.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link href="/auth">
                    <motion.button
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full font-semibold cursor-pointer bg-foreground text-background",
                        isMobile ? "px-5 py-2.5 text-sm" : "px-6 py-3 text-sm"
                      )}
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Start Free — 100 Credits
                      <ArrowRight className="h-3.5 w-3.5" />
                    </motion.button>
                  </Link>
                  <Link
                    href="/pricing"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                  >
                    Compare all plans &amp; features
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        <SectionDivider />

        {/* FAQ Section */}
        <section id="faq" className={cn(
          "py-20",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                Frequently asked questions
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Everything you need to know before getting started
              </p>
            </motion.div>
            
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  {...(!isMobile && { whileHover: { scale: 1.01 } })}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className="cursor-pointer border-muted/50 hover:border-primary/50 transition-all"
                    onClick={() => setSelectedFaq(selectedFaq === index ? null : index)}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className={cn("pr-4", isMobile ? "text-base" : "text-lg")}>
                          {faq.question}
                        </CardTitle>
                        <motion.div
                          animate={{ rotate: selectedFaq === index ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                        </motion.div>
                      </div>
                      <AnimatePresence>
                        {selectedFaq === index && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <CardDescription className="mt-4 text-base">
                              {faq.answer}
                            </CardDescription>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        <SectionDivider />

        {/* Footer */}
        <LandingFooter />
      </main>
      </div>
    </>
  )
}
