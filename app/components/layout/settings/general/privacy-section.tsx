"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  ShieldCheck,
  LockKey,
  Eye,
  FileText,
  Database,
  ArrowSquareOut,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] as const },
})

const securityFeatures = [
  {
    icon: LockKey,
    title: "End-to-End Encryption",
    description: "API keys encrypted with AES-256-GCM. Your credentials are never stored in plain text.",
    accent: "text-emerald-500 bg-emerald-500/[0.08]",
  },
  {
    icon: Database,
    title: "Row Level Security",
    description: "Database-level isolation ensures your data is only accessible by you. No cross-tenant access possible.",
    accent: "text-blue-500 bg-blue-500/[0.08]",
  },
  {
    icon: Eye,
    title: "Privacy by Design",
    description: "We collect minimal data necessary to provide the service. Your conversations and files stay yours.",
    accent: "text-indigo-500 bg-indigo-500/[0.08]",
  },
  {
    icon: ShieldCheck,
    title: "Session Security",
    description: "CSRF protection, secure HTTP-only cookies, and Content Security Policy headers on every request.",
    accent: "text-amber-500 bg-amber-500/[0.08]",
  },
]

export function PrivacySection() {
  return (
    <div className="space-y-8">

      {/* ─── Security Overview ────────────────────────────────────────── */}
      <motion.div {...fadeUp(0)}>
        <div className="rounded-xl border border-emerald-500/15 bg-gradient-to-b from-emerald-500/[0.03] to-transparent p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-emerald-500" weight="duotone" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Your data is protected</h3>
              <p className="text-xs text-muted-foreground/50 mt-0.5">
                Enterprise-grade security with encryption at rest and in transit
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Security Features Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {securityFeatures.map((feature, i) => {
          const Icon = feature.icon
          return (
            <motion.div
              key={feature.title}
              {...fadeUp(0.08 + i * 0.06)}
              className="rounded-xl border border-border/30 bg-card/20 p-4 space-y-3"
            >
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", feature.accent)}>
                <Icon className="h-4 w-4" weight="duotone" />
              </div>
              <div>
                <h4 className="text-sm font-medium">{feature.title}</h4>
                <p className="text-xs text-muted-foreground/50 mt-1 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* ─── Legal Links ─────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0.35)} className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-foreground/[0.04] flex items-center justify-center">
            <FileText className="h-3 w-3 text-muted-foreground/50" weight="duotone" />
          </div>
          <h3 className="text-sm font-semibold">Legal</h3>
        </div>

        <div className="rounded-xl border border-border/30 bg-card/20 divide-y divide-border/20">
          {[
            { href: "/privacy", label: "Privacy Policy", description: "How we collect, use, and protect your data" },
            { href: "/terms", label: "Terms of Service", description: "Our terms and conditions of use" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target="_blank"
              className="flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium">{link.label}</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">{link.description}</p>
              </div>
              <ArrowSquareOut className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
