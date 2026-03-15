"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

// ─── Scripted agent actions ───
interface Action {
  type: "move" | "click" | "type" | "scroll" | "wait"
  x: number
  y: number
  text?: string
  duration: number
  label?: string
}

const SCRIPT: Action[] = [
  { type: "move", x: 65, y: 12, duration: 500, label: "Opening browser" },
  { type: "click", x: 65, y: 12, duration: 250 },
  { type: "move", x: 55, y: 12, duration: 400, label: "Navigating to CRM" },
  { type: "type", x: 55, y: 12, text: "salesforce.com/pricing", duration: 1200 },
  { type: "click", x: 72, y: 12, duration: 250 },
  { type: "wait", x: 55, y: 12, duration: 400, label: "Loading page" },
  { type: "move", x: 42, y: 42, duration: 500, label: "Reading pricing tiers" },
  { type: "scroll", x: 42, y: 42, duration: 700 },
  { type: "move", x: 35, y: 55, duration: 400, label: "Extracting plan data" },
  { type: "click", x: 35, y: 55, duration: 250 },
  { type: "move", x: 55, y: 55, duration: 300 },
  { type: "click", x: 55, y: 55, duration: 250 },
  { type: "move", x: 75, y: 55, duration: 300, label: "Comparing features" },
  { type: "click", x: 75, y: 55, duration: 250 },
  { type: "scroll", x: 55, y: 60, duration: 600, label: "Scrolling to details" },
  { type: "move", x: 25, y: 75, duration: 400, label: "Selecting data" },
  { type: "click", x: 25, y: 75, duration: 250 },
  { type: "move", x: 80, y: 75, duration: 500 },
  { type: "click", x: 80, y: 75, duration: 250 },
  { type: "move", x: 55, y: 85, duration: 400, label: "Exporting to CSV" },
  { type: "type", x: 55, y: 85, text: "export", duration: 600 },
  { type: "click", x: 65, y: 85, duration: 250 },
  { type: "wait", x: 55, y: 50, duration: 600, label: "Task complete" },
]

const TOTAL_DURATION = SCRIPT.reduce((sum, a) => sum + a.duration, 0)

// Typing sequence — which [row, key] lights up per script step group
const TYPING_KEYS: number[][][] = [
  [[1,3],[1,5],[2,2],[2,7],[1,8]],
  [[0,2],[1,4],[2,5],[0,9],[1,6]],
  [[2,3],[0,5],[1,7],[2,8],[0,11]],
  [[1,2],[2,6],[0,7],[1,9],[2,4]],
  [[0,4],[2,1],[1,8],[0,6],[2,9]],
]

export function HeroMachineDemo({ isMobile }: { isMobile: boolean }) {
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 })
  const [currentAction, setCurrentAction] = useState<Action | null>(null)
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; id: number } | null>(null)
  const [typedText, setTypedText] = useState("")
  const [scrollY, setScrollY] = useState(0)
  const [actionLabel, setActionLabel] = useState("Initializing...")
  const [typingStep, setTypingStep] = useState(0)
  const rippleId = useRef(0)
  const rafRef = useRef<number>(0)
  const lastClickRef = useRef(0)

  useEffect(() => {
    let actionIdx = 0
    let actionStart = Date.now()
    let loopStart = Date.now()

    const animate = () => {
      const now = Date.now()
      const loopElapsed = now - loopStart

      if (loopElapsed > TOTAL_DURATION + 1200) {
        loopStart = now
        actionIdx = 0
        actionStart = now
        setTypedText("")
        setScrollY(0)
        setTypingStep(0)
      }

      let elapsed = 0
      for (let i = 0; i < SCRIPT.length; i++) {
        if (elapsed + SCRIPT[i].duration > loopElapsed) {
          if (i !== actionIdx) {
            actionIdx = i
            actionStart = now - (loopElapsed - elapsed)
          }
          break
        }
        elapsed += SCRIPT[i].duration
      }

      if (actionIdx >= SCRIPT.length) {
        rafRef.current = requestAnimationFrame(animate)
        return
      }

      const action = SCRIPT[actionIdx]
      const progress = Math.min(1, (now - actionStart) / action.duration)
      const ease = 1 - Math.pow(1 - progress, 3)

      setCurrentAction(action)
      if (action.label) setActionLabel(action.label)

      setCursorPos((prev) => ({
        x: prev.x + (action.x - prev.x) * ease * 0.18,
        y: prev.y + (action.y - prev.y) * ease * 0.18,
      }))

      if (action.type === "click" && progress > 0.3 && progress < 0.5 && now - lastClickRef.current > 200) {
        rippleId.current++
        lastClickRef.current = now
        setClickRipple({ x: action.x, y: action.y, id: rippleId.current })
      }

      if (action.type === "type" && action.text) {
        const charIdx = Math.floor(progress * action.text.length)
        setTypedText(action.text.slice(0, charIdx))
        setTypingStep((actionIdx % TYPING_KEYS.length))
      }

      if (action.type === "scroll") {
        setScrollY((prev) => prev + ease * 0.25)
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  if (isMobile) return null

  const isTyping = currentAction?.type === "type"

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
      {/* Right-side 3D workstation */}
      <div
        className="absolute -right-[6%] xl:right-[0%] 2xl:right-[3%] top-[50%] -translate-y-1/2"
        style={{ perspective: "800px" }}
      >
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0, rotateX: 6, rotateY: 22 }}
          transition={{ duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* ── Monitor ── */}
          <div
            className="w-[420px] h-[270px] rounded-2xl"
            style={{
              border: "1.5px solid rgba(128,128,128,0.15)",
              background: "linear-gradient(145deg, rgba(128,128,128,0.08) 0%, rgba(128,128,128,0.02) 100%)",
              boxShadow: "0 40px 120px -30px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Screen */}
            <div
              className="m-2.5 h-[calc(100%-20px)] rounded-xl overflow-hidden relative"
              style={{
                background: "rgba(0,0,0,0.04)",
                border: "1px solid rgba(128,128,128,0.08)",
              }}
            >
              {/* Browser chrome — traffic lights + tabs */}
              <div className="flex items-center gap-[5px] px-3 py-2" style={{ borderBottom: "1px solid rgba(128,128,128,0.05)" }}>
                <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,95,87,0.3)" }} />
                <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,189,46,0.3)" }} />
                <div className="w-2 h-2 rounded-full" style={{ background: "rgba(39,201,63,0.3)" }} />
                {/* Tabs */}
                <div className="ml-3 flex items-center gap-1">
                  <div className="px-2.5 py-[3px] rounded-md flex items-center gap-1.5" style={{ background: "rgba(128,128,128,0.06)" }}>
                    <div className="w-[6px] h-[6px] rounded-sm" style={{ background: "rgba(0,112,243,0.3)" }} />
                    <span className="text-[6px] font-medium" style={{ color: "rgba(128,128,128,0.4)" }}>Salesforce</span>
                    <span className="text-[5px] ml-0.5" style={{ color: "rgba(128,128,128,0.2)" }}>×</span>
                  </div>
                  <div className="px-2.5 py-[3px] rounded-md flex items-center gap-1.5" style={{ background: "rgba(128,128,128,0.03)" }}>
                    <div className="w-[6px] h-[6px] rounded-sm" style={{ background: "rgba(255,108,55,0.3)" }} />
                    <span className="text-[6px]" style={{ color: "rgba(128,128,128,0.25)" }}>HubSpot</span>
                  </div>
                </div>
              </div>

              {/* Address bar */}
              <div className="px-3 py-[4px] flex items-center gap-2" style={{ borderBottom: "1px solid rgba(128,128,128,0.04)" }}>
                <div className="flex items-center gap-1">
                  <div className="w-[10px] h-[10px] rounded-full flex items-center justify-center" style={{ background: "rgba(128,128,128,0.04)" }}>
                    <span className="text-[6px]" style={{ color: "rgba(128,128,128,0.15)" }}>‹</span>
                  </div>
                  <div className="w-[10px] h-[10px] rounded-full flex items-center justify-center" style={{ background: "rgba(128,128,128,0.04)" }}>
                    <span className="text-[6px]" style={{ color: "rgba(128,128,128,0.15)" }}>›</span>
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-1.5 px-2 py-[3px] rounded-md" style={{ background: "rgba(128,128,128,0.04)" }}>
                  <svg width="7" height="7" viewBox="0 0 12 12" fill="none" style={{ color: "rgba(128,128,128,0.15)" }}>
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1" />
                    <path d="M4 6H8" stroke="currentColor" strokeWidth="0.8" />
                    <path d="M6 4V8" stroke="currentColor" strokeWidth="0.8" />
                  </svg>
                  <span className="text-[6px] font-mono" style={{ color: "rgba(128,128,128,0.25)" }}>
                    {typedText || "salesforce.com/pricing"}
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      style={{ color: "rgba(128,128,128,0.3)" }}
                    >|</motion.span>
                  </span>
                </div>
              </div>

              {/* ── Page content ── */}
              <div className="h-[calc(100%-52px)] overflow-hidden relative">
                <div
                  className="absolute inset-0 transition-transform duration-500 ease-out"
                  style={{ transform: `translateY(-${scrollY * 12}px)` }}
                >
                  {/* Nav bar */}
                  <div className="px-3 py-2 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(128,128,128,0.04)" }}>
                    <div className="w-[14px] h-[14px] rounded" style={{ background: "rgba(0,112,243,0.12)" }} />
                    <div className="h-[4px] w-16 rounded-full" style={{ background: "rgba(128,128,128,0.08)" }} />
                    <div className="flex-1" />
                    <div className="flex items-center gap-2">
                      <div className="h-[4px] w-10 rounded-full" style={{ background: "rgba(128,128,128,0.05)" }} />
                      <div className="h-[4px] w-8 rounded-full" style={{ background: "rgba(128,128,128,0.05)" }} />
                      <div className="h-[4px] w-12 rounded-full" style={{ background: "rgba(128,128,128,0.05)" }} />
                      <div className="w-[14px] h-[14px] rounded-full" style={{ background: "rgba(128,128,128,0.06)" }} />
                    </div>
                  </div>

                  {/* Hero */}
                  <div className="px-4 pt-3 pb-2 text-center">
                    <div className="mx-auto h-[4px] w-24 rounded-full mb-1.5" style={{ background: "rgba(128,128,128,0.06)" }} />
                    <div className="mx-auto h-[6px] w-40 rounded-full mb-1" style={{ background: "rgba(128,128,128,0.1)" }} />
                    <div className="mx-auto h-[4px] w-32 rounded-full" style={{ background: "rgba(128,128,128,0.05)" }} />
                  </div>

                  {/* Pricing cards */}
                  <div className="px-3 pt-2">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { color: "rgba(128,128,128,0.06)", features: 3, highlight: false },
                        { color: "rgba(0,112,243,0.06)", features: 5, highlight: true },
                        { color: "rgba(128,128,128,0.06)", features: 6, highlight: false },
                      ].map((plan, i) => (
                        <div
                          key={i}
                          className="rounded-lg p-2 relative"
                          style={{
                            border: plan.highlight ? "1px solid rgba(0,112,243,0.12)" : "1px solid rgba(128,128,128,0.06)",
                            background: plan.color,
                          }}
                        >
                          {plan.highlight && (
                            <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 px-2 py-[1px] rounded-full text-[4px]" style={{ background: "rgba(0,112,243,0.12)", color: "rgba(0,112,243,0.5)" }}>
                              Popular
                            </div>
                          )}
                          <div className="h-[3px] w-12 rounded-full mb-1.5" style={{ background: "rgba(128,128,128,0.1)" }} />
                          <div className="h-[7px] w-8 rounded mb-1" style={{ background: "rgba(128,128,128,0.12)" }} />
                          <div className="text-[5px] mb-1.5" style={{ color: "rgba(128,128,128,0.2)" }}>/user/mo</div>
                          <div className="space-y-[3px]">
                            {Array.from({ length: plan.features }).map((_, fi) => (
                              <div key={fi} className="flex items-center gap-1">
                                <div className="w-[4px] h-[4px] rounded-full" style={{ background: "rgba(39,201,63,0.2)" }} />
                                <div className="h-[3px] rounded-full flex-1" style={{ background: "rgba(128,128,128,0.06)", width: `${60 + (fi * 13) % 40}%` }} />
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 h-[12px] rounded-md flex items-center justify-center" style={{ background: plan.highlight ? "rgba(0,112,243,0.1)" : "rgba(128,128,128,0.06)" }}>
                            <div className="h-[3px] w-8 rounded-full" style={{ background: plan.highlight ? "rgba(0,112,243,0.3)" : "rgba(128,128,128,0.1)" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Comparison table */}
                  <div className="px-3 pt-3">
                    <div className="h-[4px] w-20 rounded-full mb-2" style={{ background: "rgba(128,128,128,0.08)" }} />
                    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(128,128,128,0.05)" }}>
                      <div className="flex items-center px-2 py-1.5" style={{ background: "rgba(128,128,128,0.03)" }}>
                        <div className="flex-[2] h-[3px] w-12 rounded-full" style={{ background: "rgba(128,128,128,0.08)" }} />
                        <div className="flex-1 h-[3px] w-8 rounded-full mx-auto" style={{ background: "rgba(128,128,128,0.06)" }} />
                        <div className="flex-1 h-[3px] w-8 rounded-full mx-auto" style={{ background: "rgba(128,128,128,0.06)" }} />
                        <div className="flex-1 h-[3px] w-8 rounded-full mx-auto" style={{ background: "rgba(128,128,128,0.06)" }} />
                      </div>
                      {[0, 1, 2, 3, 4].map((row) => (
                        <div key={row} className="flex items-center px-2 py-[5px]" style={{ borderTop: "1px solid rgba(128,128,128,0.03)" }}>
                          <div className="flex-[2]">
                            <div className="h-[3px] rounded-full" style={{ background: "rgba(128,128,128,0.06)", width: `${50 + row * 8}%` }} />
                          </div>
                          {[0, 1, 2].map((col) => (
                            <div key={col} className="flex-1 flex justify-center">
                              {(row + col) % 3 !== 2 ? (
                                <div className="w-[6px] h-[6px] rounded-full" style={{ background: "rgba(39,201,63,0.18)" }}>
                                  <svg width="6" height="6" viewBox="0 0 12 12" fill="none">
                                    <path d="M3 6L5 8L9 4" stroke="rgba(39,201,63,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-[6px] h-[6px] rounded-full flex items-center justify-center" style={{ background: "rgba(128,128,128,0.06)" }}>
                                  <div className="w-[4px] h-[0.5px]" style={{ background: "rgba(128,128,128,0.15)" }} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Agent cursor */}
                <motion.div
                  className="absolute z-20"
                  style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
                  transition={{ type: "tween", duration: 0.05 }}
                >
                  <svg width="14" height="18" viewBox="0 0 16 20" fill="none" className="drop-shadow-md -translate-x-[1px] -translate-y-[1px]">
                    <path d="M1 1L1 14.5L4.5 11L8.5 18L11 17L7 10L12 10L1 1Z" fill="rgba(128,128,128,0.7)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
                  </svg>
                </motion.div>

                {/* Click ripple */}
                <AnimatePresence>
                  {clickRipple && (
                    <motion.div
                      key={clickRipple.id}
                      initial={{ scale: 0, opacity: 0.5 }}
                      animate={{ scale: 3, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="absolute w-3 h-3 rounded-full"
                      style={{
                        left: `${clickRipple.x}%`,
                        top: `${clickRipple.y}%`,
                        transform: "translate(-50%, -50%)",
                        border: "1px solid rgba(128,128,128,0.2)",
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Blinking cursor in code */}
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 2, height: 11, backgroundColor: "rgba(128,128,128,0.2)", left: 14 }}
                  animate={{ opacity: [0.1, 0.3, 0.1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          </div>

          {/* Stand */}
          <div className="flex flex-col items-center">
            <div className="w-[3px] h-7 rounded-full" style={{ background: "rgba(128,128,128,0.1)" }} />
            <div className="w-16 h-[3px] rounded-full" style={{ background: "rgba(128,128,128,0.1)" }} />
          </div>

          {/* ── Keyboard ── */}
          <motion.div
            className="mt-4 ml-8"
            key={isTyping ? `kb-typing` : `kb-idle`}
            initial={{ y: 0 }}
            animate={isTyping ? { y: [0, -2, 0, -1, 0] } : { y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div
              className="w-[320px] h-[90px] rounded-xl"
              style={{
                border: "1px solid rgba(128,128,128,0.12)",
                background: "linear-gradient(180deg, rgba(128,128,128,0.06) 0%, rgba(128,128,128,0.02) 100%)",
              }}
            >
              <div className="p-2.5 space-y-[5px]">
                {[
                  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                  [1.4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6],
                  [1.7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.3],
                  [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
                ].map((row, ri) => {
                  const activeKeysForStep = TYPING_KEYS[typingStep] || TYPING_KEYS[0]
                  return (
                    <div key={ri} className="flex gap-[3px]">
                      {row.map((w, ki) => {
                        const isActive = isTyping && activeKeysForStep.some(([r, k]) => r === ri && k === ki)
                        return (
                          <motion.div
                            key={`${ki}-${isActive ? "on" : "off"}`}
                            className="h-[14px] rounded-[3px]"
                            style={{
                              flex: w,
                              background: "rgba(128,128,128,0.08)",
                            }}
                            animate={isActive ? {
                              backgroundColor: [
                                "rgba(128,128,128,0.08)",
                                "rgba(128,128,128,0.28)",
                                "rgba(128,128,128,0.08)",
                              ],
                              y: [0, -1.5, 0],
                            } : {
                              backgroundColor: "rgba(128,128,128,0.08)",
                            }}
                            transition={isActive ? {
                              duration: 0.25,
                              delay: activeKeysForStep.findIndex(([r, k]) => r === ri && k === ki) * 0.12,
                              ease: "easeOut",
                            } : {}}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>

          {/* ── Mouse ── */}
          <div className="absolute" style={{ right: -30, bottom: 20 }}>
            <motion.div
              animate={{ y: [0, -3, 0], x: [0, 2, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div
                key={clickRipple?.id ?? "idle"}
                initial={{ scale: 1 }}
                animate={clickRipple ? { scale: [1, 0.92, 1] } : { scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {/* Mouse body */}
                <div
                  className="w-[40px] h-[60px] rounded-[20px] relative"
                  style={{
                    border: "1px solid rgba(128,128,128,0.15)",
                    background: "linear-gradient(180deg, rgba(128,128,128,0.08) 0%, rgba(128,128,128,0.03) 100%)",
                  }}
                >
                  {/* Left click flash */}
                  <AnimatePresence>
                    {clickRipple && (
                      <motion.div
                        key={clickRipple.id}
                        className="absolute top-0 left-0 w-1/2 h-[28px] rounded-tl-[20px]"
                        initial={{ backgroundColor: "rgba(128,128,128,0)" }}
                        animate={{ backgroundColor: ["rgba(128,128,128,0)", "rgba(128,128,128,0.2)", "rgba(128,128,128,0)"] }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    )}
                  </AnimatePresence>
                  {/* Scroll wheel */}
                  <div className="flex justify-center pt-3">
                    <motion.div
                      className="w-[4px] h-[10px] rounded-full"
                      style={{ background: "rgba(128,128,128,0.15)" }}
                      animate={currentAction?.type === "scroll"
                        ? { backgroundColor: ["rgba(128,128,128,0.15)", "rgba(128,128,128,0.3)", "rgba(128,128,128,0.15)"] }
                        : {}
                      }
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                    />
                  </div>
                  {/* Divider */}
                  <div className="mt-1.5 mx-2 h-[1px]" style={{ background: "rgba(128,128,128,0.08)" }} />
                </div>
              </motion.div>

              {/* Click ripple on mouse */}
              <AnimatePresence>
                {clickRipple && (
                  <motion.div
                    key={`mr-${clickRipple.id}`}
                    className="absolute top-[12px] left-[8px] w-[10px] h-[10px] rounded-full"
                    style={{ border: "1px solid rgba(128,128,128,0.2)" }}
                    initial={{ scale: 0.5, opacity: 0.4 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* ── Status pill ── */}
          <div className="mt-3 flex justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={actionLabel}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full"
                style={{
                  background: "rgba(128,128,128,0.04)",
                  border: "0.5px solid rgba(128,128,128,0.08)",
                }}
              >
                <span className="relative flex h-[5px] w-[5px]">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "rgba(39,201,63,0.5)" }} />
                  <span className="relative inline-flex h-[5px] w-[5px] rounded-full" style={{ background: "rgba(39,201,63,0.6)" }} />
                </span>
                <span className="text-[7px] font-medium" style={{ color: "rgba(128,128,128,0.35)" }}>
                  {actionLabel}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Ambient glow */}
      <div
        className="absolute right-[0%] top-1/2 -translate-y-1/2 w-[40%] h-[50%] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, currentColor, transparent 70%)", opacity: 0.03 }}
      />
    </div>
  )
}
