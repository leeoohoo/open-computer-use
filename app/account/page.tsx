"use client"

import { LayoutApp } from "@/app/components/layout/layout-app"
import { cn } from "@/lib/utils"
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
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

// Import settings components
import { CombinedAccount } from "@/app/components/layout/settings/general/combined-account"
import { PrivacySection } from "@/app/components/layout/settings/general/privacy-section"
import { BillingSection } from "@/app/components/layout/settings/billing/billing-section"
import { FeedbackForm } from "@/components/common/feedback-form"
import { AppInfoContent } from "@/app/components/layout/app-info/app-info-content"
import { useUser } from "@/lib/user-store/provider"
import XIcon from "@/components/icons/x"
import { GithubLogoIcon } from "@phosphor-icons/react"

// Define section types
type SectionType = "account" | "billing" | "privacy" | "notifications" | "appearance" | "api-keys" | "data" | "feedback" | "about" | "social"

// Define sections with their components
const sections = [
  {
    id: "account" as SectionType,
    label: "Account",
    icon: User,
    description: "Manage your profile and account settings",
    component: CombinedAccount,
  },
  {
    id: "billing" as SectionType,
    label: "Billing & Credits",
    icon: CreditCard,
    description: "Manage billing and credits",
    component: BillingSection,
  },
  {
    id: "privacy" as SectionType,
    label: "Privacy & Security",
    icon: Shield,
    description: "Privacy and security settings",
    component: PrivacySection,
  },
  {
    id: "notifications" as SectionType,
    label: "Notifications",
    icon: Bell,
    description: "Notification preferences",
    component: null, // Placeholder for future implementation
  },
  {
    id: "appearance" as SectionType,
    label: "Appearance",
    icon: Palette,
    description: "Customize the app appearance",
    component: null, // Placeholder for future implementation
  },
  {
    id: "api-keys" as SectionType,
    label: "API Keys",
    icon: Key,
    description: "Manage your API keys",
    component: null, // Placeholder for future implementation
  },
  {
    id: "data" as SectionType,
    label: "Data & Export",
    icon: Database,
    description: "Export and manage your data",
    component: null, // Placeholder for future implementation
  },
  {
    id: "feedback" as SectionType,
    label: "Feedback",
    icon: MessageSquare,
    description: "Send us your feedback",
    component: "feedback", // Special handling
  },
  {
    id: "about" as SectionType,
    label: "About",
    icon: Info,
    description: "About Coasty",
    component: "about", // Special handling
  },
  {
    id: "social" as SectionType,
    label: "Connect",
    icon: Share2,
    description: "Follow us on social media",
    component: "social", // Special handling
  },
]

function AccountContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading } = useUser()
  const sectionParam = searchParams.get("section") as SectionType | null
  const [activeSection, setActiveSection] = useState<SectionType>(sectionParam || "account")
  const [mobileView, setMobileView] = useState<"menu" | "content">(sectionParam ? "content" : "menu")

  // Check authentication on client side as well
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth?redirectTo=/account')
    }
  }, [user, isLoading, router])

  // Update active section when URL changes
  useEffect(() => {
    if (sectionParam && sections.some(s => s.id === sectionParam)) {
      setActiveSection(sectionParam)
      setMobileView("content")
    }
  }, [sectionParam])

  // Handle section change
  const handleSectionChange = (sectionId: SectionType) => {
    setActiveSection(sectionId)
    // Update URL without navigation
    window.history.pushState(null, "", `/account?section=${sectionId}`)
  }

  // Get the active section component
  const activeConfig = sections.find(s => s.id === activeSection)
  const ActiveComponent = activeConfig?.component

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    )
  }

  // Don't render content if not authenticated
  if (!user) {
    return null
  }

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Mobile Navigation - Section menu or back button + content */}
        <div className="lg:hidden">
          <div className="py-4">
            {mobileView === "menu" ? (
              <>
                {/* Mobile section menu */}
                <h1 className="text-xl font-semibold tracking-tight mb-4 px-1">Settings</h1>

                {/* Account sections */}
                <div className="mb-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">Account</h3>
                  <div className="rounded-lg border bg-card divide-y">
                    {sections.slice(0, 3).map((section) => {
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
                            "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                            isDisabled && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{section.label}</div>
                            <div className="text-xs text-muted-foreground truncate">{section.description}</div>
                          </div>
                          {isDisabled ? (
                            <span className="text-xs text-muted-foreground flex-shrink-0">Soon</span>
                          ) : (
                            <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Support sections */}
                <div className="mb-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">Support</h3>
                  <div className="rounded-lg border bg-card divide-y">
                    {sections.slice(7).map((section) => {
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
                            "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                            isDisabled && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{section.label}</div>
                            <div className="text-xs text-muted-foreground truncate">{section.description}</div>
                          </div>
                          <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Preferences sections */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">Preferences</h3>
                  <div className="rounded-lg border bg-card divide-y">
                    {sections.slice(3, 7).map((section) => {
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
                            "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                            isDisabled && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{section.label}</div>
                            <div className="text-xs text-muted-foreground truncate">{section.description}</div>
                          </div>
                          {isDisabled ? (
                            <span className="text-xs text-muted-foreground flex-shrink-0">Soon</span>
                          ) : (
                            <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Back button + section content */}
                <button
                  onClick={() => {
                    setMobileView("menu")
                    window.history.pushState(null, "", "/account")
                  }}
                  className="flex items-center gap-2 text-sm text-muted-foreground mb-4"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Settings</span>
                </button>
                <h1 className="text-xl font-semibold tracking-tight mb-1">{activeConfig?.label}</h1>
                <p className="text-sm text-muted-foreground mb-4">{activeConfig?.description}</p>

                {/* Mobile content */}
                <div className="rounded-lg border bg-card">
                  {activeConfig?.component === "feedback" ? (
                    <FeedbackForm authUserId={user?.id} onClose={() => {}} />
                  ) : activeConfig?.component === "about" ? (
                    <div className="space-y-6">
                      <AppInfoContent />
                    </div>
                  ) : activeConfig?.component === "social" ? (
                    <div className="divide-y">
                      <a
                        href="https://x.com/llmhub_dev"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <XIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">Follow us on X</div>
                          <div className="text-xs text-muted-foreground">@llmhub_dev</div>
                        </div>
                        <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                      </a>
                      <a
                        href="https://github.com/coasty-ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <GithubLogoIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">Star us on GitHub</div>
                          <div className="text-xs text-muted-foreground">coasty-ai</div>
                        </div>
                        <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                      </a>
                      <a
                        href="mailto:founders@coasty.ai"
                        className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <Mail className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">Contact Us</div>
                          <div className="text-xs text-muted-foreground">founders@coasty.ai</div>
                        </div>
                        <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                      </a>
                    </div>
                  ) : ActiveComponent ? (
                    <div className="p-4">
                      <ActiveComponent />
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
                        {activeConfig && <activeConfig.icon className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <h3 className="text-base font-medium mb-1">Coming Soon</h3>
                      <p className="text-sm text-muted-foreground">
                        This section will be available soon.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="hidden lg:flex gap-8 py-8">
          {/* Desktop Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <div className="sticky top-4 space-y-6">
              {/* Account Section */}
              <div className="space-y-1">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">Account</h3>
                <div className="space-y-1">
                  {sections.slice(0, 3).map((section) => {
                    const Icon = section.icon
                    const isActive = activeSection === section.id
                    const isDisabled = !section.component

                    return (
                      <button
                        key={section.id}
                        onClick={() => !isDisabled && handleSectionChange(section.id)}
                        disabled={isDisabled}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                          isActive
                            ? "bg-accent text-accent-foreground shadow-sm"
                            : "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                          isDisabled && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm font-medium">{section.label}</span>
                        {isDisabled && (
                          <span className="ml-auto text-xs text-muted-foreground">Soon</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Support Section */}
              <div className="space-y-1">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">Support</h3>
                <div className="space-y-1">
                  {sections.slice(7).map((section) => {
                    const Icon = section.icon
                    const isActive = activeSection === section.id
                    const isDisabled = !section.component

                    return (
                      <button
                        key={section.id}
                        onClick={() => !isDisabled && handleSectionChange(section.id)}
                        disabled={isDisabled}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                          isActive
                            ? "bg-accent text-accent-foreground shadow-sm"
                            : "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                          isDisabled && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm font-medium">{section.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Preferences Section */}
              <div className="space-y-1">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">Preferences</h3>
                <div className="space-y-1">
                  {sections.slice(3, 7).map((section) => {
                    const Icon = section.icon
                    const isActive = activeSection === section.id
                    const isDisabled = !section.component

                    return (
                      <button
                        key={section.id}
                        onClick={() => !isDisabled && handleSectionChange(section.id)}
                        disabled={isDisabled}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                          isActive
                            ? "bg-accent text-accent-foreground shadow-sm"
                            : "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                          isDisabled && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm font-medium">{section.label}</span>
                        {isDisabled && (
                          <span className="ml-auto text-xs text-muted-foreground">Soon</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </aside>

          {/* Desktop Main Content Area */}
          <main className="flex-1 min-w-0">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{activeConfig?.label}</h1>
              <p className="text-muted-foreground mt-1">{activeConfig?.description}</p>
            </div>

            <div className="bg-card rounded-lg border shadow-sm">
              {activeConfig?.component === "feedback" ? (
                <FeedbackForm authUserId={user?.id} onClose={() => {}} />
              ) : activeConfig?.component === "about" ? (
                <div className="p-6">
                  <AppInfoContent />
                </div>
              ) : activeConfig?.component === "social" ? (
                <div className="p-6 space-y-6">
                  <div className="grid gap-4">
                    <a
                      href="https://x.com/llmhub_dev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background group-hover:bg-accent transition-colors">
                        <XIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">Follow us on X</div>
                        <div className="text-xs text-muted-foreground">@llmhub_dev</div>
                      </div>
                      <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>

                    <a
                      href="https://github.com/coasty-ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background group-hover:bg-accent transition-colors">
                        <GithubLogoIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">Star us on GitHub</div>
                        <div className="text-xs text-muted-foreground">coasty-ai</div>
                      </div>
                      <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>

                    <a
                      href="mailto:founders@coasty.ai"
                      className="group flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background group-hover:bg-accent transition-colors">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">Contact Us</div>
                        <div className="text-xs text-muted-foreground">founders@coasty.ai</div>
                      </div>
                      <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </div>

                  <div className="p-5 rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 border border-border/30">
                    <h4 className="font-medium text-sm mb-2">Join the Community</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Connect with other users, share feedback, and stay updated with the latest features and improvements.
                    </p>
                  </div>
                </div>
              ) : ActiveComponent ? (
                <div className="p-6">
                  <ActiveComponent />
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                    {activeConfig && <activeConfig.icon className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <h3 className="text-lg font-medium mb-2">Coming Soon</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    This section is under development and will be available soon.
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
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