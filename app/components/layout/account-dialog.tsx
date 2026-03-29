"use client"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  User,
  CreditCard,
  Shield,
  Bell,
  Palette,
  Key,
  Database,
  MessageSquare,
  Info,
  Share2,
  Mail,
  Loader2,
  ChevronRight,
  X,
} from "lucide-react"
import { useState, useEffect, useCallback, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

import { CombinedAccount } from "@/app/components/layout/settings/general/combined-account"
import { PrivacySection } from "@/app/components/layout/settings/general/privacy-section"
import { BillingSection } from "@/app/components/layout/settings/billing/billing-section"
import { FeedbackForm } from "@/components/common/feedback-form"
import { AppInfoContent } from "@/app/components/layout/app-info/app-info-content"
import { useUser } from "@/lib/user-store/provider"
import XIcon from "@/components/icons/x"
import { GithubLogoIcon } from "@phosphor-icons/react"
import { CoastyIcon } from "@/components/icons/coasty"
import { useAccountDialog, type AccountSectionType } from "@/lib/account-dialog-store"

import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"

type SectionType = AccountSectionType

const sections = [
  { id: "account" as SectionType, label: "Account", icon: User, description: "Manage your profile and account settings", component: CombinedAccount },
  { id: "billing" as SectionType, label: "Billing & Credits", icon: CreditCard, description: "Manage billing and credits", component: BillingSection },
  { id: "privacy" as SectionType, label: "Privacy & Security", icon: Shield, description: "Privacy and security settings", component: PrivacySection },
  { id: "notifications" as SectionType, label: "Notifications", icon: Bell, description: "Notification preferences", component: null },
  { id: "appearance" as SectionType, label: "Appearance", icon: Palette, description: "Customize the app appearance", component: null },
  { id: "api-keys" as SectionType, label: "API Keys", icon: Key, description: "Manage your API keys", component: null },
  { id: "data" as SectionType, label: "Data & Export", icon: Database, description: "Export and manage your data", component: null },
  { id: "feedback" as SectionType, label: "Feedback", icon: MessageSquare, description: "Send us your feedback", component: "feedback" as const },
  { id: "about" as SectionType, label: "About", icon: Info, description: "About Coasty", component: "about" as const },
  { id: "social" as SectionType, label: "Connect", icon: Share2, description: "Follow us on social media", component: "social" as const },
]

const navGroups = [
  { label: "Account", ids: ["account", "billing", "privacy"] as SectionType[] },
  { label: "Preferences", ids: ["notifications", "appearance", "api-keys", "data"] as SectionType[] },
  { label: "Support", ids: ["feedback", "about", "social"] as SectionType[] },
]

function SidebarNavItem({
  section,
  isActive,
  onClick,
}: {
  section: (typeof sections)[number]
  isActive: boolean
  onClick: () => void
}) {
  const Icon = section.icon
  const isDisabled = !section.component
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "relative w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-left transition-all duration-150",
        isActive
          ? "text-foreground bg-foreground/[0.06]"
          : "text-muted-foreground/55 hover:text-foreground/80 hover:bg-foreground/[0.03]",
        isDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive && "text-foreground/70")} />
      <span className={cn("text-[13px] leading-none", isActive ? "font-semibold" : "font-medium")}>{section.label}</span>
      {isDisabled && (
        <span className="ml-auto text-[9px] font-semibold tracking-[0.08em] uppercase text-muted-foreground/30">
          soon
        </span>
      )}
    </button>
  )
}

function ComingSoonPlaceholder({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-2xl bg-primary/[0.04] blur-xl scale-150" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40 ring-1 ring-border/20">
          <Icon className="h-6 w-6 text-muted-foreground/30" />
        </div>
      </div>
      <p className="text-sm font-semibold text-foreground/50 mb-1.5">{label}</p>
      <p className="text-xs text-muted-foreground/35 max-w-[220px] leading-relaxed">
        We&apos;re building this section. It will be available in a future update.
      </p>
      <div className="mt-4 flex items-center gap-1.5">
        <span className="h-1 w-1 rounded-full bg-primary/40 animate-pulse" />
        <span className="h-1 w-1 rounded-full bg-primary/30 animate-pulse [animation-delay:0.2s]" />
        <span className="h-1 w-1 rounded-full bg-primary/20 animate-pulse [animation-delay:0.4s]" />
      </div>
    </div>
  )
}

const validSections: SectionType[] = ["account", "billing", "privacy", "notifications", "appearance", "api-keys", "data", "feedback", "about", "social"]

export function AccountDialog() {
  const { isOpen, section, close, setSection, _syncFromUrl } = useAccountDialog()
  const { user, isLoading } = useUser()
  const [mobileView, setMobileView] = useState<"menu" | "content">("content")
  const closingRef = useRef(false)

  const activeSection = section
  const activeConfig = sections.find((s) => s.id === activeSection)
  const ActiveComponent = activeConfig?.component

  const handleSectionChange = useCallback(
    (sectionId: SectionType) => {
      setSection(sectionId)
      setMobileView("content")
    },
    [setSection]
  )

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname
      if (path === "/account") {
        // We're on /account — sync section from URL
        const params = new URLSearchParams(window.location.search)
        const sec = params.get("section") as SectionType | null
        _syncFromUrl(sec && validSections.includes(sec) ? sec : "account")
      } else if (isOpen) {
        // Navigated away from /account — close dialog without pushing URL
        closingRef.current = true
        useAccountDialog.setState({ isOpen: false, _previousPath: null })
        closingRef.current = false
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [isOpen, _syncFromUrl])

  // If the page loads on /account, open the dialog
  useEffect(() => {
    if (typeof window === "undefined") return
    const path = window.location.pathname
    if (path === "/account" && !isOpen) {
      const params = new URLSearchParams(window.location.search)
      const sec = params.get("section") as SectionType | null
      // Save the referring page as "/" since we loaded directly on /account
      useAccountDialog.setState({ _previousPath: "/" })
      _syncFromUrl(sec && validSections.includes(sec) ? sec : "account")
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset mobile view when dialog opens
  useEffect(() => {
    if (isOpen) setMobileView("content")
  }, [isOpen])

  if (!user && !isLoading) return null

  const userInitial = user?.display_name?.charAt(0)?.toUpperCase() ?? "?"

  function renderSectionContent() {
    if (activeConfig?.component === "feedback") {
      return (
        <div className="rounded-xl border border-border/30 bg-card/20 overflow-hidden">
          <FeedbackForm authUserId={user?.id} onClose={close} />
        </div>
      )
    }
    if (activeConfig?.component === "about") {
      return <AppInfoContent />
    }
    if (activeConfig?.component === "social") {
      const socialLinks = [
        { href: "https://x.com/llmhub_dev", icon: XIcon, label: "Follow us on X", sub: "@llmhub_dev", external: true, accent: "bg-foreground/[0.04]" },
        { href: "https://github.com/coasty-ai", icon: GithubLogoIcon, label: "Star us on GitHub", sub: "coasty-ai", external: true, accent: "bg-foreground/[0.04]" },
        { href: "mailto:founders@coasty.ai", icon: Mail, label: "Contact Us", sub: "founders@coasty.ai", external: false, accent: "bg-primary/[0.06]" },
      ]
      return (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/30 bg-card/20 divide-y divide-border/20 overflow-hidden">
            {socialLinks.map(({ href, icon: Icon, label, sub, external, accent }) => (
              <a
                key={href}
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="group flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${accent}`}>
                  <Icon className="h-4 w-4 text-muted-foreground/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{label}</p>
                  <p className="text-xs text-muted-foreground/40 mt-0.5">{sub}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )
    }
    if (typeof ActiveComponent === "function") {
      return <ActiveComponent />
    }
    return <ComingSoonPlaceholder icon={activeConfig!.icon} label={activeConfig!.label} />
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed top-[50%] left-[50%] z-[10001] translate-x-[-50%] translate-y-[-50%]",
            "w-[95vw] max-w-[940px] h-[85vh] max-h-[680px]",
            "bg-popover rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/50",
            "border border-border/40",
            "overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-[0.97] data-[state=open]:zoom-in-[0.97]",
            "data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]",
            "duration-200"
          )}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            document.body.style.pointerEvents = ""
          }}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Account Settings</DialogTitle>
          </VisuallyHidden.Root>

          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-foreground/20" />
            </div>
          ) : (
            <div className="flex h-full">
              {/* ─── Sidebar ─────────────────────────────────────────── */}
              <aside className="hidden md:flex w-[220px] flex-shrink-0 flex-col border-r border-border/30 bg-muted/[0.02]">
                {/* User profile */}
                <div className="px-4 pt-5 pb-4">
                  <div className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl bg-card/50 border border-border/20">
                    <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border/30">
                      <AvatarImage src={user?.profile_image || undefined} className="object-cover" />
                      <AvatarFallback className="bg-transparent">
                        <CoastyIcon className="h-4 w-4 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-tight truncate">{user?.display_name || user?.email?.split("@")[0] || "User"}</p>
                      <p className="text-[11px] text-muted-foreground/50 leading-tight truncate mt-0.5">{user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Nav groups */}
                <div className="flex-1 px-3 pb-4 space-y-5 overflow-y-auto">
                  {navGroups.map((group, gi) => {
                    const groupSections = sections.filter((s) => group.ids.includes(s.id))
                    return (
                      <motion.div
                        key={group.label}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: 0.05 + gi * 0.04, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <p className="text-[9px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/35 px-2.5 mb-1.5">
                          {group.label}
                        </p>
                        <div className="space-y-0.5">
                          {groupSections.map((s) => (
                            <SidebarNavItem
                              key={s.id}
                              section={s}
                              isActive={activeSection === s.id}
                              onClick={() => handleSectionChange(s.id)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </aside>

              {/* ─── Mobile nav (< md) ─────────────────────────────── */}
              <div className="md:hidden flex flex-col h-full w-full">
                {mobileView === "menu" ? (
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold">Settings</h2>
                      <button onClick={close} className="p-1 rounded-md hover:bg-muted/40 text-muted-foreground/60">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {navGroups.map((group) => {
                      const groupSections = sections.filter((s) => group.ids.includes(s.id))
                      return (
                        <div key={group.label}>
                          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground/50 mb-1.5 px-1">
                            {group.label}
                          </p>
                          <div className="rounded-xl border border-border/30 divide-y divide-border/20 overflow-hidden">
                            {groupSections.map((s) => {
                              const Icon = s.icon
                              const isDisabled = !s.component
                              return (
                                <button
                                  key={s.id}
                                  onClick={() => !isDisabled && handleSectionChange(s.id)}
                                  disabled={isDisabled}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 text-left bg-card/50 transition-colors hover:bg-muted/40",
                                    isDisabled && "opacity-40 cursor-not-allowed"
                                  )}
                                >
                                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 shrink-0">
                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium leading-tight">{s.label}</div>
                                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">{s.description}</div>
                                  </div>
                                  {isDisabled ? (
                                    <span className="text-[10px] text-muted-foreground/40">Soon</span>
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-popover/90 backdrop-blur-sm border-b border-border/20">
                      <button
                        onClick={() => setMobileView("menu")}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <ChevronRight className="h-3 w-3 rotate-180" />
                        Back
                      </button>
                      <span className="text-xs font-medium">{activeConfig?.label}</span>
                      <button onClick={close} className="ml-auto p-1 rounded-md hover:bg-muted/40 text-muted-foreground/60">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="p-4">
                      {renderSectionContent()}
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Content area (desktop) ──────────────────────── */}
              <div className="hidden md:flex flex-col flex-1 min-w-0 h-full">
                {/* Header bar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/20">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground/40">
                      {activeConfig?.label}
                    </p>
                    {activeConfig?.description && (
                      <p className="text-[13px] text-muted-foreground/50 mt-0.5">
                        {activeConfig.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={close}
                    className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Scrollable content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 overflow-y-auto px-6 py-5"
                  >
                    {renderSectionContent()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  )
}
