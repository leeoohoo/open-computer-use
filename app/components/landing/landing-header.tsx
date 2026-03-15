"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import Image from "next/image"
import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler"
import { useTheme } from "next-themes"

const navItems = [
  { href: "/agent-swarms", label: "Agent Swarms", external: true },
  { href: "/results", label: "Case Studies", external: true },
  { href: "/#pricing", label: "Pricing" },
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
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [currentPath, setCurrentPath] = useState("")

  useEffect(() => {
    setMounted(true)
    setCurrentPath(window.location.pathname)
  }, [])

  // Ensure mobile menu is closed when resizing to desktop/tablet layouts
  useEffect(() => {
    const closeMenuOnLargeScreens = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener("resize", closeMenuOnLargeScreens)
    return () => window.removeEventListener("resize", closeMenuOnLargeScreens)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [mobileMenuOpen])

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  // Handle scroll events for header appearance
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
      
      // Only update active section based on scroll if we're on the home page
      if (currentPath === '/' || currentPath === '') {
        const sections = navItems.filter(item => !item.external).map(item => item.href.substring(2)) // substring(2) to skip "/#"
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

  // Smooth scroll to section or navigate to external link
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, external?: boolean) => {
    if (external) {
      // Allow normal navigation for external links
      setMobileMenuOpen(false)
      return
    }
    
    // If we're not on the home page, navigate to home with the hash
    if (currentPath !== '/' && currentPath !== '') {
      // Allow default navigation to home with hash
      setMobileMenuOpen(false)
      return
    }
    
    e.preventDefault()
    const targetId = href.substring(2) // Skip "/#"
    const targetElement = document.getElementById(targetId)
    
    if (targetElement) {
      const offset = 80 // Account for fixed header
      const elementPosition = targetElement.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }

    // Close mobile menu if open
    setMobileMenuOpen(false)
  }

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          scrolled ? "py-3" : "py-3.5 sm:py-4"
        )}
      >
        <div className="container mx-auto px-2 sm:px-3 md:px-4">
          <div
            className={cn(
              "relative mx-auto transition-all duration-500",
              scrolled ? "max-w-7xl lg:max-w-6xl" : "max-w-7xl"
            )}
          >
            <div
              className={cn(
                "absolute inset-0 border border-border/50 shadow-lg transition-all duration-500",
                "rounded-xl sm:rounded-2xl bg-background/95 sm:bg-background/90 sm:backdrop-blur-xl",
                scrolled
                  ? "shadow-lg shadow-primary/5"
                  : "shadow-2xl shadow-primary/10"
              )}
            />
            
            <div className="pointer-events-none absolute inset-0 hidden rounded-2xl bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-50 sm:block" />
            
            {/* Content */}
            <nav
              className={cn(
                "relative flex items-center justify-between transition-all duration-500 gap-4",
                scrolled ? "px-3 py-2.5 sm:px-4 md:px-5" : "px-3 py-2.5 sm:px-4 md:px-5 lg:px-6"
              )}
            >
              {/* Logo */}
              <Link 
                href="/" 
                className="flex items-center gap-2 group flex-shrink-0"
              >
                <motion.div
                  layoutId={animateBrandFromIntro ? "landing-brand-logo" : undefined}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "relative transition-all duration-500 flex-shrink-0",
                    scrolled ? "h-8 w-8 sm:h-9 sm:w-9" : "h-9 w-9 sm:h-10 sm:w-10"
                  )}
                >
                  {mounted && (
                    <Image
                      src={resolvedTheme === "dark" ? "/logo_light.svg" : "/logo_dark.svg"}
                      alt="Coasty Logo"
                      width={40}
                      height={40}
                      className="w-full h-full object-contain"
                      priority
                    />
                  )}
                </motion.div>
                <motion.span
                  layoutId={animateBrandFromIntro ? "landing-brand-text" : undefined}
                  className={cn(
                    "font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent transition-all duration-500 whitespace-nowrap text-base sm:text-lg leading-normal pb-0.5",
                    scrolled ? "lg:text-lg" : "lg:text-xl"
                  )}
                >
                  Coasty
                </motion.span>
              </Link>

              {/* Desktop Navigation */}
              <ul className="hidden lg:flex items-center gap-1 xl:gap-1.5 relative flex-1 justify-center px-2">
                {navItems.map((item) => {
                  const isActive = item.external 
                    ? currentPath === item.href 
                    : (currentPath === '/' || currentPath === '') && activeSection === item.href.substring(2) // substring(2) to skip "/#"
                  
                  return (
                    <li key={item.label} className="relative">
                      {isActive && (
                        <motion.div
                          layoutId="activeSection"
                          className="absolute inset-x-[-4px] inset-y-[-2px] bg-primary/10 rounded-full border border-primary/20"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            type: "spring",
                            bounce: 0.2,
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      )}
                      {item.external ? (
                        <Link
                          href={item.href}
                          className={cn(
                            "relative rounded-full transition-all duration-200 cursor-pointer block whitespace-nowrap px-2.5 xl:px-3 py-2",
                            scrolled ? "text-sm" : "text-sm xl:text-base",
                            isActive 
                              ? "text-primary font-medium" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <a
                          href={item.href}
                          onClick={(e) => handleNavClick(e, item.href, item.external)}
                          className={cn(
                            "relative rounded-full transition-all duration-200 cursor-pointer block whitespace-nowrap px-2.5 xl:px-3 py-2",
                            scrolled ? "text-sm" : "text-sm xl:text-base",
                            isActive 
                              ? "text-primary font-medium" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          {item.label}
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>

              {/* Desktop CTA Button and Theme Toggle */}
              <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
                <AnimatedThemeToggler 
                  className={cn(
                    "p-2 rounded-full transition-all hover:bg-muted/50",
                    scrolled ? "h-9 w-9" : "h-9 w-9 xl:h-10 xl:w-10"
                  )}
                />
                <Button
                  size={scrolled ? "sm" : "default"}
                  className="rounded-full group whitespace-nowrap"
                  asChild
                >
                  <Link href="/auth">
                    Sign Up / Log In
                  </Link>
                </Button>
              </div>

              {/* Mobile Theme Toggle and Menu Button */}
              <div className="flex items-center gap-1.5 sm:gap-2 lg:hidden">
                <AnimatedThemeToggler
                  className="p-2 rounded-full h-8 w-8 sm:h-9 sm:w-9 hover:bg-muted/50 inline-flex items-center justify-center"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-8 w-8 sm:h-9 sm:w-9"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </nav>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu — full-screen overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={closeMobileMenu}
            />

            {/* Menu panel — slides down from header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed inset-x-0 top-0 z-40 lg:hidden pt-[68px] sm:pt-[76px]"
            >
              <div className="mx-0 sm:mx-3 bg-background border-b border-border/50 sm:border sm:rounded-b-2xl shadow-2xl">
                <nav className="flex flex-col px-4 sm:px-6 py-4 sm:py-5 gap-1">
                  {navItems.map((item, index) => {
                    const isActive = item.external
                      ? currentPath === item.href
                      : (currentPath === '/' || currentPath === '') && activeSection === item.href.substring(2)

                    const linkClasses = cn(
                      "flex items-center px-4 py-3 sm:py-3.5 rounded-xl transition-all duration-200 text-[15px] sm:text-base font-medium",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted"
                    )

                    return (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.2 }}
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
                  <div className="my-2 border-t border-border/50" />

                  {/* CTA */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: navItems.length * 0.04, duration: 0.25 }}
                  >
                    <Button className="w-full rounded-xl h-12 text-[15px] sm:text-base font-semibold" asChild>
                      <Link href="/auth" onClick={closeMobileMenu}>
                        Sign Up / Log In
                      </Link>
                    </Button>
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
