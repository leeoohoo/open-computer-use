"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SparklesCore } from "@/components/ui/sparkles"
import { RainbowButton } from "@/components/magicui/rainbow-button"
import { WindowsIcon, AppleIcon } from "@/components/icons/platform-icons"
import {
  ArrowRight,
  Download,
  Monitor,
  Globe,
  Terminal,
  FolderOpen,
  RefreshCw,
  Check,
  Loader2,
  ShieldAlert,
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { LandingHeader } from "@/app/components/landing/landing-header"
import { motion } from "framer-motion"

type Platform = "windows" | "mac"

interface PlatformInfo {
  version: string
  filename: string
  sha512: string
  size: number
  releaseDate: string
  downloadUrl: string
}

interface DownloadData {
  windows: PlatformInfo | null
  mac: PlatformInfo | null
}

const platformMeta: Record<
  Platform,
  {
    label: string
    icon: typeof WindowsIcon
    extension: string
    requirements: string[]
  }
> = {
  windows: {
    label: "Windows",
    icon: WindowsIcon,
    extension: ".exe",
    requirements: ["Windows 10 or later", "64-bit (x86_64)", "4 GB RAM minimum"],
  },
  mac: {
    label: "macOS",
    icon: AppleIcon,
    extension: ".dmg",
    requirements: ["macOS 10.15 (Catalina) or later", "Apple Silicon or Intel", "4 GB RAM minimum"],
  },
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "windows"
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("mac")) return "mac"
  return "windows"
}

function formatSize(bytes: number): string {
  if (!bytes) return ""
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

export default function DownloadPage() {
  const [isMobile, setIsMobile] = useState(false)
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>("windows")
  const [downloadData, setDownloadData] = useState<DownloadData | null>(null)
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    setDetectedPlatform(detectPlatform())

    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    fetch(`/api/download?_=${Date.now()}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`)
        return res.json()
      })
      .then((data: DownloadData) => {
        setDownloadData(data)
      })
      .catch((err) => {
        console.error("Failed to fetch download data:", err)
      })
      .finally(() => setLoading(false))
  }, [])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: "easeOut" as const },
    },
  }

  const version = downloadData?.windows?.version || downloadData?.mac?.version

  const allPlatforms: Platform[] = ["windows", "mac"]

  const features = [
    { icon: Globe, label: "Browser automation" },
    { icon: Monitor, label: "Desktop automation" },
    { icon: Terminal, label: "Terminal access" },
    { icon: FolderOpen, label: "File operations" },
    { icon: RefreshCw, label: "Auto-updates" },
  ]

  function getDownloadButton(platform: Platform, variant: "hero" | "card") {
    const meta = platformMeta[platform]
    const data = downloadData?.[platform]

    if (loading) {
      return variant === "hero" ? (
        <RainbowButton size="lg" className="w-full sm:w-auto" disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </RainbowButton>
      ) : (
        <Button variant="outline" size="sm" className="w-full" disabled>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          Loading...
        </Button>
      )
    }

    if (data) {
      return variant === "hero" ? (
        <RainbowButton size="lg" className="w-full sm:w-auto" asChild>
          <a href={data.downloadUrl}>
            <Download className="mr-2 h-4 w-4" />
            Download for {meta.label}
          </a>
        </RainbowButton>
      ) : (
        <Button
          variant={platform === detectedPlatform ? "default" : "outline"}
          size="sm"
          className="w-full"
          asChild
        >
          <a href={data.downloadUrl}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download
          </a>
        </Button>
      )
    }

    // Fallback — no data but loading finished
    return variant === "hero" ? (
      <Button size="lg" disabled className="w-full sm:w-auto">
        Unavailable
      </Button>
    ) : (
      <Button variant="outline" size="sm" className="w-full" disabled>
        Unavailable
      </Button>
    )
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Sparkles Background */}
      <div className="absolute inset-0 w-full h-full">
        <SparklesCore
          id="download-sparkles"
          background="transparent"
          minSize={0.4}
          maxSize={1}
          particleDensity={6}
          className="w-full h-full"
          particleColor={theme === "dark" ? "#FFFFFF" : "#000000"}
        />
      </div>

      <LandingHeader />

      <main className={cn("relative", isMobile ? "pt-16" : "pt-20")}>
        {/* Hero */}
        <section
          className={cn(
            "flex items-center justify-center",
            isMobile ? "px-4 py-12" : "px-6 py-20"
          )}
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-4xl"
          >
            <motion.div variants={itemVariants} className="text-center mb-8">
              <Badge variant="outline" className="mb-4">
                <Download className="mr-1 h-3 w-3" />
                Desktop App
              </Badge>
              <h1
                className={cn(
                  "font-bold tracking-tight",
                  isMobile ? "text-4xl" : "text-5xl sm:text-6xl"
                )}
              >
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Download Coasty Desktop
                </span>
              </h1>
              <p
                className={cn(
                  "text-muted-foreground mx-auto",
                  isMobile
                    ? "mt-4 text-base max-w-md"
                    : "mt-6 text-lg sm:text-xl max-w-2xl"
                )}
              >
                Run AI agents directly on your machine. Full browser, desktop,
                and terminal automation with a native experience.
              </p>
              {version && (
                <div className="flex justify-center mt-4">
                  <Badge variant="secondary">v{version}</Badge>
                </div>
              )}
            </motion.div>

            {/* Recommended download */}
            <motion.div variants={itemVariants} className="mb-12">
              {(() => {
                const meta = platformMeta[detectedPlatform]
                const data = downloadData?.[detectedPlatform]
                const Icon = meta.icon
                return (
                  <div
                    className={cn(
                      "relative mx-auto max-w-lg rounded-2xl border border-primary/30 bg-card/80 backdrop-blur-sm p-6 sm:p-8",
                      "shadow-lg shadow-primary/5"
                    )}
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground border-0">
                        Recommended for your system
                      </Badge>
                    </div>
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">
                          Coasty for {meta.label}
                        </h2>
                        {data && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {meta.extension} installer
                            {data.size ? ` · ${formatSize(data.size)}` : ""}
                          </p>
                        )}
                      </div>
                      {getDownloadButton(detectedPlatform, "hero")}
                    </div>
                  </div>
                )
              })()}
            </motion.div>

            {/* Installation notice */}
            <motion.div variants={itemVariants} className="mb-12">
              <div className="mx-auto max-w-lg rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Before you install</p>
                  </div>
                </div>
                <div className="px-4 py-3.5 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Coasty Desktop is brand new, so your operating system
                    {" won't"} recognize it yet. This is completely normal for
                    newly released apps — {"here's"} how to proceed:
                  </p>
                  <div className="space-y-2.5">
                    <div className="flex gap-2.5">
                      <WindowsIcon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Windows SmartScreen will say{" "}
                        <span className="text-foreground font-medium">
                          {'"'}Windows protected your PC{'"'}
                        </span>
                        . Click{" "}
                        <span className="text-foreground font-medium">More info</span>
                        {" "}then{" "}
                        <span className="text-foreground font-medium">Run anyway</span>.
                      </p>
                    </div>
                    <div className="flex gap-2.5">
                      <AppleIcon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        macOS Gatekeeper will say{" "}
                        <span className="text-foreground font-medium">
                          {'"'}Coasty Desktop {"can't"} be opened{'"'}
                        </span>
                        . Open{" "}
                        <span className="text-foreground font-medium">
                          System Settings &gt; Privacy &amp; Security
                        </span>
                        {" "}and click{" "}
                        <span className="text-foreground font-medium">Open Anyway</span>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* All platforms */}
            <motion.div variants={itemVariants} className="mb-16">
              <h3 className="text-center text-sm font-medium text-muted-foreground mb-6">
                All platforms
              </h3>
              <div
                className={cn(
                  "grid gap-4 max-w-3xl mx-auto",
                  isMobile ? "grid-cols-1" : "grid-cols-2"
                )}
              >
                {allPlatforms.map((platform) => {
                  const meta = platformMeta[platform]
                  const data = downloadData?.[platform]
                  const Icon = meta.icon
                  const isRecommended = platform === detectedPlatform
                  return (
                    <div
                      key={platform}
                      className={cn(
                        "rounded-xl border bg-card/60 backdrop-blur-sm p-5 transition-all hover:shadow-md",
                        isRecommended
                          ? "border-primary/30"
                          : "border-border/50 hover:border-primary/20"
                      )}
                    >
                      <div className="flex flex-col items-center gap-3 text-center">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {meta.extension}
                            {data?.size ? ` · ${formatSize(data.size)}` : ""}
                          </p>
                        </div>
                        {getDownloadButton(platform, "card")}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* System Requirements */}
            <motion.div variants={itemVariants} className="mb-16">
              <h3
                className={cn(
                  "text-center font-semibold mb-8",
                  isMobile ? "text-xl" : "text-2xl"
                )}
              >
                System Requirements
              </h3>
              <div
                className={cn(
                  "grid gap-4 max-w-3xl mx-auto",
                  isMobile ? "grid-cols-1" : "grid-cols-2"
                )}
              >
                {allPlatforms.map((platform) => {
                  const meta = platformMeta[platform]
                  const Icon = meta.icon
                  return (
                    <div
                      key={platform}
                      className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-5"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-sm">{meta.label}</p>
                      </div>
                      <ul className="space-y-1.5">
                        {meta.requirements.map((req) => (
                          <li
                            key={req}
                            className="flex items-start gap-2 text-xs text-muted-foreground"
                          >
                            <Check className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* What's included */}
            <motion.div variants={itemVariants} className="mb-16">
              <h3
                className={cn(
                  "text-center font-semibold mb-8",
                  isMobile ? "text-xl" : "text-2xl"
                )}
              >
                What's Included
              </h3>
              <div className="flex flex-wrap justify-center gap-3 max-w-xl mx-auto">
                {features.map((f) => (
                  <div
                    key={f.label}
                    className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 backdrop-blur-sm px-4 py-2"
                  >
                    <f.icon className="h-4 w-4 text-primary" />
                    <span className="text-sm">{f.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* CTA */}
            <motion.div variants={itemVariants} className="text-center mb-12">
              <p className="text-muted-foreground mb-4">
                Prefer the browser?
              </p>
              <Button variant="outline" size="lg" className="rounded-3xl" asChild>
                <Link href="/auth">
                  Open Coasty in Browser
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-border/50">
          <div
            className={cn(
              "mx-auto",
              isMobile ? "px-4 max-w-xl" : "px-6 max-w-7xl"
            )}
          >
            <div
              className={cn(
                "flex justify-between items-center",
                isMobile && "flex-col gap-6"
              )}
            >
              <p className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} Coasty. All rights reserved.
              </p>
              <div className="flex gap-6">
                <Link
                  href="/privacy"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy
                </Link>
                <Link
                  href="/terms"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms
                </Link>
                <Link
                  href="/blog"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Blog
                </Link>
                <Link
                  href="/download"
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Download
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
