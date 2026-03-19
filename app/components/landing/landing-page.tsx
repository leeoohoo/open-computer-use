"use client"

import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// HeroParallaxChat removed — demo section is now static
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
import { GuideLines, SectionDivider as SharedSectionDivider } from "./guide-lines"
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

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "month",
    description: "Try the #1 computer-use agent",
    credits: 0,
    machines: 0,
    swarm: 0,
    features: [
      "1 temporary VM (2hr)",
      "Coasty Computer Agent",
      "Basic search",
      "Sandboxed, E2E encrypted",
      "No credit card required",
    ],
    limitations: [],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Lite",
    price: "$9",
    period: "month",
    description: "Light daily automation",
    credits: 100,
    machines: 1,
    swarm: 2,
    features: [
      "1 VM (deleted after inactivity)",
      "Coasty Computer Agent",
      "2 agents in parallel",
      "Basic search",
      "Standard support (real humans)",
    ],
    limitations: [],
    cta: "Get Lite",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$19",
    period: "month",
    description: "Automate tasks every day",
    credits: 200,
    machines: 1,
    swarm: 3,
    features: [
      "1 always-on VM",
      "Coasty Computer Agent",
      "3 agents in parallel",
      "Advanced search & extraction",
      "Standard support (real humans)",
    ],
    limitations: [],
    cta: "Get Starter",
    highlighted: false,
  },
  {
    name: "Plus",
    price: "$50",
    period: "month",
    description: "Scale complex workflows",
    credits: 600,
    machines: 2,
    swarm: 6,
    features: [
      "2 always-on VMs",
      "Coasty Computer Agent",
      "6 agents in parallel",
      "Advanced search & extraction",
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
    description: "Unlimited heavy automation",
    credits: 1500,
    machines: 3,
    swarm: 9,
    features: [
      "3 always-on VMs",
      "Coasty Computer Agent",
      "9 agents in parallel",
      "Advanced search & extraction",
      "Premium support, 12hr response",
    ],
    limitations: [],
    cta: "Get Pro",
    highlighted: false,
  },
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
    answer: "Credits are consumed as the agent works on tasks. Longer, more complex tasks use more credits. Paid plans include monthly credits, and you can also purchase additional credit packs anytime."
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

  const SectionDivider = SharedSectionDivider

  return (
    <>
      <div className="min-h-screen bg-background relative">

      <GuideLines />

      {/* Fixed header */}
      <LandingHeader />

      {/* Main content */}
      <main className={cn("relative", isMobile ? "pt-16" : "pt-20")}>
        {/* Hero Section */}
        <section id="hero" className={cn(
          "relative min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center overflow-hidden",
          isMobile ? "px-7 pt-8 pb-16" : "px-10 pt-16 pb-24"
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
          isMobile ? "px-7" : "px-10"
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
          isMobile ? "px-7" : "px-10"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-5xl mx-auto"
          >
            {/* CSS animations for visual cards */}
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes lp-scan-line { 0% { top: 10% } 100% { top: 85% } }
              @keyframes lp-check-pop { 0% { transform: scale(0); opacity: 0 } 60% { transform: scale(1.2); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
              @keyframes lp-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
              @keyframes lp-click-ring { 0% { transform: scale(0.8); opacity: 0 } 50% { transform: scale(1); opacity: 1 } 100% { transform: scale(1.8); opacity: 0 } }
              @keyframes lp-cursor-blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
              @keyframes lp-typing { 0%, 100% { width: 0 } 30%, 70% { width: 100% } }
              @keyframes lp-step-fill { 0% { transform: scaleX(0) } 100% { transform: scaleX(1) } }
              @keyframes lp-msg-appear { 0% { opacity: 0; transform: translateY(6px) } 100% { opacity: 1; transform: translateY(0) } }
              @keyframes lp-dot-pulse { 0%, 100% { opacity: 0.3 } 50% { opacity: 1 } }
              @keyframes lp-progress { 0% { width: 0% } 100% { width: var(--progress, 75%) } }
              @keyframes lp-retry-loop { 0%, 20% { opacity: 1 } 25%, 45% { opacity: 0.3 } 50%, 70% { opacity: 1 } 75%, 100% { opacity: 0.3 } }
              @keyframes lp-screenshot-flash { 0%, 90% { opacity: 0 } 95% { opacity: 0.3 } 100% { opacity: 0 } }
              @keyframes lp-bar-grow { 0% { width: 0 } 100% { width: var(--w, 60%) } }
              @keyframes lp-swarm-stagger-1 { 0% { width: 0 } 100% { width: 85% } }
              @keyframes lp-swarm-stagger-2 { 0% { width: 0 } 100% { width: 65% } }
              @keyframes lp-swarm-stagger-3 { 0% { width: 0 } 100% { width: 40% } }
            `}} />

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
                Not a chatbot. Not an RPA script.
              </h2>
            </motion.div>

            <div className={cn(
              "grid gap-4",
              isMobile ? "grid-cols-1" : "grid-cols-2"
            )}>
              {/* Works like a human — scan + click visual */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-border/40 bg-card/30 p-5 hover:border-border/60 hover:bg-card/50 transition-all duration-300"
              >
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-16" : "h-20")}>
                  <div className="flex items-center gap-3">
                    <div className="relative w-[80px] h-[48px] rounded-lg border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
                      <div className="space-y-1 p-2">
                        <div className="h-[3px] w-[80%] rounded-full bg-foreground/10" />
                        <div className="h-[3px] w-[60%] rounded-full bg-foreground/10" />
                        <div className="h-[3px] w-[70%] rounded-full bg-foreground/10" />
                        <div className="h-[3px] w-[50%] rounded-full bg-foreground/10" />
                      </div>
                      <div
                        className="absolute left-0 right-0 h-px bg-foreground/25"
                        style={{ animation: "lp-scan-line 3s ease-in-out infinite" }}
                      />
                    </div>
                    <ArrowRight className="size-3 text-foreground/20" />
                    <div className="relative w-6 h-6 rounded-lg border border-foreground/20 flex items-center justify-center">
                      <Monitor className="size-3 text-foreground/30" />
                      <div
                        className="absolute inset-0 rounded-lg border border-foreground/20"
                        style={{ animation: "lp-click-ring 2s ease-out infinite" }}
                      />
                    </div>
                  </div>
                </div>
                <p className={cn("font-semibold text-foreground", isMobile ? "text-base" : "text-lg")}>
                  Works like a human
                </p>
                <p className="text-sm text-muted-foreground/50 mt-0.5">Sees, clicks, types, navigates — exactly like you</p>
              </motion.div>

              {/* No scripts or setup — plain english → done visual */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-border/40 bg-card/30 p-5 hover:border-border/60 hover:bg-card/50 transition-all duration-300"
              >
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-16" : "h-20")}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2 overflow-hidden">
                      <div className="relative">
                        <span className="text-[10px] text-foreground/40 font-mono whitespace-nowrap" style={{ animation: "lp-typing 4s ease-in-out infinite", display: "inline-block", overflow: "hidden" }}>
                          do this task for me
                        </span>
                        <span className="text-[10px] text-foreground/50" style={{ animation: "lp-cursor-blink 1s step-end infinite" }}>|</span>
                      </div>
                    </div>
                    <ArrowRight className="size-3 text-foreground/20" />
                    <div
                      className="flex items-center gap-1 text-foreground/40"
                      style={{ animation: "lp-check-pop 0.5s ease forwards 1.5s", opacity: 0 }}
                    >
                      <Check className="size-4" />
                      <span className="text-xs font-medium">done</span>
                    </div>
                  </div>
                </div>
                <p className={cn("font-semibold text-foreground", isMobile ? "text-base" : "text-lg")}>
                  No scripts or setup
                </p>
                <p className="text-sm text-muted-foreground/50 mt-0.5">Plain English in, results out</p>
              </motion.div>

              {/* Handles the unexpected — CAPTCHA → adapts → success */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-border/40 bg-card/30 p-5 hover:border-border/60 hover:bg-card/50 transition-all duration-300"
              >
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-16" : "h-20")}>
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg border border-foreground/15 bg-foreground/[0.03] px-2.5 py-1.5">
                      <span className="text-[10px] text-foreground/30 font-medium">CAPTCHA</span>
                    </div>
                    <span
                      className="text-xs text-foreground/20"
                      style={{ animation: "lp-float 2s ease-in-out infinite" }}
                    >→</span>
                    <div className="rounded-lg border border-foreground/15 bg-foreground/[0.03] px-2.5 py-1.5">
                      <span className="text-[10px] text-foreground/30 font-medium">adapts</span>
                    </div>
                    <span className="text-xs text-foreground/20">→</span>
                    <div
                      className="h-5 w-5 rounded-full border border-foreground/20 flex items-center justify-center"
                      style={{ animation: "lp-check-pop 0.5s ease forwards 2s", opacity: 0 }}
                    >
                      <Check className="size-3 text-foreground/40" />
                    </div>
                  </div>
                </div>
                <p className={cn("font-semibold text-foreground", isMobile ? "text-base" : "text-lg")}>
                  Handles the unexpected
                </p>
                <p className="text-sm text-muted-foreground/50 mt-0.5">Adapts to CAPTCHAs, popups, layout changes</p>
              </motion.div>

              {/* Runs in isolation — sandboxed VM visual */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-border/40 bg-card/30 p-5 hover:border-border/60 hover:bg-card/50 transition-all duration-300"
              >
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-16" : "h-20")}>
                  <div className="relative w-[60px] h-[44px] rounded-lg border border-dashed border-foreground/15 flex items-center justify-center">
                    <div className="w-8 h-6 rounded border border-foreground/10 bg-foreground/[0.03] flex items-center justify-center">
                      <Monitor className="size-3 text-foreground/20" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full border border-foreground/15 bg-background flex items-center justify-center">
                      <Shield className="size-2.5 text-foreground/30" />
                    </div>
                  </div>
                </div>
                <p className={cn("font-semibold text-foreground", isMobile ? "text-base" : "text-lg")}>
                  Runs in isolation
                </p>
                <p className="text-sm text-muted-foreground/50 mt-0.5">Sandboxed VM per session — nothing leaks</p>
              </motion.div>
            </div>
          </motion.div>
        </section>

        <SectionDivider />

        {/* How It Works Section */}
        <section id="how-it-works" className={cn(
          "py-20",
          isMobile ? "px-7" : "px-10"
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
            </motion.div>

            <div className={cn(
              "grid gap-4",
              isMobile ? "grid-cols-1" : "grid-cols-3"
            )}>
              {/* Step 1: Describe — typing animation */}
              <motion.div
                variants={itemVariants}
                className="relative rounded-2xl border border-border/40 bg-card/30 p-5"
              >
                {!isMobile && (
                  <div className="absolute top-1/2 -right-2.5 text-foreground/15">
                    <ArrowRight className="size-4" />
                  </div>
                )}
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-20" : "h-28")}>
                  <div className="w-full max-w-[200px] rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
                      <div className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
                      <div className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
                    </div>
                    <div className="relative overflow-hidden">
                      <span
                        className="text-[10px] text-foreground/40 font-mono whitespace-nowrap inline-block overflow-hidden"
                        style={{ animation: "lp-typing 5s ease-in-out infinite" }}
                      >
                        Research 100 leads on LinkedIn...
                      </span>
                      <span className="text-[10px] text-foreground/50" style={{ animation: "lp-cursor-blink 1s step-end infinite" }}>|</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/[0.06] text-[10px] font-bold text-foreground/50">1</span>
                  <p className={cn("font-semibold text-foreground", isMobile ? "text-base" : "text-lg")}>Describe your task</p>
                </div>
                <p className="text-sm text-muted-foreground/50 pl-7">Plain English. That&apos;s it.</p>
              </motion.div>

              {/* Step 2: Agent works — mini browser with actions */}
              <motion.div
                variants={itemVariants}
                className="relative rounded-2xl border border-border/40 bg-card/30 p-5"
              >
                {!isMobile && (
                  <div className="absolute top-1/2 -right-2.5 text-foreground/15">
                    <ArrowRight className="size-4" />
                  </div>
                )}
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-20" : "h-28")}>
                  <div className="w-full max-w-[200px] rounded-lg border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
                    {/* Browser bar */}
                    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-foreground/[0.06]">
                      <div className="h-1 w-1 rounded-full bg-foreground/15" />
                      <div className="h-1 w-1 rounded-full bg-foreground/15" />
                      <div className="h-1 w-1 rounded-full bg-foreground/15" />
                      <div className="ml-1 h-3 flex-1 rounded bg-foreground/[0.04]" />
                    </div>
                    {/* Page content with scan line */}
                    <div className="relative p-2 space-y-1.5">
                      <div className="h-[3px] w-[90%] rounded-full bg-foreground/10" />
                      <div className="h-[3px] w-[70%] rounded-full bg-foreground/10" />
                      <div className="h-[3px] w-[80%] rounded-full bg-foreground/10" />
                      <div className="h-[3px] w-[55%] rounded-full bg-foreground/10" />
                      <div className="h-[3px] w-[75%] rounded-full bg-foreground/10" />
                      <div
                        className="absolute left-0 right-0 h-px bg-foreground/20"
                        style={{ animation: "lp-scan-line 2.5s ease-in-out infinite" }}
                      />
                      {/* Click ring */}
                      <div className="absolute top-3 right-4">
                        <div
                          className="h-3 w-3 rounded-full border border-foreground/20"
                          style={{ animation: "lp-click-ring 2s ease-out infinite 1s" }}
                        />
                      </div>
                      {/* Screenshot flash */}
                      <div
                        className="absolute inset-0 bg-foreground/10 rounded"
                        style={{ animation: "lp-screenshot-flash 3s ease infinite" }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/[0.06] text-[10px] font-bold text-foreground/50">2</span>
                  <p className={cn("font-semibold text-foreground", isMobile ? "text-base" : "text-lg")}>Watch the agent work</p>
                </div>
                <p className="text-sm text-muted-foreground/50 pl-7">Opens browser, clicks, types, navigates</p>
              </motion.div>

              {/* Step 3: Done — results appearing */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-border/40 bg-card/30 p-5"
              >
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-20" : "h-28")}>
                  <div className="w-full max-w-[200px] space-y-2">
                    {/* Result items appearing */}
                    {["Task completed", "12 leads found", "Added to CRM"].map((text, i) => (
                      <div
                        key={text}
                        className="flex items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-2.5 py-1.5"
                        style={{ animation: `lp-msg-appear 0.4s ease forwards ${0.5 + i * 0.4}s`, opacity: 0 }}
                      >
                        <div
                          className="h-3 w-3 rounded-full border border-foreground/20 flex items-center justify-center flex-shrink-0"
                          style={{ animation: `lp-check-pop 0.3s ease forwards ${0.8 + i * 0.4}s`, opacity: 0 }}
                        >
                          <Check className="size-2 text-foreground/40" />
                        </div>
                        <span className="text-[10px] text-foreground/40">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/[0.06] text-[10px] font-bold text-foreground/50">3</span>
                  <p className={cn("font-semibold text-foreground", isMobile ? "text-base" : "text-lg")}>Task complete</p>
                </div>
                <p className="text-sm text-muted-foreground/50 pl-7">Every action logged with screenshots</p>
              </motion.div>
            </div>
          </motion.div>
        </section>

        <SectionDivider />

        {/* OSWorld Benchmark Section */}
        <section className={cn(
          "py-20",
          isMobile ? "px-7" : "px-10"
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

        {/* Cost Comparison */}
        <section id="cost" className={cn(
          "py-20",
          isMobile ? "px-7" : "px-10"
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
          isMobile ? "px-7" : "px-10"
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
          isMobile ? "px-7" : "px-10"
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
            </motion.div>

            <div className={cn(
              "grid gap-4",
              isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"
            )}>
              {/* Self-Correcting — retry loop visual */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-border/40 bg-card/30 p-5 hover:border-border/60 hover:bg-card/50 transition-all duration-300"
              >
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-14" : "h-16")}>
                  <div className="flex items-center gap-2">
                    <div className="rounded border border-foreground/10 bg-foreground/[0.03] px-2 py-1">
                      <span className="text-[9px] text-foreground/30 font-mono" style={{ animation: "lp-retry-loop 4s ease infinite" }}>click</span>
                    </div>
                    <span className="text-[9px] text-foreground/15">→</span>
                    <div className="rounded border border-foreground/10 bg-foreground/[0.03] px-2 py-1">
                      <span className="text-[9px] text-foreground/30 font-mono" style={{ animation: "lp-retry-loop 4s ease 1s infinite" }}>retry</span>
                    </div>
                    <span className="text-[9px] text-foreground/15">→</span>
                    <div
                      className="h-4 w-4 rounded-full border border-foreground/20 flex items-center justify-center"
                      style={{ animation: "lp-check-pop 0.5s ease forwards 2s", opacity: 0 }}
                    >
                      <Check className="size-2.5 text-foreground/40" />
                    </div>
                  </div>
                </div>
                <p className={cn("font-semibold text-foreground", isMobile ? "text-sm" : "text-base")}>Self-Correcting</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">Detects errors, retries alternative paths</p>
              </motion.div>

              {/* Audit Trail — screenshot stack visual */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-border/40 bg-card/30 p-5 hover:border-border/60 hover:bg-card/50 transition-all duration-300"
              >
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-14" : "h-16")}>
                  <div className="relative w-[80px] h-[40px]">
                    {/* Stacked screenshots */}
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="absolute rounded border border-foreground/10 bg-foreground/[0.03]"
                        style={{
                          width: 50, height: 30,
                          left: i * 12, top: i * 3,
                          animation: `lp-msg-appear 0.3s ease forwards ${0.3 + i * 0.2}s`,
                          opacity: 0,
                        }}
                      >
                        <div className="p-1 space-y-0.5">
                          <div className="h-[2px] w-[70%] bg-foreground/10" />
                          <div className="h-[2px] w-[50%] bg-foreground/10" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className={cn("font-semibold text-foreground", isMobile ? "text-sm" : "text-base")}>Full Audit Trail</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">Every click logged with screenshots</p>
              </motion.div>

              {/* Schedule — clock with ticks visual */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-border/40 bg-card/30 p-5 hover:border-border/60 hover:bg-card/50 transition-all duration-300"
              >
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-14" : "h-16")}>
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full border border-foreground/15 flex items-center justify-center">
                      <div className="h-3 w-px bg-foreground/25 origin-bottom" style={{ animation: "lp-float 3s ease-in-out infinite" }} />
                      <div className="absolute h-2 w-px bg-foreground/15 origin-bottom rotate-90" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1" style={{ animation: "lp-dot-pulse 2s ease infinite" }}>
                        <div className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
                        <span className="text-[8px] text-foreground/30 font-mono">9:00 AM</span>
                      </div>
                      <div className="flex items-center gap-1" style={{ animation: "lp-dot-pulse 2s ease 0.5s infinite" }}>
                        <div className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
                        <span className="text-[8px] text-foreground/30 font-mono">2:00 PM</span>
                      </div>
                      <div className="flex items-center gap-1" style={{ animation: "lp-dot-pulse 2s ease 1s infinite" }}>
                        <div className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
                        <span className="text-[8px] text-foreground/30 font-mono">11:00 PM</span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className={cn("font-semibold text-foreground", isMobile ? "text-sm" : "text-base")}>Schedule 24/7</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">Runs on cron — hourly, daily, weekly</p>
              </motion.div>

              {/* Sandboxed — VM isolation visual */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-border/40 bg-card/30 p-5 hover:border-border/60 hover:bg-card/50 transition-all duration-300"
              >
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-14" : "h-16")}>
                  <div className="flex items-center gap-2">
                    <div className="relative w-10 h-8 rounded border border-dashed border-foreground/15 flex items-center justify-center">
                      <Monitor className="size-3 text-foreground/20" />
                      <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border border-foreground/15 bg-background flex items-center justify-center">
                        <Shield className="size-2 text-foreground/30" />
                      </div>
                    </div>
                    <span className="text-[8px] text-foreground/15">×</span>
                    <div className="relative w-10 h-8 rounded border border-dashed border-foreground/15 flex items-center justify-center">
                      <Monitor className="size-3 text-foreground/20" />
                      <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border border-foreground/15 bg-background flex items-center justify-center">
                        <Shield className="size-2 text-foreground/30" />
                      </div>
                    </div>
                  </div>
                </div>
                <p className={cn("font-semibold text-foreground", isMobile ? "text-sm" : "text-base")}>Sandboxed & Secure</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">Isolated VM per session, destroyed after</p>
              </motion.div>

              {/* #1 Benchmark — bar chart visual */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-border/40 bg-card/30 p-5 hover:border-border/60 hover:bg-card/50 transition-all duration-300"
              >
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-14" : "h-16")}>
                  <div className="w-[100px] space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 rounded-full bg-foreground/20" style={{ animation: "lp-bar-grow 1.5s ease forwards", "--w": "100%" } as React.CSSProperties} />
                      <span className="text-[7px] text-foreground/40 font-bold whitespace-nowrap">82%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 rounded-full bg-foreground/10" style={{ animation: "lp-bar-grow 1.5s ease forwards 0.2s", "--w": "72%" } as React.CSSProperties} />
                      <span className="text-[7px] text-foreground/25 whitespace-nowrap">73%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 rounded-full bg-foreground/[0.07]" style={{ animation: "lp-bar-grow 1.5s ease forwards 0.4s", "--w": "60%" } as React.CSSProperties} />
                      <span className="text-[7px] text-foreground/25 whitespace-nowrap">62%</span>
                    </div>
                  </div>
                </div>
                <p className={cn("font-semibold text-foreground", isMobile ? "text-sm" : "text-base")}>#1 on OSWorld</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">82% — highest score ever recorded</p>
              </motion.div>

              {/* Swarms — parallel bars visual */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-border/40 bg-card/30 p-5 hover:border-border/60 hover:bg-card/50 transition-all duration-300"
              >
                <div className={cn("flex items-center justify-center mb-4", isMobile ? "h-14" : "h-16")}>
                  <div className="w-[100px] space-y-1.5">
                    {[
                      { label: "Agent 1", anim: "lp-swarm-stagger-1" },
                      { label: "Agent 2", anim: "lp-swarm-stagger-2" },
                      { label: "Agent 3", anim: "lp-swarm-stagger-3" },
                    ].map((a) => (
                      <div key={a.label} className="flex items-center gap-1.5">
                        <span className="text-[7px] text-foreground/25 w-[32px] text-right flex-shrink-0">{a.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-foreground/[0.04] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-foreground/15"
                            style={{ animation: `${a.anim} 3s ease-in-out infinite alternate` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className={cn("font-semibold text-foreground", isMobile ? "text-sm" : "text-base")}>Agent Swarms</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">Split tasks across machines in parallel</p>
              </motion.div>
            </div>
          </motion.div>
        </section>

        <SectionDivider />

        {/* Pricing Section — simplified overview */}
        <section id="pricing" className={cn(
          "py-20",
          isMobile ? "px-7" : "px-10"
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
                No credit card. Your AI agent is ready in 60 seconds.
              </p>
            </motion.div>

            {/* Plan cards — 5-col grid */}
            <div className={cn(
              "grid gap-3",
              isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-5"
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
                    {plan.credits > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">{plan.credits.toLocaleString()} credits/mo</span>
                    </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <HardDrive className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">
                        {plan.machines === 0 ? "1 temporary VM (2hr)" : plan.name === "Lite" ? "1 VM (deleted after inactivity)" : `${plan.machines} always-on VM${plan.machines > 1 ? "s" : ""}`}
                      </span>
                    </div>
                    {plan.swarm > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Bot className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {plan.swarm} agents in parallel
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
                      Start Free
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
          isMobile ? "px-7" : "px-10"
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
