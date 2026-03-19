"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Menu, X, ArrowRight, ChevronDown, Search, Bug, TrendingUp, FileText, Mail, ShoppingCart, Users, BarChart3, Globe, Eye, Send, MonitorSmartphone } from "lucide-react"
import Image from "next/image"
import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler"
import { useTheme } from "next-themes"

const useCaseDropdownItems = [
  { slug: "competitor-intel", label: "Competitor Intel", icon: Search, stat: "5", statLabel: "competitor profiles delivered" },
  { slug: "qa-bug-reports", label: "QA Bug Reports", icon: Bug, stat: "30+", statLabel: "user flows tested per run" },
  { slug: "seo-gap-analysis", label: "SEO Gap Analysis", icon: TrendingUp, stat: "150+", statLabel: "keyword gaps identified" },
  { slug: "data-extraction", label: "Data Extraction", icon: FileText, stat: "1,000+", statLabel: "rows extracted per run" },
  { slug: "lead-generation", label: "Lead Generation", icon: Users, stat: "50", statLabel: "qualified leads per run" },
  { slug: "site-audit", label: "Site Audit", icon: BarChart3, stat: "200+", statLabel: "pages audited per run" },
  { slug: "ad-intelligence", label: "Ad Intelligence", icon: Eye, stat: "25+", statLabel: "ad creatives captured" },
  { slug: "email-outreach", label: "Email Outreach", icon: Send, stat: "50", statLabel: "personalized emails drafted" },
  { slug: "design-review", label: "Design Review", icon: MonitorSmartphone, stat: "12", statLabel: "breakpoints tested per page" },
  { slug: "price-monitoring", label: "Price Monitoring", icon: ShoppingCart, stat: "200+", statLabel: "SKUs compared per run" },
  { slug: "market-research", label: "Market Research", icon: Globe, stat: "40+", statLabel: "data points sourced" },
  { slug: "email-campaigns", label: "Email Campaigns", icon: Mail, stat: "100", statLabel: "personalized emails per campaign" },
]

const navItems = [
  { href: "/agent-swarms", label: "Agent Swarms", external: true },
  { href: "/results", label: "Demos", external: true },
  { href: "/pricing", label: "Pricing", external: true },
  { href: "/guide", label: "Guide", external: true },
  { href: "/download", label: "Download", external: true },
  { href: "/blog", label: "Blog", external: true }
]

export function LandingHeader({
  animateBrandFromIntro = false,
}: {
  animateBrandFromIntro?: boolean
}) {
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState("hero")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [useCasesOpen, setUseCasesOpen] = useState(false)
  const [hoveredUseCase, setHoveredUseCase] = useState<number>(0)
  const [mobileUseCasesOpen, setMobileUseCasesOpen] = useState(false)
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [currentPath, setCurrentPath] = useState("")

  useEffect(() => {
    setMounted(true)
    setCurrentPath(window.location.pathname)
  }, [])

  useEffect(() => {
    const closeMenuOnLargeScreens = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener("resize", closeMenuOnLargeScreens)
    return () => window.removeEventListener("resize", closeMenuOnLargeScreens)
  }, [])

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [mobileMenuOpen])

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)

      if (currentPath === '/' || currentPath === '') {
        const sections = navItems.filter(item => !item.external).map(item => item.href.substring(2))
        const scrollPosition = window.scrollY + 100

        for (let i = sections.length - 1; i >= 0; i--) {
          const section = document.getElementById(sections[i])
          if (section && section.offsetTop <= scrollPosition) {
            setActiveSection(sections[i])
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [currentPath])

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, external?: boolean) => {
    if (external) {
      setMobileMenuOpen(false)
      return
    }

    if (currentPath !== '/' && currentPath !== '') {
      setMobileMenuOpen(false)
      return
    }

    e.preventDefault()
    const targetId = href.substring(2)
    const targetElement = document.getElementById(targetId)

    if (targetElement) {
      const offset = 80
      const elementPosition = targetElement.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }

    setMobileMenuOpen(false)
  }

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          scrolled ? "py-2" : "py-3 sm:py-4"
        )}
      >
        <div className="mx-auto max-w-7xl px-7 sm:px-10">
          <div
            className={cn(
              "relative mx-auto transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              scrolled ? "max-w-5xl" : ""
            )}
          >
            {/* Glass background */}
            <div
              className={cn(
                "absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "rounded-2xl",
                "bg-background/80 backdrop-blur-2xl backdrop-saturate-[1.8]",
                "border border-border/30",
                scrolled
                  ? "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]"
                  : "shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)]"
              )}
            />

            {/* Content */}
            <nav
              className={cn(
                "relative flex items-center justify-between transition-all duration-500 gap-4",
                scrolled ? "px-4 py-2 sm:px-5" : "px-4 py-2.5 sm:px-6"
              )}
            >
              {/* Logo */}
              <Link
                href="/"
                className="flex items-center gap-2.5 group flex-shrink-0"
              >
                <motion.div
                  layoutId={animateBrandFromIntro ? "landing-brand-logo" : undefined}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "relative transition-all duration-500 flex-shrink-0",
                    scrolled ? "h-7 w-7 sm:h-8 sm:w-8" : "h-8 w-8 sm:h-9 sm:w-9"
                  )}
                >
                  {mounted && (
                    <Image
                      src={resolvedTheme === "dark" ? "/logo_light.svg" : "/logo_dark.svg"}
                      alt="Coasty Logo"
                      width={36}
                      height={36}
                      className="w-full h-full object-contain"
                      priority
                    />
                  )}
                </motion.div>
                <motion.span
                  layoutId={animateBrandFromIntro ? "landing-brand-text" : undefined}
                  className={cn(
                    "font-semibold text-foreground transition-all duration-500 whitespace-nowrap tracking-[-0.01em]",
                    scrolled ? "text-[15px] sm:text-base" : "text-base sm:text-lg"
                  )}
                >
                  Coasty
                </motion.span>
              </Link>

              {/* Desktop Navigation */}
              <ul className="hidden lg:flex items-center gap-0.5 relative flex-1 justify-center">
                {/* Use Cases Dropdown */}
                <li
                  className="relative"
                  onMouseEnter={() => {
                    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current)
                    setUseCasesOpen(true)
                  }}
                  onMouseLeave={() => {
                    dropdownTimeoutRef.current = setTimeout(() => setUseCasesOpen(false), 150)
                  }}
                >
                  <Link
                    href="/use-cases"
                    className={cn(
                      "relative flex items-center gap-1 whitespace-nowrap px-3 py-1.5 text-[13px] font-medium tracking-[-0.006em] rounded-lg transition-colors duration-200",
                      currentPath.startsWith("/use-cases")
                        ? "text-foreground"
                        : "text-muted-foreground/60 hover:text-foreground"
                    )}
                  >
                    Use Cases
                    <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", useCasesOpen && "rotate-180")} />
                    {currentPath.startsWith("/use-cases") && (
                      <motion.span
                        layoutId="nav-indicator"
                        className="absolute bottom-0 left-3 right-3 h-px bg-foreground/40"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                  </Link>

                  <AnimatePresence>
                    {useCasesOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[580px] rounded-xl border border-border/30 bg-background/95 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.3)] p-1.5"
                      >
                        <div className="flex gap-1.5">
                          {/* Left: use case list */}
                          <div className="flex-1 min-w-0">
                            <div className="grid grid-cols-2 gap-0.5">
                              {useCaseDropdownItems.map((uc, i) => {
                                const Icon = uc.icon
                                const isHovered = hoveredUseCase === i
                                return (
                                  <Link
                                    key={uc.slug}
                                    href={`/use-cases/${uc.slug}`}
                                    onClick={() => setUseCasesOpen(false)}
                                    onMouseEnter={() => setHoveredUseCase(i)}
                                    className={cn(
                                      "flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors duration-100",
                                      isHovered ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]"
                                    )}
                                  >
                                    <Icon className={cn(
                                      "size-3.5 shrink-0 transition-colors duration-100",
                                      isHovered ? "text-foreground/70" : "text-muted-foreground/40"
                                    )} />
                                    <span className={cn(
                                      "text-[12px] font-medium transition-colors duration-100 truncate",
                                      isHovered ? "text-foreground" : "text-muted-foreground/60"
                                    )}>
                                      {uc.label}
                                    </span>
                                  </Link>
                                )
                              })}
                            </div>
                            <div className="mt-1 pt-1 border-t border-border/15">
                              <Link
                                href="/use-cases"
                                onClick={() => setUseCasesOpen(false)}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-foreground/[0.04] transition-colors duration-150 text-[11px] font-medium text-muted-foreground/40 hover:text-foreground"
                              >
                                View all use cases
                                <ArrowRight className="h-2.5 w-2.5" />
                              </Link>
                            </div>
                          </div>

                          {/* Right: preview panel */}
                          <div className="w-[160px] shrink-0 rounded-lg bg-foreground/[0.03] dark:bg-foreground/[0.04] p-4 flex flex-col items-center justify-center relative overflow-hidden">
                            {(() => {
                              const huc = useCaseDropdownItems[hoveredUseCase]
                              const HIcon = huc.icon
                              return (
                                <>
                                  <HIcon className="absolute -right-4 -bottom-4 size-28 text-foreground/[0.04] dark:text-foreground/[0.05]" strokeWidth={0.8} />
                                  <AnimatePresence mode="wait">
                                    <motion.div
                                      key={hoveredUseCase}
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.12 }}
                                      className="relative text-center"
                                    >
                                      <span className="text-3xl font-bold tracking-tight text-foreground/85">
                                        {huc.stat}
                                      </span>
                                      <p className="text-[10px] font-medium text-muted-foreground/40 mt-1 leading-tight">
                                        {huc.statLabel}
                                      </p>
                                    </motion.div>
                                  </AnimatePresence>
                                </>
                              )
                            })()}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>

                {navItems.map((item) => {
                  const isActive = item.external
                    ? currentPath === item.href
                    : (currentPath === '/' || currentPath === '') && activeSection === item.href.substring(2)

                  return (
                    <li key={item.label} className="relative">
                      {item.external ? (
                        <Link
                          href={item.href}
                          className={cn(
                            "relative block whitespace-nowrap px-3 py-1.5 text-[13px] font-medium tracking-[-0.006em] rounded-lg transition-colors duration-200",
                            isActive
                              ? "text-foreground"
                              : "text-muted-foreground/60 hover:text-foreground"
                          )}
                        >
                          {item.label}
                          {isActive && (
                            <motion.span
                              layoutId="nav-indicator"
                              className="absolute bottom-0 left-3 right-3 h-px bg-foreground/40"
                              transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 35,
                              }}
                            />
                          )}
                        </Link>
                      ) : (
                        <a
                          href={item.href}
                          onClick={(e) => handleNavClick(e, item.href, item.external)}
                          className={cn(
                            "relative block whitespace-nowrap px-3 py-1.5 text-[13px] font-medium tracking-[-0.006em] rounded-lg transition-colors duration-200",
                            isActive
                              ? "text-foreground"
                              : "text-muted-foreground/60 hover:text-foreground"
                          )}
                        >
                          {item.label}
                          {isActive && (
                            <motion.span
                              layoutId="nav-indicator"
                              className="absolute bottom-0 left-3 right-3 h-px bg-foreground/40"
                              transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 35,
                              }}
                            />
                          )}
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>

              {/* Desktop CTA */}
              <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
                <AnimatedThemeToggler
                  className={cn(
                    "rounded-lg transition-all hover:bg-foreground/[0.04]",
                    scrolled ? "h-8 w-8 p-1.5" : "h-9 w-9 p-2"
                  )}
                />
                <div className="w-px h-4 bg-border/40 mx-1" />
                <Link
                  href="/auth"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg font-medium transition-all duration-200",
                    "text-[13px] tracking-[-0.006em]",
                    "bg-foreground text-background",
                    "hover:opacity-90 active:scale-[0.98]",
                    scrolled ? "px-3.5 py-1.5" : "px-4 py-2"
                  )}
                >
                  Get Started
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Mobile controls */}
              <div className="flex items-center gap-1 lg:hidden">
                <AnimatedThemeToggler
                  className="p-1.5 rounded-lg h-8 w-8 hover:bg-foreground/[0.04] inline-flex items-center justify-center"
                />
                <button
                  className={cn(
                    "inline-flex items-center justify-center rounded-lg h-8 w-8 transition-colors duration-200",
                    "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                  )}
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? (
                    <X className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  ) : (
                    <Menu className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </nav>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
              onClick={closeMobileMenu}
            />

            {/* Menu panel */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 top-0 z-40 lg:hidden pt-[60px] sm:pt-[68px]"
            >
              <div className="mx-2 sm:mx-4 bg-background/95 backdrop-blur-2xl border border-border/30 rounded-b-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
                <nav className="flex flex-col px-3 py-3 gap-0.5">
                  {/* Mobile Use Cases Accordion */}
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <button
                      onClick={() => setMobileUseCasesOpen(!mobileUseCasesOpen)}
                      className={cn(
                        "flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl transition-all duration-150 text-[15px] font-medium tracking-[-0.006em]",
                        currentPath.startsWith("/use-cases")
                          ? "text-foreground bg-foreground/[0.04]"
                          : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.03]"
                      )}
                    >
                      Use Cases
                      <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", mobileUseCasesOpen && "rotate-180")} />
                    </button>
                    <AnimatePresence>
                      {mobileUseCasesOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-0.5 px-1.5 py-1.5">
                            {useCaseDropdownItems.map((uc) => {
                              const Icon = uc.icon
                              return (
                                <Link
                                  key={uc.slug}
                                  href={`/use-cases/${uc.slug}`}
                                  onClick={closeMobileMenu}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-foreground/[0.04] transition-colors duration-150"
                                >
                                  <Icon className="size-3.5 shrink-0 text-muted-foreground/40" />
                                  <span className="text-[13px] font-medium text-muted-foreground/60">{uc.label}</span>
                                </Link>
                              )
                            })}
                          </div>
                          <Link
                            href="/use-cases"
                            onClick={closeMobileMenu}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 mx-1.5 mb-1 rounded-lg hover:bg-foreground/[0.04] text-[12px] font-medium text-muted-foreground/50"
                          >
                            View all use cases
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {navItems.map((item, index) => {
                    const isActive = item.external
                      ? currentPath === item.href
                      : (currentPath === '/' || currentPath === '') && activeSection === item.href.substring(2)

                    const linkClasses = cn(
                      "flex items-center px-3.5 py-2.5 rounded-xl transition-all duration-150 text-[15px] font-medium tracking-[-0.006em]",
                      isActive
                        ? "text-foreground bg-foreground/[0.04]"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.03] active:bg-foreground/[0.06]"
                    )

                    return (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {item.external ? (
                          <Link
                            href={item.href}
                            className={linkClasses}
                            onClick={closeMobileMenu}
                          >
                            {item.label}
                          </Link>
                        ) : (
                          <a
                            href={item.href}
                            onClick={(e) => handleNavClick(e, item.href, item.external)}
                            className={linkClasses}
                          >
                            {item.label}
                          </a>
                        )}
                      </motion.div>
                    )
                  })}

                  {/* Divider */}
                  <div className="my-1.5 mx-3.5 border-t border-border/20" />

                  {/* CTA */}
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: navItems.length * 0.03 + 0.05, duration: 0.2 }}
                    className="px-1 pb-1"
                  >
                    <Link
                      href="/auth"
                      onClick={closeMobileMenu}
                      className="flex items-center justify-center gap-2 w-full rounded-xl h-11 text-[15px] font-semibold tracking-[-0.006em] bg-foreground text-background hover:opacity-90 active:scale-[0.99] transition-all duration-150"
                    >
                      Get Started
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </motion.div>
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
