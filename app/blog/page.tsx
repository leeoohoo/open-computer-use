"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { LandingHeader } from "@/app/components/landing/landing-header"
import { GuideLines } from "@/app/components/landing/guide-lines"
import { LandingFooter } from "@/app/components/landing/landing-footer"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { motion } from "framer-motion"
import { useState } from "react"

interface BlogPost {
  id: string
  title: string
  excerpt: string
  author: string
  date: string
  readTime: string
  category: string
  featured?: boolean
}

const blogPosts: BlogPost[] = [
  {
    id: "agent-swarm-launch",
    title: "Introducing Agent Swarms: The Most Powerful Parallel Computer-Use System Ever Built",
    excerpt: "Today we are launching Agent Swarms — the ability to split any task across multiple autonomous machines running simultaneously. While other tools let you chain API calls, Coasty spins up real VMs, each with its own browser, desktop, and terminal, and orchestrates them in parallel. This is not prompt chaining. This is full computer-use at scale.",
    author: "Marcus Sterling",
    date: "2026-03-13",
    readTime: "12 min",
    category: "Product",
    featured: true,
  },
  {
    id: "desktop-control-agi",
    title: "Why AI Agents Controlling Desktops Are Our Fastest Path to AGI",
    excerpt: "Forget chat interfaces and API calls. The real breakthrough in artificial general intelligence is happening through AI agents that can see, click, and control computers exactly like humans do.",
    author: "Marcus Sterling",
    date: "2026-03-05",
    readTime: "15 min",
    category: "Research",
  },
  {
    id: "coasty-reddit-marketing",
    title: "How Coasty Ran a Full Reddit Marketing Campaign Autonomously",
    excerpt: "We gave Coasty a single prompt: market our product on Reddit. It researched competitors, identified subreddits, crafted posts, and engaged with comments. Here is what happened.",
    author: "Sarah Chen",
    date: "2026-03-04",
    readTime: "8 min",
    category: "Case Study",
  },
  {
    id: "qa-testing-itself",
    title: "We Let Coasty QA Test Its Own Product. It Found 14 Bugs.",
    excerpt: "In a meta experiment, we pointed Coasty at its own checkout and onboarding flows. It navigated every path, filed detailed bug reports, and caught issues our team missed.",
    author: "Michael Rodriguez",
    date: "2026-03-03",
    readTime: "10 min",
    category: "Case Study",
  },
  {
    id: "osworld-benchmark",
    title: "82% on OSWorld: What State-of-the-Art Computer Use Actually Means",
    excerpt: "Coasty achieved the highest score on the OSWorld benchmark for autonomous computer use. We break down how the benchmark works and what this result means for real-world tasks.",
    author: "Emily Watson",
    date: "2026-03-01",
    readTime: "12 min",
    category: "Research",
  },
  {
    id: "prospecting-outreach",
    title: "From Zero to 200 Personalized Emails: Autonomous Sales Prospecting",
    excerpt: "Coasty found prospective customers, researched their companies, wrote personalized outreach emails, and sent them. Each email was unique, relevant, and human-sounding.",
    author: "David Park",
    date: "2026-02-28",
    readTime: "7 min",
    category: "Case Study",
  },
  {
    id: "yc-application",
    title: "Can an AI Fill Out the YC S26 Application? We Tried It.",
    excerpt: "The Y Combinator application is notoriously detailed. We gave Coasty our company info and asked it to fill the entire form. It navigated 30+ fields across multiple pages.",
    author: "Alex Thompson",
    date: "2026-02-26",
    readTime: "9 min",
    category: "Case Study",
  },
  {
    id: "job-application-agent",
    title: "Coasty Applied to 50 Jobs in One Afternoon",
    excerpt: "We tasked Coasty with finding matching software engineering roles, tailoring a resume for each, and submitting applications. It handled job boards, cover letters, and form variations.",
    author: "Rachel Kim",
    date: "2026-02-24",
    readTime: "8 min",
    category: "Case Study",
  },
  {
    id: "hacker-news-engagement",
    title: "Writing and Posting on Hacker News, Autonomously",
    excerpt: "Coasty drafted a blog post, submitted it to Hacker News, and engaged with comments in real time. We watched the entire session unfold without touching the keyboard.",
    author: "James Liu",
    date: "2026-02-22",
    readTime: "6 min",
    category: "Case Study",
  },
  {
    id: "multi-model-orchestration",
    title: "Why We Use Multiple AI Models Instead of One",
    excerpt: "Different models excel at different tasks. Our multi-model orchestration routes browser tasks, reasoning, and code generation to the best-suited model in real time.",
    author: "Emily Watson",
    date: "2026-02-20",
    readTime: "11 min",
    category: "Engineering",
  },
  {
    id: "electron-local-agent",
    title: "Introducing Coasty Desktop: AI That Controls Your Local Machine",
    excerpt: "Our new Electron app runs as a floating overlay and executes agent commands directly on your computer. No VMs, no latency. Your browser, your files, your desktop.",
    author: "Michael Rodriguez",
    date: "2026-02-18",
    readTime: "7 min",
    category: "Product",
  },
  {
    id: "browser-agent-architecture",
    title: "How Our Browser Agent Thinks Before It Clicks",
    excerpt: "A deep dive into the search-first strategy our browser agent uses. It researches via Google before opening any page, minimizes tab sprawl, and validates every action.",
    author: "Rachel Kim",
    date: "2026-02-15",
    readTime: "13 min",
    category: "Engineering",
  },
  {
    id: "email-automation-case",
    title: "Sending Emails You Would Actually Send: AI-Written Outreach That Works",
    excerpt: "Coasty composed, reviewed, and sent a real email on behalf of a user. It pulled context from previous conversations, matched the user's tone, and hit send.",
    author: "Sarah Chen",
    date: "2026-02-13",
    readTime: "6 min",
    category: "Case Study",
  },
  {
    id: "sandboxed-execution",
    title: "How We Run AI-Generated Code Safely in Docker Containers",
    excerpt: "Every agent session runs inside an isolated container with resource limits, network controls, and automatic teardown. Here is how we built it and why it matters.",
    author: "Alex Thompson",
    date: "2026-02-10",
    readTime: "10 min",
    category: "Engineering",
  },
  {
    id: "ai-employee-economics",
    title: "The Economics of an AI Employee vs. a Human Hire",
    excerpt: "An AI agent costs a fraction of a full-time hire and works around the clock. We break down the real numbers across marketing, QA, outreach, and support roles.",
    author: "David Park",
    date: "2026-02-08",
    readTime: "9 min",
    category: "Industry",
  },
  {
    id: "customer-support-agent",
    title: "Resolving Support Tickets Without Human Intervention",
    excerpt: "Coasty looked up customer accounts, diagnosed issues, wrote replies, and resolved tickets end-to-end. We share results from a week-long pilot with a real support queue.",
    author: "Lisa Chen",
    date: "2026-02-05",
    readTime: "8 min",
    category: "Case Study",
  },
  {
    id: "byok-philosophy",
    title: "Bring Your Own Keys: Why We Believe in User Control",
    excerpt: "Your API keys, your control. BYOK is not just about cost. It ensures complete transparency, no middleman in your AI interactions, and the freedom to switch providers.",
    author: "Lisa Chen",
    date: "2026-02-03",
    readTime: "6 min",
    category: "Product",
  },
  {
    id: "linkedin-recruiting",
    title: "Sourcing Candidates on LinkedIn and Scheduling Calls, Autonomously",
    excerpt: "We asked Coasty to find senior engineers on LinkedIn, send personalized connection requests, and schedule introductory calls. It handled the entire funnel.",
    author: "James Liu",
    date: "2026-02-01",
    readTime: "7 min",
    category: "Case Study",
  },
  {
    id: "prompt-caching-tokens",
    title: "Cutting Token Costs 60% with Prompt Caching",
    excerpt: "Agent sessions are token-heavy. We implemented prompt caching across multi-turn conversations to dramatically reduce costs without sacrificing context quality.",
    author: "Michael Rodriguez",
    date: "2026-01-28",
    readTime: "8 min",
    category: "Engineering",
  },
  {
    id: "future-ai-agents",
    title: "The Future of AI Agents: Predictions for the Next 12 Months",
    excerpt: "From month-long autonomous projects to cross-application workflows without APIs, here is what we expect to see in the AI agent space by early 2027.",
    author: "Marcus Sterling",
    date: "2026-01-25",
    readTime: "5 min",
    category: "Industry",
  },
  {
    id: "open-source-movement",
    title: "Open Source AI Models and Why They Matter for Agents",
    excerpt: "Open-source models bring transparency, customization, and privacy. We explore how they fit into the agent ecosystem alongside proprietary models.",
    author: "Alex Thompson",
    date: "2026-01-20",
    readTime: "9 min",
    category: "Industry",
  },
]

const categories = ["All", ...Array.from(new Set(blogPosts.map(p => p.category)))]

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.04, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
}

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState("All")

  const featured = blogPosts.find(p => p.featured)
  const filtered = activeCategory === "All"
    ? blogPosts.filter(p => !p.featured)
    : blogPosts.filter(p => p.category === activeCategory && !p.featured)

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  return (
    <div className="relative min-h-screen bg-background">
      <GuideLines />
      <LandingHeader />

      <main className="pt-32 sm:pt-36 pb-24">
        {/* Header */}
        <div className="max-w-5xl mx-auto px-5 sm:px-6 mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/50 mb-4"
          >
            Blog
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-5"
          >
            Insights & Updates
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-muted-foreground text-lg sm:text-xl max-w-xl leading-relaxed"
          >
            Deep dives into autonomous AI agents, real case studies, engineering decisions, and where the industry is heading.
          </motion.p>
        </div>

        {/* Category Filter */}
        <div className="max-w-5xl mx-auto px-5 sm:px-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-wrap gap-2"
          >
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-full text-sm font-medium px-4 py-1.5 transition-colors duration-200",
                  activeCategory === cat
                    ? "bg-foreground text-background"
                    : "text-muted-foreground/60 hover:text-foreground border border-border/40 hover:border-border/60"
                )}
              >
                {cat}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Featured Post */}
        {featured && activeCategory === "All" && (
          <div className="max-w-5xl mx-auto px-5 sm:px-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <Link href={`/blog/${featured.id}`}>
                <div className="group rounded-2xl overflow-hidden border border-border/40 bg-card hover:border-border/60 transition-all duration-300 p-8 sm:p-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/40">
                        {featured.category}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground/30 bg-foreground/5 px-2 py-0.5 rounded-full">
                        Featured
                      </span>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-foreground/50 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 group-hover:text-foreground/70 transition-colors duration-200">
                    {featured.title}
                  </h2>
                  <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-6 max-w-2xl">
                    {featured.excerpt}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground/50">
                    <span>{featured.author}</span>
                    <span className="text-muted-foreground/20">|</span>
                    <span>{formatDate(featured.date)}</span>
                    <span className="text-muted-foreground/20">|</span>
                    <span>{featured.readTime}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>
        )}

        {/* Post Grid */}
        <div className="max-w-5xl mx-auto px-5 sm:px-6 mb-28">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filtered.map((post, i) => (
              <motion.div
                key={post.id}
                custom={i}
                initial="hidden"
                animate="show"
                variants={fade}
              >
                <Link href={`/blog/${post.id}`}>
                  <div className="h-full rounded-xl overflow-hidden border border-border/30 bg-card hover:border-border/60 transition-colors duration-300 flex flex-col p-5 sm:p-6 group">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/40">
                        {post.category}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-foreground/50 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-foreground/70 transition-colors duration-200 mb-2 line-clamp-2 leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-sm text-muted-foreground/70 leading-relaxed mb-4 line-clamp-3 flex-1">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground/40 mt-auto pt-4 border-t border-border/20">
                      <span>{post.author}</span>
                      <span className="text-muted-foreground/15">|</span>
                      <span>{formatDate(post.date)}</span>
                      <span className="text-muted-foreground/15">|</span>
                      <span>{post.readTime}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-muted-foreground/50 text-sm">No posts in this category yet.</p>
              <button
                onClick={() => setActiveCategory("All")}
                className="mt-3 text-sm text-foreground/60 hover:text-foreground transition-colors underline underline-offset-4"
              >
                View all posts
              </button>
            </motion.div>
          )}
        </div>

        {/* Divider */}
        <div className="max-w-5xl mx-auto px-5 sm:px-6">
          <div className="border-t border-border/30" />
        </div>

        {/* CTA */}
        <div className="max-w-5xl mx-auto px-5 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-24 sm:mt-28 text-center"
          >
            <p className="text-muted-foreground/60 text-sm mb-6">
              Want to see Coasty in action?
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth">
                <motion.button
                  className="inline-flex items-center gap-2.5 rounded-full font-semibold text-background bg-foreground px-8 py-3.5 text-[15px] cursor-pointer"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Try Coasty Free
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </Link>
              <Link href="/results">
                <motion.button
                  className="inline-flex items-center gap-2 rounded-full font-medium text-muted-foreground hover:text-foreground border border-border/40 hover:border-border/60 px-6 py-3 text-[14px] cursor-pointer transition-colors duration-200"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  View Case Studies
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </motion.button>
              </Link>
            </div>
            <p className="text-[11px] text-muted-foreground/30 mt-4">
              No credit card required
            </p>
          </motion.div>
        </div>
      </main>

      <LandingFooter />
    </div>
  )
}
