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
    title: "Self-Correcting Execution",
    description: "Wrong click? Dead end? Your AI workforce catches errors, course-corrects, and keeps going. Assign the operation and walk away — it delivers results.",
  },
  {
    icon: Shield,
    title: "Full Operational Visibility",
    description: "Every action logged. Every click, every keystroke, every decision — a complete audit trail your team can review. The transparency of 10 employees with the overhead of zero.",
  },
  {
    icon: CalendarCheck,
    title: "Runs While You Sleep",
    description: "Operations don’t stop at 5pm. Coasty processes tickets, sends follow-ups, generates reports, and manages workflows around the clock — 365 days a year.",
  },
  {
    icon: Monitor,
    title: "Isolated & Secure",
    description: "Every operation runs in an isolated sandbox. Your data stays safe, nothing leaks between sessions. Enterprise-grade security built for running real business operations.",
  },
  {
    icon: Star,
    title: "82% Success Rate — #1 in the World",
    description: "#1 on the OSWorld benchmark. This isn’t a chatbot that tries — it’s an autonomous workforce that executes. Real operations, completed end-to-end.",
  },
]

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "month",
    description: "Test drive your AI workforce",
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
    description: "Run one department autonomously",
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
    description: "Run multiple departments at scale",
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
    description: "Full company operations coverage",
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
    question: "What is Coasty?",
    answer: "Coasty is an autonomous AI workforce platform. You assign business operations — marketing campaigns, lead generation, support tickets, data processing, QA testing — and Coasty executes them end-to-end on real computers. It browses the web, fills forms, sends emails, extracts data, and manages workflows, just like a team of employees would."
  },
  {
    question: "How is this different from ChatGPT or other AI assistants?",
    answer: "AI assistants generate text. Coasty executes operations. It doesn't just tell you what to do — it opens a browser, navigates to websites, clicks buttons, fills forms, sends emails, and delivers completed work. Think of it as hiring an operations team, not chatting with a bot."
  },
  {
    question: "What operations can Coasty run?",
    answer: "Anything a human can do on a computer. Lead generation and outreach, marketing campaigns, support ticket resolution, data extraction and reporting, QA testing, form filling, social media management, competitive research, invoice processing, recruiting — if it involves a browser or desktop application, Coasty can run it."
  },
  {
    question: "What are credits and how are they used?",
    answer: "Credits power your AI workforce. Each operation consumes credits based on complexity and duration. The Free plan includes 100 credits per month, and paid plans offer significantly more. You can also purchase additional credit packs anytime to scale up operations."
  },
  {
    question: "Can Coasty run on my own computer?",
    answer: "Yes. Our desktop app runs as a lightweight overlay on your machine, executing operations directly on your local browser and applications. Alternatively, operations run on isolated cloud machines — your choice."
  },
  {
    question: "Is my data safe?",
    answer: "Every operation runs in an isolated sandbox environment. Nothing leaks between sessions. Your files stay safe, your credentials stay private, and every action is logged in a full audit trail. Enterprise-grade security by default."
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
                { value: "82%", label: "Task success rate", sublabel: "#1 globally on OSWorld" },
                { value: "10+", label: "Departments covered", sublabel: "Marketing to finance" },
                { value: "24/7", label: "Always running", sublabel: "No shifts, no downtime" },
                { value: "$0", label: "Headcount added", sublabel: "Zero employees needed" },
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
                Every department. Zero headcount.
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Other companies hire 20 people. You deploy Coasty.
              </p>
            </motion.div>

            {(() => {
              const personas = [
                {
                  persona: "2-Person Startup",
                  pain: "We need a 20-person team but can only afford two.",
                  result: "Run marketing, sales, and ops with zero hires",
                  tasks: ["Run weekly competitor research across 10 markets", "Build and maintain a 500-lead pipeline", "Process vendor proposals and compare pricing", "Generate investor update reports every Friday"],
                },
                {
                  persona: "Scaling Agency",
                  pain: "We landed 3x more clients but can't hire fast enough.",
                  result: "Service 30 clients with a team of 5",
                  tasks: ["Generate weekly performance reports per client", "Run QA across every client's staging site", "Manage social calendars for 15 accounts", "Research and brief 20 content pieces per week"],
                },
                {
                  persona: "E-commerce Brand",
                  pain: "Support, returns, and inventory are drowning us.",
                  result: "Handle 500+ tickets/week without a support team",
                  tasks: ["Resolve support tickets by pulling order data", "Monitor competitor pricing and update catalogs", "Process returns and generate refund reports", "Run daily social media engagement campaigns"],
                },
                {
                  persona: "Solo Operator",
                  pain: "I run the whole company alone.",
                  result: "Operate like a 10-person company, solo",
                  tasks: ["Prospect, qualify, and send outreach sequences", "Schedule meetings, send agendas, and follow up", "Reconcile invoices and update financial trackers", "Post across 4 channels and engage with replies"],
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
                Deploy in 60 seconds
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                No hiring, no onboarding, no management overhead
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
                  title: "Assign the operation",
                  description: "\"Run outreach to 100 leads and log responses in the CRM.\" \"Process this week's invoices.\" \"QA the checkout flow on staging.\""
                },
                {
                  step: "2",
                  icon: Monitor,
                  title: "It runs autonomously",
                  description: "Your AI workforce opens browsers, navigates apps, fills forms, extracts data — operating real software exactly like a human employee would."
                },
                {
                  step: "3",
                  icon: Check,
                  title: "Operations complete",
                  description: "Reports generated. Emails sent. Data extracted. Every action logged with a full audit trail. Review outputs and deploy the next operation."
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
                The cost of a team vs. Coasty
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                A 3-person operations team costs $12,000+/mo. Coasty runs the same workload 24/7.
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
                        <h3 className={cn("font-semibold text-foreground", isMobile ? "text-sm" : "text-base")}>Hiring a Team</h3>
                        <p className="text-xs text-muted-foreground/50 mt-0.5">VAs, contractors, or employees</p>
                      </div>
                    </div>
                  </div>
                  <div className={cn(isMobile ? "px-5 py-4" : "px-8 py-6")}>
                    {[
                      { label: "Monthly cost", value: "$8,000 – $15,000+", negative: true },
                      { label: "Availability", value: "8 hrs/day, weekdays", negative: true },
                      { label: "Ramp-up time", value: "2–6 weeks per hire", negative: true },
                      { label: "Turnover risk", value: "30% annual avg", negative: true },
                      { label: "Scaling", value: "Hire, train, manage", negative: true },
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
                          <h3 className={cn("font-semibold text-foreground", isMobile ? "text-sm" : "text-base")}>Coasty AI Workforce</h3>
                          <p className="text-xs text-muted-foreground/50 mt-0.5">Autonomous operations platform</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-[10px] font-semibold text-primary uppercase tracking-wider">Recommended</span>
                    </div>
                  </div>
                  <div className={cn("relative", isMobile ? "px-5 py-4" : "px-8 py-6")}>
                    {[
                      { label: "Monthly cost", value: "From $0/mo" },
                      { label: "Availability", value: "24/7, every day" },
                      { label: "Ramp-up time", value: "60 seconds" },
                      { label: "Turnover risk", value: "Zero" },
                      { label: "Scaling", value: "Instant, no hiring" },
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
                  Replace a <span className="font-bold text-foreground">$12k/mo team</span>
                </span>
                <span className="h-4 w-px bg-border/50" />
                <span className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
                  <span className="font-bold text-primary">100x</span> cheaper
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
                Watch it run operations
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Real operations. Unscripted. Every click recorded.
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
                Built for real operations
              </h2>
              <p className={cn(
                "text-muted-foreground mt-4 max-w-lg mx-auto",
                isMobile ? "text-sm" : "text-base"
              )}>
                Not a chatbot. An autonomous workforce that runs your business.
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
              const humanCost = plan.price === "$0" ? "$2,000" : plan.price === "$19" ? "$4,000" : plan.price === "$50" ? "$8,000" : "$12,000"
              const humanCostNum = plan.price === "$0" ? 2000 : plan.price === "$19" ? 4000 : plan.price === "$50" ? 8000 : 12000
              const coastyCostNum = plan.price === "$0" ? 0 : plan.price === "$19" ? 19 : plan.price === "$50" ? 50 : 100
              const savings = (humanCostNum - coastyCostNum).toLocaleString()

              const rows: { label: string; coasty: string | boolean; human: string | boolean }[] = [
                { label: "Monthly cost", coasty: `${plan.price}/mo`, human: `${humanCost}/mo` },
                { label: "You save", coasty: `$${savings}/mo`, human: "$0" },
                { label: "Availability", coasty: "24/7, every day", human: "Business hours only" },
                { label: "Deploy time", coasty: "60 seconds", human: "2-6 weeks to hire" },
                { label: "Turnover risk", coasty: "Zero", human: "30% annual avg" },
                { label: "Full audit trail", coasty: true, human: false },
                { label: "Scale instantly", coasty: true, human: false },
                { label: "No HR overhead", coasty: true, human: false },
                { label: "Cancel anytime", coasty: true, human: false },
              ]

              const deptsCovered = plan.price === "$0" ? "1 dept" : plan.price === "$19" ? "1-2 depts" : plan.price === "$50" ? "3-5 depts" : "Full ops"
              const multiplier = plan.price === "$0" ? "Free" : plan.price === "$19" ? "210x" : plan.price === "$50" ? "160x" : "120x"

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
                        Covers <span className="font-semibold text-foreground">{deptsCovered}</span>
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
                              Hiring a Team
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
