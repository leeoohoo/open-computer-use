"use client"

import { Button } from "@/components/ui/button"
import { NoiseBackground } from "@/components/ui/noise-background"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PointerHighlight } from "@/components/ui/pointer-highlight"
// HeroParallaxChat removed — demo section is now static
// SparklesCore available but not used in current hero design
// import { SparklesCore } from "@/components/ui/sparkles"
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid"
import { Globe as GlobeComponent } from "@/components/magicui/globe"
import { Tree, Folder, File, type TreeViewElement } from "@/components/magicui/file-tree"
import { RainbowButton } from "@/components/magicui/rainbow-button"
import { GridPattern } from "@/components/magicui/grid-pattern"
import { Check, Zap, Shield, Globe, Code, Users, Sparkles, ChevronRight, Star, ArrowRight, Bot, Brain, Rocket, X, MessageSquare, FileText, Search, Terminal, Cloud, Cpu, Monitor, HardDrive, Clock, Infinity, Play, Download, CalendarCheck, RefreshCw } from "lucide-react"
import { CoastyIcon } from "@/components/icons/coasty"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { captureUtmParams } from "@/lib/posthog/analytics"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { useSearchParams } from "next/navigation"
import { LandingHeader } from "./landing-header"
import { HeroUseCaseCarousel } from "./hero-use-case-carousel"
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
    title: "It Fixes Its Own Mistakes",
    description: "Wrong click? Dead end? The agent catches errors, course-corrects, and keeps going. You assign the task and walk away — it handles the rest.",
  },
  {
    icon: Shield,
    title: "You See Everything It Does",
    description: "Full audit trail of every action. Every click, every keystroke, every decision — logged and reviewable. Complete transparency, zero guesswork.",
  },
  {
    icon: CalendarCheck,
    title: "Never Miss a Meeting Again",
    description: "Hand off your calendar chaos. Coasty books appointments, sends follow-ups, and keeps your schedule tight — like a PA who never sleeps and never forgets.",
  },
  {
    icon: Monitor,
    title: "Your Data Stays Yours",
    description: "Every task runs in an isolated sandbox. Your files stay safe, your computer stays untouched, and nothing leaks between sessions. Enterprise-grade security by default.",
  },
  {
    icon: Star,
    title: "Work That Actually Gets Done",
    description: "#1 on the OSWorld benchmark. This isn’t a chatbot that tries — it’s an agent that delivers. Real tasks, completed end-to-end.",
  },
]

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "month",
    description: "Save 30 min (go touch grass)",
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
    description: "Saves ~6-12 hrs of manual work",
    agentMinutes: "200 credits/month",
    features: [
      "1 persistent machine, no limits",
      "SOTA OSWorld Agent 82%",
      "Full AI computer-use agent",
      "One-click remote connection",
      "File upload & download",
      "Full audit trail",
      "2x more credits than Free",
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
    description: "Saves ~18-24 hrs of manual work",
    agentMinutes: "600 credits/month",
    features: [
      "2 persistent machines, no limits",
      "SOTA OSWorld Agent 82%",
      "Full AI computer-use agent",
      "One-click remote connection",
      "File upload & download",
      "Full audit trail",
      "3x more credits than Starter",
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
    description: "Saves ~24-36 hrs of manual work",
    agentMinutes: "1500 credits/month",
    features: [
      "3 persistent machines, no limits",
      "SOTA OSWorld Agent 82%",
      "Full AI computer-use agent",
      "One-click remote connection",
      "File upload & download",
      "Full audit trail",
      "2.5x more credits than Plus",
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
    question: "What is Coasty and how does it work?",
    answer: "Coasty is an AI-powered computer-use platform that gives you a virtual machine controlled by an intelligent agent. You describe what you need done, and the agent handles it autonomously — browsing the web, running commands, managing files, and more. Think of it as a digital employee that works inside its own computer."
  },
  {
    question: "What are credits and how are they used?",
    answer: "Credits are the currency that powers your AI agent sessions. Each task you assign consumes credits based on its complexity and duration. The Free plan includes 100 credits per month, and paid plans offer significantly more. You can also purchase additional credit packs anytime if you need a top-up."
  },
  {
    question: "What's the difference between the plans?",
    answer: "We offer four plans to fit your needs. Free ($0/mo) gives you 100 credits and a 2-hour VM to try things out. Starter ($19/mo) provides 200 credits with a persistent VM and human support. Plus ($50/mo) includes 600 credits, API access, and priority support. Pro ($100/mo) offers 1,500 credits, early access to new features, SLA guarantees, and premium support."
  },
  {
    question: "What is a persistent virtual machine?",
    answer: "Paid plans include a persistent virtual machine that retains your files, installed software, and configuration across sessions. Unlike the Free plan's VM (which resets after 2 hours), a persistent VM lets you pick up exactly where you left off — no re-setup required."
  },
  {
    question: "Can I purchase additional credits?",
    answer: "Yes. All subscribers can purchase additional credit packs at any time from the billing section of their account. Packs are available in multiple sizes with bulk discounts of up to 20%, so you never have to worry about running out mid-project."
  },
  {
    question: "What can the AI agent actually do?",
    answer: "The agent can browse websites, fill out forms, extract data, run terminal commands, manage files, automate desktop applications, and much more. It operates inside a full Ubuntu desktop environment with Chrome, development tools, and office software pre-installed. You can also connect your own desktop via our Electron app for local automation."
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
  const [comparisonPlan, setComparisonPlan] = useState(2) // default to Plus (index 2)
  const [activePersona, setActivePersona] = useState(0)
  const { theme } = useTheme()

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

  return (
    <>
      <div className="min-h-screen bg-background relative">

      {/* Fixed header */}
      <LandingHeader />

      {/* Main content */}
      <main className={cn("relative", isMobile ? "pt-16" : "pt-20")}>
        {/* Hero Section */}
        <section id="hero" className={cn(
          "relative min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center overflow-hidden",
          isMobile ? "px-4 pt-8 pb-16" : "px-6 pt-16 pb-24"
        )}>
          {/* Grid texture — fades from top to transparent */}
          {!isMobile && (
            <GridPattern
              width={64}
              height={64}
              className="absolute inset-0 h-full w-full [mask-image:linear-gradient(to_bottom,white_10%,transparent_50%)] fill-muted-foreground/[0.02] stroke-muted-foreground/[0.05]"
            />
          )}

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
                { value: "82%", label: "Task success rate", sublabel: "#1 in the world" },
                { value: "50x", label: "Cheaper than hiring", sublabel: "Same output, fraction of cost" },
                { value: "24/7", label: "Always available", sublabel: "No breaks, no sick days" },
                { value: "<1 min", label: "To first task", sublabel: "No setup needed" },
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

        {/* Use Cases by Persona */}
        <section id="use-cases" className={cn(
          "py-20 relative",
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
                One agent, every role
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Whatever your role, Coasty takes the busywork off your plate
              </p>
            </motion.div>

            {(() => {
              const personas = [
                {
                  persona: "Startup Founder",
                  pain: "I can't afford to hire, but I need things done.",
                  result: "Save $4,000+/mo on virtual assistants",
                  tasks: ["Competitor research & market analysis", "Lead list building & outreach prep", "Financial model data entry", "Vendor comparisons & procurement"],
                },
                {
                  persona: "Ops Manager",
                  pain: "50 repetitive tasks are eating my team's time.",
                  result: "Reclaim 20+ hours per week for your team",
                  tasks: ["Automated report generation every Monday", "Invoice processing & data extraction", "Employee onboarding form filling", "Cross-system data syncing"],
                },
                {
                  persona: "Solopreneur",
                  pain: "I'm drowning in admin work.",
                  result: "Get back to the work that actually grows your business",
                  tasks: ["Scheduling meetings & calendar management", "Email drafts & follow-ups", "Bookkeeping data entry", "Social media research & posting"],
                },
                {
                  persona: "Agency Owner",
                  pain: "I need to scale without scaling headcount.",
                  result: "Handle 3x more clients with the same team",
                  tasks: ["Client reporting at scale", "Multi-account social management", "Bulk content research & briefs", "QA testing across client sites"],
                },
              ]
              const active = personas[activePersona]

              return (
                <motion.div variants={itemVariants}>
                  {/* Tabs — just text, no decoration */}
                  <div className={cn(
                    "flex justify-center",
                    isMobile ? "gap-0 mb-8 border-b border-border/30" : "gap-0 mb-10 border-b border-border/30"
                  )}>
                    {personas.map((p, i) => {
                      const isActive = i === activePersona
                      return (
                        <button
                          key={p.persona}
                          onClick={() => setActivePersona(i)}
                          className={cn(
                            "relative cursor-pointer transition-colors duration-200 -mb-px",
                            isMobile ? "px-3 pb-3 text-xs" : "px-5 pb-3.5 text-sm",
                            isActive
                              ? "text-foreground font-medium"
                              : "text-muted-foreground/40 hover:text-muted-foreground/70"
                          )}
                        >
                          {p.persona}
                          {isActive && (
                            <motion.div
                              layoutId="persona-underline"
                              className="absolute bottom-0 left-0 right-0 h-px bg-foreground"
                              transition={{ type: "spring", stiffness: 400, damping: 35 }}
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Content */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activePersona}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        isMobile ? "space-y-6" : "grid grid-cols-2 gap-16 max-w-3xl mx-auto"
                      )}
                    >
                      {/* Left — quote + result */}
                      <div>
                        <p className={cn(
                          "text-foreground/50 leading-relaxed",
                          isMobile ? "text-base" : "text-lg"
                        )}>
                          &ldquo;{active.pain}&rdquo;
                        </p>
                        <p className={cn(
                          "text-foreground font-medium mt-5",
                          isMobile ? "text-sm" : "text-base"
                        )}>
                          {active.result}
                        </p>
                      </div>

                      {/* Right — task list */}
                      <div className={cn(isMobile ? "border-t border-border/20 pt-5" : "")}>
                        <ul className={cn(isMobile ? "space-y-2" : "space-y-2.5")}>
                          {active.tasks.map((task, ti) => (
                            <motion.li
                              key={task}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: ti * 0.04, duration: 0.15 }}
                              className={cn(
                                "flex items-start gap-2.5",
                                isMobile ? "text-sm" : "text-[15px]"
                              )}
                            >
                              <span className="text-muted-foreground/30 select-none shrink-0 leading-snug">&mdash;</span>
                              <span className="text-muted-foreground leading-snug">{task}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              )
            })()}
          </motion.div>
        </section>


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
                Three steps. That's it.
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Describe the task, watch it work, review the results
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
                  title: "Tell it what to do",
                  description: "Describe the task in plain English. \"Research competitors and put the results in a spreadsheet.\" \"Fill out this form.\" \"Debug this code.\""
                },
                {
                  step: "2",
                  icon: Monitor,
                  title: "It works on a real computer",
                  description: "Your AI employee opens a browser, clicks, types, and navigates — just like a person sitting at a desk. You can watch it work in real time."
                },
                {
                  step: "3",
                  icon: Check,
                  title: "Review the results",
                  description: "When it's done, review the output. Download files, check the spreadsheet, verify the form. Full audit trail of every action taken."
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
                Why pay more for less?
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                A virtual assistant costs $3,000/mo and works 8 hours a day. Coasty works around the clock for a fraction of the price.
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
                        <h3 className={cn("font-semibold text-foreground", isMobile ? "text-sm" : "text-base")}>Hiring a Human</h3>
                        <p className="text-xs text-muted-foreground/50 mt-0.5">Virtual assistant or employee</p>
                      </div>
                    </div>
                  </div>
                  <div className={cn(isMobile ? "px-5 py-4" : "px-8 py-6")}>
                    {[
                      { label: "Monthly cost", value: "$3,000 – $5,000", negative: true },
                      { label: "Availability", value: "8 hrs/day, weekdays", negative: true },
                      { label: "Ramp-up time", value: "2–4 weeks", negative: true },
                      { label: "Sick days & PTO", value: "15–25 days/year", negative: true },
                      { label: "Scaling", value: "Hire more people", negative: true },
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
                              src={theme === "dark" ? "/logo_light.svg" : "/logo_dark.svg"}
                              alt="Coasty"
                              width={22}
                              height={22}
                              className="h-[22px] w-[22px] object-contain"
                            />
                          )}
                        </div>
                        <div>
                          <h3 className={cn("font-semibold text-foreground", isMobile ? "text-sm" : "text-base")}>Coasty AI Employee</h3>
                          <p className="text-xs text-muted-foreground/50 mt-0.5">AI-powered computer agent</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-[10px] font-semibold text-primary uppercase tracking-wider">Recommended</span>
                    </div>
                  </div>
                  <div className={cn("relative", isMobile ? "px-5 py-4" : "px-8 py-6")}>
                    {[
                      { label: "Monthly cost", value: "From $0/mo" },
                      { label: "Availability", value: "24/7, no breaks" },
                      { label: "Ramp-up time", value: "30 seconds" },
                      { label: "Sick days & PTO", value: "Never" },
                      { label: "Scaling", value: "Instant" },
                      { label: "Audit trail", value: "Every action logged" },
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
                  Save up to <span className="font-bold text-foreground">$4,900/mo</span>
                </span>
                <span className="h-4 w-px bg-border/50" />
                <span className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
                  <span className="font-bold text-primary">50x</span> cheaper
                </span>
              </div>
            </motion.div>
          </motion.div>
        </section>

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
                See it in action
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Real sessions. No scripts. No edits.
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
                Why teams trust Coasty
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Built to deliver real results, not just demos
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
                    href="/auth"
                    cta="Get started"
                  />
                </motion.div>
              ))}
            </BentoGrid>
          </motion.div>
        </section>

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
                Independent benchmarks prove Coasty outperforms every other AI agent at real computer tasks
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
                          src={theme === "dark" ? "/logo_light.svg" : "/logo_dark.svg"}
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

        {/* Pricing Section */}
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
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                Simple, transparent pricing
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Start free. Upgrade when you need more.
              </p>
            </motion.div>

            {/* Plan pills with prices */}
            <div className={cn(
              "flex items-center justify-center gap-2 mb-10 flex-wrap",
              isMobile ? "gap-1.5" : "gap-2"
            )}>
              {pricingPlans.map((plan, i) => (
                <button
                  key={plan.name}
                  onClick={() => setComparisonPlan(i)}
                  className={cn(
                    "relative rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5",
                    isMobile ? "px-3 py-2" : "px-4 py-2.5",
                    comparisonPlan === i
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {plan.name}
                  <span className={cn(
                    "text-xs font-normal",
                    comparisonPlan === i ? "text-primary-foreground/70" : "text-muted-foreground/60"
                  )}>
                    {plan.price}
                  </span>
                  {plan.badge && comparisonPlan !== i && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                  )}
                </button>
              ))}
              <Link
                href="mailto:founders@coasty.ai"
                className={cn(
                  "rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                  isMobile ? "px-3 py-2" : "px-4 py-2.5"
                )}
              >
                <span className="leading-none">Enterprise</span>
                <span className="text-xs font-normal text-muted-foreground/60 leading-none">Custom</span>
              </Link>
            </div>

            {/* Selected plan detail + comparison */}
            {(() => {
              const plan = pricingPlans[comparisonPlan]
              // Tier-appropriate human equivalent costs
              const humanCost = plan.price === "$0" ? "$800" : plan.price === "$19" ? "$1,500" : plan.price === "$50" ? "$3,000" : "$5,000"
              const humanCostNum = plan.price === "$0" ? 800 : plan.price === "$19" ? 1500 : plan.price === "$50" ? 3000 : 5000
              const coastyCostNum = plan.price === "$0" ? 0 : plan.price === "$19" ? 19 : plan.price === "$50" ? 50 : 100
              const savings = (humanCostNum - coastyCostNum).toLocaleString()

              const rows: { label: string; coasty: string | boolean; human: string | boolean }[] = [
                { label: "Monthly cost", coasty: `${plan.price}/mo`, human: `${humanCost}/mo` },
                { label: "You save", coasty: `$${savings}/mo`, human: "$0" },
                { label: "Available", coasty: "24/7, no breaks", human: plan.price === "$0" ? "~4 hrs/week" : plan.price === "$19" ? "~5 hrs/day" : plan.price === "$50" ? "~8 hrs/day" : "~8 hrs/day" },
                { label: "Start working in", coasty: "30 seconds", human: plan.price === "$0" ? "1-2 weeks" : plan.price === "$19" ? "1-2 weeks" : "2-4 weeks" },
                { label: "Sick days & PTO", coasty: "Never", human: plan.price === "$0" ? "N/A (freelancer)" : "15-25 days/yr" },
                { label: "Full audit trail", coasty: true, human: false },
                { label: "Scale up instantly", coasty: true, human: false },
                { label: "No HR or overhead", coasty: true, human: plan.price === "$0" },
                { label: "Cancel anytime", coasty: true, human: plan.price === "$0" },
              ]

              const timeSaved = plan.price === "$0" ? "30 min" : plan.price === "$19" ? "6-12 hrs" : plan.price === "$50" ? "18-24 hrs" : "24-36 hrs"
              const multiplier = plan.price === "$0" ? "Free" : plan.price === "$19" ? "79x" : plan.price === "$50" ? "60x" : "50x"

              return (
                <>
                  {/* Savings highlight pill */}
                  <motion.div
                    key={`pill-${plan.name}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex justify-center mb-8"
                  >
                    <div className="inline-flex items-center gap-3 rounded-full border border-border bg-muted/40 px-5 py-2.5 shadow-sm">
                      <span className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
                        Save <span className="font-semibold text-foreground">${savings}/mo</span>
                      </span>
                      <span className="h-3.5 w-px bg-border" />
                      <span className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
                        <span className="font-semibold text-foreground">{timeSaved}</span> saved monthly
                      </span>
                      <span className="h-3.5 w-px bg-border" />
                      <span className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
                        <span className="font-semibold text-foreground">{multiplier}</span> cheaper
                      </span>
                    </div>
                  </motion.div>

                  <div className={cn(
                    "grid gap-6",
                    isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
                  )}>
                    {/* Left column — Coasty plan details */}
                    <motion.div
                      key={plan.name}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25 }}
                      className={cn(
                        "relative rounded-xl border p-6",
                        "border-primary/30 bg-gradient-to-b from-primary/[0.06] to-primary/[0.02] shadow-sm shadow-primary/10"
                      )}
                    >
                      {plan.badge && (
                        <div className="absolute -top-2.5 left-4">
                          <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                            {plan.badge}
                          </span>
                        </div>
                      )}

                      <div className="mb-5">
                        <div className="flex items-center gap-2">
                          <CoastyIcon className="h-5 w-5 text-primary" />
                          <h3 className="text-sm font-semibold text-primary">Coasty {plan.name}</h3>
                        </div>
                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="text-4xl font-semibold tracking-tight text-foreground">{plan.price}</span>
                          <span className="text-sm text-muted-foreground">/{plan.period}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{plan.description}</p>
                      </div>

                      <div className="mb-3 flex items-center gap-2 rounded-lg bg-primary/[0.08] border border-primary/10 px-3 py-2">
                        <Zap className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium text-foreground">
                          {typeof plan.agentMinutes === 'string'
                            ? plan.agentMinutes
                            : <>
                                {`${(plan.agentMinutes * 10).toLocaleString()} credits`}
                                <span className="text-muted-foreground font-normal">/month</span>
                              </>
                          }
                        </span>
                      </div>

                      {/* Persistent machines highlight */}
                      {plan.name !== "Free" && (
                        <div className="mb-5 flex items-center gap-2 rounded-lg bg-violet-500/[0.08] border border-violet-500/15 px-3 py-2">
                          <HardDrive className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-foreground">
                            {plan.name === "Starter" ? "1" : plan.name === "Plus" ? "2" : "3"} persistent machine{plan.name !== "Starter" ? "s" : ""}
                            <span className="text-muted-foreground font-normal">, no limits</span>
                          </span>
                        </div>
                      )}

                      <Button
                        className={cn(
                          "w-full mb-6",
                          plan.highlighted
                            ? ""
                            : "hover:bg-primary hover:text-primary-foreground"
                        )}
                        variant={plan.highlighted ? "default" : "outline"}
                        size="sm"
                        asChild
                      >
                        <Link href="/auth">
                          {plan.cta}
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>

                      <div className="space-y-2.5">
                        {plan.features.map((feature) => (
                          <div key={feature} className="flex items-start gap-2">
                            <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Right column — Comparison table */}
                    <motion.div
                      key={`compare-${plan.name}`}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: 0.05 }}
                      className="flex flex-col"
                    >
                      <div className="rounded-xl border border-border overflow-hidden">
                        {/* Table header */}
                        <div className="grid grid-cols-3 border-b border-border bg-muted/30">
                          <div className="p-4" />
                          <div className="p-4 text-center border-l border-primary/20 bg-primary/[0.04]">
                            <div className={cn("font-semibold text-primary", isMobile ? "text-xs" : "text-sm")}>
                              Coasty {plan.name}
                            </div>
                            <div className={cn("font-bold text-primary mt-1", isMobile ? "text-lg" : "text-xl")}>
                              {plan.price}<span className="text-xs font-normal text-primary/60">/mo</span>
                            </div>
                          </div>
                          <div className="p-4 text-center border-l border-border">
                            <div className={cn("font-semibold text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
                              Human Equivalent
                            </div>
                            <div className={cn("font-bold text-muted-foreground mt-1 line-through decoration-destructive/50", isMobile ? "text-lg" : "text-xl")}>
                              {humanCost}<span className="text-xs font-normal no-underline">/mo</span>
                            </div>
                          </div>
                        </div>

                        {/* Table rows */}
                        {rows.map((row, i) => (
                          <div
                            key={row.label}
                            className={cn(
                              "grid grid-cols-3",
                              i < rows.length - 1 && "border-b border-border",
                              i % 2 === 1 && "bg-muted/20"
                            )}
                          >
                            <div className={cn("p-3 flex items-center", isMobile ? "text-xs px-2.5" : "text-sm")}>
                              <span className="font-medium text-foreground">{row.label}</span>
                            </div>
                            <div className={cn(
                              "p-3 flex items-center justify-center border-l",
                              "border-primary/20 bg-primary/[0.02]"
                            )}>
                              {typeof row.coasty === "boolean" ? (
                                row.coasty
                                  ? <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10"><Check className="h-3.5 w-3.5 text-primary" /></div>
                                  : <X className="h-4 w-4 text-muted-foreground/40" />
                              ) : (
                                <span className={cn(
                                  "font-semibold text-primary",
                                  isMobile ? "text-xs" : "text-sm"
                                )}>
                                  {row.coasty}
                                </span>
                              )}
                            </div>
                            <div className="p-3 flex items-center justify-center border-l border-border">
                              {typeof row.human === "boolean" ? (
                                row.human
                                  ? <Check className="h-4 w-4 text-muted-foreground/60" />
                                  : <X className="h-4 w-4 text-destructive/40" />
                              ) : (
                                <span className={cn(
                                  "font-medium text-muted-foreground",
                                  isMobile ? "text-xs" : "text-sm"
                                )}>
                                  {row.human}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </div>
                </>
              )
            })()}

            {/* Enterprise pill */}
            <motion.div variants={itemVariants} className={cn(
              "mt-12 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden",
              isMobile ? "p-5" : "p-8"
            )}>
              <div className={cn(
                "flex items-center justify-between gap-6",
                isMobile && "flex-col text-center"
              )}>
                <div className={cn("flex-1", isMobile ? "space-y-2" : "space-y-1")}>
                  <div className="flex items-center gap-2.5" style={isMobile ? { justifyContent: "center" } : undefined}>
                    <h3 className={cn("font-semibold text-foreground", isMobile ? "text-base" : "text-lg")}>Enterprise</h3>
                    <span className="rounded-full bg-foreground/5 border border-border/50 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Custom</span>
                  </div>
                  <p className={cn("text-muted-foreground leading-relaxed", isMobile ? "text-xs" : "text-sm")}>
                    Custom credits, dedicated VMs, SLA guarantees, SSO, priority support, and tailored onboarding for your team.
                  </p>
                </div>
                <Button variant="outline" className="flex-shrink-0 gap-2" asChild>
                  <Link href="mailto:founders@coasty.ai">
                    Contact Us
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </section>

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

        {/* Footer */}
        <footer className="border-t border-border/40">
          <div className={cn(
            "mx-auto py-10",
            isMobile ? "px-4 max-w-xl" : "px-6 max-w-5xl"
          )}>
            <div className={cn(
              "flex justify-between items-center",
              isMobile && "flex-col gap-5"
            )}>
              <div className={cn("flex items-center gap-4", isMobile && "flex-col gap-3")}>
                <p className="text-sm text-muted-foreground/70">
                  © {new Date().getFullYear()} Coasty
                </p>
              </div>
              <div className={cn("flex items-center gap-5", isMobile && "flex-wrap justify-center")}>
                {[
                  { href: "/privacy", label: "Privacy" },
                  { href: "/terms", label: "Terms" },
                  { href: "/blog", label: "Blog" },
                  { href: "/download", label: "Download" },
                  { href: "mailto:founders@coasty.ai", label: "Contact" },
                ].map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-sm text-muted-foreground/60 hover:text-foreground transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </main>
      </div>
    </>
  )
}
