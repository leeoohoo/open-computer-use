"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Video, Play } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { MockSwarmTree } from "./swarm-demo"

const VIDEO_ID = "IBydvwkJcCQ"

export function HeroUseCaseCarousel({ isMobile }: { isMobile: boolean }) {
  const [playing, setPlaying] = useState(false)

  const handlePlay = useCallback(() => {
    setPlaying(true)
  }, [])

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* ─── Hero text ─── */}
      <div className={cn("relative z-10 text-center", isMobile ? "mb-10" : "mb-14")}>
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-background/60 backdrop-blur-sm px-4 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-emerald-400" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              #1 State of the Art · <span className="text-foreground font-semibold">82% OSWorld</span>
            </span>
          </div>
        </div>

        {/* Headline */}
        <h1 className={cn(
          "font-bold tracking-tight",
          isMobile ? "text-4xl leading-[1.2]" : "text-5xl sm:text-6xl lg:text-7xl leading-[1.1]"
        )}>
          <span className="text-foreground">Autopilot operations</span>
          <br />
          <span className="text-muted-foreground/40">with </span>
          <span className="text-emerald-500 dark:text-emerald-400">computer-using agent swarms.</span>
        </h1>

        {/* Sub */}
        <p className={cn(
          "text-muted-foreground/50 mt-5 mx-auto",
          isMobile ? "text-sm max-w-xs" : "text-lg max-w-md"
        )}>
          The most advanced computer-using agent swarm technology. No&nbsp;integrations. No&nbsp;setup. It just works.
        </p>

        {/* CTAs */}
        <div className={cn(
          "flex items-center justify-center gap-3",
          isMobile ? "mt-8 flex-col" : "mt-10"
        )}>
          <Link href="/auth">
            <motion.button
              className={cn(
                "inline-flex items-center gap-2.5 rounded-full font-semibold cursor-pointer bg-foreground text-background",
                isMobile ? "px-6 py-3 text-sm" : "px-8 py-3.5 text-[15px]"
              )}
              style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.15)" }}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              Try Coasty
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </Link>
          <a href="https://cal.com/coasty/15min" target="_blank" rel="noopener noreferrer">
            <motion.button
              className={cn(
                "inline-flex items-center gap-2.5 rounded-full font-semibold cursor-pointer border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors",
                isMobile ? "px-6 py-3 text-sm" : "px-8 py-3.5 text-[15px]"
              )}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <Video className="h-4 w-4" />
              Talk to Cofounders
            </motion.button>
          </a>
        </div>
      </div>

      {/* ─── Swarm demo / Video ─── */}
      <div className="relative z-10">
        {/* Screen glow */}
        <div
          className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[80%] h-[40%] rounded-full blur-[80px] opacity-[0.07] dark:opacity-[0.12] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, currentColor 0%, transparent 70%)" }}
        />

        {/* Browser chrome */}
        <div className={cn(
          "relative rounded-xl sm:rounded-2xl overflow-hidden",
          "border border-border/40 dark:border-border/30",
          "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08),0_12px_48px_-8px_rgba(0,0,0,0.1)]",
          "dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),0_12px_48px_-8px_rgba(0,0,0,0.4)]",
          "ring-1 ring-white/[0.05] dark:ring-white/[0.03]"
        )}>
          <AnimatePresence mode="wait">
            {playing ? (
              <motion.div
                key="video"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative w-full bg-neutral-950"
                style={{ paddingTop: "56.25%" }}
              >
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0&modestbranding=1&showinfo=0&autoplay=1`}
                  title="Coasty Agent Swarm Demo"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  style={{ border: "none" }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="demo"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                {/* Interactive swarm tree graph */}
                <div className="bg-background">
                  <MockSwarmTree />
                </div>

                {/* Clickable overlay with play button — sits above everything */}
                <div
                  className="absolute inset-0 z-[20] flex flex-col items-center justify-center cursor-pointer group"
                  onClick={handlePlay}
                >
                  {/* Scrim that darkens on hover */}
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-black/20 dark:bg-black/10 dark:group-hover:bg-black/30 transition-colors duration-500 rounded-xl sm:rounded-2xl" />

                  {/* Play button */}
                  <motion.div
                    className={cn(
                      "relative z-[1] flex items-center justify-center rounded-full",
                      "bg-foreground shadow-2xl",
                      "group-hover:scale-105 transition-transform duration-300",
                      isMobile ? "h-14 w-14" : "h-[72px] w-[72px]"
                    )}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {/* Outer glow ring */}
                    <span className={cn(
                      "absolute rounded-full border-2 border-foreground/20 group-hover:border-foreground/40 transition-all duration-500",
                      isMobile ? "-inset-2" : "-inset-2.5"
                    )} />
                    {/* Soft pulse */}
                    <span className={cn(
                      "absolute rounded-full bg-foreground/10 animate-[ping_3s_ease-in-out_infinite]",
                      isMobile ? "-inset-3" : "-inset-4"
                    )} />
                    <Play className={cn(
                      "text-background fill-background ml-[2px]",
                      isMobile ? "h-5 w-5" : "h-6 w-6"
                    )} />
                  </motion.div>

                  {/* Label pill below */}
                  <motion.div
                    className={cn(
                      "relative z-[1] mt-3 inline-flex items-center gap-2 rounded-full",
                      "bg-foreground/90 backdrop-blur-sm px-4 py-1.5",
                      "group-hover:bg-foreground transition-colors duration-300"
                    )}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.3, duration: 0.4 }}
                  >
                    <span className={cn(
                      "font-semibold text-background",
                      isMobile ? "text-[10px]" : "text-xs"
                    )}>
                      Watch Demo
                    </span>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
