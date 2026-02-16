"use client"

import { LayoutApp } from "@/app/components/layout/layout-app"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
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
  GitBranch
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import Link from "next/link"

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
type SectionType = "account" | "billing" | "privacy" | "notifications" | "appearance" | "api-keys" | "data" | "feedback" | "about" | "changelog" | "social"

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
    description: "About LLMHub",
    component: "about", // Special handling
  },
  {
    id: "changelog" as SectionType,
    label: "Changelog",
    icon: GitBranch,
    description: "See what&apos;s new in LLMHub",
    component: "changelog", // Special handling
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
  const [hasScrolled, setHasScrolled] = useState(false)

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
        {/* Mobile and Tablet Navigation - Horizontal scrollable tabs */}
        <div className="lg:hidden sticky top-0 z-40 bg-background border-b -mx-4 px-4 sm:-mx-6 sm:px-6">
          <div className="relative">
            <div className="py-3">
              {/* Fade indicators for scroll - enhanced visibility */}
              <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background via-background/90 to-transparent pointer-events-none z-10" />
              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background via-background/90 to-transparent pointer-events-none z-10" />

              <ScrollArea
                className="w-full"
                onScroll={() => !hasScrolled && setHasScrolled(true)}
              >
                <div className="flex space-x-1 pb-2">
                  {sections.filter(s => s.component).map((section, index) => {
                    const Icon = section.icon
                    const isActive = activeSection === section.id

                    return (
                      <button
                        key={section.id}
                        onClick={() => handleSectionChange(section.id)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{section.label}</span>
                      </button>
                    )
                  })}
                </div>
                <ScrollBar orientation="horizontal" className="h-1.5 opacity-60" />
              </ScrollArea>
            </div>

            {/* Swipe hint below tabs - only shows initially */}
            {!hasScrolled && (
              <div className="pb-2 text-center">
                <span className="text-xs text-muted-foreground italic">↔️ Swipe for more options</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-8 py-6 lg:py-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-8 space-y-6">
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

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{activeConfig?.label}</h1>
              <p className="text-muted-foreground mt-1">{activeConfig?.description}</p>
            </div>

            <div className="bg-card rounded-lg border shadow-sm">
              {/* Handle special sections */}
              {activeConfig?.component === "feedback" ? (
                <FeedbackForm authUserId={user?.id} onClose={() => {}} />
              ) : activeConfig?.component === "about" ? (
                <div className="space-y-6">
                  <AppInfoContent />
                </div>
              ) : activeConfig?.component === "changelog" ? (
                <div className="space-y-6">
                  <div className="p-6">
                    <div className="text-center space-y-4">
                      <GitBranch className="h-12 w-12 text-primary mx-auto" />
                      <h3 className="text-lg font-semibold">View Full Changelog</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Track our journey of continuous improvement. See all the new features, enhancements, and bug fixes we&apos;ve released.
                      </p>
                      <div className="flex gap-4 justify-center pt-4">
                        <Button asChild>
                          <Link href="/changelog" target="_blank">
                            <GitBranch className="mr-2 h-4 w-4" />
                            View Changelog
                          </Link>
                        </Button>
                        <Button variant="outline" asChild>
                          <Link href="https://github.com/LLmHub-dev" target="_blank">
                            View on GitHub
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeConfig?.component === "social" ? (
                <div className="space-y-8">
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
                      href="https://github.com/LLmHub-dev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background group-hover:bg-accent transition-colors">
                        <GithubLogoIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">Star us on GitHub</div>
                        <div className="text-xs text-muted-foreground">LLmHub-dev</div>
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
                  
                  <div className="p-6 rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 border border-border/30">
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