"use client"

import Link from "next/link"
import Image from "next/image"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { ArrowUpRight } from "lucide-react"

const footerColumns: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/guide", label: "Guide" },
      { href: "/download", label: "Download" },
      { href: "/pricing", label: "Pricing" },
      { href: "/agent-swarms", label: "Agent Swarms" },
      { href: "/status", label: "Status" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/use-cases", label: "Use Cases" },
      { href: "/blog", label: "Blog" },
      { href: "/results", label: "Demos" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "https://cal.com/coasty/15min", label: "Talk to Cofounders & Demo", external: true },
      { href: "mailto:founders@coasty.ai", label: "Contact", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
]

export function LandingFooter() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <footer className="border-t border-border/40">
      {/* Main footer content */}
      <div className="mx-auto max-w-5xl px-7 sm:px-10">
        {/* Top section: brand + columns */}
        <div className="py-12 sm:py-16 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-10 lg:gap-8">
          {/* Brand column — spans 2 cols on lg */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-2 flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <div className="relative h-8 w-8 flex-shrink-0">
                {mounted && (
                  <Image
                    src={resolvedTheme === "dark" ? "/logo_light.svg" : "/logo_dark.svg"}
                    alt="Coasty"
                    width={32}
                    height={32}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              <span className="font-semibold text-foreground text-base tracking-[-0.01em]">
                Coasty
              </span>
            </Link>
            <p className="text-sm text-muted-foreground/60 leading-relaxed max-w-[260px]">
              AI-powered computer use.
              <br />
              Automate any workflow with intelligent agents.
            </p>
          </div>

          {/* Link columns */}
          {footerColumns.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <h3 className="text-[13px] font-medium text-foreground tracking-[-0.006em]">
                {column.title}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="group/link inline-flex items-center gap-1 text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors duration-200"
                    >
                      {link.label}
                      {link.external && (
                        <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-px translate-x-[-2px] group-hover/link:opacity-100 group-hover/link:translate-x-0 group-hover/link:translate-y-0 transition-all duration-200" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border/30 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-muted-foreground/50 tracking-[-0.006em]">
            &copy; {new Date().getFullYear()} Coasty. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="text-[12px] text-muted-foreground/50 hover:text-muted-foreground transition-colors duration-200"
            >
              Privacy
            </Link>
            <span className="text-muted-foreground/20 text-[10px]">|</span>
            <Link
              href="/terms"
              className="text-[12px] text-muted-foreground/50 hover:text-muted-foreground transition-colors duration-200"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>

      {/* Giant Coasty wordmark */}
      <div className="relative w-full flex items-end justify-center select-none overflow-x-clip overflow-y-visible px-7 sm:px-10 md:px-10 pb-6">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[80%] h-[60%] bg-gradient-to-r from-blue-500/[0.07] via-purple-500/[0.07] to-blue-500/[0.07] dark:from-blue-400/[0.05] dark:via-purple-400/[0.05] dark:to-blue-400/[0.05] rounded-full blur-3xl" />
        </div>
        <h2
          className="relative text-[20vw] sm:text-[18vw] md:text-[16vw] lg:text-[14vw] font-black tracking-tighter leading-[1.15] bg-gradient-to-b from-foreground/90 via-foreground/50 to-foreground/10 bg-clip-text text-transparent px-[0.15em] pb-[0.15em]"
          aria-hidden="true"
        >
          Coasty
        </h2>
      </div>
    </footer>
  )
}
