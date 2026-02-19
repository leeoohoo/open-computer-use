"use client"

import { Button } from "@/components/ui/button"
import { NoiseBackground } from "@/components/ui/noise-background"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PointerHighlight } from "@/components/ui/pointer-highlight"
import { HeroParallaxChat } from "@/components/ui/hero-parallax-chat"
import { SparklesCore } from "@/components/ui/sparkles"
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid"
import { Globe as GlobeComponent } from "@/components/magicui/globe"
import { Tree, Folder, File, type TreeViewElement } from "@/components/magicui/file-tree"
import { Check, Zap, Shield, Globe, Code, Users, Sparkles, ChevronRight, Star, ArrowRight, Bot, Brain, Rocket, Github, X, MessageSquare, FileText, Search, Terminal, Cloud, Cpu, Monitor, HardDrive, Clock, Infinity } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { LandingHeader } from "./landing-header"
import { MockChatDemo } from "./mock-chat-demo"
import { MockVMDisplay } from "./mock-vm-display"
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "framer-motion"
import Image from "next/image"
import { Caveat, Cormorant_Garamond } from "next/font/google"

const handwriting = Caveat({
  subsets: ["latin"],
  weight: ["600"],
})

const brandSubtitle = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["italic"],
})

const BRAND_SUBTITLE_TEXT = "I am designed to emulate you."

const features = [
  {
    icon: Monitor,
    title: "Isolated Virtual Machines",
    description: "We provide isolated virtual machines - no need to bring anything. Complete development environments ready to use.",
  },
  {
    icon: Zap,
    title: "Automatic VM Switching",
    description: "Automatic virtual machine switch anytime. Seamlessly transition between different environments as needed.",
  },
  {
    icon: HardDrive,
    title: "Storage Provided",
    description: "Storage also provided. Keep your files, projects, and data persistent across sessions.",
  },
  {
    icon: Infinity,
    title: "Unlimited Requests",
    description: "Unlimited requests in given time quota. Make as many AI requests as you need within your session.",
  },
  {
    icon: Globe,
    title: "Unlimited Web Search",
    description: "Unlimited web only search. Access and analyze information from across the entire internet.",
  },
]

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try out AI automation with limited resources",
    agentMinutes: 10,
    features: [
      "1 virtual machine and computer using agent",
      "Upload/download files from your personal machine",
      "One-click remote connection - no setup required",
      "Community support",
      "Web search & browsing",
    ],
    limitations: [],
    cta: "Start Free",
    highlighted: false,
  },
  // {
  //   name: "Starter",
  //   price: "$19",
  //   period: "per month",
  //   description: "Learn and automate your routine computer operations",
  //   agentMinutes: 200,
  //   features: [
  //     "Up to 2 virtual machines",
  //     "5 CPU cores, 5GB RAM",
  //     "20GB storage",
  //     "Upload/download files from your personal machine",
  //     "One-click remote connection - no setup required",
  //     "Your files & apps remain intact between sessions",
  //     "Standard support",
  //     "Multiple active projects",
  //     "Web search & browsing",
  //     "Basic integrations",
  //   ],
  //   limitations: [],
  //   cta: "Start with Starter",
  //   highlighted: false,
  // },
  {
    name: "Professional",
    price: "$50",
    period: "per month",
    description: "Professional-grade automation for demanding workflows",
    agentMinutes: "Unlimited Usage*",
    features: [
      "1 virtual machine and computer using agent",
      "Upload/download files from your personal machine",
      "One-click remote connection - no setup required",
      "Priority VM performance & faster processing",
      "Priority support with 24hr response",
      "Unlimited projects",
      "Advanced web search & data extraction",
      "API access",
      "Custom workflows",
    ],
    limitations: [],
    cta: "Go Professional",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: "$100",
    period: "per month",
    description: "Unrestricted automation with premium capabilities and priority processing",
    agentMinutes: "Unlimited Premium*",
    features: [
      "1 virtual machine and computer using agent",
      "Upload/download files from your personal machine",
      "One-click remote connection - no setup required",
      "Dedicated high-performance resources",
      "Premium support with 1hr response",
      "Unlimited everything",
      "Early access to new features",
      "Custom integrations & workflows",
      "SSO authentication",
      "SLA guarantee",
    ],
    limitations: [],
    cta: "Get Enterprise",
    highlighted: false,
  },
]

const testimonials = [
  {
    name: "Alex Chen",
    role: "Senior Developer",
    company: "TechStart",
    content: "Perfect for quick tasks! I can spin up a VM, complete a 30-minute coding task, and move on. No setup headaches, just pure productivity.",
    rating: 5,
  },
  {
    name: "Sarah Johnson",
    role: "Product Manager",
    company: "DataFlow",
    content: "Finally, an AI that can handle those small but time-consuming tasks. Data analysis that took me hours now gets done in minutes. So easy to use!",
    rating: 5,
  },
  {
    name: "Mike Rodriguez",
    role: "ML Engineer",
    company: "AI Solutions",
    content: "I use it for quick automation scripts and one-off tasks. The 1-hour limit is actually perfect - it keeps me focused and the AI works incredibly fast.",
    rating: 5,
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
    title: "Defi Protocol Market Arbitrage Research",
    chatId: "72ee57a3-e831-44fa-88a7-02c0f9e777d0",
    description: "Calculate APY differences accounting for gas fees, identify profitable arbitrage paths, and generate an automated trading script",
  },
  {
    title: "Quant Trading & Research",
    chatId: "6f24c719-868d-4308-9e54-8ab00914761d",
    description: "Backtest a Pairs Trading Strategy on QuantConnect",
  },
  {
    title: "Nvidia Options Web app and Dashboard",
    chatId: "fb94d739-978b-42f8-81f3-5acaaeb3420f",
    description: " Options Greeks Dashboard Construction",
  },
  {
    title: "Just Browsing and Playing",
    chatId: "2c27ad52-47e0-4ed4-9998-701cebc1c409",
    description: "AI agent playing your favourite songs",
  },
  {
    title: "Human Control and Intervention",
    chatId: "977166f6-4d5f-4977-904b-603931bd8a8d",
    description: "AI agent researching ask you for instructions",
  },
]

const faqs = [
  {
    question: "What are isolated virtual machines?",
    answer: "We provide fully isolated virtual machines with complete development environments ready to use. No need to bring your own infrastructure - everything is pre-configured and ready for your AI agents to control and execute tasks."
  },
  {
    question: "How does the pricing work?",
    answer: "We offer simple, transparent hourly pricing at $3.99 per hour of agent usage. You only pay for the time your AI agents are actively working. Free tier includes unlimited web searches with a 1-hour task limit."
  },
  {
    question: "What's included in the storage?",
    answer: "With paid plans, we provide persistent storage for your files, projects, and data across sessions. Your work is automatically saved and available whenever you return, making it easy to pick up where you left off."
  },
  {
    question: "What does automatic VM switching mean?",
    answer: "Your AI agent can seamlessly transition between different virtual machine environments as needed. Switch from a development server to a testing environment instantly without manual configuration."
  },
  {
    question: "Are there really unlimited requests?",
    answer: "Yes! Within your session time, you can make unlimited requests to the AI agent. There's no cap on how many commands, questions, or tasks you can give during your allocated time."
  },
  {
    question: "What's the difference between the plans?",
    answer: "Free gets you started with 10 minutes to test the waters 🌊, Professional unlocks unlimited usage for power users 💪, and Enterprise gives you the royal treatment with premium everything! Plus, paid plans get persistent machines (no more 2-hour auto-delete drama!) 👑"
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
  const [showBrandIntro, setShowBrandIntro] = useState(false)
  const [showPageContent, setShowPageContent] = useState(false)
  const [typedSubtitle, setTypedSubtitle] = useState("")
  const [subtitleTypingDone, setSubtitleTypingDone] = useState(false)
  const { theme } = useTheme()
  const prefersReducedMotion = useReducedMotion()

  // Detect mobile device
  useEffect(() => {
    setMounted(true)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!mounted) {
      return
    }

    const isSmallDevice = window.innerWidth < 768

    if (prefersReducedMotion || isSmallDevice) {
      setShowBrandIntro(false)
      setShowPageContent(true)
      setTypedSubtitle(BRAND_SUBTITLE_TEXT)
      setSubtitleTypingDone(true)
      return
    }

    setShowPageContent(false)
    setShowBrandIntro(true)
    setTypedSubtitle("")
    setSubtitleTypingDone(false)
  }, [mounted, prefersReducedMotion])

  useEffect(() => {
    if (!mounted || prefersReducedMotion || !showBrandIntro) {
      return
    }

    let currentIndex = 0
    const typingInterval = window.setInterval(() => {
      currentIndex += 1
      setTypedSubtitle(BRAND_SUBTITLE_TEXT.slice(0, currentIndex))

      if (currentIndex >= BRAND_SUBTITLE_TEXT.length) {
        window.clearInterval(typingInterval)
        setSubtitleTypingDone(true)
      }
    }, 22)

    return () => {
      window.clearInterval(typingInterval)
    }
  }, [mounted, prefersReducedMotion, showBrandIntro])

  useEffect(() => {
    if (!mounted || prefersReducedMotion || !showBrandIntro || !subtitleTypingDone) {
      return
    }

    const startMoveTimeout = window.setTimeout(() => {
      setShowBrandIntro(false)
    }, 280)

    return () => {
      window.clearTimeout(startMoveTimeout)
    }
  }, [mounted, prefersReducedMotion, showBrandIntro, subtitleTypingDone])

  useEffect(() => {
    if (!mounted || prefersReducedMotion || showBrandIntro || showPageContent) {
      return
    }

    const revealTimeout = window.setTimeout(() => {
      setShowPageContent(true)
    }, 600)

    return () => {
      window.clearTimeout(revealTimeout)
    }
  }, [mounted, prefersReducedMotion, showBrandIntro, showPageContent])

  // Animation variants
  const sparklesDensity = isMobile ? 3 : 6
  const sectionViewport = { once: true, amount: isMobile ? 0.03 : 0.1 }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: isMobile ? 0.06 : 0.1,
        delayChildren: isMobile ? 0.04 : 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: isMobile ? 18 : 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: isMobile ? 0.35 : 0.5,
        ease: "easeOut" as const
      }
    }
  }

  const contentVisible = mounted && showPageContent
  const headerVisible = mounted && !showBrandIntro

  return (
    <LayoutGroup id="landing-brand-transition">
      <div className="min-h-screen bg-background relative">
      {/* Sparkles Background */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <SparklesCore
          id="landing-sparkles"
          background="transparent"
          minSize={0.4}
          maxSize={1}
          particleDensity={sparklesDensity}
          className="w-full h-full"
          particleColor={theme === "dark" ? "#FFFFFF" : "#000000"}
        />
      </div>

      <AnimatePresence>
        {mounted && showBrandIntro && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <div className="flex flex-col items-center gap-3 px-6">
              <div className="flex items-center gap-3">
                <motion.div
                  layoutId="landing-brand-logo"
                  transition={{ type: "spring", stiffness: 210, damping: 26 }}
                  className="relative h-14 w-14 sm:h-16 sm:w-16"
                >
                  {mounted && (
                    <Image
                      src={theme === "dark" ? "/logo_light.svg" : "/logo_dark.svg"}
                      alt="Coasty Logo"
                      width={64}
                      height={64}
                      className="h-full w-full object-contain"
                      priority
                    />
                  )}
                </motion.div>
                <motion.span
                  layoutId="landing-brand-text"
                  transition={{ type: "spring", stiffness: 210, damping: 26 }}
                  className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl"
                >
                  Coasty
                </motion.span>
              </div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: "easeOut", delay: 0.15 }}
                className={cn(
                  "min-h-[1.75rem] text-center text-lg text-foreground/75 sm:min-h-[2rem] sm:text-xl",
                  brandSubtitle.className
                )}
              >
                {typedSubtitle}
                {showBrandIntro && !subtitleTypingDone && (
                  <motion.span
                    aria-hidden="true"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                    className="ml-0.5 inline-block"
                  >
                    |
                  </motion.span>
                )}
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed header */}
      <div
        className={cn(
          "transition-opacity duration-500",
          headerVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <LandingHeader animateBrandFromIntro />
      </div>

      {/* Main content */}
      <main
        className={cn(
          "relative transition-opacity duration-500",
          isMobile ? "pt-16" : "pt-20",
          contentVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Hero Section */}
        <section id="hero" className={cn(
          "min-h-screen flex items-center justify-center",
          isMobile ? "px-4 py-12" : "px-6 py-20"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="w-full max-w-7xl"
          >
            <motion.div
              variants={itemVariants}
              className={cn(
                "text-center mb-8",
                isMobile ? "space-y-5" : "space-y-7"
              )}
            >
              <h1 className={cn(
                "font-semibold tracking-tight",
                isMobile ? "text-4xl" : "text-5xl sm:text-6xl lg:text-7xl xl:text-8xl"
              )}>
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  AI Agents That{" "}
                </span>
                <PointerHighlight
                  containerClassName="inline-block"
                  rectangleClassName="border-primary/50"
                  pointerClassName="text-primary"
                >
                  <span
                    className={cn(
                      "inline-block px-2 py-1 text-primary/90 -rotate-1",
                      "text-[1.05em] leading-[0.9]",
                      handwriting.className
                    )}
                  >
                    Control Computers
                  </span>
                </PointerHighlight>
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {" "}Like Humans
                </span>
              </h1>
              <div className="mx-auto flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-lg md:w-auto md:max-w-none md:flex-row md:items-center md:gap-4">
                <NoiseBackground
                  containerClassName="w-full md:w-auto p-[1px] rounded-full bg-transparent dark:bg-transparent"
                  className="p-0"
                  gradientColors={["rgb(34, 197, 94)", "rgb(16, 185, 129)", "rgb(132, 204, 22)"]}
                  noiseIntensity={0.08}
                  speed={0.08}
                >
                  <Link
                    href="/auth"
                    className="group inline-flex h-12 w-full items-center justify-center rounded-full bg-transparent px-5 sm:px-6 md:min-w-[220px] md:px-7 text-sm sm:text-[0.95rem] font-semibold text-slate-900 transition-opacity hover:opacity-95 dark:text-white"
                  >
                    Put AI to Work for You
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </NoiseBackground>
                <NoiseBackground
                  containerClassName="w-full md:w-auto p-[1px] rounded-full bg-transparent dark:bg-transparent"
                  className="p-0"
                  gradientColors={["rgb(59, 130, 246)", "rgb(14, 165, 233)", "rgb(6, 182, 212)"]}
                  noiseIntensity={0.08}
                  speed={0.08}
                >
                  <Link
                    href="https://github.com/LLmHub-dev/open-computer-use"
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex h-12 w-full items-center justify-center rounded-full bg-transparent px-5 sm:px-6 md:min-w-[220px] md:px-7 text-sm sm:text-[0.95rem] font-semibold text-slate-900 transition-opacity hover:opacity-95 dark:text-white"
                  >
                    <Github className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                    Built in Public. Open Source.
                  </Link>
                </NoiseBackground>
              </div>
              <p className={cn(
                "text-muted-foreground mx-auto",
                isMobile ? "text-base max-w-md" : "text-lg sm:text-xl max-w-2xl"
              )}>
                Your AI employees work on real computers. They browse, code, and get things done while you focus on what matters.
              </p>
            </motion.div>
            
            {/* VM display and Chat Input */}
            <div className="relative">
              <motion.div
                variants={itemVariants}
                className={cn(
                  "relative z-10",
                  isMobile
                    ? "mb-6"
                    : "mb-[-40px]" // Overlap on desktop
                )}
              >
                <div className={cn(
                  "mx-auto",
                  isMobile ? "max-w-sm" : "max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl"
                )}>
                  <MockVMDisplay />
                </div>
              </motion.div>
              
              <motion.div 
                variants={itemVariants} 
                className={cn(
                  "relative z-20",
                  isMobile ? "pt-0" : "pt-16"
                )}
              >
                <div className={cn(
                  "mx-auto",
                  isMobile ? "max-w-full" : "max-w-3xl"
                )}>
                  <MockChatDemo />
                </div>
              </motion.div>
            </div>
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
            className="max-w-7xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                Everything You Need for AI Productivity
              </h2>
              <p className={cn(
                "text-muted-foreground",
                isMobile ? "mt-4 text-base" : "mt-6 text-lg sm:text-xl"
              )}>
                Powerful features that make AI work for you
              </p>
            </motion.div>
            
            <BentoGrid className={cn(
              "w-full",
              isMobile 
                ? "grid-cols-1 auto-rows-[18rem]" 
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[20rem]"
            )}>
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  variants={itemVariants}
                  className={cn(
                    index === 0 && !isMobile ? "col-span-2" : "col-span-1",
                    index === 3 && !isMobile ? "col-span-2" : "col-span-1"
                  )}
                >
                  <BentoCard
                    name={feature.title}
                    className={cn(
                      "h-full",
                      index === 0 && !isMobile ? "col-span-2" : "col-span-1",
                      index === 3 && !isMobile ? "col-span-2" : "col-span-1"
                    )}
                    background={
                      feature.title === "Unlimited Web Search" ? (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                          <Globe className="h-32 w-32" />
                        </div>
                      ) : feature.title === "Storage Provided" ? (
                        <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
                          <div className="p-4 scale-75">
                            <Tree 
                              elements={fileTreeElements}
                              initialExpandedItems={["1", "2", "3"]}
                              className="text-xs"
                            >
                              {fileTreeElements.map((element) => (
                                <TreeItem key={element.id} element={element} />
                              ))}
                            </Tree>
                          </div>
                        </div>
                      ) : feature.title === "Unlimited Requests" ? (
                        <div className="absolute inset-0 overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center">
                            {/* Animated infinity symbol */}
                            <motion.div
                              className="opacity-20"
                              animate={{
                                rotate: 360,
                              }}
                              transition={{
                                duration: 20,
                                ease: "linear",
                                repeat: Number.POSITIVE_INFINITY,
                              }}
                            >
                              <Infinity className="w-48 h-48" />
                            </motion.div>
                          </div>
                          {/* Animated rings */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            {[0, 1, 2].map((index) => (
                              <motion.div
                                key={index}
                                className="absolute w-32 h-32 border-2 border-primary/10 rounded-full"
                                initial={{ scale: 1, opacity: 0 }}
                                animate={{
                                  scale: [1, 2.5],
                                  opacity: [0.5, 0],
                                }}
                                transition={{
                                  duration: 3,
                                  ease: "easeOut" as const,
                                  repeat: Number.POSITIVE_INFINITY,
                                  delay: index * 1,
                                }}
                              />
                            ))}
                          </div>
                          {/* Grid dots pattern */}
                          <div className="absolute inset-0">
                            <div 
                              className="w-full h-full opacity-5"
                              style={{
                                backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
                                backgroundSize: '30px 30px',
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                          <feature.icon className="h-32 w-32" />
                        </div>
                      )
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

        {/* Demo Section */}
        <section id="demo" className={cn(
          "py-20 relative",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-7xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                See AI Agents in Action
              </h2>
              <p className={cn(
                "text-muted-foreground",
                isMobile ? "mt-4 text-base" : "mt-6 text-lg sm:text-xl"
              )}>
                Watch how our AI agents complete real-world tasks
              </p>
            </motion.div>
          </motion.div>
          <div className="relative min-h-[400px]">
            <HeroParallaxChat demos={demoChatSessions} />
          </div>
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
            className="max-w-7xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Monthly Plans That Actually Make Sense! 🎉
                </span>
              </h2>
              <p className={cn(
                "text-muted-foreground",
                isMobile ? "mt-4 text-base" : "mt-6 text-lg sm:text-xl"
              )}>
                <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                  No confusing credits, no hourly stress - just pick your plan and let your AI employees work their magic! ✨
                </span>
              </p>
            </motion.div>
            
            <div className={cn(
              "grid gap-6 justify-center",
              isMobile
                ? "grid-cols-1"
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto"
            )}>
              {pricingPlans.map((plan, index) => (
                <motion.div
                  key={plan.name}
                  variants={itemVariants}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ 
                    delay: index * 0.1,
                    duration: 0.5,
                    ease: "easeOut" as const
                  }}
                  className="h-full group"
                >
                  <div className="relative h-full">
                    {/* Badge positioned outside the card */}
                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <Badge className="bg-primary text-primary-foreground shadow-lg px-4 py-1 text-xs font-bold animate-pulse">
                          ⭐ {plan.badge}
                        </Badge>
                      </div>
                    )}
                    
                    <Card 
                      className={cn(
                        "relative h-full overflow-hidden transition-all duration-300",
                        "border-2 hover:border-primary/50",
                        "hover:shadow-2xl hover:shadow-primary/10",
                        "hover:-translate-y-2",
                        "bg-gradient-to-b from-background to-background/80",
                        plan.highlighted && [
                          "border-primary shadow-xl",
                          "bg-gradient-to-b from-primary/5 to-background",
                          "scale-[1.02]"
                        ]
                      )}
                    >
                      {/* Glow effect on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Top gradient line for highlighted plan */}
                      {plan.badge && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
                      )}
                    
                    <CardHeader className="relative space-y-4 pb-6">
                      <div className="space-y-2">
                        <CardTitle className="text-2xl font-bold tracking-tight group-hover:text-primary transition-colors duration-200">
                          {plan.name}
                        </CardTitle>
                        <CardDescription className="text-sm leading-relaxed min-h-[3rem]">
                          {plan.description}
                        </CardDescription>
                      </div>
                      
                      <div className="pt-4 pb-2">
                        <div className="flex items-baseline gap-1">
                          <span className="text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            {plan.price}
                          </span>
                          <span className="text-sm text-muted-foreground font-medium">
                            /{plan.period}
                          </span>
                        </div>
                      </div>
                      
                      {/* Agent Execution Time Highlight */}
                      <div className="p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-2">
                          <Zap className="h-5 w-5 text-primary" />
                          <div className="flex flex-col">
                            <span className="text-2xl font-bold text-primary">
                              {typeof plan.agentMinutes === 'string'
                                ? plan.agentMinutes
                                : plan.agentMinutes >= 60
                                  ? `${Math.floor(plan.agentMinutes / 60)}${plan.agentMinutes % 60 > 0 ? '+' : ''} hours`
                                  : `${plan.agentMinutes} minutes`
                              }
                            </span>
                            <span className="text-xs text-muted-foreground">
                              AI agent automation per month
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <Separator className="opacity-50" />
                    </CardHeader>
                    
                    <CardContent className="relative space-y-4">
                      <div className="space-y-3">
                        {plan.features.map((feature, idx) => (
                          <motion.div
                            key={feature}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-start gap-3 group/item"
                          >
                            <div className="rounded-full bg-green-500/10 p-1 mt-0.5">
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            </div>
                            <span className="text-sm leading-relaxed text-foreground/90 group-hover/item:text-foreground transition-colors">
                              {feature}
                            </span>
                          </motion.div>
                        ))}
                        {plan.limitations.map((limitation, idx) => (
                          <motion.div
                            key={limitation}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: (plan.features.length + idx) * 0.05 }}
                            className="flex items-start gap-3"
                          >
                            <div className="rounded-full bg-muted p-1 mt-0.5">
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <span className="text-sm leading-relaxed text-muted-foreground">
                              {limitation}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                    
                    <CardFooter className="relative pt-6">
                      <Button 
                        className={cn(
                          "w-full h-12 text-sm font-semibold transition-all duration-200",
                          "shadow-sm hover:shadow-lg",
                          plan.highlighted ? [
                            "bg-primary hover:bg-primary/90",
                            "shadow-primary/25 hover:shadow-primary/40",
                          ] : [
                            "hover:bg-primary hover:text-primary-foreground",
                            "hover:border-primary"
                          ]
                        )}
                        variant={plan.highlighted ? "default" : "outline"}
                        size="lg"
                        asChild
                      >
                        <Link href="/auth" className="flex items-center justify-center gap-2">
                          <span>{plan.cta}</span>
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className={cn(
          "py-20",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={sectionViewport}
            className="max-w-7xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                Loved by Teams Worldwide
              </h2>
              <p className={cn(
                "text-muted-foreground",
                isMobile ? "mt-4 text-base" : "mt-6 text-lg sm:text-xl"
              )}>
                See what our users are saying
              </p>
            </motion.div>
            
            <div className={cn(
              "grid gap-8",
              isMobile 
                ? "grid-cols-1" 
                : "grid-cols-1 lg:grid-cols-3"
            )}>
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={testimonial.name}
                  variants={itemVariants}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border-muted/50 hover:border-primary/50 transition-all hover:shadow-lg">
                    <CardHeader>
                      <div className="flex gap-1 mb-4">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                        ))}
                      </div>
                      <CardDescription className="text-base">
                        "{testimonial.content}"
                      </CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <div>
                        <p className="font-semibold">{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {testimonial.role} at {testimonial.company}
                        </p>
                      </div>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>
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
            className="max-w-4xl mx-auto"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-3xl" : "text-4xl sm:text-5xl"
              )}>
                Frequently Asked Questions
              </h2>
              <p className={cn(
                "text-muted-foreground",
                isMobile ? "mt-4 text-base" : "mt-6 text-lg sm:text-xl"
              )}>
                Got questions? We've got answers
              </p>
            </motion.div>
            
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  whileHover={{ scale: 1.01 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card 
                    className="cursor-pointer border-muted/50 hover:border-primary/50 transition-all"
                    onClick={() => setSelectedFaq(selectedFaq === index ? null : index)}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg pr-4">
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
        <footer className="py-12">
          <div className={cn(
            "mx-auto",
            isMobile ? "px-4 max-w-xl" : "px-6 max-w-7xl"
          )}>
            <div className={cn(
              "flex justify-between items-center",
              isMobile && "flex-col gap-6"
            )}>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} Coasty. All rights reserved.
              </p>
              <div className="flex gap-6">
                <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Privacy
                </Link>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Terms
                </Link>
                <Link href="/changelog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Changelog
                </Link>
                <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Blog
                </Link>
                <Link href="mailto:founders@coasty.ai" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Contact
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
      </div>
    </LayoutGroup>
  )
}
