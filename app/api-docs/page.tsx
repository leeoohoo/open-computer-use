"use client"

import { GuideLines } from "@/app/components/landing/guide-lines"
import { LandingHeader } from "@/app/components/landing/landing-header"
import { LandingFooter } from "@/app/components/landing/landing-footer"
import { APITab } from "@/app/guide/tabs/api"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  ArrowRight,
  MousePointerClick,
  Monitor,
  Terminal,
  Zap,
  Code2,
  Layers,
  Eye,
  Keyboard,
  type LucideIcon,
} from "lucide-react"

const ease = [0.22, 1, 0.36, 1] as const

/* ─── Animated demo visual ─── */

function DemoVisual() {
  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Browser window */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease }}
        className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/[0.08] dark:shadow-black/[0.3]"
      >
        {/* Title bar */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/30 bg-muted/20">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/50" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/50" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/50" />
          <div className="ml-3 flex-1 h-5 rounded-md bg-muted/40 max-w-[200px]" />
        </div>

        {/* Page content mockup */}
        <div className="p-6 space-y-4 relative min-h-[200px]">
          {/* Nav bar */}
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded bg-blue-500/15" />
            <div className="h-2.5 w-16 rounded-full bg-muted/50" />
            <div className="ml-auto flex gap-2">
              <div className="h-2.5 w-10 rounded-full bg-muted/30" />
              <div className="h-2.5 w-10 rounded-full bg-muted/30" />
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-3 pt-2">
            <div className="h-8 rounded-lg border border-border/30 bg-muted/20 px-3 flex items-center">
              <div className="h-2 w-24 rounded-full bg-muted/40" />
            </div>
            <div className="h-8 rounded-lg border border-border/30 bg-muted/20 px-3 flex items-center">
              <div className="h-2 w-32 rounded-full bg-muted/40" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 flex-1 rounded-lg bg-foreground/[0.06] flex items-center justify-center">
                <div className="h-2 w-12 rounded-full bg-muted/50" />
              </div>
              <div className="h-8 w-20 rounded-lg bg-foreground/10 flex items-center justify-center">
                <div className="h-2 w-10 rounded-full bg-foreground/20" />
              </div>
            </div>
          </div>

          {/* Animated cursor */}
          <motion.div
            className="absolute"
            initial={{ top: 80, left: 60, opacity: 0 }}
            animate={{
              top: [100, 80, 130, 160, 160],
              left: [60, 200, 120, 180, 180],
              opacity: [0, 1, 1, 1, 0],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
          >
            <MousePointerClick className="h-5 w-5 text-foreground/50 drop-shadow-md" />
          </motion.div>
        </div>
      </motion.div>

      {/* Floating action cards */}
      <motion.div
        initial={{ opacity: 0, x: 20, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8, ease }}
        className="absolute -right-4 top-16 rounded-xl border border-border/30 bg-card/90 backdrop-blur-md p-3 shadow-lg shadow-black/[0.05] max-w-[180px]"
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded bg-emerald-500/15 flex items-center justify-center">
              <MousePointerClick className="h-2.5 w-2.5 text-emerald-500" />
            </div>
            <span className="text-[9px] font-mono text-foreground/50">click(200, 130)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded bg-blue-500/15 flex items-center justify-center">
              <Keyboard className="h-2.5 w-2.5 text-blue-500" />
            </div>
            <span className="text-[9px] font-mono text-foreground/50">type(&quot;hello&quot;)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded bg-amber-500/15 flex items-center justify-center">
              <Keyboard className="h-2.5 w-2.5 text-amber-500" />
            </div>
            <span className="text-[9px] font-mono text-foreground/50">press(enter)</span>
          </div>
        </div>
      </motion.div>

      {/* Status pill */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 1.2, ease }}
        className="absolute -left-2 bottom-8 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] backdrop-blur-md px-3 py-1.5 flex items-center gap-2"
      >
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Task complete</span>
      </motion.div>
    </div>
  )
}

/* ─── Feature card ─── */

function FeatureCard({ icon: Icon, title, description, delay }: {
  icon: LucideIcon; title: string; description: string; delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay, ease }}
      className="relative rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-6 overflow-hidden group hover:border-border/50 transition-colors"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
      <Icon className="h-20 w-20 absolute -bottom-3 -right-3 text-foreground/[0.03] pointer-events-none" strokeWidth={1} />
      <div className="relative">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.04] mb-4">
          <Icon className="h-4.5 w-4.5 text-foreground/50" strokeWidth={1.8} />
        </div>
        <h3 className="text-sm font-semibold mb-1.5">{title}</h3>
        <p className="text-[13px] text-muted-foreground/50 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  )
}

/* ─── Pricing row ─── */

function PricingRow({ endpoint, cost, description }: { endpoint: string; cost: string; description: string }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <code className="text-[11px] font-mono text-foreground/60 flex-1 truncate">{endpoint}</code>
      <span className="text-[11px] text-muted-foreground/40 hidden sm:block w-44 truncate">{description}</span>
      <span className="text-[11px] font-mono font-semibold text-foreground/50 w-14 text-right shrink-0">{cost}</span>
    </div>
  )
}

/* ─── Main page ─── */

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <GuideLines />
      <LandingHeader />

      {/* ════════════════════════════════════════════════════
          HERO
          ════════════════════════════════════════════════════ */}
      <section className="pt-32 sm:pt-40 pb-20 px-7 sm:px-10 relative overflow-hidden">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — copy */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <div className="h-5 w-5 rounded-md bg-foreground/[0.06] flex items-center justify-center">
                    <Terminal className="h-3 w-3 text-foreground/50" />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.15em]">Computer Use API</span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-5">
                  Give your code<br />
                  <span className="text-muted-foreground/40">eyes and hands</span>
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground/55 leading-relaxed max-w-md mb-8">
                  Send a screenshot, get structured mouse and keyboard actions back. Build automation, testing, and AI agents that interact with any GUI.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/auth"
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all bg-foreground text-background hover:bg-foreground/90"
                  >
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="#docs"
                    className="inline-flex items-center gap-2 rounded-xl border border-border/40 px-6 py-3 text-sm font-medium text-muted-foreground/70 hover:text-foreground hover:border-border/60 transition-all"
                  >
                    <Code2 className="h-4 w-4" />
                    Read the Docs
                  </a>
                </div>
              </motion.div>
            </div>

            {/* Right — animated demo */}
            <div className="hidden lg:block">
              <DemoVisual />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          HOW IT WORKS
          ════════════════════════════════════════════════════ */}
      <section className="py-20 px-7 sm:px-10 border-t border-border/10">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">One API call. Full control.</h2>
            <p className="text-sm sm:text-base text-muted-foreground/50 max-w-lg mx-auto">
              Screenshot in, structured actions out. No browser drivers, no DOM parsing, no selectors to maintain.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto mb-16">
            {[
              { num: "1", label: "Send screenshot", sub: "Base64 PNG/JPEG + instruction" },
              { num: "2", label: "AI reasons", sub: "Vision model identifies UI elements" },
              { num: "3", label: "Get actions", sub: "click(512, 340), type('hello')" },
            ].map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1, ease }}
                className="text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/[0.05] mx-auto mb-3">
                  <span className="text-sm font-bold text-foreground/50">{s.num}</span>
                </div>
                <p className="text-sm font-semibold mb-1">{s.label}</p>
                <p className="text-[12px] text-muted-foreground/40">{s.sub}</p>
              </motion.div>
            ))}
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard icon={Eye} title="Vision-First" description="Understands any UI — web apps, desktop software, mobile screens. No selectors or DOM access needed." delay={0} />
            <FeatureCard icon={Layers} title="Multi-Step Sessions" description="Stateful sessions maintain trajectory history across steps. The AI remembers what it's already done." delay={0.06} />
            <FeatureCard icon={Zap} title="Two Engines" description="V3 for speed (3.5s/step, multi-action). V1 for accuracy (reflection, single-action). Choose per request." delay={0.12} />
            <FeatureCard icon={Monitor} title="Any Screen" description="Works with browser screenshots, desktop apps, mobile emulators, VNC streams — anything visual." delay={0.18} />
            <FeatureCard icon={Terminal} title="10 Action Types" description="click, type, scroll, drag, key combos, and more. Exact coordinates returned for every action." delay={0.24} />
            <FeatureCard icon={Code2} title="Any Language" description="Simple REST API. Works with Python, JavaScript, Go, Ruby, PHP, Java, C#, cURL — anything with HTTP." delay={0.3} />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          PRICING
          ════════════════════════════════════════════════════ */}
      <section className="py-20 px-7 sm:px-10 border-t border-border/10">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Simple, per-request pricing</h2>
            <p className="text-sm sm:text-base text-muted-foreground/50 max-w-md mx-auto">
              Pay only for what you use. Credits deducted from your shared balance. No separate API subscription.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, ease }}
            className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
            <div className="divide-y divide-border/10">
              <PricingRow endpoint="POST /predict" cost="5 cr" description="Screenshot to actions" />
              <PricingRow endpoint="POST /sessions" cost="10 cr" description="Create multi-step session" />
              <PricingRow endpoint="POST /sessions/{id}/predict" cost="4 cr" description="Predict within session" />
              <PricingRow endpoint="POST /ground" cost="3 cr" description="Find element coordinates" />
              <PricingRow endpoint="POST /ocr" cost="3 cr" description="Extract text from image" />
              <PricingRow endpoint="POST /parse" cost="Free" description="Parse action code" />
              <PricingRow endpoint="GET /models, /usage, /sessions" cost="Free" description="Management endpoints" />
            </div>
          </motion.div>

          {/* Surcharges */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2, ease }}
            className="mt-4 rounded-xl border border-border/20 bg-card/30 px-5 py-4"
          >
            <p className="text-[11px] font-semibold text-muted-foreground/40 uppercase tracking-wider mb-3">Surcharges</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[12px]">
              {[
                ["Trajectory screenshot", "+2 cr each"],
                ["HD image (>1280x720)", "+1 cr/image"],
                ["V1 engine", "+3 cr/request"],
                ["Custom system prompt", "+1 cr"],
              ].map(([label, cost]) => (
                <div key={label} className="contents">
                  <span className="text-muted-foreground/45">{label}</span>
                  <span className="text-right font-mono text-muted-foreground/35">{cost}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          FULL DOCS
          ════════════════════════════════════════════════════ */}
      <section id="docs" className="py-20 px-7 sm:px-10 border-t border-border/10 scroll-mt-16">
        <div className="mx-auto max-w-5xl">
          <APITab inApp={false} />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          CTA
          ════════════════════════════════════════════════════ */}
      <section className="py-24 px-7 sm:px-10 border-t border-border/10">
        <div className="mx-auto max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
              Start building in minutes
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground/50 mb-8 max-w-md mx-auto">
              Create a free account, generate an API key, and send your first screenshot. No credit card required.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all bg-foreground text-background hover:bg-foreground/90"
              >
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-border/40 px-6 py-3 text-sm font-medium text-muted-foreground/70 hover:text-foreground hover:border-border/60 transition-all"
              >
                View Plans
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
