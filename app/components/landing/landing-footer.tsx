"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

export function LandingFooter() {
  return (
    <footer className="border-t border-border/40">
      {/* Links + copyright */}
      <div className="mx-auto px-5 sm:px-6 max-w-5xl py-10">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-5">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground/70">
              © {new Date().getFullYear()} Coasty
            </p>
          </div>
          <div className="flex items-center gap-5 flex-wrap justify-center">
            {[
              { href: "/guide", label: "Guide" },
              { href: "/results", label: "Case Studies" },
              { href: "/blog", label: "Blog" },
              { href: "/download", label: "Download" },
              { href: "/status", label: "Status" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
              { href: "https://cal.com/coasty/15min", label: "Talk to Cofounders" },
              { href: "mailto:founders@coasty.ai", label: "Contact" },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground/60 hover:text-foreground transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Giant Coasty wordmark — below links, bottom of page */}
      <div className="relative w-full flex items-end justify-center select-none overflow-x-clip overflow-y-visible px-4 sm:px-6 md:px-8 pb-6">
        {/* Subtle gradient glow behind the text */}
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
