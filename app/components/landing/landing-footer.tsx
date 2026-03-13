"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

export function LandingFooter() {
  return (
    <footer className="border-t border-border/40">
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
    </footer>
  )
}
