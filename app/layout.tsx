import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import "./mobile-performance.css"
import { ConditionalLayout } from "./conditional-layout"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ChatsProvider } from "@/lib/chat-store/chats/provider"
import { ChatSessionProvider } from "@/lib/chat-store/session/provider"
import { ModelProvider } from "@/lib/model-store/provider"
import { TanstackQueryProvider } from "@/lib/tanstack-query/tanstack-query-provider"
import { UserPreferencesProvider } from "@/lib/user-preference-store/provider"
import { UserProvider } from "@/lib/user-store/provider"
import { getUserProfile } from "@/lib/user/api"
import { ThemeProvider } from "next-themes"
import Script from "next/script"
import { LayoutClient } from "./layout-client"
import { PostHogProvider } from "@/lib/posthog/provider"
import { PostHogPageView } from "@/lib/posthog/page-view"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Coasty - Your AI Employee That Collaborates With Everyone",
    template: "%s | Coasty - Your AI Employee"
  },
  description:
    "Your AI employee that collaborates with everyone. Connect all your models, tools, and teams in one intelligent workspace. Work together with AI that understands your context.",
  keywords: [
    "AI employee",
    "AI collaboration platform",
    "team AI assistant",
    "collaborative AI workspace",
    "AI workflow automation",
    "intelligent AI employee",
    "AI team member",
    "multi-model AI platform",
    "AI workplace assistant",
    "collaborative intelligence",
    "AI productivity tools",
    "team collaboration AI",
    "AI-powered workplace",
    "intelligent automation"
  ],
  authors: [{ name: "Coasty Team" }],
  creator: "Coasty",
  publisher: "Coasty",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://coasty.ai",
    siteName: "Coasty - Your AI Employee",
    title: "Coasty - Your AI Employee That Collaborates With Everyone",
    description: "Your AI employee that collaborates with everyone. Connect all your models, tools, and teams in one intelligent workspace. Work together with AI that understands your context.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Coasty - Your AI Employee That Collaborates With Everyone"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Coasty - Your AI Employee That Collaborates With Everyone",
    description: "Your AI employee that collaborates with everyone. Connect all your models, tools, and teams in one intelligent workspace.",
    images: ["/og-image.png"],
    creator: "@coasty_ai"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://coasty.ai"
  },
  category: "productivity",
  applicationName: "Coasty",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://coasty.ai"),
  verification: {
    google: "google-site-verification-code",
    yandex: "yandex-verification-code",
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const isDev = process.env.NODE_ENV === "development"
  const userProfile = await getUserProfile()

  return (
    <html lang="en" suppressHydrationWarning>
      {!isDev ? (
        <>
          <Script
            async
            src="https://analytics.umami.is/script.js"
            data-website-id="42e5b68c-5478-41a6-bc68-088d029cee52"
          />
        </>
      ) : null}
      {/* Structured Data for SEO */}
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "Coasty",
            "url": "https://coasty.ai",
            "logo": "https://coasty.ai/logo_light.svg",
            "description": "Your AI employee that collaborates with everyone. Connect all your models, tools, and teams in one intelligent workspace.",
            "applicationCategory": "ProductivityApplication",
            "operatingSystem": "Web Browser",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "ratingCount": "1250"
            },
            "featureList": [
              "Multi-Model AI Support",
              "Real-time Collaboration",
              "Intelligent Context Understanding",
              "Team Workspace Integration",
              "Automated Workflows",
              "File and Document Analysis",
              "Code Execution Environment",
              "Cross-Team Communication",
              "Custom AI Training",
              "Enterprise Security"
            ],
            "screenshot": "https://coasty.ai/og-image.png",
            "sameAs": [
              "https://x.com/llmhub_dev"
            ]
          })
        }}
      />
      <Script
        id="organization-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Coasty",
            "url": "https://coasty.ai",
            "logo": "https://coasty.ai/logo_light.svg",
            "description": "Your AI employee that collaborates with everyone in your organization",
            "contactPoint": {
              "@type": "ContactPoint",
              "contactType": "customer support",
              "availableLanguage": ["English"]
            }
          })
        }}
      />
      <Script
        id="website-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Coasty",
            "url": "https://coasty.ai",
            "potentialAction": {
              "@type": "SearchAction",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": "https://coasty.ai/search?q={search_term_string}"
              },
              "query-input": "required name=search_term_string"
            }
          })
        }}
      />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <PostHogProvider>
          <PostHogPageView />
          <TanstackQueryProvider>
            <LayoutClient />
            <UserProvider initialUser={userProfile}>
              <ModelProvider>
                <ChatsProvider userId={userProfile?.id}>
                  <ChatSessionProvider>
                    <UserPreferencesProvider
                      userId={userProfile?.id}
                      initialPreferences={userProfile?.preferences}
                    >
                      <TooltipProvider
                        delayDuration={200}
                        skipDelayDuration={500}
                      >
                        <ThemeProvider
                          attribute="class"
                          defaultTheme="dark"
                          enableSystem={false}
                          disableTransitionOnChange
                        >
                          {children}
                        </ThemeProvider>
                      </TooltipProvider>
                    </UserPreferencesProvider>
                  </ChatSessionProvider>
                </ChatsProvider>
              </ModelProvider>
            </UserProvider>
          </TanstackQueryProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
