"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SparklesCore } from "@/components/ui/sparkles"
import { ArrowLeft, Sparkles, Rocket, Bug, Wrench, Plus, Zap, Shield, Globe, Users, GitBranch, ChevronRight, Calendar, Tag, Star, TrendingUp, MessageSquare, Code, Cpu, Database, ExternalLink, Github } from "lucide-react"
import { CoastyIcon } from "@/components/icons/coasty"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { LandingHeader } from "@/app/components/landing/landing-header"
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from "framer-motion"

const changelogEntries = [
  {
    id: "v2-0-0",
    version: "2.0.0",
    date: "January 10, 2025",
    title: "AI Desktop Control & Complete Platform",
    icon: Cpu,
    badge: "Major Release",
    badgeVariant: "default" as const,
    highlights: [
      "AI-controlled virtual machines with full desktop access",
      "Complete computer control through browser-based interface",
      "Advanced file uploads and web browsing capabilities",
      "Real-time collaboration with screen sharing"
    ],
    sections: [
      {
        title: "Virtual Machine & Desktop Control",
        icon: Cpu,
        items: [
          "Create and control virtual Linux desktops through your browser",
          "AI agent with full computer control via pyautogui and selenium",
          "Browser-based VNC access for real-time desktop viewing",
          "Automatic task execution and workflow automation",
          "Resource management with Azure Container Instances"
        ]
      },
      {
        title: "AI Capabilities",
        icon: Sparkles,
        items: [
          "Support for 15+ AI models (OpenAI, Anthropic, Google, Meta, etc.)",
          "Multi-model chat with side-by-side comparison",
          "Code execution in Python, JavaScript, and shell",
          "Advanced web search and content extraction",
          "Local AI support via Ollama integration"
        ]
      },
      {
        title: "File & Media Handling",
        icon: Database,
        items: [
          "Drag-and-drop file uploads with preview",
          "Image, PDF, and document processing",
          "Jupyter notebook support with cell execution",
          "Web scraping and content analysis",
          "Persistent file storage with Supabase"
        ]
      },
      {
        title: "Collaboration Features",
        icon: Users,
        items: [
          "Real-time collaborative rooms with invite links",
          "Screen sharing and remote assistance",
          "Multi-user chat with role management",
          "Shared workspace with file synchronization",
          "Activity tracking and audit logs"
        ]
      },
      {
        title: "Developer Tools",
        icon: Code,
        items: [
          "Docker-based sandboxed code execution",
          "Git integration for version control",
          "API key management with BYOK support",
          "Webhook and automation support",
          "Extensive API for custom integrations"
        ]
      }
    ]
  },
  {
    id: "v1-0-0",
    version: "1.0.0",
    date: "October 15, 2024",
    title: "Collaborative AI Search Engine",
    icon: Globe,
    badge: "Initial Release",
    badgeVariant: "secondary" as const,
    highlights: [
      "Revolutionary collaborative search experience",
      "Multi-user research sessions",
      "AI-powered search with multiple providers",
      "Real-time collaboration tools"
    ],
    sections: [
      {
        title: "Search & Research",
        icon: Globe,
        items: [
          "Advanced web search with Google Custom Search API",
          "Multi-depth research modes (quick, standard, deep)",
          "Automatic source verification and citation",
          "Content summarization and extraction",
          "Search history and saved queries"
        ]
      },
      {
        title: "Collaboration",
        icon: Users,
        items: [
          "Create collaborative search rooms",
          "Real-time result sharing",
          "Team research sessions with role assignment",
          "Shared bookmarks and collections",
          "Comment and annotation system"
        ]
      },
      {
        title: "AI Integration",
        icon: Sparkles,
        items: [
          "Multiple AI model support (GPT-4, Claude, Gemini)",
          "Intelligent query refinement",
          "Contextual search suggestions",
          "Answer synthesis from multiple sources",
          "Natural language processing"
        ]
      },
      {
        title: "Core Platform",
        icon: Rocket,
        items: [
          "User authentication with Supabase",
          "Project and workspace organization",
          "Dark/light theme support",
          "Mobile-responsive design",
          "Export and sharing capabilities"
        ]
      }
    ]
  }
]

export default function ChangelogPage() {
  const [activeVersion, setActiveVersion] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const { theme } = useTheme()

  // Get today's date
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Scroll progress tracking
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start center", "end center"]
  })

  const scaleY = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  })

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (latest) => {
      setScrollProgress(latest)
    })
    return unsubscribe
  }, [scrollYProgress])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut" as const
      }
    }
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Sparkles Background */}
      <div className="absolute inset-0 w-full h-full">
        <SparklesCore
          id="changelog-sparkles"
          background="transparent"
          minSize={0.4}
          maxSize={1}
          particleDensity={6}
          className="w-full h-full"
          particleColor={theme === "dark" ? "#FFFFFF" : "#000000"}
        />
      </div>

      {/* Header */}
      <LandingHeader />

      {/* Main Content */}
      <main className={cn(
        "relative",
        isMobile ? "pt-16" : "pt-20"
      )}>
        {/* Hero Section */}
        <section className={cn(
          "flex items-center justify-center",
          isMobile ? "px-4 py-12" : "px-6 py-20"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-6xl"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <GitBranch className="mr-1 h-3 w-3" />
                Version History
              </Badge>
              <h1 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-4xl" : "text-5xl sm:text-6xl"
              )}>
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  What's New in Coasty
                </span>
              </h1>
              <p className={cn(
                "text-muted-foreground mx-auto",
                isMobile ? "mt-4 text-base max-w-md" : "mt-6 text-lg sm:text-xl max-w-2xl"
              )}>
                Track our journey of continuous improvement. From major releases to bug fixes, see how we're evolving your AI employee.
              </p>
              <div className="flex justify-center gap-4 mt-6">
                <Badge variant="secondary">
                  <Tag className="mr-1 h-3 w-3" />
                  Latest: v{changelogEntries[0].version}
                </Badge>
                <Badge variant="outline">
                  <Calendar className="mr-1 h-3 w-3" />
                  {today}
                </Badge>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* Changelog Timeline */}
        <section className={cn(
          "py-12 relative",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="max-w-6xl mx-auto"
          >
            <div className="relative" ref={timelineRef}>
              {/* Timeline Line - Desktop Only */}
              {!isMobile && (
                <div className="absolute left-12 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent">
                  {/* Glowing Progress Bar */}
                  <motion.div
                    className="absolute top-0 left-0 w-full origin-top"
                    style={{
                      scaleY,
                      height: '100%'
                    }}
                  >
                    <div
                      className="w-px h-full bg-gradient-to-b from-primary via-primary to-primary/50"
                      style={{
                        boxShadow: '0 0 10px rgba(var(--primary-rgb), 0.5)'
                      }}
                    />
                  </motion.div>

                  {/* Glowing Dot that follows scroll */}
                  <motion.div
                    className="absolute left-1/2 -translate-x-1/2 w-4 h-4"
                    style={{
                      top: useTransform(scrollYProgress, [0, 1], ['0%', '100%'])
                    }}
                  >
                    <div className="relative w-full h-full">
                      <div className="absolute inset-0 bg-primary rounded-full animate-ping" />
                      <div
                        className="relative w-full h-full bg-primary rounded-full"
                        style={{
                          boxShadow: '0 0 20px rgba(var(--primary-rgb), 0.8)'
                        }}
                      />
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Timeline Entries */}
              <div className="space-y-12">
                {changelogEntries.map((entry, index) => {
                  const Icon = entry.icon
                  const isActive = activeVersion === entry.id
                  const isLatest = index === 0
                  const entryProgress = (index + 1) / changelogEntries.length
                  const isInView = scrollProgress >= (index / changelogEntries.length) - 0.1

                  return (
                    <motion.div
                      key={entry.id}
                      variants={itemVariants}
                      className={cn(
                        "relative",
                        !isMobile && "pl-24"
                      )}
                    >

                      {/* Content Card */}
                      <motion.div
                        whileHover={{ x: isMobile ? 0 : 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card
                          className={cn(
                            "border-muted/50 transition-all cursor-pointer overflow-hidden",
                            "hover:shadow-xl hover:border-primary/50",
                            isActive && "border-primary shadow-2xl",
                            isLatest && "border-primary/50 bg-gradient-to-br from-primary/5 to-transparent",
                            isInView && "border-primary/30"
                          )}
                          onClick={() => setActiveVersion(isActive ? null : entry.id)}
                        >
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "p-3 rounded-xl transition-all duration-300",
                                  isActive
                                    ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25"
                                    : "bg-gradient-to-br from-primary/20 to-primary/10 text-primary"
                                )}>
                                  <Icon className="h-6 w-6" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <h3 className="text-2xl font-bold">
                                      v{entry.version}
                                    </h3>
                                    <Badge
                                      variant={entry.badgeVariant}
                                      className={cn(
                                        "px-2 py-0.5",
                                        entry.badge === "Major Release" && "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0"
                                      )}
                                    >
                                      {entry.badge}
                                    </Badge>
                                    {isLatest && (
                                      <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 animate-pulse">
                                        <Sparkles className="mr-1 h-3 w-3" />
                                        Current
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-sm">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                      <Calendar className="h-3.5 w-3.5" />
                                      {entry.date}
                                    </span>
                                    <span className="font-medium text-foreground">
                                      {entry.title}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <motion.div
                                animate={{ rotate: isActive ? 90 : 0 }}
                                transition={{ duration: 0.2 }}
                                className="shrink-0"
                              >
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              </motion.div>
                            </div>

                            {/* Highlights */}
                            <div className="mt-4 grid gap-2">
                              {entry.highlights.map((highlight, idx) => (
                                <motion.div
                                  key={idx}
                                  className="rounded-lg bg-muted/30 p-2.5 border border-border/50"
                                  initial={{ opacity: 0, x: -20 }}
                                  whileInView={{ opacity: 1, x: 0 }}
                                  viewport={{ once: true }}
                                  transition={{ delay: idx * 0.05 }}
                                >
                                  <span className="text-sm text-muted-foreground leading-relaxed">{highlight}</span>
                                </motion.div>
                              ))}
                            </div>
                          </CardHeader>

                      <AnimatePresence>
                        {isActive && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <CardContent className="pt-0">
                              {/* Sections */}
                              {entry.sections && (
                                <div className="grid gap-4 mt-4">
                                  {entry.sections.map((section, idx) => {
                                    const SectionIcon = section.icon
                                    return (
                                      <motion.div
                                        key={idx}
                                        className="rounded-xl border bg-gradient-to-br from-background to-muted/20 border-border/50 overflow-hidden"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                      >
                                        <div className="px-4 py-3 bg-muted/30 border-b border-border/50">
                                          <h4 className="font-semibold flex items-center gap-2">
                                            <div className="p-1 rounded-md bg-primary/10">
                                              <SectionIcon className="h-4 w-4 text-primary" />
                                            </div>
                                            {section.title}
                                          </h4>
                                        </div>
                                        <div className="p-4">
                                          <ul className="space-y-2">
                                            {section.items.map((item, itemIdx) => (
                                              <motion.li
                                                key={itemIdx}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: (idx * 0.1) + (itemIdx * 0.05) }}
                                              >
                                                <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                                              </motion.li>
                                            ))}
                                          </ul>
                                        </div>
                                      </motion.div>
                                    )
                                  })}
                                </div>
                              )}

                              {/* Actions */}
                              <div className="mt-6 flex flex-wrap gap-3">
                                <Button variant="outline" size="sm" asChild>
                                  <Link href="https://github.com/coasty-ai" target="_blank">
                                    <Github className="mr-2 h-4 w-4" />
                                    View Release
                                  </Link>
                                </Button>
                                <Button variant="ghost" size="sm" asChild>
                                  <Link href="https://github.com/coasty-ai" target="_blank">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    View Changes
                                  </Link>
                                </Button>
                              </div>
                            </CardContent>
                          </motion.div>
                        )}
                      </AnimatePresence>
                        </Card>
                      </motion.div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Subscribe Section */}
            <motion.div
              variants={itemVariants}
              className="mt-20"
            >
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 overflow-hidden relative">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

                <CardHeader className="text-center relative z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 mb-4 mx-auto">
                    <CoastyIcon className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Stay in the Loop
                  </CardTitle>
                  <CardDescription className="mt-2 text-base">
                    Get notified about new features, improvements, and updates as we continue to evolve Coasty.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center relative z-10">
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button size="lg" className="group" asChild>
                      <Link href="https://github.com/coasty-ai" target="_blank">
                        <Star className="mr-2 h-4 w-4 group-hover:fill-current transition-all" />
                        Star on GitHub
                      </Link>
                    </Button>
                    <Button variant="outline" size="lg" className="group" asChild>
                      <Link href="https://github.com/coasty-ai" target="_blank">
                        <Github className="mr-2 h-4 w-4" />
                        Watch Releases
                      </Link>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-6">
                    Join our community of developers and AI enthusiasts
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              variants={itemVariants}
              className="mt-12 text-center"
            >
              <div className="inline-flex flex-col sm:flex-row gap-4">
                <Button variant="outline" size="lg" asChild>
                  <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                  </Link>
                </Button>
                <Button size="lg" asChild>
                  <Link href="/auth">
                    Try Latest Version
                  </Link>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="py-12 mt-20 border-t border-border/50">
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
                <Link href="/changelog" className="text-sm text-primary hover:text-primary/80 transition-colors">
                  Changelog
                </Link>
                <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Privacy
                </Link>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Terms
                </Link>
                <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Blog
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}