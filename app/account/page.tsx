"use client"

import { LayoutApp } from "@/app/components/layout/layout-app"
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
  ArrowLeft,
  MessageSquare,
  Info,
  Share2,
  Mail,
  Loader2,
  ChevronRight,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

import { CombinedAccount } from "@/app/components/layout/settings/general/combined-account"
import { PrivacySection } from "@/app/components/layout/settings/general/privacy-section"
import { BillingSection } from "@/app/components/layout/settings/billing/billing-section"
import { FeedbackForm } from "@/components/common/feedback-form"
import { AppInfoContent } from "@/app/components/layout/app-info/app-info-content"
import { useUser } from "@/lib/user-store/provider"
import XIcon from "@/components/icons/x"
import { GithubLogoIcon } from "@phosphor-icons/react"

type SectionType =
  | "account"
  | "billing"
  | "privacy"
  | "notifications"
  | "appearance"
  | "api-keys"
  | "data"
  | "feedback"
  | "about"
  | "social"

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
  section: typeof sections[number]
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
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors duration-100",
        isActive
          ? "text-foreground font-semibold"
          : "text-muted-foreground/55 hover:text-foreground/80",
        isDisabled && "opacity-30 cursor-not-allowed"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="text-[13px] font-medium leading-none">{section.label}</span>
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
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-foreground/[0.04] blur-xl scale-150" />
        <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/[0.05] ring-1 ring-foreground/[0.08]">
          <Icon className="h-5 w-5 text-muted-foreground/40" />
        </div>
      </div>
      <p className="text-sm font-medium text-foreground/60 mb-1">{label}</p>
      <p className="text-xs text-muted-foreground/40 max-w-[200px] leading-relaxed">
        This section is being built and will be available soon
      </p>
    </div>
  )
}

function AccountContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading } = useUser()
  const sectionParam = searchParams.get("section") as SectionType | null
  const [activeSection, setActiveSection] = useState<SectionType>(sectionParam || "account")
  const [mobileView, setMobileView] = useState<"menu" | "content">(sectionParam ? "content" : "menu")

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth?redirectTo=/account")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (sectionParam && sections.some((s) => s.id === sectionParam)) {
      setActiveSection(sectionParam)
      setMobileView("content")
    }
  }, [sectionParam])

  const handleSectionChange = (sectionId: SectionType) => {
    setActiveSection(sectionId)
    window.history.pushState(null, "", `/account?section=${sectionId}`)
  }

  const activeConfig = sections.find((s) => s.id === activeSection)
  const ActiveComponent = activeConfig?.component

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
      </div>
    )
  }

  if (!user) return null

  const userInitial = user?.display_name?.charAt(0)?.toUpperCase() ?? "?"

  // ─── Shared section content renderer ────────────────────────────────────────
  function renderSectionContent(padded = false) {
    const cls = padded ? "p-6" : ""
    if (activeConfig?.component === "feedback") {
      return <FeedbackForm authUserId={user?.id} onClose={() => {}} />
    }
    if (activeConfig?.component === "about") {
      return (
        <div className={cls}>
          <AppInfoContent />
        </div>
      )
    }
    if (activeConfig?.component === "social") {
      return (
        <div className={padded ? "p-6 space-y-2" : "space-y-2"}>
          {[
            { href: "https://x.com/llmhub_dev", icon: XIcon, label: "Follow us on X", sub: "@llmhub_dev", external: true },
            { href: "https://github.com/coasty-ai", icon: GithubLogoIcon, label: "Star us on GitHub", sub: "coasty-ai", external: true },
            { href: "mailto:founders@coasty.ai", icon: Mail, label: "Contact Us", sub: "founders@coasty.ai", external: false },
          ].map(({ href, icon: Icon, label, sub, external }) => (
            <a
              key={href}
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-foreground/[0.04] transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/[0.06] shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{label}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
            </a>
          ))}
        </div>
      )
    }
    if (typeof ActiveComponent === "function") {
      return (
        <div className={cls}>
          <ActiveComponent />
        </div>
      )
    }
    return <ComingSoonPlaceholder icon={activeConfig!.icon} label={activeConfig!.label} />
  }

  return (
    <div className="w-full h-full overflow-hidden flex flex-col">

      {/* ─── Mobile ─────────────────────────────────────────────────────── */}
      <div className="lg:hidden flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          {mobileView === "menu" ? (
            <div className="space-y-5">
              <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
              {navGroups.map((group) => {
                const groupSections = sections.filter((s) => group.ids.includes(s.id))
                return (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground/50 mb-1.5 px-1">
                      {group.label}
                    </p>
                    <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden">
                      {groupSections.map((section) => {
                        const Icon = section.icon
                        const isDisabled = !section.component
                        return (
                          <button
                            key={section.id}
                            onClick={() => {
                              if (!isDisabled) {
                                setActiveSection(section.id)
                                setMobileView("content")
                                window.history.pushState(null, "", `/account?section=${section.id}`)
                              }
                            }}
                            disabled={isDisabled}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3 text-left bg-card transition-colors hover:bg-muted/40",
                              isDisabled && "opacity-40 cursor-not-allowed"
                            )}
                          >
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/[0.05] shrink-0">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium leading-tight">{section.label}</div>
                              <div className="text-[11px] text-muted-foreground truncate mt-0.5">{section.description}</div>
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
            <div>
              <button
                onClick={() => {
                  setMobileView("menu")
                  window.history.pushState(null, "", "/account")
                }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground mb-5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Settings
              </button>
              <h1 className="text-lg font-semibold tracking-tight mb-0.5">{activeConfig?.label}</h1>
              <p className="text-xs text-muted-foreground mb-5">{activeConfig?.description}</p>
              <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
                {renderSectionContent(true)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Desktop ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 min-h-0">
        <aside className="w-[196px] flex-shrink-0 flex flex-col overflow-y-auto">
          {/* User profile */}
          <div className="px-3 pt-6 pb-4">
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage src={user?.profile_image ?? ""} className="object-cover" />
                <AvatarFallback className="text-[10px] font-semibold">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium leading-tight truncate">{user?.display_name}</p>
                <p className="text-[10px] text-muted-foreground/50 leading-tight truncate mt-0.5">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div className="flex-1 px-3 pb-6 space-y-6">
            {navGroups.map((group) => {
              const groupSections = sections.filter((s) => group.ids.includes(s.id))
              return (
                <div key={group.label}>
                  <p className="text-[9px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/35 px-2.5 mb-2">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {groupSections.map((section) => (
                      <SidebarNavItem
                        key={section.id}
                        section={section}
                        isActive={activeSection === section.id}
                        onClick={() => handleSectionChange(section.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        {/* Content area */}
        <main className="flex-1 min-w-0 overflow-y-auto px-7 py-6">
          <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground/35 mb-5">
            {activeConfig?.label}
          </p>
          {activeConfig?.component === "feedback" || activeConfig?.component === "about" ? (
            <div className="rounded-xl bg-muted/20 overflow-hidden">
              {renderSectionContent(true)}
            </div>
          ) : activeConfig?.component === "social" ? (
            <div className="space-y-1.5">{renderSectionContent(false)}</div>
          ) : typeof ActiveComponent === "function" ? (
            <ActiveComponent />
          ) : (
            <ComingSoonPlaceholder icon={activeConfig!.icon} label={activeConfig!.label} />
          )}
        </main>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <LayoutApp>
      <AccountContent />
    </LayoutApp>
  )
}
