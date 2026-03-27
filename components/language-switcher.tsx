"use client"

import { useLocale } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition, useRef, useEffect, useState } from "react"
import { localeNames, type Locale } from "@/i18n/config"
import { cn } from "@/lib/utils"
import { Globe, Check } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

const orderedLocales: Locale[] = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ar', 'hi', 'ru',
  'nl', 'pl', 'uk', 'th', 'vi', 'tr', 'id', 'sv', 'da', 'no', 'fi',
  'cs', 'ro', 'hu', 'el', 'he', 'ms', 'fil',
]

function useLocaleChange() {
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const changeLocale = (newLocale: Locale) => {
    if (newLocale === locale || isPending) return
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: newLocale }),
      })
      router.refresh()
    })
  }

  return { locale: locale as Locale, isPending, changeLocale }
}

/**
 * Full horizontal pill strip — used in footer
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, isPending, changeLocale } = useLocaleChange()
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current
      const active = activeRef.current
      const scrollLeft = active.offsetLeft - container.offsetWidth / 2 + active.offsetWidth / 2
      container.scrollTo({ left: scrollLeft, behavior: "smooth" })
    }
  }, [locale])

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-1.5 mb-3">
        <Globe className="h-3.5 w-3.5 text-muted-foreground/40" />
        <span className="text-[11px] font-medium text-muted-foreground/40 uppercase tracking-widest">
          {localeNames[locale] ?? locale}
        </span>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent z-10" />

        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 px-1"
          style={{ scrollbarWidth: "none" }}
        >
          {orderedLocales.map((l) => {
            const isActive = l === locale
            return (
              <button
                key={l}
                ref={isActive ? activeRef : undefined}
                onClick={() => changeLocale(l)}
                disabled={isPending}
                className={cn(
                  "relative flex-shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium",
                  "transition-all duration-200 cursor-pointer select-none",
                  "border whitespace-nowrap",
                  isActive
                    ? "bg-foreground text-background border-foreground/80 shadow-sm"
                    : "border-border/30 text-muted-foreground/50 hover:text-foreground hover:border-border/60 hover:bg-muted/30",
                  isPending && !isActive && "opacity-40 pointer-events-none"
                )}
              >
                {localeNames[l]}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Compact globe button with popover grid — used in header/nav
 */
export function LanguageSwitcherCompact({ className }: { className?: string }) {
  const { locale, isPending, changeLocale } = useLocaleChange()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Close on escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-2 py-1.5",
          "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05]",
          "transition-all duration-200 cursor-pointer",
          isPending && "opacity-50 pointer-events-none",
        )}
        aria-label="Change language"
      >
        <Globe className="h-4 w-4" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{locale}</span>
      </button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute top-full right-0 mt-2 z-50",
              "w-[320px] sm:w-[380px] max-h-[70vh] overflow-y-auto",
              "rounded-xl border border-border/30",
              "bg-background/95 backdrop-blur-2xl",
              "shadow-[0_8px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.3)]",
              "p-3",
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-1.5 mb-3 px-1">
              <Globe className="h-3.5 w-3.5 text-muted-foreground/40" />
              <span className="text-[11px] font-medium text-muted-foreground/40 uppercase tracking-widest">
                Language
              </span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 gap-1">
              {orderedLocales.map((l) => {
                const isActive = l === locale
                return (
                  <button
                    key={l}
                    onClick={() => {
                      changeLocale(l)
                      setOpen(false)
                    }}
                    disabled={isPending}
                    className={cn(
                      "relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium",
                      "transition-all duration-150 cursor-pointer select-none text-left",
                      isActive
                        ? "bg-foreground/[0.07] text-foreground"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.04]",
                      isPending && !isActive && "opacity-40 pointer-events-none"
                    )}
                  >
                    <span className="truncate flex-1">{localeNames[l]}</span>
                    {isActive && <Check className="h-3 w-3 text-primary flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
