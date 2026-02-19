"use client"

import type { Tables } from "@/app/types/database.types"
import { CoastyIcon } from "@/components/icons/coasty"
import { SparklesCore } from "@/components/ui/sparkles"
import { useTheme } from "next-themes"
import Image from "next/image"
import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/prompt-kit/chat-container"
import { ScrollButton } from "@/components/prompt-kit/scroll-button"
import { Message } from "@/app/components/chat/message"
import { ToolInvocation } from "@/app/components/chat/tool-invocation"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { APP_NAME } from "@/lib/config"
import { useRef, useState, useEffect, useCallback } from "react"
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, Play } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { ProjectNavigatorProvider, useProjectNavigator } from "@/lib/project-navigator-store/provider"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"
import { ChatsProvider } from "@/lib/chat-store/chats/provider"
import { ChatSessionProvider } from "@/lib/chat-store/session/provider"
import { ChatStreamingProvider, useChatStreaming } from "@/lib/chat-streaming-store/provider"
import { ProjectNavigator } from "@/app/components/project/project-navigator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type MessageType = Tables<"messages">

type ArticleProps = {
  chatId: string
  date: string
  title: string
  subtitle: string
  messages: MessageType[]
}

// Sparkles background component - matching the regular chat page
function GridBackground() {
  const { theme } = useTheme()

  return (
    <div className="absolute inset-0 w-full h-full">
      <SparklesCore
        id="share-sparkles"
        background="transparent"
        minSize={0.4}
        maxSize={1}
        particleDensity={6}
        className="w-full h-full"
        particleColor={theme === "dark" ? "#FFFFFF" : "#000000"}
      />
    </div>
  )
}

// Play button overlay component with glassmorphic design
function PlayOverlay({ onPlay, title }: { onPlay: () => void, title?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      onClick={onPlay}
    >
      {/* Multiple gradient layers for progressive blur effect */}
      <div className="absolute inset-0">
        {/* Top section - nearly transparent with minimal blur */}
        <div 
          className="absolute inset-x-0 top-0 h-1/3"
          style={{
            background: 'rgba(var(--background), 0.1)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        />
        
        {/* Upper middle section - slightly more opaque and blurred */}
        <div 
          className="absolute inset-x-0 top-1/3 h-1/6"
          style={{
            background: 'linear-gradient(to bottom, rgba(var(--background), 0.2), rgba(var(--background), 0.4))',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />
        
        {/* Middle section - increasing opacity and blur */}
        <div 
          className="absolute inset-x-0 top-1/2 h-1/6"
          style={{
            background: 'linear-gradient(to bottom, rgba(var(--background), 0.4), rgba(var(--background), 0.6))',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        />
        
        {/* Lower section - heavy blur and more opaque */}
        <div 
          className="absolute inset-x-0 bottom-1/3 h-1/6"
          style={{
            background: 'linear-gradient(to bottom, rgba(var(--background), 0.6), rgba(var(--background), 0.8))',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        />
        
        {/* Bottom section - maximum blur and nearly opaque */}
        <div 
          className="absolute inset-x-0 bottom-0 h-1/3"
          style={{
            background: 'linear-gradient(to bottom, rgba(var(--background), 0.8), rgba(var(--background), 0.95))',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
          }}
        />
      </div>
      {/* Subtle animated background gradient */}
      <div className="absolute inset-0 opacity-10">
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-primary/30 via-transparent to-primary/20"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{
            backgroundSize: '200% 200%',
          }}
        />
      </div>
      
      {/* Company branding section */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="relative z-10 mb-12 text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <CoastyIcon className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent leading-normal pb-0.5">
            {APP_NAME}
          </h1>
        </div>
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Coasty Agent Platform
        </p>
      </motion.div>
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4, type: "spring" }}
        className="relative z-10"
      >
        {/* Subtle ripple effect behind button */}
        <div className="absolute inset-0 -m-16">
          <motion.div 
            className="absolute inset-0 rounded-full border border-primary/10"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [0.8, 1.2, 0.8],
              opacity: [0, 0.3, 0] 
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div 
            className="absolute inset-0 rounded-full border border-primary/5"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ 
              scale: [0.9, 1.3, 0.9],
              opacity: [0, 0.2, 0] 
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.3
            }}
          />
        </div>
        
        {/* Play button with theme-matched colors */}
        <button
          className="relative group flex h-36 w-36 items-center justify-center rounded-full bg-card hover:bg-accent border border-border shadow-xl transition-all duration-300 hover:scale-105"
          style={{
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
          onClick={(e) => {
            e.stopPropagation()
            onPlay()
          }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 opacity-50" />
          <Play
            weight="fill"
            className="h-14 w-14 text-primary ml-1 group-hover:scale-110 transition-transform relative z-10"
          />
        </button>
      </motion.div>
      
      {/* Enhanced information section */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="relative z-10 mt-10 text-center max-w-md px-6"
      >
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Coasty Agent Execution Replay
        </h2>
        {title && (
          <p className="text-lg font-medium text-foreground/80 mb-3">
            "{title}"
          </p>
        )}
        <p className="text-muted-foreground leading-relaxed">
          Watch how the computer autonomously completed this task through our advanced HCI system. 
          See the intelligent automation, tools utilized, and solutions executed in real-time.
        </p>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-6 text-sm text-muted-foreground"
        >
          AI that works on real computers, so you don&apos;t have to.
        </motion.p>
        
        {/* CTA hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 0.6, 0.4] }}
          transition={{ 
            opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            delay: 0.7
          }}
          className="mt-8 text-xs text-muted-foreground"
        >
          Click to begin replay
        </motion.p>
      </motion.div>
    </motion.div>
  )
}

// Reversed logo component for button - uses opposite theme logo
function ReversedLogo({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Use the reversed logic - light logo for light mode, dark logo for dark mode
  const logoSrc = mounted && resolvedTheme === "light" ? "/logo_light.svg" : "/logo_dark.svg"
  
  return (
    <Image
      src={logoSrc}
      alt="Coasty Logo"
      width={20}
      height={20}
      className={className}
      suppressHydrationWarning
    />
  )
}

// Action buttons component - styled like chat input container with responsive design
function ActionButtons({ onReplay, onTryItOut }: { onReplay: () => void, onTryItOut: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="mt-4 px-1 w-full max-w-3xl mx-auto"
    >
      {/* Mobile layout - stacked buttons */}
      <div className="sm:hidden">
        <div className="relative flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-sm">
          {/* Top section - CTA text and Launch button */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Deploy your own AI Agent
            </span>
            <Button
              size="sm"
              onClick={onTryItOut}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 h-8 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium"
            >
              <ReversedLogo className="h-4 w-4 object-contain flex-shrink-0" />
              <span>Launch</span>
            </Button>
          </div>
          
          {/* Divider */}
          <div className="h-px w-full bg-border" />
          
          {/* Bottom section - Replay button centered */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onReplay}
            className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 h-8 hover:bg-accent/50 transition-colors w-full"
          >
            <Play className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Replay Animation</span>
          </Button>
        </div>
      </div>
      
      {/* Tablet and Desktop layout - horizontal */}
      <div className="hidden sm:block">
        <div className="relative flex items-center gap-2 rounded-2xl border bg-card p-2 shadow-sm">
          {/* Left side - Replay button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onReplay}
            className="flex items-center gap-2 rounded-xl px-3 py-2 h-9 hover:bg-accent/50 transition-colors"
          >
            <Play className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Replay</span>
          </Button>
          
          {/* Center divider */}
          <div className="h-6 w-px bg-border" />
          
          {/* Right side - Input-like area with Try it Out button */}
          <div className="flex-1 flex items-center justify-between px-3">
            <span className="text-sm text-muted-foreground hidden md:inline">
              Deploy your own Coasty Agent
            </span>
            <span className="text-sm text-muted-foreground md:hidden">
              Deploy Agent
            </span>
            <Button
              size="sm"
              onClick={onTryItOut}
              className="ml-3 flex items-center gap-2 rounded-xl px-3 md:px-4 py-2 h-9 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <ReversedLogo className="h-5 w-5 object-contain flex-shrink-0" />
              <span className="hidden lg:inline">Launch Coasty Agent</span>
              <span className="lg:hidden">Launch Agent</span>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Simplified header matching the main app header style
function ShareHeader() {
  return (
    <header className="h-app-header pointer-events-none fixed top-0 right-0 left-0 z-40">
      <div className="relative mx-auto flex h-full max-w-full items-center justify-between px-2 sm:px-4 lg:px-6 xl:px-8">
        <div className="flex w-full items-center justify-between min-w-0">
          <div className="-ml-0.5 flex items-center gap-1 sm:gap-2 lg:-ml-2.5 min-w-0 flex-shrink-0">
            <Link
              href="/"
              className="pointer-events-auto inline-flex items-center text-xl sm:text-2xl font-semibold tracking-tight min-w-0"
            >
              <CoastyIcon className="mr-2 size-6 sm:size-7 flex-shrink-0" />
              <span className="hidden sm:inline truncate">{APP_NAME}</span>
            </Link>
          </div>
          <div className="pointer-events-auto flex items-center justify-end gap-1 sm:gap-2 min-w-0 flex-shrink-0">
            <AnimatedThemeToggler 
              className="bg-background dark:bg-card dark:hover:bg-card/70 hover:bg-muted text-muted-foreground h-8 w-8 rounded-3xl flex items-center justify-center flex-shrink-0 shadow-sm hover:shadow-md transition-all duration-200"
            />
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground hover:text-foreground hover:bg-muted/80 bg-background dark:bg-card dark:hover:bg-card/70 rounded-3xl transition-all duration-200 shadow-sm hover:shadow-md font-medium px-2 py-1.5 h-8 sm:px-3 sm:py-2 sm:h-9"
              >
                <span className="text-sm font-medium">Start Chat</span>
                <ArrowUpRight className="ml-1 size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

function SimpleArticleContent({
  chatId,
  date,
  title,
  subtitle,
  messages,
}: ArticleProps) {
  const initialMessageCount = useRef(messages.length)
  const [transformedMessages, setTransformedMessages] = useState<any[]>([])
  const [visibleMessages, setVisibleMessages] = useState<any[]>([])
  const [showPlayOverlay, setShowPlayOverlay] = useState(true)
  const [isReplaying, setIsReplaying] = useState(false)
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [showActionButtons, setShowActionButtons] = useState(false)
  const [currentToolInvocations, setCurrentToolInvocations] = useState<any[]>([])
  const [cuaSectionIndex, setCuaSectionIndex] = useState(0) // tracks which CUA section we're on within a message
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { isOpen: isNavigatorOpen, setIsOpen: setNavigatorOpen, toggleNavigator, width: navigatorWidth } = useProjectNavigator()
  const [isMobile, setIsMobile] = useState(false)
  const { streamingMessages, setStreamingMessages } = useChatStreaming()
  const router = useRouter()
  
  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 640
      setIsMobile(mobile)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])
  
  // Transform database messages to match the format expected by Message component
  // CUA messages get cuaSections metadata for progressive replay within the same bubble
  useEffect(() => {
    const CUA_TAG_REGEX = /<cua-section\s+[^>]*>[\s\S]*?<\/cua-section>/g
    const transformed: any[] = []

    messages.forEach(msg => {
      let parts = undefined
      if (msg.parts) {
        try {
          parts = msg.parts
        } catch (e) {
          console.error('Error parsing parts:', e)
        }
      }

      const content = msg.content || ""
      const hasCuaTags = /<cua-section\s/.test(content)

      // Extract CUA sections as metadata for progressive streaming
      let cuaSections: string[] | undefined
      if (msg.role === "assistant" && hasCuaTags) {
        const sections = content.match(CUA_TAG_REGEX)
        if (sections && sections.length > 1) {
          cuaSections = sections
        }
      }

      transformed.push({
        id: msg.id.toString(),
        role: msg.role as "user" | "assistant",
        content,
        parts,
        experimental_attachments: msg.experimental_attachments || undefined,
        cuaSections, // array of individual section strings for progressive replay
      })
    })

    setTransformedMessages(transformed)
  }, [messages])
  
  // Initialize state when play overlay is first shown
  useEffect(() => {
    if (showPlayOverlay) {
      // Clear everything when showing play overlay
      setVisibleMessages([])
      setStreamingMessages([])
      setCurrentToolInvocations([])
      // Ensure navigator starts closed
      setNavigatorOpen(false)
    }
  }, [showPlayOverlay, setStreamingMessages, setNavigatorOpen])
  
  // Replay functions
  const startReplay = useCallback(() => {
    setShowPlayOverlay(false)
    setIsReplaying(true)
    setCurrentMessageIndex(0)
    setCuaSectionIndex(0)
    setVisibleMessages([])
    setStreamingMessages([]) // Clear streaming messages for Project Navigator
    setCurrentToolInvocations([])
    setShowActionButtons(false)
  }, [setStreamingMessages])

  const restartReplay = useCallback(() => {
    setShowActionButtons(false)
    setShowPlayOverlay(true)
    setCurrentMessageIndex(0)
    setCuaSectionIndex(0)
    setVisibleMessages([])
    setStreamingMessages([]) // Clear streaming messages for Project Navigator
    setCurrentToolInvocations([])
  }, [setStreamingMessages])
  
  const handleTryItOut = useCallback(() => {
    router.push('/')
  }, [router])
  
  // Task replay effect - shows messages progressively
  // For CUA messages with multiple sections, streams sections into the same bubble
  useEffect(() => {
    if (!isReplaying) {
      return
    }

    if (currentMessageIndex >= transformedMessages.length) {
      // Replay complete - restore full messages with tool invocations
      setIsReplaying(false)
      setShowActionButtons(true)
      const fullMessages = transformedMessages.map(msg => ({ ...msg, isNew: false }))
      setVisibleMessages(fullMessages)
      setStreamingMessages(fullMessages)
      // Show all tools at completion
      const allTools: any[] = []
      transformedMessages.forEach(message => {
        if (message.role === 'assistant' && message.parts) {
          const toolParts = message.parts.filter((p: any) => p.type === 'tool-invocation')
          allTools.push(...toolParts)
        }
      })
      setCurrentToolInvocations(allTools)
      return
    }

    const currentMessage = transformedMessages[currentMessageIndex]
    const hasCuaSections = currentMessage.cuaSections && currentMessage.cuaSections.length > 1

    // Calculate delay
    let baseDelay = 500
    if (hasCuaSections) {
      baseDelay = cuaSectionIndex === 0 ? 500 : 350 // First section slightly longer, subsequent faster
    } else if (currentMessage.role === "user") {
      baseDelay = 250
    } else if (currentMessage.content && currentMessage.content.length > 500) {
      baseDelay = 800
    } else if (currentMessage.parts?.some((p: any) => p.type === 'tool-invocation')) {
      baseDelay = 600
    }

    // Check if this message has tool invocations with screenshots
    const hasToolParts = currentMessage.parts?.some((p: any) => p.type === 'tool-invocation')

    replayIntervalRef.current = setTimeout(() => {
      // Auto-open the computer tab when first message with tools appears
      if (hasToolParts && !isNavigatorOpen) {
        setNavigatorOpen(true)
      }

      if (hasCuaSections) {
        // Progressive CUA streaming: build up content section by section within same bubble
        const sectionsToShow = currentMessage.cuaSections!.slice(0, cuaSectionIndex + 1)
        const partialContent = sectionsToShow.join("\n")

        // Count action-result sections visible so far — each one maps to a tool invocation screenshot
        const actionResultCount = (partialContent.match(/<cua-section[^>]*type="action-result"[^>]*>/g) || []).length

        // Split parts into tool and non-tool
        const allToolParts = currentMessage.parts?.filter((p: any) => p.type === 'tool-invocation') || []
        const nonToolParts = currentMessage.parts?.filter((p: any) => p.type !== 'tool-invocation') || []

        // Only include tool invocations up to the number of action-results shown
        const syncedToolParts = allToolParts.slice(0, actionResultCount)

        // visibleMessages: no tool parts (rendered by Message component)
        const messageForDisplay = {
          ...currentMessage,
          content: partialContent,
          parts: nonToolParts.length > 0 ? nonToolParts : undefined,
          isNew: cuaSectionIndex === 0,
          isStreaming: true,
        }

        // streamingMessages: synced tool parts for ProjectNavigator (screenshot per action-result)
        const messageForNavigator = {
          ...currentMessage,
          content: partialContent,
          parts: [...nonToolParts, ...syncedToolParts],
          isNew: cuaSectionIndex === 0,
          isStreaming: true,
        }

        setVisibleMessages(prev => {
          const existingIndex = prev.findIndex(m => m.id === currentMessage.id)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = { ...messageForDisplay, isNew: false }
            return updated
          } else {
            const updated = prev.map(msg => ({ ...msg, isNew: false }))
            return [...updated, messageForDisplay]
          }
        })

        // ProjectNavigator gets only the tool invocations matching revealed action-results
        setStreamingMessages(prev => {
          const existingIndex = prev.findIndex(m => m.id === currentMessage.id)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = { ...messageForNavigator, isNew: false }
            return updated
          } else {
            return [...prev.map(msg => ({ ...msg, isNew: false })), messageForNavigator]
          }
        })

        if (cuaSectionIndex + 1 < currentMessage.cuaSections!.length) {
          setCuaSectionIndex(prev => prev + 1)
        } else {
          // All sections streamed — finalize with full parts
          setVisibleMessages(prev => {
            const idx = prev.findIndex(m => m.id === currentMessage.id)
            if (idx >= 0) {
              const updated = [...prev]
              updated[idx] = {
                ...currentMessage,
                parts: nonToolParts.length > 0 ? nonToolParts : undefined,
                isNew: false,
                isStreaming: false,
              }
              return updated
            }
            return prev
          })
          setStreamingMessages(prev => {
            const idx = prev.findIndex(m => m.id === currentMessage.id)
            if (idx >= 0) {
              const updated = [...prev]
              updated[idx] = { ...currentMessage, isNew: false, isStreaming: false }
              return updated
            }
            return prev
          })
          setCuaSectionIndex(0)
          setCurrentMessageIndex(prev => prev + 1)
        }
      } else {
        // Non-CUA message: add it in one shot
        // visibleMessages: no tool parts
        const messageForDisplay = {
          ...currentMessage,
          parts: currentMessage.parts
            ? currentMessage.parts.filter((p: any) => p.type !== 'tool-invocation')
            : undefined,
          isNew: true,
        }

        // streamingMessages: full parts for ProjectNavigator
        const messageForNavigator = {
          ...currentMessage,
          isNew: true,
        }

        setVisibleMessages(prev => {
          const updated = prev.map(msg => ({ ...msg, isNew: false }))
          return [...updated, messageForDisplay]
        })

        setStreamingMessages(prev => {
          return [...prev.map(msg => ({ ...msg, isNew: false })), messageForNavigator]
        })

        setCurrentMessageIndex(prev => prev + 1)
      }

      // Auto-scroll to the message
      setTimeout(() => {
        const element = document.getElementById(`message-${currentMessage.id}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 50)
    }, baseDelay)

    return () => {
      if (replayIntervalRef.current) {
        clearTimeout(replayIntervalRef.current)
        replayIntervalRef.current = null
      }
    }
  }, [isReplaying, currentMessageIndex, cuaSectionIndex, transformedMessages, setStreamingMessages, isNavigatorOpen, setNavigatorOpen])

  // Update tool invocations synced with CUA sections — each action-result reveals one screenshot
  useEffect(() => {
    if (!isReplaying && !showActionButtons) {
      return
    }

    const allTools: any[] = []
    const upTo = Math.min(currentMessageIndex + 1, transformedMessages.length)
    for (let i = 0; i < upTo; i++) {
      const message = transformedMessages[i]
      if (message.role === 'assistant' && message.parts) {
        const toolParts = message.parts.filter((p: any) => p.type === 'tool-invocation')

        // For the current CUA message being streamed, only show tools matching action-result count
        if (i === currentMessageIndex && message.cuaSections && message.cuaSections.length > 1) {
          const sectionsShown = message.cuaSections.slice(0, cuaSectionIndex + 1).join("\n")
          const actionResultCount = (sectionsShown.match(/<cua-section[^>]*type="action-result"[^>]*>/g) || []).length
          allTools.push(...toolParts.slice(0, actionResultCount))
        } else {
          allTools.push(...toolParts)
        }
      }
    }

    setCurrentToolInvocations(allTools)
  }, [currentMessageIndex, cuaSectionIndex, transformedMessages, isReplaying, showActionButtons])
  
  // No-op handlers for read-only view
  const handleDelete = (id: string) => {}
  const handleEdit = (id: string, newText: string) => {}
  const handleReload = () => {}

  return (
    <div className="relative bg-background flex h-dvh w-full overflow-hidden">
      {/* Grid background pattern - exact same as main app */}
      <GridBackground />
      
      {/* Play overlay */}
      <AnimatePresence>
        {showPlayOverlay && (
          <PlayOverlay onPlay={startReplay} title={title} />
        )}
      </AnimatePresence>
      
      
      {/* Main content - matching the main app layout exactly */}
      <div 
        className="flex-1 flex transition-all duration-300"
        style={{
          marginRight: chatId && isNavigatorOpen && !isMobile ? `${navigatorWidth}%` : 0
        }}
      >
        <main className="@container relative h-dvh w-full">
          <ShareHeader />
          
          {/* Content area - matching main chat exactly */}
          <div className="relative pt-[var(--spacing-app-header,56px)] h-full overflow-hidden scrollbar-invisible">
            <div className="h-full overflow-hidden scrollbar-invisible scroll-container">
              <div className="@container/main relative flex h-full flex-col items-center justify-end md:justify-center no-scrollbar">
                
                {/* Chat container - exact same as Conversation component */}
                <div className="relative flex h-full w-full flex-col items-center overflow-hidden no-scrollbar scroll-container">
                  <ChatContainerRoot className="relative w-full h-full">
                    <ChatContainerContent className="flex w-full flex-col items-center pt-4 pb-20">
                      <div className={cn(
                        "w-full px-4 sm:px-6 md:px-8",
                        "max-w-3xl",
                        "mx-auto"
                      )}>
                        {/* Chat title as a subtle header */}
                        <div className="mb-8 text-center">
                          <h1 className="text-2xl font-semibold text-foreground/80 mb-2">
                            {title}
                          </h1>
                          <p className="text-sm text-muted-foreground">
                            {subtitle} • {new Date(date).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                        
                        {/* Messages with exact same styling as main chat */}
                        <AnimatePresence initial={false} mode="wait">
                          {visibleMessages?.map((message, index) => {
                            const isLast = index === visibleMessages.length - 1
                            const hasScrollAnchor = isLast && visibleMessages.length > initialMessageCount.current
                            const isNew = message.isNew === true

                            return (
                              <motion.div
                                key={`msg-${message.id}`}
                                id={`message-${message.id}`}
                                initial={isNew ? { opacity: 0, y: 15 } : false}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{
                                  duration: isNew ? 0.3 : 0,
                                  ease: "easeOut",
                                }}
                                className="w-full"
                              >
                                <Message
                                  id={message.id}
                                  variant={message.role}
                                  attachments={message.experimental_attachments}
                                  isLast={isLast}
                                  onDelete={handleDelete}
                                  onEdit={handleEdit}
                                  onReload={handleReload}
                                  hasScrollAnchor={hasScrollAnchor}
                                  parts={message.parts}
                                  status="ready"
                                  user_id={undefined}
                                  users={undefined}
                                >
                                  {message.content}
                                </Message>
                              </motion.div>
                            )
                          })}
                        </AnimatePresence>
                      </div>
                      
                      {/* Scroll button - exact same position as main chat */}
                      <div className="absolute bottom-0 right-0 pb-2 pr-4">
                        <ScrollButton />
                      </div>
                    </ChatContainerContent>
                  </ChatContainerRoot>
                </div>
                
                {/* Tool invocations display - positioned at bottom like in main chat */}
                <div
                  className={cn(
                    "relative inset-x-0 bottom-0 z-50 mx-auto w-full px-4 sm:px-6 md:px-8 pb-4",
                    "max-w-3xl"
                  )}
                >
                  {/* Tool invocations display */}
                  <AnimatePresence mode="wait">
                    {currentToolInvocations.length > 0 && (
                      <motion.div 
                        key={`tools-${currentToolInvocations.map(t => t.toolName || '').join('-')}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="relative z-0 mb-1 px-1"
                      >
                        <ToolInvocation toolInvocations={currentToolInvocations} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Action buttons after replay */}
                  <AnimatePresence>
                    {showActionButtons && (
                      <ActionButtons 
                        onReplay={restartReplay}
                        onTryItOut={handleTryItOut}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      
      {/* Project Navigator - show for shared chat */}
      {chatId && (
        <ProjectNavigator
          isOpen={isNavigatorOpen}
          onToggle={toggleNavigator}
        />
      )}
    </div>
  )
}

export default function SimpleArticle(props: ArticleProps) {
  return (
    <ChatSessionProvider>
      <ChatsProvider>
        <MessagesProvider>
          <ChatStreamingProvider>
            <ProjectNavigatorProvider>
              <SimpleArticleContent {...props} />
            </ProjectNavigatorProvider>
          </ChatStreamingProvider>
        </MessagesProvider>
      </ChatsProvider>
    </ChatSessionProvider>
  )
}