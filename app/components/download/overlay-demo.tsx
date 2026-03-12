"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

/* ── Script constants ── */
const TYPEWRITER_TEXT = "Find flights from SF to Tokyo next month"
const CHAR_DELAY = 45
const AI_RESPONSE =
  "I'll search for flights from San Francisco to Tokyo. Let me check the best options..."

const TOOL_STEPS = [
  "Opened Google Flights",
  "Searching SFO → NRT, Apr 10–17",
  "Comparing prices across airlines",
]

type CursorCoord = number | string  // number=px, string=percent e.g. "42%"

/* ── Click ripple ── */
function ClickRipple({ x, y }: { x: CursorCoord; y: CursorCoord }) {
  return (
    <motion.div
      className="absolute pointer-events-none z-[60]"
      style={{ left: x, top: y }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40"
        initial={{ width: 0, height: 0 }}
        animate={{ width: 28, height: 28 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/60"
        initial={{ scale: 1 }}
        animate={{ scale: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      />
    </motion.div>
  )
}

/* ── Cursor ── */
function DemoCursor({ x, y, visible }: { x: CursorCoord; y: CursorCoord; visible: boolean }) {
  return (
    <motion.div
      className="absolute pointer-events-none z-[60]"
      animate={{ left: x, top: y, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <svg width="14" height="18" viewBox="0 0 16 20" fill="none" className="drop-shadow-lg">
        <path
          d="M1 1L1 14.5L4.5 11L8.5 18.5L11 17L7 9.5L12 9.5L1 1Z"
          fill="white"
          stroke="black"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  )
}

/* ── Coasty logo ── */
function CoastyLogo() {
  return (
    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="demoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="30%" stopColor="rgba(255,255,255,0.1)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.3)" />
          <stop offset="70%" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="100%" stopColor="rgba(255,255,255,1)" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="100" fill="url(#demoGrad)" />
    </svg>
  )
}

/* ── Typewriter ── */
function TypewriterText({ text, charIndex, showCaret }: { text: string; charIndex: number; showCaret: boolean }) {
  return (
    <span className="text-[11px] text-neutral-200">
      {text.slice(0, charIndex)}
      {showCaret && (
        <span className="inline-block w-[1px] h-3 bg-neutral-300 ml-[1px] align-middle animate-[blink_1s_step-end_infinite]" />
      )}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════
   Desktop screen — shows the agent actions behind overlay
   ═══════════════════════════════════════════════════════ */
type DesktopPhase = "idle" | "browser-opening" | "searching" | "results"

function DesktopScreen({ phase }: { phase: DesktopPhase }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-neutral-950 overflow-hidden">
      {/* Desktop wallpaper — subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900" />

      {/* Desktop content */}
      <div className="relative flex-1">
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {/* Minimal desktop with a few icons */}
              <div className="grid grid-cols-3 gap-4 sm:gap-6 opacity-25">
                {[
                  { icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z", label: "Files" },
                  { icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5", label: "Projects" },
                  { icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z", label: "Notes" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-neutral-800/60 border border-neutral-700/30 flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 sm:w-[18px] sm:h-[18px]">
                        <path d={item.icon} />
                      </svg>
                    </div>
                    <span className="text-[9px] text-neutral-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {phase === "browser-opening" && (
            <motion.div
              key="browser"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-3 top-12 flex flex-col rounded-lg overflow-hidden border border-neutral-700/40 bg-neutral-900"
            >
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/80 border-b border-neutral-700/30">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-neutral-600/60" />
                  <div className="w-2 h-2 rounded-full bg-neutral-600/60" />
                  <div className="w-2 h-2 rounded-full bg-neutral-600/60" />
                </div>
                <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900/80 border border-neutral-700/30">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-500">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  <span className="text-[9px] text-neutral-500 truncate">google.com/travel/flights</span>
                </div>
              </div>
              {/* Browser body — Google Flights skeleton */}
              <div className="flex-1 bg-neutral-900 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-medium text-blue-400">Google</span>
                    <span className="text-[10px] text-neutral-500">Flights</span>
                  </div>
                </div>
                {/* Search bar */}
                <div className="rounded-lg border border-neutral-700/40 bg-neutral-800/50 p-2 mb-3">
                  <div className="flex items-center gap-3 text-[9px]">
                    <div className="flex items-center gap-1.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-500"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4m-10-10h4m12 0h4" /></svg>
                      <span className="text-neutral-300">SFO</span>
                    </div>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-600"><path d="M5 12h14m-4-4l4 4-4 4" /></svg>
                    <div className="flex items-center gap-1.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-500"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4m-10-10h4m12 0h4" /></svg>
                      <span className="text-neutral-300">NRT</span>
                    </div>
                    <div className="ml-auto text-neutral-500">Apr 10 – 17</div>
                  </div>
                </div>
                {/* Loading shimmer */}
                <div className="space-y-2">
                  <div className="h-2 w-24 rounded bg-neutral-800 animate-pulse" />
                  <div className="h-2 w-32 rounded bg-neutral-800/60 animate-pulse" />
                </div>
              </div>
            </motion.div>
          )}

          {(phase === "searching" || phase === "results") && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-3 top-12 flex flex-col rounded-lg overflow-hidden border border-neutral-700/40 bg-neutral-900"
            >
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/80 border-b border-neutral-700/30">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-neutral-600/60" />
                  <div className="w-2 h-2 rounded-full bg-neutral-600/60" />
                  <div className="w-2 h-2 rounded-full bg-neutral-600/60" />
                </div>
                <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900/80 border border-neutral-700/30">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-500">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  <span className="text-[9px] text-neutral-500 truncate">google.com/travel/flights</span>
                </div>
              </div>
              {/* Results body */}
              <div className="flex-1 bg-neutral-900 p-3 overflow-hidden">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-medium text-blue-400">Google</span>
                  <span className="text-[10px] text-neutral-500">Flights</span>
                  <span className="text-[8px] text-neutral-600 ml-auto">SFO → NRT · Apr 10–17</span>
                </div>

                {/* Flight results */}
                <div className="space-y-1.5">
                  {[
                    { airline: "ANA", time: "11:05 AM – 3:25 PM+1", dur: "11h 20m", stops: "Nonstop", price: "$734" },
                    { airline: "JAL", time: "1:30 PM – 5:50 PM+1", dur: "11h 20m", stops: "Nonstop", price: "$789" },
                    { airline: "United", time: "11:40 AM – 4:15 PM+1", dur: "11h 35m", stops: "Nonstop", price: "$812" },
                    { airline: "Delta", time: "3:00 PM – 8:10 PM+1", dur: "12h 10m", stops: "1 stop", price: "$651" },
                  ].map((f, i) => (
                    <motion.div
                      key={f.airline}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: phase === "results" ? i * 0.12 : 0 }}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-[8px]",
                        i === 0
                          ? "border-blue-500/30 bg-blue-950/20"
                          : "border-neutral-700/30 bg-neutral-800/30"
                      )}
                    >
                      <span className={cn("font-medium w-6 sm:w-8", i === 0 ? "text-blue-300" : "text-neutral-300")}>{f.airline}</span>
                      <span className="text-neutral-400 flex-1 hidden sm:block">{f.time}</span>
                      <span className="text-neutral-500 w-9 sm:w-11">{f.dur}</span>
                      <span className={cn("w-8 sm:w-10 hidden sm:block", f.stops === "Nonstop" ? "text-emerald-500" : "text-neutral-500")}>{f.stops}</span>
                      <span className={cn("font-semibold w-8 text-right", i === 0 ? "text-blue-300" : "text-neutral-200")}>{f.price}</span>
                    </motion.div>
                  ))}
                </div>
                {phase === "results" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-2 flex items-center gap-1"
                  >
                    <span className="text-[8px] text-emerald-500/80">Best price:</span>
                    <span className="text-[8px] font-medium text-emerald-400">$651 on Delta (1 stop)</span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Taskbar */}
      <div className="relative z-10 flex items-center justify-center gap-2 px-4 py-1.5 bg-neutral-900/90 border-t border-neutral-800/50">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="w-6 h-6 rounded-md bg-neutral-800/50" />
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════ MAIN ═══════════════════ */
export function OverlayDemo() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [phase, setPhase] = useState<
    "idle" | "cursor-to-pill" | "click-pill" | "typing" | "send-click" |
    "sending" | "expanding" | "ai-response" | "tools" | "done" | "collapsing"
  >("idle")
  const [typedChars, setTypedChars] = useState(0)
  const [aiChars, setAiChars] = useState(0)
  const [toolIndex, setToolIndex] = useState(-1)
  const [cursorPos, setCursorPos] = useState<{ x: CursorCoord; y: CursorCoord }>({ x: "65%", y: 14 })
  const [cursorVisible, setCursorVisible] = useState(false)
  const [clicks, setClicks] = useState<{ id: number; x: CursorCoord; y: CursorCoord }[]>([])
  const [desktopPhase, setDesktopPhase] = useState<DesktopPhase>("idle")
  const clickId = useRef(0)

  const addClick = useCallback((x: CursorCoord, y: CursorCoord) => {
    const id = ++clickId.current
    setClicks((prev) => [...prev, { id, x, y }])
    setTimeout(() => setClicks((prev) => prev.filter((c) => c.id !== id)), 600)
  }, [])

  useEffect(() => {
    const t: NodeJS.Timeout[] = []
    const push = (fn: () => void, ms: number) => t.push(setTimeout(fn, ms))
    let offset = 0

    function runCycle() {
      setPhase("idle")
      setIsExpanded(false)
      setTypedChars(0)
      setAiChars(0)
      setToolIndex(-1)
      setCursorVisible(false)
      setCursorPos({ x: "65%", y: 14 })
      setDesktopPhase("idle")
      offset = 0

      // Cursor targets — relative to screen container
      // Overlay is centered, ~56% wide, pill is at top ~8px, h=36px → center y≈26
      const pillInputX = "42%"    // left side of pill input
      const pillInputY = 26       // vertical center of pill
      const sendBtnX = "68%"      // right side of pill (send button area)
      const sendBtnY = 26

      // 1. Cursor appears, moves to pill
      push(() => {
        setCursorVisible(true)
        setPhase("cursor-to-pill")
        setCursorPos({ x: pillInputX, y: pillInputY })
      }, (offset += 1000))

      // 2. Click on pill
      push(() => {
        setPhase("click-pill")
        addClick(pillInputX, pillInputY)
      }, (offset += 600))

      // 3. Typewriter in pill
      push(() => {
        setPhase("typing")
        setCursorVisible(false)
      }, (offset += 300))

      for (let i = 1; i <= TYPEWRITER_TEXT.length; i++) {
        push(() => setTypedChars(i), offset + i * CHAR_DELAY)
      }
      offset += TYPEWRITER_TEXT.length * CHAR_DELAY + 200

      // 4. Cursor to Send, click
      push(() => {
        setCursorVisible(true)
        setCursorPos({ x: sendBtnX, y: sendBtnY })
      }, (offset += 200))

      push(() => {
        setPhase("send-click")
        addClick(sendBtnX, sendBtnY)
      }, (offset += 400))

      // 5. Expand + browser opens behind
      push(() => {
        setPhase("expanding")
        setIsExpanded(true)
        setCursorVisible(false)
        setDesktopPhase("browser-opening")
      }, (offset += 300))

      // 6. AI response types
      push(() => setPhase("ai-response"), (offset += 500))
      for (let i = 1; i <= AI_RESPONSE.length; i++) {
        push(() => setAiChars(i), offset + i * 18)
      }
      offset += AI_RESPONSE.length * 18 + 300

      // 7. Tool steps + desktop changes
      push(() => {
        setPhase("tools")
        setDesktopPhase("searching")
      }, offset)

      push(() => setToolIndex(0), (offset += 600))
      push(() => {
        setToolIndex(1)
        setDesktopPhase("results")
      }, (offset += 800))
      push(() => setToolIndex(2), (offset += 800))

      // 8. Hold
      push(() => setPhase("done"), (offset += 1800))

      // 9. Collapse
      push(() => {
        setPhase("collapsing")
        setIsExpanded(false)
      }, (offset += 1500))

      // 10. Restart
      push(runCycle, (offset += 2500))
    }

    runCycle()
    return () => t.forEach(clearTimeout)
  }, [addClick])

  const showSendBtn = (phase === "typing" || phase === "send-click" || phase === "sending") && typedChars > 0
  const pillText = phase === "typing" || phase === "send-click" || phase === "sending"

  // Use a ref to measure the actual screen height and compute overlay dimensions
  const screenRef = useRef<HTMLDivElement>(null)
  const [screenH, setScreenH] = useState(326)

  useEffect(() => {
    const measure = () => {
      if (screenRef.current) setScreenH(screenRef.current.clientHeight)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  const PILL_H = Math.max(28, Math.min(36, screenH * 0.1))
  const EXPANDED_H = Math.min(screenH - 16, 290)  // 8px top + 8px bottom padding

  return (
    <div className="flex items-center justify-center w-full px-4">
      {/* Monitor frame */}
      <div className="w-full max-w-[580px]">
        <div className="relative rounded-xl overflow-hidden border border-neutral-700/40 bg-neutral-950 shadow-2xl shadow-black/50">
          {/* Screen */}
          <div ref={screenRef} className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
            {/* Desktop background with reactive content */}
            <DesktopScreen phase={desktopPhase} />

            {/* Overlay — positioned at top center */}
            <div className="absolute top-[2%] left-1/2 -translate-x-1/2 z-30" style={{ width: "56%" }}>
              <motion.div
                animate={{ height: isExpanded ? EXPANDED_H : PILL_H }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="w-full rounded-xl bg-neutral-900/95 backdrop-blur-xl overflow-hidden border border-neutral-600/30"
                style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
              >
                {/* Pill bar */}
                <div className="flex items-center gap-1.5 w-full px-2 flex-shrink-0" style={{ height: PILL_H }}>
                  <CoastyLogo />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />

                  {!isExpanded ? (
                    <div className="flex-1 min-w-0">
                      {pillText ? (
                        <TypewriterText text={TYPEWRITER_TEXT} charIndex={typedChars} showCaret={phase === "typing"} />
                      ) : (
                        <span className="text-[10px] text-neutral-500">Ask Coasty anything...</span>
                      )}
                    </div>
                  ) : (
                    <span className="flex-1 min-w-0 text-[11px] font-medium text-neutral-200 truncate">Coasty</span>
                  )}

                  <div className="flex items-center gap-0.5">
                    {showSendBtn && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="px-1.5 py-0.5 rounded-md text-white text-[9px] font-medium"
                        style={{ background: "#0079c7" }}
                      >
                        Send
                      </motion.div>
                    )}
                    <div className="p-1 text-neutral-500 hidden sm:block">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </div>
                    <div className="p-1 text-emerald-400/70 hidden sm:block">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <polyline points="9 12 11 14 15 10" />
                      </svg>
                    </div>
                    <div className="p-1 text-neutral-500">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isExpanded ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                      </svg>
                    </div>
                    <div
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[7px] sm:text-[8px] font-semibold text-white"
                      style={{ background: "linear-gradient(to bottom right, #36b3f8, #0079c7)" }}
                    >
                      J
                    </div>
                  </div>
                </div>

                {/* Expanded panel */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, delay: 0.06 }}
                      className="flex flex-col"
                      style={{ height: EXPANDED_H - PILL_H }}
                    >
                      <div className="flex-1 overflow-hidden px-2.5 py-2 space-y-2">
                        {/* User message */}
                        <div className="flex justify-end">
                          <div className="max-w-[85%] px-2 sm:px-3 py-1 sm:py-1.5 bg-neutral-800 rounded-2xl text-[9px] sm:text-[11px] text-neutral-200 leading-relaxed">
                            {TYPEWRITER_TEXT}
                          </div>
                        </div>

                        {/* AI response */}
                        {(phase === "ai-response" || phase === "tools" || phase === "done" || phase === "collapsing") && (
                          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                            <div className="max-w-[90%] text-[9px] sm:text-[11px] text-neutral-300 leading-relaxed">
                              {AI_RESPONSE.slice(0, aiChars)}
                              {phase === "ai-response" && aiChars < AI_RESPONSE.length && (
                                <span className="inline-block w-[1px] h-3 bg-neutral-400 ml-[1px] align-middle animate-[blink_1s_step-end_infinite]" />
                              )}
                            </div>
                          </motion.div>
                        )}

                        {/* Tool steps */}
                        {toolIndex >= 0 && (
                          <div className="space-y-1 pl-0.5">
                            {TOOL_STEPS.map((step, i) => {
                              if (i > toolIndex) return null
                              const isDone = i < toolIndex || phase === "done" || phase === "collapsing"
                              const isActive = i === toolIndex && phase !== "done" && phase !== "collapsing"
                              return (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, x: -6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[10px]"
                                >
                                  {isDone ? (
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 flex-shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                                  ) : isActive ? (
                                    <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-yellow-400/60 border-t-yellow-400 animate-spin flex-shrink-0" />
                                  ) : (
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 flex-shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                                  )}
                                  <span className={isDone ? "text-neutral-500" : "text-neutral-300"}>{step}</span>
                                </motion.div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Input */}
                      <div className="px-2 sm:px-2.5 pb-1.5 sm:pb-2 pt-0.5 flex-shrink-0">
                        <div className="rounded-lg sm:rounded-xl bg-neutral-800 border border-neutral-700/50 px-2 sm:px-2.5 py-1 sm:py-1.5 flex items-center">
                          <span className="flex-1 text-[8px] sm:text-[10px] text-neutral-500">Tell your AI what to do...</span>
                          <div className="size-5 sm:size-6 rounded-full bg-white/15 text-neutral-500 flex items-center justify-center">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="19" x2="12" y2="5" />
                              <polyline points="5 12 12 5 19 12" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Cursor + ripples */}
            <DemoCursor x={cursorPos.x} y={cursorPos.y} visible={cursorVisible} />
            {clicks.map((c) => (
              <ClickRipple key={c.id} x={c.x} y={c.y} />
            ))}
          </div>
        </div>

        {/* Monitor stand */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-4 bg-gradient-to-b from-neutral-700/40 to-neutral-800/30 rounded-b-sm" />
          <div className="w-28 h-1.5 bg-neutral-700/30 rounded-full" />
        </div>
      </div>
    </div>
  )
}
