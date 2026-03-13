"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import {
  Key,
  Eye,
  EyeSlash,
  Lock,
  ShieldCheck,
  PencilSimple,
  TrashSimple,
  ArrowRight,
  CheckCircle,
  Plus,
  ArrowsLeftRight,
} from "@phosphor-icons/react"

/* ─── animation variants ─── */

const fade = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.05, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

/* ─── data ─── */

const savedCredentials = [
  { domain: "gmail.com", username: "john@example.com", letter: "G", color: "bg-red-500" },
  { domain: "linkedin.com", username: "john.doe", letter: "L", color: "bg-blue-600" },
  { domain: "notion.so", username: "john@example.com", letter: "N", color: "bg-neutral-800 dark:bg-neutral-200" },
  { domain: "hubspot.com", username: "john@company.com", letter: "H", color: "bg-orange-500" },
]

const securityFeatures = [
  {
    icon: Lock,
    title: "End-to-end encryption",
    description: "Passwords encrypted with AES-256 before storage",
  },
  {
    icon: ShieldCheck,
    title: "VM isolation",
    description: "Credentials only exist inside your session's sandboxed VM",
  },
  {
    icon: EyeSlash,
    title: "Never logged",
    description: "Credentials are never included in chat logs or AI training",
  },
]

const commonServices = [
  "Gmail / Google Workspace",
  "LinkedIn",
  "Twitter / X",
  "HubSpot / Salesforce",
  "Notion / Confluence",
  "WordPress",
  "GitHub",
  "Slack",
  "Bank / Financial sites",
  "Company CRM",
]

/* ─── mock components ─── */

function MockInput({
  label,
  value,
  helperText,
  isPassword,
}: {
  label: string
  value: string
  helperText?: string
  isPassword?: boolean
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground/70">{label}</label>
      <div className="relative">
        <div className="flex h-10 w-full items-center rounded-xl border border-border/40 bg-background/60 px-3.5 text-sm text-foreground">
          <span className="flex-1 truncate">
            {isPassword && !showPassword ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : value}
          </span>
          {isPassword && (
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="ml-2 shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {showPassword ? (
                <EyeSlash size={16} weight="duotone" />
              ) : (
                <Eye size={16} weight="duotone" />
              )}
            </button>
          )}
        </div>
      </div>
      {helperText && (
        <p className="text-[11px] text-muted-foreground/50">{helperText}</p>
      )}
    </div>
  )
}

function CredentialCard({
  domain,
  username,
  letter,
  color,
}: {
  domain: string
  username: string
  letter: string
  color: string
}) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-4 transition-all duration-200 hover:border-border/60">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white",
            color
          )}
        >
          {letter}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{domain}</p>
          <p className="text-[12px] text-muted-foreground/60 truncate mt-0.5">{username}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[12px] text-muted-foreground/40 font-mono">
              {revealed ? "s3cur3P@ss!" : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
            </span>
            <button
              onClick={() => setRevealed(!revealed)}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              {revealed ? (
                <EyeSlash size={13} weight="duotone" />
              ) : (
                <Eye size={13} weight="duotone" />
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-foreground/[0.04] transition-all">
            <PencilSimple size={14} weight="duotone" />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/[0.04] transition-all">
            <TrashSimple size={14} weight="duotone" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── main export ─── */

export function CredentialsTab({ inApp }: { inApp: boolean }) {
  return (
    <div className="space-y-0">

        {/* ── Section 1: Why Save Credentials? ── */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="mb-12 sm:mb-16"
        >
          <motion.p
            variants={fade}
            custom={0}
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
          >
            Credentials
          </motion.p>
          <motion.h2
            variants={fade}
            custom={1}
            className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
          >
            Why Save Credentials?
          </motion.h2>
          <motion.p
            variants={fade}
            custom={2}
            className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed max-w-2xl mb-6"
          >
            Many tasks need Coasty to log into websites like Gmail, LinkedIn, your CRM, and more.
            Saved credentials let Coasty auto-fill login forms so it can complete tasks without
            interrupting you for passwords.
          </motion.p>

          {/* amber callout */}
          <motion.div
            variants={fade}
            custom={3}
            className="rounded-2xl border border-amber-500/15 dark:border-amber-400/15 bg-amber-500/[0.03] dark:bg-amber-400/[0.04] p-5 sm:p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 dark:bg-amber-400/10">
                <ShieldCheck size={20} weight="duotone" className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">
                  Your credentials are safe
                </h3>
                <p className="text-[13px] sm:text-sm text-muted-foreground/70 leading-relaxed">
                  Credentials are encrypted and only used inside your session&apos;s isolated VM.
                  They&apos;re never logged or shared.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* ── Section 2: Adding a Credential ── */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="mb-12 sm:mb-16"
        >
          <motion.p
            variants={fade}
            custom={0}
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
          >
            Step by step
          </motion.p>
          <motion.h2
            variants={fade}
            custom={1}
            className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
          >
            Adding a Credential
          </motion.h2>
          <motion.p
            variants={fade}
            custom={2}
            className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed max-w-2xl mb-8"
          >
            Follow these steps to save a new credential that Coasty can use during tasks.
          </motion.p>

          {/* steps */}
          <motion.div variants={fade} custom={3} className="space-y-4 mb-8">
            {[
              { step: 1, text: "Navigate to Saved Credentials from the sidebar or go to /secrets" },
              { step: 2, text: 'Click "Add Credential" to open the form' },
              { step: 3, text: "Fill in the service domain, username, and password" },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.04] dark:bg-foreground/[0.06] text-xs font-bold text-muted-foreground/60">
                  {s.step}
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed pt-0.5">{s.text}</p>
              </div>
            ))}
          </motion.div>

          {/* mock form */}
          <motion.div
            variants={fade}
            custom={4}
            className="rounded-2xl border border-border/40 bg-card/50 p-5 sm:p-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.04] dark:bg-foreground/[0.06]">
                <Plus size={16} weight="bold" className="text-foreground/70" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Add Credential</h3>
            </div>

            <div className="space-y-4 max-w-sm">
              <MockInput
                label="Service"
                value="gmail.com"
                helperText="The website domain where you log in"
              />
              <MockInput label="Username" value="john@example.com" />
              <MockInput label="Password" value="myS3cur3P@ss" isPassword />

              <div className="pt-2">
                <div className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-foreground text-background text-sm font-medium cursor-default">
                  <Key size={14} weight="duotone" />
                  Save Credential
                </div>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* ── Section 3: Managing Your Credentials ── */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="mb-12 sm:mb-16"
        >
          <motion.p
            variants={fade}
            custom={0}
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
          >
            Manage
          </motion.p>
          <motion.h2
            variants={fade}
            custom={1}
            className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
          >
            Managing Your Credentials
          </motion.h2>
          <motion.p
            variants={fade}
            custom={2}
            className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed max-w-2xl mb-8"
          >
            View, edit, and delete your saved credentials from the credentials page. Each card shows
            the service, username, and a masked password you can reveal.
          </motion.p>

          <motion.div
            variants={fade}
            custom={3}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {savedCredentials.map((cred) => (
              <CredentialCard key={cred.domain} {...cred} />
            ))}
          </motion.div>
        </motion.section>

        {/* ── Section 4: How Auto-Fill Works ── */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="mb-12 sm:mb-16"
        >
          <motion.p
            variants={fade}
            custom={0}
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
          >
            How it works
          </motion.p>
          <motion.h2
            variants={fade}
            custom={1}
            className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
          >
            How Auto-Fill Works
          </motion.h2>

          {/* visual flow */}
          <motion.div
            variants={fade}
            custom={2}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"
          >
            {/* step 1: login page encountered */}
            <div className="rounded-2xl border border-border/40 bg-card/30 p-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mb-3 block">
                Step 1
              </span>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Encounters a login page
              </h3>
              {/* mini login mock */}
              <div className="rounded-xl border border-border/30 bg-background/50 p-3 space-y-2">
                <div className="h-3 w-16 rounded bg-foreground/[0.06]" />
                <div className="h-8 w-full rounded-lg border border-border/30 bg-background/60" />
                <div className="h-3 w-14 rounded bg-foreground/[0.06]" />
                <div className="h-8 w-full rounded-lg border border-border/30 bg-background/60" />
                <div className="h-7 w-20 rounded-lg bg-foreground/10" />
              </div>
            </div>

            {/* step 2: domain match */}
            <div className="rounded-2xl border border-border/40 bg-card/30 p-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mb-3 block">
                Step 2
              </span>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Matches your credentials
              </h3>
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground/60">gmail.com</span>
                </div>
                <ArrowsLeftRight size={20} weight="duotone" className="text-muted-foreground/30 rotate-90" />
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] px-3 py-2">
                  <Lock size={14} weight="duotone" className="text-amber-600 dark:text-amber-400" />
                  <span className="text-xs text-foreground/80">Saved credential found</span>
                </div>
              </div>
            </div>

            {/* step 3: auto-filled */}
            <div className="rounded-2xl border border-border/40 bg-card/30 p-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mb-3 block">
                Step 3
              </span>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Auto-fills the form
              </h3>
              {/* mini filled login mock */}
              <div className="rounded-xl border border-border/30 bg-background/50 p-3 space-y-2">
                <div className="h-3 w-16 rounded bg-foreground/[0.06]" />
                <div className="flex h-8 items-center rounded-lg border border-emerald-500/30 bg-emerald-500/[0.03] px-2.5 gap-1.5">
                  <span className="text-[11px] text-foreground/70 truncate">john@example.com</span>
                  <CheckCircle size={13} weight="fill" className="text-emerald-500 shrink-0 ml-auto" />
                </div>
                <div className="h-3 w-14 rounded bg-foreground/[0.06]" />
                <div className="flex h-8 items-center rounded-lg border border-emerald-500/30 bg-emerald-500/[0.03] px-2.5 gap-1.5">
                  <span className="text-[11px] text-foreground/70">{"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}</span>
                  <CheckCircle size={13} weight="fill" className="text-emerald-500 shrink-0 ml-auto" />
                </div>
                <div className="h-7 w-20 rounded-lg bg-foreground/10" />
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={fade}
            custom={3}
            className="rounded-xl border border-border/30 bg-background/50 p-4"
          >
            <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
              <span className="font-medium text-muted-foreground/80">Note:</span>{" "}
              If no credential matches the domain, Coasty will ask you to log in manually or prompt you
              to save the credential for next time.
            </p>
          </motion.div>
        </motion.section>

        {/* ── Section 5: Security Details ── */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="mb-12 sm:mb-16"
        >
          <motion.p
            variants={fade}
            custom={0}
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
          >
            Security
          </motion.p>
          <motion.h2
            variants={fade}
            custom={1}
            className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8"
          >
            Security Details
          </motion.h2>

          <motion.div
            variants={fade}
            custom={2}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            {securityFeatures.map((feat, i) => {
              const FeatIcon = feat.icon
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-border/40 bg-card/30 p-5 sm:p-6"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.04] dark:bg-foreground/[0.06] mb-3">
                    <FeatIcon size={18} weight="duotone" className="text-foreground/70" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">
                    {feat.title}
                  </h3>
                  <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              )
            })}
          </motion.div>
        </motion.section>

        {/* ── Section 6: Common Services ── */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          <motion.p
            variants={fade}
            custom={0}
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3"
          >
            Recommendations
          </motion.p>
          <motion.h2
            variants={fade}
            custom={1}
            className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3"
          >
            Common Services to Save
          </motion.h2>
          <motion.p
            variants={fade}
            custom={2}
            className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed max-w-2xl mb-8"
          >
            We recommend saving credentials for the services you use most often. Here are the most
            popular ones:
          </motion.p>

          <motion.div
            variants={fade}
            custom={3}
            className="flex flex-wrap gap-2 mb-8"
          >
            {commonServices.map((service) => (
              <span
                key={service}
                className="inline-flex items-center h-8 px-3.5 rounded-full border border-border/40 bg-card/50 text-[13px] text-foreground/80"
              >
                {service}
              </span>
            ))}
          </motion.div>

        </motion.section>

      {/* ── CTA ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="rounded-2xl border border-border/40 bg-card/30 text-center p-6 sm:p-8"
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
          Try it now
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-3">
          Ready to save your first credential?
        </h2>
        <p className="text-sm text-muted-foreground/60 max-w-lg mx-auto mb-6">
          Head to Saved Credentials to add your logins so Coasty can auto-fill them during tasks.
        </p>
        <Link
          href="/secrets"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Go to Saved Credentials
          <ArrowRight size={14} weight="bold" />
        </Link>
      </motion.section>

    </div>
  )
}
