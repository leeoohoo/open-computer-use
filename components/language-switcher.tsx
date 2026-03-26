"use client"

import { useLocale } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { localeNames, type Locale } from "@/i18n/config"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Globe } from "lucide-react"
import { cn } from "@/lib/utils"

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleLocaleChange = (newLocale: Locale) => {
    if (newLocale === locale) return
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: newLocale }),
      })
      router.refresh()
    })
  }

  // Group languages by region for easier scanning
  const popularLocales: Locale[] = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh', 'ar', 'hi', 'ru']
  const otherLocales = (Object.keys(localeNames) as Locale[]).filter(
    (l) => !popularLocales.includes(l)
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          "text-muted-foreground/60 hover:text-foreground",
          "border border-transparent hover:border-border/40",
          "transition-all duration-200 cursor-pointer",
          isPending && "opacity-50 pointer-events-none",
          className
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{localeNames[locale as Locale] ?? locale}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[400px] overflow-y-auto min-w-[180px]"
      >
        {popularLocales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => handleLocaleChange(l)}
            className={cn(
              "cursor-pointer text-sm",
              l === locale && "font-semibold text-primary"
            )}
          >
            {localeNames[l]}
          </DropdownMenuItem>
        ))}
        {otherLocales.length > 0 && (
          <>
            <div className="h-px bg-border/50 my-1" />
            {otherLocales.map((l) => (
              <DropdownMenuItem
                key={l}
                onClick={() => handleLocaleChange(l)}
                className={cn(
                  "cursor-pointer text-sm",
                  l === locale && "font-semibold text-primary"
                )}
              >
                {localeNames[l]}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
