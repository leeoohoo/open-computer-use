"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { Check, Monitor, GitFork, Play, RotateCcw, ChevronDown, Clock, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MessageCircle, Radio, Database, HelpCircle, Shield } from "lucide-react"

// ─── Types & Data ───────────────────────────────────────────────────────────

interface DemoMachine {
  id: number
  label: string
  status: "idle" | "booting" | "running" | "done"
  progress: number
  steps: string[]
  currentStep: number
}

const demoPrompt = "Research the top 5 CRM tools — compare pricing, features, integrations, and user reviews"

const demoMachines: DemoMachine[] = [
  { id: 1, label: "Salesforce", status: "idle", progress: 0, currentStep: -1, steps: ["Opening pricing page", "Extracting plan tiers", "Checking integrations", "Scraping G2 reviews", "Compiling findings"] },
  { id: 2, label: "HubSpot", status: "idle", progress: 0, currentStep: -1, steps: ["Navigating to HubSpot", "Comparing plan tiers", "Listing integrations", "Reading Capterra reviews", "Compiling findings"] },
  { id: 3, label: "Pipedrive", status: "idle", progress: 0, currentStep: -1, steps: ["Loading pricing page", "Cataloging features", "Reviewing Zapier integrations", "Pulling TrustRadius scores", "Compiling findings"] },
  { id: 4, label: "Zoho CRM", status: "idle", progress: 0, currentStep: -1, steps: ["Visiting Zoho site", "Extracting editions", "Mapping ecosystem", "Checking G2 sentiment", "Compiling findings"] },
  { id: 5, label: "Close", status: "idle", progress: 0, currentStep: -1, steps: ["Opening Close page", "Documenting features", "Checking API docs", "Reading testimonials", "Compiling findings"] },
]

const screenConfigs = [
  { url: "salesforce.com/pricing", color: "#00A1E0", typingText: "enterprise CRM pricing", brand: "Salesforce", tab: "Pricing", tiers: [{ name: "Essentials", price: "$25" }, { name: "Professional", price: "$80" }, { name: "Enterprise", price: "$165" }], features: ["Contact Mgmt", "Opportunity Tracking", "Reports & Dashboards", "API Access"] },
  { url: "hubspot.com/products", color: "#FF7A59", typingText: "hubspot free vs paid", brand: "HubSpot", tab: "Products", tiers: [{ name: "Free", price: "$0" }, { name: "Starter", price: "$20" }, { name: "Pro", price: "$890" }], features: ["Email Marketing", "Forms & Landing", "Ad Management", "Live Chat"] },
  { url: "pipedrive.com/features", color: "#2BC47D", typingText: "pipeline management", brand: "Pipedrive", tab: "Features", tiers: [{ name: "Essential", price: "$14" }, { name: "Advanced", price: "$34" }, { name: "Pro", price: "$49" }], features: ["Deal Pipeline", "Email Sync", "Automations", "Revenue Insights"] },
  { url: "zoho.com/crm/editions", color: "#E42527", typingText: "zoho crm comparison", brand: "Zoho CRM", tab: "Editions", tiers: [{ name: "Standard", price: "$14" }, { name: "Professional", price: "$23" }, { name: "Enterprise", price: "$40" }], features: ["Lead Scoring", "Workflow Rules", "Advanced Analytics", "Zia AI Assistant"] },
  { url: "close.com/pricing", color: "#6E5CFF", typingText: "close crm api docs", brand: "Close", tab: "Pricing", tiers: [{ name: "Startup", price: "$29" }, { name: "Professional", price: "$99" }, { name: "Business", price: "$149" }], features: ["Built-in Calling", "Email Sequences", "Pipeline View", "Custom Reports"] },
]

const cursorPaths = [
  { x: [50, 35, 35, 65, 65, 45, 50], y: [25, 38, 38, 55, 72, 82, 25] },
  { x: [45, 60, 60, 30, 30, 75, 45], y: [28, 40, 40, 58, 76, 58, 28] },
  { x: [55, 30, 30, 70, 70, 40, 55], y: [22, 44, 44, 58, 72, 85, 22] },
  { x: [40, 70, 70, 35, 35, 60, 40], y: [26, 42, 42, 62, 78, 48, 26] },
  { x: [60, 40, 40, 55, 55, 30, 60], y: [20, 45, 45, 60, 74, 68, 20] },
]

const KB_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O"],
  ["A","S","D","F","G","H","J","K"],
  ["Z","X","C","V","B","N","M"],
]

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useSwarmDemo() {
  const [machines, setMachines] = useState<DemoMachine[]>(demoMachines.map(m => ({ ...m })))
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle")
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef(0)

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setMachines(demoMachines.map(m => ({ ...m })))
    setPhase("idle")
    setElapsed(0)
    tickRef.current = 0
  }, [])

  const start = useCallback(() => {
    reset()
    setPhase("running")
    const speeds = demoMachines.map(() => 0.7 + Math.random() * 0.6)

    intervalRef.current = setInterval(() => {
      tickRef.current += 1
      setElapsed(tickRef.current)

      setMachines(prev => {
        const next = prev.map((m, i) => {
          if (m.status === "done") return m
          const speed = speeds[i]
          const tick = tickRef.current

          if (tick <= 3) return { ...m, status: "booting" as const }

          const runTick = tick - 3
          const stepDuration = 4
          const adjustedStep = Math.floor((runTick * speed) / stepDuration)
          const clampedStep = Math.min(adjustedStep, m.steps.length - 1)
          const progress = Math.min(((runTick * speed) / (m.steps.length * stepDuration)) * 100, 100)

          if (progress >= 100) {
            return { ...m, status: "done" as const, progress: 100, currentStep: m.steps.length - 1 }
          }
          return { ...m, status: "running" as const, progress, currentStep: clampedStep }
        })

        if (next.every(m => m.status === "done")) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setPhase("done")
        }
        return next
      })
    }, 400)
  }, [reset])

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return { machines, phase, elapsed, start, reset }
}

// ─── Machine Card ───────────────────────────────────────────────────────────

export function DemoMachineCard({ machine, index }: { machine: DemoMachine; index: number }) {
  const config = screenConfigs[index]
  const waypoints = cursorPaths[index]
  const isActive = machine.status === "running"
  const isBooting = machine.status === "booting"
  const isDone = machine.status === "done"

  const statusColor = isDone ? "text-emerald-500" : isActive ? "text-amber-500" : isBooting ? "text-blue-400" : "text-muted-foreground/25"

  const [typedText, setTypedText] = useState("")
  const [activeKey, setActiveKey] = useState("")
  const keyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activityRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (machine.status !== "running") {
      setTypedText(isDone ? config.typingText : "")
      setActiveKey("")
      if (activityRef.current) { clearInterval(activityRef.current); activityRef.current = null }
      return
    }
    const text = config.typingText
    let i = 0
    const interval = setInterval(() => {
      if (i < text.length) {
        setTypedText(text.substring(0, i + 1))
        const c = text[i].toUpperCase()
        if (/[A-Z]/.test(c)) {
          setActiveKey(c)
          if (keyTimeoutRef.current) clearTimeout(keyTimeoutRef.current)
          keyTimeoutRef.current = setTimeout(() => setActiveKey(""), 80)
        }
        i++
      } else {
        clearInterval(interval)
        const chars = text.toUpperCase().replace(/[^A-Z]/g, "").split("")
        let j = 0
        activityRef.current = setInterval(() => {
          setActiveKey(chars[j % chars.length])
          if (keyTimeoutRef.current) clearTimeout(keyTimeoutRef.current)
          keyTimeoutRef.current = setTimeout(() => setActiveKey(""), 80)
          j++
        }, 300 + index * 40)
      }
    }, 100 + index * 12)
    return () => {
      clearInterval(interval)
      if (activityRef.current) { clearInterval(activityRef.current); activityRef.current = null }
      if (keyTimeoutRef.current) clearTimeout(keyTimeoutRef.current)
    }
  }, [machine.status, config.typingText, index, isDone])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative rounded-xl border p-3 backdrop-blur-sm transition-all duration-500 overflow-hidden",
        isDone ? "border-emerald-500/20 bg-emerald-500/[0.03]"
        : isActive ? "border-amber-500/15 bg-amber-500/[0.02]"
        : isBooting ? "border-blue-400/15 bg-blue-500/[0.02]"
        : "border-border/30 bg-card/20"
      )}
    >
      {/* Machine header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "size-5 rounded-md flex items-center justify-center border transition-colors duration-300",
            isDone ? "bg-emerald-500/10 border-emerald-500/20" :
            isActive ? "bg-amber-500/10 border-amber-500/20" :
            "bg-muted/20 border-border/40"
          )}>
            <Monitor className={cn("size-2.5", statusColor)} />
          </div>
          <span className="text-xs font-medium">{machine.label}</span>
        </div>
        <span className={cn("text-[9px] font-mono tabular-nums tracking-wide", statusColor)}>
          {isDone ? "DONE" : isActive ? `${Math.round(machine.progress)}%` : isBooting ? "INIT" : "IDLE"}
        </span>
      </div>

      {/* Mini Desktop Screen */}
      <div className={cn(
        "relative rounded-lg overflow-hidden mb-2 transition-all duration-500 border",
        "aspect-[16/11]",
        isActive ? "bg-[#0d0d1a] border-amber-500/10" :
        isDone ? "bg-[#0d0d1a] border-emerald-500/15" :
        isBooting ? "bg-[#0d0d1a]/80 border-blue-400/10" :
        "bg-[#0d0d1a]/40 border-white/[0.04]"
      )}>
        {/* Browser chrome */}
        <div className="bg-[#1e1e3a]/90 border-b border-white/[0.03]">
          <div className="flex items-center px-1 pt-[3px] gap-[2px]">
            <div className="flex gap-[3px] px-1 py-[2px]">
              <div className="size-[4px] rounded-full bg-[#ff5f57]/50" />
              <div className="size-[4px] rounded-full bg-[#febc2e]/50" />
              <div className="size-[4px] rounded-full bg-[#28c840]/50" />
            </div>
            <div className="flex items-center gap-[3px] bg-[#0d0d1a] rounded-t-[3px] px-1.5 py-[2px] border-t border-x border-white/[0.06] -mb-px relative z-[1]">
              <div className="size-[4px] rounded-[1px]" style={{ backgroundColor: config.color + "80" }} />
              <span className="text-[4px] text-white/50 font-medium truncate max-w-[40px]">{config.brand}</span>
              <span className="text-[4px] text-white/15 ml-[1px]">&times;</span>
            </div>
            <div className="flex items-center gap-[2px] px-1 py-[2px] opacity-40">
              <div className="size-[3px] rounded-full bg-white/20" />
              <span className="text-[3.5px] text-white/25 truncate">{config.tab}</span>
            </div>
            <div className="text-[5px] text-white/10 ml-[2px]">+</div>
          </div>
          <div className="flex items-center gap-[3px] px-1.5 py-[2.5px] bg-[#0d0d1a]">
            <div className="flex gap-[2px]">
              <span className="text-[5px] text-white/12">&larr;</span>
              <span className="text-[5px] text-white/12">&rarr;</span>
              <span className="text-[5px] text-white/12">&#8635;</span>
            </div>
            <div className="flex-1 bg-white/[0.05] rounded-[3px] px-1.5 py-[2px] flex items-center gap-[3px] border border-white/[0.03]">
              <svg className="size-[4px] text-white/20 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="text-[4.5px] text-white/30 font-mono truncate">{config.url}</span>
            </div>
          </div>
        </div>

        {/* Screen content */}
        <motion.div
          className="relative p-[5px] flex flex-col gap-[4px] overflow-hidden"
          animate={isActive ? { y: [0, -5, -2, -8, -3, 0] } : { y: 0 }}
          transition={isActive ? { duration: 12, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
        >
          <div className="flex items-center gap-[4px] pb-[3px] border-b border-white/[0.04]">
            <div className="size-[6px] rounded-[1.5px] flex-shrink-0" style={{ backgroundColor: config.color + "50" }} />
            <span className="text-[4px] font-semibold text-white/35 tracking-wide truncate">{config.brand}</span>
            <div className="ml-auto flex gap-[5px]">
              {["Pricing", "Features", "Reviews"].map((nav) => (
                <span key={nav} className="text-[3.5px] text-white/15">{nav}</span>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={(isActive || isDone) ? { opacity: 1 } : { opacity: isBooting ? 0.15 : 0.08 }}
            transition={{ delay: isActive ? 0.2 : 0, duration: 0.4 }}
            className="rounded-[3px] px-[5px] py-[4px]"
            style={{ backgroundColor: config.color + "0c", borderLeft: `1.5px solid ${config.color}30` }}
          >
            <div className="h-[3px] w-[60%] rounded-full bg-white/15 mb-[2px]" />
            <div className="h-[2px] w-[80%] rounded-full bg-white/[0.06]" />
          </motion.div>

          <div className="flex items-center rounded-[3px] bg-white/[0.06] px-[4px] py-[3px] gap-[3px] border border-white/[0.04]">
            <svg className="size-[5px] text-white/20 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <span className="text-[4px] text-white/40 font-mono truncate leading-none flex-1">
              {typedText || (isBooting ? "" : "Search...")}
              {isActive && <span className="animate-pulse text-white/60">|</span>}
            </span>
          </div>

          <motion.div
            className="grid grid-cols-3 gap-[3px]"
            initial={{ opacity: 0, y: 4 }}
            animate={(isActive || isDone) ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: isActive ? 0.8 : 0, duration: 0.5 }}
          >
            {config.tiers.map((tier, k) => (
              <div key={k} className="rounded-[2.5px] p-[3px] border overflow-hidden" style={{ borderColor: k === 1 ? config.color + "35" : "rgba(255,255,255,0.04)", backgroundColor: k === 1 ? config.color + "0a" : "rgba(255,255,255,0.02)" }}>
                {k === 1 && (
                  <div className="rounded-[1px] px-[2px] py-[0.5px] mb-[2px] -mx-[1px] -mt-[1px] text-center" style={{ backgroundColor: config.color + "25" }}>
                    <span className="text-[2.5px] font-bold text-white/50 uppercase tracking-wider">Popular</span>
                  </div>
                )}
                <div className="text-[3px] text-white/25 mb-[1px] truncate">{tier.name}</div>
                <div className="text-[5px] font-bold text-white/50 mb-[2px]" style={k === 1 ? { color: config.color + "bb" } : {}}>
                  {tier.price}<span className="text-[2.5px] text-white/15 font-normal">/mo</span>
                </div>
                <div className="h-px w-full bg-white/[0.04] mb-[2px]" />
                {[0, 1].map(f => (
                  <div key={f} className="flex items-center gap-[2px] mb-[1px]">
                    <div className="size-[3px] rounded-full flex-shrink-0" style={{ backgroundColor: config.color + "40" }} />
                    <div className="h-[1.5px] rounded-full bg-white/[0.06]" style={{ width: `${55 + f * 20}%` }} />
                  </div>
                ))}
              </div>
            ))}
          </motion.div>

          <motion.div
            className="rounded-[2.5px] border border-white/[0.03] overflow-hidden"
            initial={{ opacity: 0 }}
            animate={(isActive || isDone) ? { opacity: 1 } : {}}
            transition={{ delay: isActive ? 1.5 : 0, duration: 0.4 }}
          >
            <div className="flex items-center px-[3px] py-[2px] bg-white/[0.03] border-b border-white/[0.03]">
              <span className="text-[3px] text-white/20 flex-1">Feature</span>
              {config.tiers.map((t, k) => (
                <span key={k} className="text-[2.5px] text-white/15 w-[18%] text-center truncate">{t.name.substring(0, 3)}</span>
              ))}
            </div>
            {config.features.map((feat, f) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, x: -3 }}
                animate={(isActive || isDone) ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: isActive ? 1.8 + f * 0.25 : 0, duration: 0.25 }}
                className={cn("flex items-center px-[3px] py-[1.5px]", f % 2 === 0 && "bg-white/[0.015]")}
              >
                <span className="text-[3px] text-white/20 flex-1 truncate">{feat}</span>
                {config.tiers.map((_, k) => (
                  <div key={k} className="w-[18%] flex justify-center">
                    {(f <= k + 1) ? (
                      <div className="size-[3px] rounded-full" style={{ backgroundColor: config.color + "50" }} />
                    ) : (
                      <div className="size-[3px] rounded-full bg-white/[0.06]" />
                    )}
                  </div>
                ))}
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="flex items-center gap-[3px] px-[3px] py-[2px] rounded-[2px] bg-white/[0.025]"
            initial={{ opacity: 0 }}
            animate={(isActive || isDone) ? { opacity: 1 } : {}}
            transition={{ delay: isActive ? 2.8 : 0, duration: 0.3 }}
          >
            <div className="flex gap-[1px]">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className="size-[3px] rounded-[0.5px]" style={{ backgroundColor: config.color + "50" }} />
              ))}
              <div className="size-[3px] rounded-[0.5px] bg-white/[0.08]" />
            </div>
            <span className="text-[3px] text-white/20">4.2 avg</span>
            <div className="h-[2px] flex-1 rounded-full bg-white/[0.04] overflow-hidden ml-[2px]">
              <div className="h-full rounded-full" style={{ width: "84%", backgroundColor: config.color + "35" }} />
            </div>
          </motion.div>
        </motion.div>

        {/* Cursor */}
        {(isActive || isBooting) && (
          <motion.div
            className="absolute pointer-events-none z-10"
            animate={isActive ? { left: waypoints.x.map(v => `${v}%`), top: waypoints.y.map(v => `${v}%`) } : { left: "50%", top: "50%" }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", times: waypoints.x.map((_: number, i: number) => i / (waypoints.x.length - 1)) }}
          >
            <svg width="10" height="13" viewBox="0 0 14 18" className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
              <path d="M2 1L2 14.5L5.8 10.7L9.5 17L11.5 16L7.8 9.2L12.5 9.2L2 1Z" fill="white" fillOpacity="0.95" stroke="black" strokeWidth="0.8" strokeOpacity="0.2" />
            </svg>
            {isActive && (
              <motion.div
                className="absolute -left-2 -top-2 size-5 rounded-full"
                style={{ borderColor: config.color + "50", borderWidth: 1.5 }}
                animate={{ scale: [0.3, 1.5], opacity: [0.7, 0] }}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.8 }}
              />
            )}
          </motion.div>
        )}

        {/* Scrollbar */}
        {isActive && (
          <div className="absolute right-[1px] top-[15%] bottom-[10%] w-[3px] rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="w-full rounded-full bg-white/20"
              style={{ position: "absolute" }}
              animate={{ height: ["25%", "18%", "30%", "25%"], top: ["5%", "35%", "25%", "55%"] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        )}

        {/* Done overlay */}
        {isDone && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-emerald-500/[0.06] backdrop-blur-[1px] flex items-center justify-center">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.4 }}
              className="size-7 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.15)]"
            >
              <Check className="size-3.5 text-emerald-400" />
            </motion.div>
          </motion.div>
        )}

        {isActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -bottom-4 inset-x-0 h-8 blur-xl" style={{ backgroundColor: config.color + "08" }} />
          </div>
        )}
      </div>

      {/* Keyboard + Mouse */}
      <div className={cn("flex gap-1.5 mb-2 transition-opacity duration-300", isActive ? "opacity-100" : isDone ? "opacity-35" : "opacity-15")}>
        <div className="flex-1 rounded-md bg-muted/20 dark:bg-white/[0.025] border border-border/15 dark:border-white/[0.04] p-[3px] pb-[4px]">
          {KB_ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-[1.5px] justify-center mb-[1.5px]" style={{ paddingLeft: ri * 1.5 }}>
              {row.map(key => {
                const isPressed = activeKey === key
                return (
                  <div key={key} className={cn("rounded-[1.5px] text-[3.5px] font-mono flex items-center justify-center leading-none transition-all duration-[60ms]", "size-[8px] sm:size-[9px]", isPressed ? "text-white scale-[1.15] shadow-[0_0_6px_rgba(245,158,11,0.4)]" : "bg-muted/30 dark:bg-white/[0.05] text-muted-foreground/25 dark:text-white/15")} style={isPressed ? { backgroundColor: config.color + "60" } : undefined}>
                    {key}
                  </div>
                )
              })}
            </div>
          ))}
          <div className="flex gap-[1.5px] justify-center items-center mt-[1.5px]">
            <div className={cn("h-[7px] sm:h-[8px] rounded-[1.5px] transition-all duration-[60ms]", "w-[38px] sm:w-[44px]", activeKey === " " ? "shadow-[0_0_6px_rgba(245,158,11,0.4)]" : "bg-muted/30 dark:bg-white/[0.05]")} style={activeKey === " " ? { backgroundColor: config.color + "60" } : undefined} />
            <div className="size-[8px] sm:size-[9px] rounded-[1.5px] bg-muted/30 dark:bg-white/[0.05] text-[3px] font-mono flex items-center justify-center text-muted-foreground/20 dark:text-white/10">↵</div>
          </div>
        </div>

        <div className="w-[22px] sm:w-[26px] rounded-md bg-muted/20 dark:bg-white/[0.025] border border-border/15 dark:border-white/[0.04] p-[3px] flex flex-col items-center justify-center gap-[3px]">
          <div className="relative w-[12px] sm:w-[14px] h-[18px] sm:h-[20px] rounded-[7px] border border-muted-foreground/10 dark:border-white/[0.08] overflow-hidden bg-muted/15 dark:bg-white/[0.03]">
            <div className="absolute top-0 left-0 right-0 h-[45%] flex">
              <div className="flex-1 border-r border-muted-foreground/[0.06] dark:border-white/[0.04]" />
              <div className="flex-1" />
            </div>
            <motion.div
              className="absolute top-[3px] left-1/2 -translate-x-1/2 w-[2px] h-[5px] rounded-full bg-muted-foreground/15 dark:bg-white/[0.12]"
              animate={isActive ? { y: [0, 1, -1, 0] } : { y: 0 }}
              transition={isActive ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
            />
            <div className="absolute top-[45%] left-0 right-0 h-px bg-muted-foreground/[0.06] dark:bg-white/[0.04]" />
            {isActive && (
              <motion.div
                className="absolute top-0 left-0 w-1/2 h-[45%] rounded-tl-[7px]"
                style={{ backgroundColor: config.color + "30" }}
                animate={{ opacity: [0, 0.8, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.4 }}
              />
            )}
          </div>
          {isActive && (
            <motion.div animate={{ y: [0, 1.5, -1.5, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <ChevronDown className="size-[7px] text-muted-foreground/20 dark:text-white/15" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] rounded-full bg-foreground/[0.04] overflow-hidden mb-2">
        <motion.div
          className={cn("h-full rounded-full", isDone ? "bg-emerald-500" : "bg-amber-500")}
          initial={{ width: 0 }}
          animate={{ width: `${machine.progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-[3px]">
        {machine.steps.map((step, i) => {
          const stepDone = machine.currentStep > i || isDone
          const stepActive = machine.currentStep === i && isActive
          return (
            <div key={i} className={cn("flex items-center gap-1.5 text-[10px] transition-all duration-200", stepDone ? "text-foreground/50" : stepActive ? "text-foreground font-medium" : "text-muted-foreground/15")}>
              {stepDone ? (
                <Check className="size-2.5 text-emerald-500 flex-shrink-0" />
              ) : stepActive ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="flex-shrink-0">
                  <RotateCcw className="size-2.5 text-amber-500" />
                </motion.div>
              ) : (
                <div className="size-2.5 rounded-full border border-foreground/[0.06] flex-shrink-0" />
              )}
              <span className="truncate">{step}</span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Full Demo Section ──────────────────────────────────────────────────────

export function SwarmDemoSection({ isMobile, compact }: { isMobile: boolean; compact?: boolean }) {
  const { machines, phase, elapsed, start, reset } = useSwarmDemo()

  return (
    <div>
      {/* Prompt bar */}
      <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-4 mb-5">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 size-9 rounded-lg bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
            <GitFork className="size-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono text-amber-500/60 tracking-wide">SWARM</span>
              <span className="text-[10px] text-muted-foreground/30">5 machines</span>
            </div>
            <p className="text-sm font-medium leading-relaxed truncate">{demoPrompt}</p>
          </div>
          <div className="flex-shrink-0">
            {phase === "idle" && (
              <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0 rounded-lg shadow-sm" onClick={start}>
                <Play className="size-3" />
                Run
              </Button>
            )}
            {phase === "running" && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/10">
                <span className="text-xs font-mono text-amber-500 tabular-nums">{(elapsed * 0.4).toFixed(1)}s</span>
                <span className="relative size-2">
                  <span className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-30" />
                  <span className="absolute inset-0 rounded-full bg-amber-500" />
                </span>
              </div>
            )}
            {phase === "done" && (
              <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={reset}>
                <RotateCcw className="size-3" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Machine grid */}
      <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : compact ? "grid-cols-2 lg:grid-cols-5" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5")}>
        {machines.map((m, i) => (
          <DemoMachineCard key={m.id} machine={m} index={i} />
        ))}
      </div>

      {/* Completion */}
      <AnimatePresence>
        {phase === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-5 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Check className="size-4 text-emerald-500" />
              <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">All 5 machines completed</span>
            </div>
            <p className="text-sm text-muted-foreground">
              ~10 min instead of ~50 min — <span className="font-semibold text-foreground">5x faster</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ==========================================================================
// Mock Swarm Tree — graph visualization with fork connectors
// ==========================================================================

interface MockStep {
  text: string
  tool: string
  status: "success" | "pending" | "running"
  screenshot?: boolean
  /** Swarm communication type for special rendering */
  swarmTool?: "message" | "broadcast" | "memory" | "help" | "expertise"
  /** Target machine index for direct messages */
  targetMachine?: number
}

interface MockMachine {
  label: string
  status: "success" | "running" | "pending"
  steps: MockStep[]
}

const MOCK_PROMPT = "Research top 5 CRM platforms — compare pricing, features, and user reviews"

const MOCK_MACHINES: MockMachine[] = [
  {
    label: "Salesforce",
    status: "success",
    steps: [
      { text: "Navigating to Salesforce pricing page", tool: "browser_navigate", status: "success" },
      { text: "Extracting Enterprise, Professional, and Starter plan tiers with pricing", tool: "browser_extract", status: "success" },
      { text: "Shared pricing format template with team", tool: "write_shared_memory", status: "success", swarmTool: "memory" },
      { text: "Checking integration marketplace — found 4,000+ apps", tool: "browser_navigate", status: "success" },
      { text: "Scraping G2 reviews — 4.3/5 from 19,842 reviews", tool: "browser_extract", status: "success", screenshot: true },
      { text: "Sent comparison data to HubSpot agent", tool: "send_swarm_message", status: "success", swarmTool: "message", targetMachine: 1 },
      { text: "Compiling Salesforce findings into structured report", tool: "terminal_exec", status: "success" },
    ],
  },
  {
    label: "HubSpot",
    status: "success",
    steps: [
      { text: "Opening HubSpot CRM pricing page", tool: "browser_navigate", status: "success" },
      { text: "Read pricing format from shared memory", tool: "read_shared_memory", status: "success", swarmTool: "memory" },
      { text: "Comparing Free, Starter, Professional, Enterprise plans", tool: "browser_extract", status: "success" },
      { text: "Reviewing 1,500+ integration listings", tool: "browser_navigate", status: "success", screenshot: true },
      { text: "Reading Capterra reviews — 4.5/5 from 4,091 reviews", tool: "browser_extract", status: "success" },
      { text: "Broadcast: Found free tier comparison data", tool: "broadcast_swarm_message", status: "success", swarmTool: "broadcast" },
      { text: "Compiling HubSpot findings into structured report", tool: "terminal_exec", status: "success" },
    ],
  },
  {
    label: "Pipedrive",
    status: "running",
    steps: [
      { text: "Loading Pipedrive pricing and features page", tool: "browser_navigate", status: "success" },
      { text: "Cataloging Essential through Enterprise features", tool: "browser_extract", status: "success" },
      { text: "Claimed expertise: mid-market CRM analysis", tool: "claim_expertise", status: "success", swarmTool: "expertise" },
      { text: "Reviewing Zapier integrations — 400+ connections", tool: "browser_navigate", status: "success" },
      { text: "Pulling TrustRadius scores and sentiment analysis", tool: "browser_extract", status: "running" },
      { text: "Compile Pipedrive findings", tool: "terminal_exec", status: "pending" },
    ],
  },
  {
    label: "Zoho CRM",
    status: "running",
    steps: [
      { text: "Visiting Zoho CRM editions page", tool: "browser_navigate", status: "success" },
      { text: "Extracting Standard, Professional, Enterprise, Ultimate pricing", tool: "browser_extract", status: "success" },
      { text: "Sent question to Salesforce agent about API limits", tool: "send_swarm_message", status: "success", swarmTool: "message", targetMachine: 0 },
      { text: "Mapping Zoho ecosystem — 45+ native integrations", tool: "browser_navigate", status: "running" },
      { text: "Check G2 sentiment analysis", tool: "browser_extract", status: "pending" },
      { text: "Compile Zoho CRM findings", tool: "terminal_exec", status: "pending" },
    ],
  },
  {
    label: "Close",
    status: "pending",
    steps: [
      { text: "Opening Close.com pricing page", tool: "browser_navigate", status: "success" },
      { text: "Documenting Startup, Professional, Enterprise features", tool: "browser_extract", status: "running" },
      { text: "Requested help: Can't find Close API rate limits", tool: "request_help", status: "pending", swarmTool: "help" },
      { text: "Check API docs and integration capabilities", tool: "browser_navigate", status: "pending" },
      { text: "Read customer testimonials and review scores", tool: "browser_extract", status: "pending" },
      { text: "Compile Close findings", tool: "terminal_exec", status: "pending" },
    ],
  },
]

// Mock interaction connections data
const MOCK_INTERACTIONS = [
  { from: 0, to: 1, type: "message" as const, label: "pricing data" },
  { from: 1, to: null, type: "broadcast" as const, label: "free tier comparison" },
  { from: 0, to: null, type: "memory" as const, label: "pricing_template" },
  { from: 1, to: null, type: "memory" as const, label: "pricing_template" },
  { from: 3, to: 0, type: "message" as const, label: "API limits question" },
  { from: 4, to: null, type: "help" as const, label: "API rate limits" },
]

function MockMachineBranch({ machine, index, animated }: { machine: MockMachine; index: number; animated: boolean }) {
  const statusIcon = machine.status === "success"
    ? <Check className="size-3 text-emerald-500" />
    : machine.status === "running"
      ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}><RotateCcw className="size-3 text-amber-500" /></motion.div>
      : <Clock className="size-3 text-muted-foreground/40" />

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "w-full rounded-xl border px-3 py-2.5 text-center transition-colors shadow-sm backdrop-blur-sm",
          machine.status === "success"
            ? "border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-950/25"
            : machine.status === "running"
              ? "border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/15"
              : "border-border/40 bg-background/70 dark:bg-background/50"
        )}
      >
        <div className="flex items-center justify-center gap-1.5">
          <Monitor className="size-3.5 text-muted-foreground/60" />
          <span className="text-xs font-medium">{machine.label}</span>
          {statusIcon}
        </div>
      </div>

      <div className="relative w-full mt-0 pt-2">
        <div
          className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, hsl(var(--border) / 0.3) 0px, hsl(var(--border) / 0.3) 4px, transparent 4px, transparent 8px)",
          }}
        />
        <div className="relative flex flex-col gap-2 items-center">
          {machine.steps.map((step, j) => (
            <motion.div
              key={j}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={animated ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.25, delay: 0.6 + index * 0.08 + j * 0.06 }}
              className="relative w-full z-[1]"
            >
              <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-[2]">
                {step.swarmTool ? (
                  <div className={cn(
                    "size-4 rounded-full border-2 border-background shadow-sm flex items-center justify-center",
                    step.swarmTool === "message" ? "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/20"
                    : step.swarmTool === "broadcast" ? "bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-cyan-500/20"
                    : step.swarmTool === "memory" ? "bg-gradient-to-br from-violet-400 to-violet-600 shadow-violet-500/20"
                    : step.swarmTool === "help" ? "bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/20"
                    : "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/20"
                  )}>
                    {step.swarmTool === "message" && <MessageCircle className="size-2 text-white" />}
                    {step.swarmTool === "broadcast" && <Radio className="size-2 text-white" />}
                    {step.swarmTool === "memory" && <Database className="size-2 text-white" />}
                    {step.swarmTool === "help" && <HelpCircle className="size-2 text-white" />}
                    {step.swarmTool === "expertise" && <Shield className="size-2 text-white" />}
                  </div>
                ) : step.screenshot ? (
                  <div className="size-4 rounded-full border-2 border-background bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm shadow-amber-500/20 flex items-center justify-center">
                    <Eye className="size-2 text-white" />
                  </div>
                ) : (
                  <span
                    className={cn(
                      "block size-2.5 rounded-full ring-2 ring-background",
                      step.status === "success"
                        ? "bg-emerald-500/70"
                        : step.status === "running"
                          ? "bg-amber-500/70"
                          : "bg-muted-foreground/20"
                    )}
                  />
                )}
              </div>

              <div
                className={cn(
                  "mx-1 mt-2 rounded-lg border px-3 py-2 text-left transition-all shadow-sm",
                  step.swarmTool === "message"
                    ? "border-blue-500/20 bg-blue-50/30 dark:bg-blue-950/10"
                    : step.swarmTool === "broadcast"
                      ? "border-cyan-500/20 bg-cyan-50/30 dark:bg-cyan-950/10"
                      : step.swarmTool === "memory"
                        ? "border-violet-500/20 bg-violet-50/30 dark:bg-violet-950/10"
                        : step.swarmTool === "help"
                          ? "border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/10"
                          : step.swarmTool === "expertise"
                            ? "border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10"
                            : step.status === "running"
                              ? "border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/10"
                              : "border-border/25 bg-background/80 dark:bg-background/60 backdrop-blur-sm"
                )}
              >
                <p className="text-[11px] leading-relaxed text-foreground/80 line-clamp-2">{step.text}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  {step.swarmTool ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[9px] leading-none px-1.5 py-0.5 rounded-full font-medium",
                        step.swarmTool === "message" ? "text-blue-600/80 dark:text-blue-400/70 bg-blue-500/10"
                        : step.swarmTool === "broadcast" ? "text-cyan-600/80 dark:text-cyan-400/70 bg-cyan-500/10"
                        : step.swarmTool === "memory" ? "text-violet-600/80 dark:text-violet-400/70 bg-violet-500/10"
                        : step.swarmTool === "help" ? "text-amber-600/80 dark:text-amber-400/70 bg-amber-500/10"
                        : "text-emerald-600/80 dark:text-emerald-400/70 bg-emerald-500/10"
                      )}
                    >
                      {step.swarmTool === "message" && <><MessageCircle className="size-2.5" />Message{step.targetMachine !== undefined ? ` → #${step.targetMachine + 1}` : ""}</>}
                      {step.swarmTool === "broadcast" && <><Radio className="size-2.5" />Broadcast</>}
                      {step.swarmTool === "memory" && <><Database className="size-2.5" />Shared Memory</>}
                      {step.swarmTool === "help" && <><HelpCircle className="size-2.5" />Help Request</>}
                      {step.swarmTool === "expertise" && <><Shield className="size-2.5" />Expertise</>}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[9px] leading-none px-1.5 py-0.5 rounded-full font-mono",
                        step.status === "success"
                          ? "text-emerald-600/70 dark:text-emerald-400/60 bg-emerald-500/8"
                          : step.status === "running"
                            ? "text-amber-600/70 dark:text-amber-400/60 bg-amber-500/8"
                            : "text-muted-foreground/40 bg-muted/30"
                      )}
                    >
                      <span className={cn(
                        "size-1 rounded-full",
                        step.status === "success" ? "bg-emerald-500" : step.status === "running" ? "bg-amber-500 animate-pulse" : "bg-muted-foreground/30"
                      )} />
                      {step.tool}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MockSwarmTree() {
  const [mounted, setMounted] = useState(false)
  const treeRef = useRef<HTMLDivElement>(null)
  const inView = useInView(treeRef, { once: true, amount: 0.2 })

  useEffect(() => {
    if (inView) {
      const t = setTimeout(() => setMounted(true), 200)
      return () => clearTimeout(t)
    }
  }, [inView])

  const cols = MOCK_MACHINES.length

  return (
    <div ref={treeRef} className="relative w-full">
      {/* Dotted canvas background */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl">
        <div
          className="absolute inset-0 opacity-[0.25] dark:opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 0.5px, transparent 0.5px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-500/[0.04] dark:bg-amber-400/[0.06] blur-[80px]" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-blue-500/[0.03] dark:bg-blue-400/[0.05] blur-[60px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-56 w-56 rounded-full bg-emerald-500/[0.02] dark:bg-emerald-400/[0.03] blur-[80px]" />
      </div>

      <div className="relative z-[1] px-4 sm:px-6 py-6 overflow-x-auto">
        {/* Root prompt node */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center mb-1"
        >
          <div className="relative max-w-md px-5 py-3.5 rounded-xl border border-border/50 bg-background/90 dark:bg-background/70 backdrop-blur-sm text-center shadow-sm">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 mb-1.5 font-medium font-mono">
              Prompt
            </p>
            <p className="text-sm leading-snug text-foreground/90">{MOCK_PROMPT}</p>
          </div>
        </motion.div>

        {/* Fork connector SVG */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={mounted ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex justify-center"
        >
          <svg
            width={Math.max(cols * 200, 400)}
            height={52}
            viewBox={`0 0 ${Math.max(cols * 200, 400)} 52`}
            className="shrink-0"
          >
            {MOCK_MACHINES.map((_, i) => {
              const totalW = Math.max(cols * 200, 400)
              const colW = totalW / cols
              const startX = totalW / 2
              const endX = colW * i + colW / 2
              const midY = 26
              return (
                <motion.path
                  key={i}
                  d={`M ${startX} 0 C ${startX} ${midY}, ${endX} ${midY}, ${endX} 52`}
                  fill="none"
                  className="stroke-border/50 dark:stroke-border/40"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={mounted ? { pathLength: 1, opacity: 1 } : {}}
                  transition={{ duration: 0.7, delay: 0.3 + i * 0.08, ease: "easeOut" }}
                />
              )
            })}
          </svg>
        </motion.div>

        {/* Machine branches with swarm connections overlay */}
        <div className="relative">
        {/* Swarm connections overlay — absolutely positioned over machine headers */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={mounted ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="absolute inset-x-0 top-0 z-[2] pointer-events-none"
        >
          <div className="relative w-full" style={{ height: 0, overflow: "visible" }}>
          <svg
            width={Math.max(cols * 200, 400)}
            height={48}
            viewBox={`0 0 ${Math.max(cols * 200, 400)} 48`}
            className="pointer-events-none"
            style={{ position: "relative", top: -2 }}
          >
            <defs>
              <style>{`
                @keyframes mock-flow {
                  to { stroke-dashoffset: -20; }
                }
                .mock-arc {
                  animation: mock-flow 1.5s linear infinite;
                }
                @keyframes mock-pulse {
                  0%, 100% { opacity: 0.4; }
                  50% { opacity: 0.9; }
                }
                .mock-pulse {
                  animation: mock-pulse 2s ease-in-out infinite;
                }
              `}</style>
              <marker id="mock-arrow-blue" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
                <path d="M 0 0 L 5 2 L 0 4 z" fill="#3b82f6" opacity="0.6" />
              </marker>
              <marker id="mock-arrow-cyan" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
                <path d="M 0 0 L 5 2 L 0 4 z" fill="#06b6d4" opacity="0.6" />
              </marker>
            </defs>
            {(() => {
              const totalW = Math.max(cols * 200, 400)
              const colW = totalW / cols
              const machineX = (idx: number) => colW * idx + colW / 2

              const CONN_COLORS: Record<string, string> = {
                message: "#3b82f6",
                broadcast: "#06b6d4",
                memory: "#8b5cf6",
                help: "#f59e0b",
                expertise: "#10b981",
              }

              return MOCK_INTERACTIONS.map((conn, ci) => {
                const fromX = machineX(conn.from)
                const stroke = CONN_COLORS[conn.type]

                if (conn.type === "message" && conn.to !== null) {
                  const toX = machineX(conn.to)
                  const dist = Math.abs(toX - fromX)
                  const arcH = Math.max(14, Math.min(36, dist * 0.16)) + (ci % 3) * 3
                  const midX = (fromX + toX) / 2
                  return (
                    <g key={ci}>
                      <path
                        d={`M ${fromX} 48 Q ${midX} ${48 - arcH}, ${toX} 48`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={3}
                        opacity={0.08}
                      />
                      <path
                        d={`M ${fromX} 48 Q ${midX} ${48 - arcH}, ${toX} 48`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        className="mock-arc"
                        opacity={0.6}
                        markerEnd="url(#mock-arrow-blue)"
                      />
                    </g>
                  )
                }

                if (conn.type === "broadcast") {
                  return (
                    <g key={ci}>
                      {[0, 1, 2, 3, 4].filter(i => i !== conn.from).map(targetIdx => {
                        const toX = machineX(targetIdx)
                        const dist = Math.abs(toX - fromX)
                        const arcH = Math.max(12, Math.min(32, dist * 0.14))
                        const midX = (fromX + toX) / 2
                        return (
                          <path
                            key={targetIdx}
                            d={`M ${fromX} 48 Q ${midX} ${48 - arcH}, ${toX} 48`}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={1}
                            strokeDasharray="4 4"
                            className="mock-arc"
                            opacity={0.35}
                          />
                        )
                      })}
                      <circle cx={fromX} cy={46} r={3.5} fill={stroke} opacity={0.15} className="mock-pulse" />
                      <circle cx={fromX} cy={46} r={1.5} fill={stroke} opacity={0.5} />
                    </g>
                  )
                }

                if (conn.type === "memory") {
                  const centerX = totalW / 2
                  return (
                    <g key={ci}>
                      <path
                        d={`M ${fromX} 48 Q ${(fromX + centerX) / 2} ${20}, ${centerX} 12`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        className="mock-arc"
                        opacity={0.4}
                      />
                    </g>
                  )
                }

                if (conn.type === "help") {
                  return (
                    <g key={ci}>
                      <line
                        x1={fromX} y1={48} x2={fromX} y2={14}
                        stroke={stroke}
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        opacity={0.4}
                        className="mock-arc"
                      />
                      <circle cx={fromX} cy={10} r={4} fill={stroke} opacity={0.12} />
                      <text x={fromX} y={13} textAnchor="middle" fontSize={6} fill={stroke} opacity={0.6}>?</text>
                    </g>
                  )
                }

                return null
              })
            })()}

            {/* Central memory node */}
            {(() => {
              const totalW = Math.max(cols * 200, 400)
              const centerX = totalW / 2
              return (
                <g>
                  <rect x={centerX - 14} y={4} width={28} height={14} rx={3} fill="#8b5cf6" opacity={0.1} stroke="#8b5cf6" strokeWidth={0.5} strokeOpacity={0.25} />
                  <text x={centerX} y={14} textAnchor="middle" fontSize={6} fontWeight={600} fill="#8b5cf6" opacity={0.5}>MEM</text>
                </g>
              )
            })()}
          </svg>
          </div>
        </motion.div>

        {/* Interaction legend — floating bottom-left */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.3, delay: 0.55 }}
          className="absolute z-[10] bottom-2 left-2 flex gap-1.5 flex-wrap pointer-events-none"
        >
          {[
            { icon: MessageCircle, label: "Messages", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
            { icon: Radio, label: "Broadcast", color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
            { icon: Database, label: "Shared Memory", color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
            { icon: HelpCircle, label: "Help", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
            { icon: Shield, label: "Expertise", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
          ].map(({ icon: Icon, label, color }) => (
            <span key={label} className={cn("inline-flex items-center gap-1 text-[8px] font-medium px-1.5 py-0.5 rounded-full border", color)}>
              <Icon className="size-2" />
              {label}
            </span>
          ))}
        </motion.div>

        {/* Machine branches */}
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(170px, 1fr))`,
            minWidth: cols * 180,
          }}
        >
          {MOCK_MACHINES.map((machine, i) => (
            <motion.div
              key={machine.label}
              initial={{ opacity: 0, y: 16 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.4 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <MockMachineBranch machine={machine} index={i} animated={mounted} />
            </motion.div>
          ))}
        </div>
        </div>{/* close relative wrapper for overlay + branches */}
      </div>

      {/* Label */}
      <div className="absolute bottom-3 left-4 z-[10] flex items-center gap-1.5 text-[10px] text-muted-foreground/30 select-none pointer-events-none">
        <Eye className="size-3" />
        <span>Live swarm execution with agent communication</span>
      </div>
    </div>
  )
}
