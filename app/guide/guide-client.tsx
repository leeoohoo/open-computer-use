"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { LandingHeader } from "@/app/components/landing/landing-header"
import { LandingFooter } from "@/app/components/landing/landing-footer"
import { LayoutApp } from "@/app/components/layout/layout-app"
import { motion, AnimatePresence } from "framer-motion"
import {
  BookOpen,
  RocketLaunch,
  ChatText,
  Desktop,
  Key,
  Lightning,
  Monitor,
  CreditCard,
  ArrowRight,
  VideoCamera,
} from "@phosphor-icons/react"

import { OverviewTab } from "./tabs/overview"
import { GettingStartedTab } from "./tabs/getting-started"
import { ChatTasksTab } from "./tabs/chat-tasks"
import { MachinesTab } from "./tabs/machines"
import { CredentialsTab } from "./tabs/credentials"
import { SwarmModeTab } from "./tabs/swarm-mode"
import { DesktopAppTab } from "./tabs/desktop-app"
import { BillingTab } from "./tabs/billing"

/* ─── tab config ─── */

const tabs = [
  { id: "overview", label: "Overview", shortLabel: "Overview", icon: BookOpen },
  { id: "getting-started", label: "Getting Started", shortLabel: "Start", icon: RocketLaunch },
  { id: "chat-tasks", label: "Chat & Tasks", shortLabel: "Chat", icon: ChatText },
  { id: "machines", label: "Machines", shortLabel: "Machines", icon: Desktop },
  { id: "credentials", label: "Credentials", shortLabel: "Creds", icon: Key },
  { id: "swarm-mode", label: "Swarm Mode", shortLabel: "Swarm", icon: Lightning },
  { id: "desktop-app", label: "Desktop App", shortLabel: "Desktop", icon: Monitor },
  { id: "billing", label: "Billing & Credits", shortLabel: "Billing", icon: CreditCard },
] as const

type TabId = (typeof tabs)[number]["id"]

/* ─── animation ─── */

const tabContent = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
}

/* ─── tab content renderer ─── */

function TabContent({ activeTab, inApp }: { activeTab: TabId; inApp: boolean }) {
  switch (activeTab) {
    case "overview":
      return <OverviewTab inApp={inApp} />
    case "getting-started":
      return <GettingStartedTab inApp={inApp} />
    case "chat-tasks":
      return <ChatTasksTab inApp={inApp} />
    case "machines":
      return <MachinesTab inApp={inApp} />
    case "credentials":
      return <CredentialsTab inApp={inApp} />
    case "swarm-mode":
      return <SwarmModeTab inApp={inApp} />
    case "desktop-app":
      return <DesktopAppTab inApp={inApp} />
    case "billing":
      return <BillingTab inApp={inApp} />
  }
}

/* ─── tab navigation ─── */

function TabNav({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (id: TabId) => void }) {
  return (
    <div className="relative">
      {/* Scroll fade indicators */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 sm:hidden" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 sm:hidden" />

      <nav
        className="flex gap-1 overflow-x-auto scrollbar-invisible pb-1 -mx-1 px-1"
        role="tablist"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-200 shrink-0",
                isActive
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.04]"
              )}
            >
              <Icon
                size={15}
                weight={isActive ? "fill" : "duotone"}
                className="shrink-0"
              />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

/* ─── guide content ─── */

function GuideContent({ inApp }: { inApp: boolean }) {
  const [activeTab, setActiveTab] = useState<TabId>("overview")

  if (inApp) {
    return (
      <div className="h-full overflow-y-auto scrollbar-invisible relative">
        {/* Ambient background — matches machines/history/secrets pages */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div
            className="absolute -top-[30%] -right-[15%] h-[60%] w-[50%] rounded-full opacity-[0.02] dark:opacity-[0.04] blur-[120px]"
            style={{ background: "radial-gradient(circle, currentColor, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-[20%] -left-[10%] h-[50%] w-[40%] rounded-full opacity-[0.015] dark:opacity-[0.035] blur-[100px]"
            style={{ background: "radial-gradient(circle, currentColor, transparent 70%)" }}
          />
          <div
            className="absolute inset-0 opacity-[0.012] dark:opacity-[0.025]"
            style={{
              backgroundImage: "linear-gradient(rgba(128,128,128,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.3) 1px, transparent 1px)",
              backgroundSize: "80px 80px",
            }}
          />
        </div>

        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6 relative z-10">
          {/* Header — matches machines/history/secrets style */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Guide</h1>
              <p className="text-muted-foreground text-sm mt-1.5">
                From first setup to advanced features — learn how to get the most out of Coasty
              </p>
            </div>
          </motion.div>

          {/* Tab navigation */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] as const }}
            className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-4 pt-2 bg-background/80 backdrop-blur-xl border-b border-border/30"
          >
            <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
          </motion.div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={tabContent}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <TabContent activeTab={activeTab} inApp={inApp} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    )
  }

  // Public / landing page version
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <div className="pt-28 sm:pt-32 pb-24">
        <div className="mx-auto px-5 sm:px-6 max-w-5xl">
          {/* ── header ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const }}
            className="mb-8"
          >
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
              The Complete Guide
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-[1.1] tracking-tight">
              Everything you need to know about Coasty
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground/70 mt-2 max-w-2xl leading-relaxed">
              From first setup to advanced features — learn how to get the most out of your AI agent.
            </p>
            <a
              href="https://cal.com/coasty/15min"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 h-9 px-4 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground/70 hover:text-foreground hover:border-border transition-all"
            >
              <VideoCamera size={15} weight="duotone" />
              Talk to Cofounders
            </a>
          </motion.div>

          {/* ── tab navigation ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] as const }}
            className="sticky top-[56px] z-20 -mx-5 sm:-mx-6 px-5 sm:px-6 pb-4 pt-2 bg-background/80 backdrop-blur-xl border-b border-border/30"
          >
            <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
          </motion.div>

          {/* ── tab content ── */}
          <div className="mt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                variants={tabContent}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                <TabContent activeTab={activeTab} inApp={inApp} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <LandingFooter />
    </div>
  )
}

/* ─── page wrapper ─── */

export function GuideClient({ inApp }: { inApp: boolean }) {
  if (inApp) {
    return (
      <LayoutApp>
        <GuideContent inApp />
      </LayoutApp>
    )
  }

  return <GuideContent inApp={false} />
}
