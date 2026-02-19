"use client"

import type { ToolInvocationUIPart } from "@ai-sdk/ui-utils"
import { cn } from "@/lib/utils"
import {
  ArrowsOut,
  ArrowsIn,
  Monitor,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
import { useProjectNavigator } from "@/lib/project-navigator-store/provider"
import { useState, useMemo, useEffect } from "react"

interface ToolInvocationProps {
  toolInvocations: ToolInvocationUIPart[]
  className?: string
  defaultOpen?: boolean
}

export function ToolInvocation({
  toolInvocations,
}: ToolInvocationProps) {
  const { isOpen, setIsOpen } = useProjectNavigator()
  const [isClicked, setIsClicked] = useState(false)
  const [previousScreenshot, setPreviousScreenshot] = useState<string | null>(null)
  
  // Check environment variable for showing additional info
  const envValue = typeof window !== 'undefined' ? 
    process.env.NEXT_PUBLIC_PROJECT_SHOW_ADDITIONAL_INFO : 'false'
  const showAdditionalInfo = envValue === 'true'

  const toolInvocationsData = Array.isArray(toolInvocations)
    ? toolInvocations
    : [toolInvocations]

  // Check if any tools are still loading
  const hasLoadingTools = toolInvocationsData.some(
    (tool) => tool.toolInvocation.state === "call" || tool.toolInvocation.state === "partial-call"
  )
  const allToolsCompleted = toolInvocationsData.every(
    (tool) => tool.toolInvocation.state === "result"
  )
  
  const isLoadingState = hasLoadingTools && !allToolsCompleted

  // Count unique tools and extract task information
  const toolCount = toolInvocationsData.length
  
  // Function to get descriptive action sentence based on tool type
  const getToolActionDescription = (toolName: string, state: string, args?: any) => {
    const isActive = state === 'call' || state === 'partial-call'
    
    // Browser tools
    if (toolName.toLowerCase().startsWith('browser')) {
      return isActive ? 'Navigating through web pages to gather information' : 'Successfully retrieved web content'
    }
    
    // Terminal tools  
    if (toolName.toLowerCase().startsWith('terminal')) {
      const terminalCommand = toolName.replace('terminal_', '').toLowerCase()
      switch (terminalCommand) {
        case 'connect':
          return isActive ? 'Establishing terminal session' : 'Terminal session established'
        case 'execute':
          return isActive ? 'Processing command in terminal environment' : 'Command processed successfully'
        case 'read':
          return isActive ? 'Reading terminal output' : 'Terminal output captured'
        case 'clear':
          return isActive ? 'Clearing terminal display' : 'Terminal display cleared'
        case 'close':
          return '' // Don't show terminal close messages
        default:
          return isActive ? 'Processing terminal operation' : 'Terminal operation completed'
      }
    }
    
    // File tools
    if (toolName.toLowerCase().startsWith('file_')) {
      const fileCommand = toolName.replace('file_', '').toLowerCase()
      switch (fileCommand) {
        case 'read':
          return isActive ? 'Reading file contents from the system' : 'File contents retrieved'
        case 'write':
          return isActive ? 'Writing data to file system' : 'File successfully written'
        case 'edit':
          return isActive ? 'Modifying file contents' : 'File modifications saved'
        case 'delete':
          return isActive ? 'Removing file from system' : 'File removed successfully'
        case 'exists':
          return isActive ? 'Checking file existence' : 'File check completed'
        case 'append':
          return isActive ? 'Appending content to file' : 'Content appended successfully'
        default:
          return isActive ? 'Processing file operation' : 'File operation completed'
      }
    }
    
    // Directory tools
    if (toolName.toLowerCase().includes('directory') || toolName.toLowerCase().includes('dir')) {
      return isActive ? 'Navigating directory structure' : 'Directory navigation completed'
    }
    
    // Search tools
    if (toolName === 'webSearch' || toolName === 'googleSearch') {
      return isActive ? 'Searching the web for relevant information' : 'Web search results obtained'
    }
    
    // Code execution
    if (toolName === 'codeExecution') {
      return isActive ? 'Executing code in isolated environment' : 'Code execution completed'
    }
    
    // Image search
    if (toolName === 'imageSearch') {
      return isActive ? 'Searching for relevant images' : 'Image search completed'
    }
    
    // URL scraper
    if (toolName === 'urlScraper') {
      return isActive ? 'Extracting content from webpage' : 'Webpage content extracted'
    }
    
    // VM tools
    if (toolName === 'vmScreenshot') {
      return isActive ? 'Capturing virtual machine screen' : 'Screen capture completed'
    }
    if (toolName === 'vmAction') {
      return isActive ? 'Performing action on virtual machine' : 'Virtual machine action completed'
    }
    
    // Default
    return isActive ? 'Processing action' : 'Action completed'
  }

  // Extract detailed task information from tool invocations
  const taskInfo = useMemo(() => {
    const tasks = toolInvocationsData.map(tool => {
      const { toolName, args, state, result } = tool.toolInvocation as any
      
      // Use descriptive sentences when not showing additional info
      if (!showAdditionalInfo) {
        const description = getToolActionDescription(toolName, state, args)
        // Skip empty descriptions (like terminal close)
        if (!description) {
          return null
        }
        return { 
          action: description, 
          target: '', // Empty target since it's included in the description
          state, 
          resultInfo: null 
        }
      }
      
      let action = state === 'result' ? 'Processed' : 'Processing'
      let target = 'task'
      
      switch (toolName) {
        case 'webSearch':
        case 'googleSearch':
          action = state === 'result' ? 'Searched' : 'Searching'
          target = args?.query ? `"${args.query.substring(0, 30)}${args.query.length > 30 ? '...' : ''}"` : 'the web'
          break
        case 'codeExecution':
          action = state === 'result' ? 'Executed' : 'Executing'
          target = args?.language ? `${args.language} code` : 'code'
          break
        case 'urlScraper':
          action = state === 'result' ? 'Read' : 'Reading'
          if (args?.url) {
            try {
              const url = new URL(args.url)
              target = url.hostname.replace('www.', '')
            } catch {
              target = 'webpage'
            }
          } else {
            target = 'webpage'
          }
          break
        case 'imageSearch':
          action = state === 'result' ? 'Found' : 'Finding'
          target = args?.query ? `images of "${args.query.substring(0, 25)}${args.query.length > 25 ? '...' : ''}"` : 'images'
          break
        case 'vmScreenshot':
          action = state === 'result' ? 'Captured' : 'Capturing'
          target = 'VM screenshot'
          break
        case 'vmAction':
          action = state === 'result' ? 'Performed' : 'Performing'
          if (args?.action) {
            switch (args.action) {
              case 'click':
                target = `click at (${args.x}, ${args.y})`
                break
              case 'type':
                target = `typing text`
                break
              case 'key':
                target = `key press: ${args.key}`
                break
              case 'scroll':
                target = `scroll action`
                break
              default:
                target = `${args.action} action`
            }
          } else {
            target = 'VM action'
          }
          break
        default:
          target = toolName
      }
      
      // Check for results count
      let resultInfo = null
      if (state === 'result' && result) {
        if (Array.isArray(result)) {
          resultInfo = `${result.length} results`
        } else if (result.success !== undefined) {
          resultInfo = result.success ? 'Success' : 'Failed'
        }
      }
      
      return { action, target, state, resultInfo }
    }).filter(task => task !== null)  // Filter out null tasks (like terminal close)
    
    // Get the most recent or most important task
    const primaryTask = tasks[tasks.length - 1] || tasks[0]
    
    // Summarize all tasks
    const summary = tasks.length > 1 
      ? `Running ${tasks.length} tasks`
      : primaryTask ? `${primaryTask.action} ${primaryTask.target}` : 'Processing'
    
    return { tasks, primaryTask, summary }
  }, [toolInvocationsData, showAdditionalInfo])
  
  // Extract web search thumbnails for composite display
  const webSearchThumbnails = useMemo(() => {
    // Check all completed tools for web search results (in reverse order to get most recent)
    for (let i = toolInvocationsData.length - 1; i >= 0; i--) {
      const tool = toolInvocationsData[i]
      
      if (tool.toolInvocation.state === "result" && tool.toolInvocation.result) {
        const toolName = tool.toolInvocation.toolName
        
        // Check if this is a web search tool
        if (toolName === 'webSearch' || toolName === 'googleSearch') {
          const result = tool.toolInvocation.result
          
          // Try to parse the result
          let parsedResult = result
          if (result && typeof result === 'object' && 'content' in result) {
            if (Array.isArray(result.content)) {
              const textContent = result.content.find((item: any) => item.type === 'text')
              if (textContent?.text) {
                try {
                  parsedResult = JSON.parse(textContent.text)
                } catch {
                  parsedResult = null
                }
              }
            } else if (typeof result.content === 'string') {
              try {
                parsedResult = JSON.parse(result.content)
              } catch {
                parsedResult = null
              }
            }
          } else if (typeof result === 'string') {
            try {
              parsedResult = JSON.parse(result)
            } catch {
              parsedResult = null
            }
          }
          
          // Extract thumbnails from search results
          if (Array.isArray(parsedResult)) {
            const thumbnails = parsedResult
              .filter((item: any) => item && typeof item === 'object' && (item.image || item.thumbnail))
              .slice(0, 4) // Get up to 4 images
              .map((item: any) => item.image || item.thumbnail)
            
            if (thumbnails.length > 0) {
              return thumbnails
            }
          }
        }
      }
    }
    
    return null
  }, [toolInvocationsData])

  // Extract screenshot from tool results (check all tools, use the most recent screenshot)
  // Returns a full data URI string ready to use as img src
  // Checks both: result.frontendScreenshot (streaming) and toolInvocation.frontendScreenshot (DB persisted)
  const latestScreenshot = useMemo(() => {
    function toDataUri(raw: string): string | null {
      const clean = raw.trim()
      if (!clean) return null
      if (clean.startsWith('data:image/')) return clean
      if (clean.startsWith('/9j/')) return `data:image/jpeg;base64,${clean}`
      if (clean.startsWith('iVBOR')) return `data:image/png;base64,${clean}`
      return `data:image/jpeg;base64,${clean}`
    }

    for (let i = toolInvocationsData.length - 1; i >= 0; i--) {
      const inv = toolInvocationsData[i].toolInvocation as any

      // 1. Check toolInvocation.frontendScreenshot (DB-persisted format)
      if (inv.frontendScreenshot && typeof inv.frontendScreenshot === 'string') {
        const uri = toDataUri(inv.frontendScreenshot)
        if (uri) return uri
      }

      // 2. Check result.frontendScreenshot (streaming format)
      if (inv.state === "result" && inv.result && typeof inv.result === 'object' && 'frontendScreenshot' in inv.result) {
        const uri = toDataUri(inv.result.frontendScreenshot)
        if (uri) return uri
      }
    }
    return null
  }, [toolInvocationsData])
  
  // Track screenshot changes
  useEffect(() => {
    if (latestScreenshot && latestScreenshot !== previousScreenshot) {
      // Small delay to allow for smooth transition
      setTimeout(() => {
        setPreviousScreenshot(latestScreenshot)
      }, 50)
    }
  }, [latestScreenshot, previousScreenshot])

  const handleToggleComputer = () => {
    setIsClicked(true)
    // Small delay to show the animation before toggling
    setTimeout(() => {
      setIsOpen(!isOpen)  // Toggle instead of always setting to true
      setIsClicked(false)
    }, 150)
  }

  return (
    <div 
      className="relative mx-auto" 
      style={{ maxWidth: 'calc(100% - 1rem)' }}
    >
      {/* Ripple effect when clicked */}
      <AnimatePresence>
        {isClicked && (
          <motion.div
            className="absolute inset-0 rounded-t-2xl rounded-b-md"
            initial={{ scale: 1, opacity: 0.3 }}
            animate={{ scale: 1.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              background: 'radial-gradient(circle, rgba(var(--primary), 0.2) 0%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: 1
            }}
          />
        )}
      </AnimatePresence>
      <button
        onClick={handleToggleComputer}
        type="button"
        className="group rounded-t-2xl rounded-b-md p-4 w-full bg-muted/80 backdrop-blur-md border border-border/30 hover:bg-muted/90 transition-colors duration-200"
        style={{
          borderBottom: '1px solid rgba(var(--border), 0.2)',
          boxShadow: '0 -6px 12px -3px rgba(0, 0, 0, 0.08), 0 -3px 6px -2px rgba(0, 0, 0, 0.04)',
          zIndex: 0
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Computer screen preview - always show in landscape format */}
            <div className="relative h-16 w-24 transition-transform duration-200 ease-out group-hover:scale-110">
              {/* Aura effect based on status */}
              {isLoadingState && (
                <div className="absolute -inset-2 z-0">
                  <div 
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 opacity-30 blur-xl animate-pulse"
                    style={{
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite, shimmerAura 3s ease-in-out infinite'
                    }}
                  />
                </div>
              )}
              {!isLoadingState && allToolsCompleted && (
                <div className="absolute -inset-2 z-0">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.25, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 blur-xl"
                  />
                </div>
              )}
              <AnimatePresence mode="wait">
                {webSearchThumbnails ? (
                  // Show composite thumbnail for web search results
                  <motion.div
                    key={`search-thumbnails-${webSearchThumbnails.length}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="absolute inset-0 z-10"
                  >
                    <div className="relative h-full w-full rounded-lg overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 shadow-sm">
                      {webSearchThumbnails.length === 1 ? (
                        // Single image
                        <img
                          src={webSearchThumbnails[0]}
                          alt="Search result"
                          className="w-full h-full object-cover opacity-95"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : webSearchThumbnails.length === 2 ? (
                        // Two images side by side
                        <div className="flex h-full">
                          {webSearchThumbnails.map((thumbnail: string, i: number) => (
                            <div key={i} className="w-1/2 h-full relative overflow-hidden">
                              <img
                                src={thumbnail}
                                alt={`Result ${i + 1}`}
                                className="w-full h-full object-cover opacity-95"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                              {i === 0 && <div className="absolute right-0 top-0 bottom-0 w-px bg-zinc-700/50" />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        // 3 or 4 images in a grid
                        <div className="grid grid-cols-2 gap-px bg-zinc-700/50 h-full">
                          {webSearchThumbnails.map((thumbnail: string, i: number) => (
                            <div key={i} className="relative overflow-hidden bg-zinc-900">
                              <img
                                src={thumbnail}
                                alt={`Result ${i + 1}`}
                                className="w-full h-full object-cover opacity-95"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Search indicator in corner */}
                      <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-1">
                        <svg className="h-3 w-3 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className="text-[8px] text-white/70 font-medium">Web</span>
                      </div>
                    </div>
                  </motion.div>
                ) : latestScreenshot ? (
                  // Show larger screenshot preview if available
                  <motion.div
                    key={`screenshot-${latestScreenshot.substring(0, 20)}`} // Use part of screenshot as key
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="absolute inset-0 z-10"
                  >
                    <div className="relative h-full w-full rounded-lg overflow-hidden border border-border/50 bg-gray-900 shadow-sm">
                      <motion.img
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        src={latestScreenshot}
                        alt="Computer screenshot"
                        className="h-full w-full object-cover"
                        style={{ objectPosition: 'top center' }}
                      />
                      {/* Small monitor icon in corner */}
                      <div className="absolute bottom-1 right-1 bg-black/50 backdrop-blur-sm rounded p-0.5">
                        <Monitor className="h-3 w-3 text-white/70" weight="duotone" />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  // Simple monitor placeholder when no screenshot available
                  <div className="absolute inset-0 z-10 rounded-lg border border-border/50 bg-muted/50 flex items-center justify-center">
                    <Monitor className="h-6 w-6 text-muted-foreground/40" weight="duotone" />
                  </div>
                )}
              </AnimatePresence>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <motion.p 
                  className={cn("font-medium text-sm", isLoadingState && "shimmer-text")}
                  animate={isLoadingState ? {
                    backgroundPosition: ['200% 0', '-200% 0']
                  } : {}}
                  transition={{
                    duration: 3,
                    repeat: isLoadingState ? Infinity : 0,
                    ease: "linear"
                  }}
                  style={isLoadingState ? {
                    backgroundSize: '200% 100%',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  } : {}}
                >
                  {taskInfo.primaryTask ? 
                    (taskInfo.primaryTask.target ? 
                      `${taskInfo.primaryTask.action} ${taskInfo.primaryTask.target}` : 
                      taskInfo.primaryTask.action) : 
                    (isLoadingState ? 'Processing...' : 'Processed')
                  }
                </motion.p>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <motion.div
                  animate={isLoadingState ? {
                    backgroundPosition: ['200% 0', '-200% 0']
                  } : {}}
                  transition={{
                    duration: 3,
                    repeat: isLoadingState ? Infinity : 0,
                    ease: "linear",
                    delay: 0.5
                  }}
                  className={isLoadingState ? "shimmer-text-muted" : ""}
                  style={isLoadingState ? {
                    backgroundSize: '200% 100%',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    display: 'inline-block'
                  } : {}}
                >
                  <p className="text-xs text-muted-foreground">
                    {isLoadingState && (
                      <span>
                        {`${toolCount} ${toolCount === 1 ? 'task' : 'tasks'} in progress`}
                        <motion.span
                          className="inline-block ml-0.5"
                          animate={{
                            opacity: [0, 1, 0]
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        >
                          .
                        </motion.span>
                        <motion.span
                          className="inline-block"
                          animate={{
                            opacity: [0, 1, 0]
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 0.2
                          }}
                        >
                          .
                        </motion.span>
                        <motion.span
                          className="inline-block"
                          animate={{
                            opacity: [0, 1, 0]
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 0.4
                          }}
                        >
                          .
                        </motion.span>
                      </span>
                    )}
                    {!isLoadingState && (
                      `${toolCount} ${toolCount === 1 ? 'task' : 'tasks'} completed`
                    )}
                  </p>
                </motion.div>
                {taskInfo.primaryTask?.resultInfo && (
                  <span className="text-xs text-muted-foreground/70">
                    • {taskInfo.primaryTask.resultInfo}
                  </span>
                )}
              </div>
              {!isLoadingState && (
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {isOpen ? 'Click to minimize' : 'Click to view details'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center">
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div
                  key="minimize"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                  className="relative"
                  title="Minimize details"
                >
                  <ArrowsIn 
                    className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" 
                    weight="bold"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="maximize"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.2 }}
                  className="relative"
                  title="Expand details"
                >
                  <ArrowsOut 
                    className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" 
                    weight="bold"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </button>
    </div>
  )
}