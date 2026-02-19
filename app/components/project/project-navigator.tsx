"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { themeConfig } from "@/lib/theme-config"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowsIn,
  CaretRight,
  CaretLeft,
  UsersThree,
  Wrench,
  Code,
  Globe,
  Link,
  Image,
  MagnifyingGlass,
  CheckCircle,
  XCircle,
  Spinner,
  Copy,
  Check,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Desktop,
  Camera,
  Brain,
  FileText,
  Terminal,
} from "@phosphor-icons/react"
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUpRight, MousePointer, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useProjectNavigator } from "@/lib/project-navigator-store/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { useChatStreaming } from "@/lib/chat-streaming-store/provider"
import type { ToolInvocationUIPart } from "@ai-sdk/ui-utils"
import { toast } from "sonner"
import { TaskExecutionDisplay } from "./task-execution-display"
import { TaskChecklist } from "./task-checklist"
import { FileExplorer } from "./file-explorer"
import { FolderOpen, Monitor } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface ToolInvocationData {
  id: string
  toolName: string
  state: 'call' | 'partial-call' | 'result'
  args?: any
  result?: any
  frontendScreenshot?: string  // Base64 screenshot for frontend display only
  timestamp?: string
  messageId?: string
  isNew?: boolean
}

interface SubTask {
  task_id: string
  description: string
  assigned_agent: string
  expected_output: string
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped" | "waiting_for_user"
  summary?: string
  error?: string
  start_time?: string
  end_time?: string
  retry_count?: number
}

interface TaskPlan {
  main_objective: string
  subtasks: SubTask[]
  created_at: string
  completed_at?: string
}

interface ProjectNavigatorProps {
  isOpen: boolean
  onToggle: () => void
  disableAutoOpen?: boolean
}

export function ProjectNavigator({ isOpen, onToggle, disableAutoOpen = false }: ProjectNavigatorProps) {
  const { chatId } = useChatSession()
  const { getChatById } = useChats()
  const currentChat = chatId ? getChatById(chatId) : null
  const { width, setWidth, selectedVMId } = useProjectNavigator()
  const { messages: persistedMessages } = useMessages()
  const { streamingMessages, lastUpdate: streamingLastUpdate } = useChatStreaming()
  const [activeTab, setActiveTab] = useState<'activity' | 'files'>('activity')
  
  // Use streaming messages if available, fallback to persisted
  const messages = streamingMessages.length > 0 ? streamingMessages : persistedMessages
  
  // Check if we should show additional info (defaults to false for better display)
  // Environment variables in Next.js client components are replaced at build time
  const envValue = process.env.NEXT_PUBLIC_PROJECT_SHOW_ADDITIONAL_INFO
  // Always use special formatting unless explicitly set to 'true'
  const showAdditionalInfo = envValue === 'true'
  
  // Debug log to verify env variable
  useEffect(() => {
    console.log('[ProjectNavigator] ENV:', envValue, '| showAdditionalInfo:', showAdditionalInfo, '| Special formatting:', !showAdditionalInfo)
  }, [])
  
  // Debug: Log when component mounts/updates
  useEffect(() => {
    console.log('[ProjectNavigator] Component updated, messages:', {
      persistedCount: persistedMessages.length,
      streamingCount: streamingMessages.length,
      usingStreaming: streamingMessages.length > 0
    })
  }, [persistedMessages, streamingMessages])
  
  useEffect(() => {
    if (streamingMessages.length > 0) {
      console.log('[ProjectNavigator] Using streaming messages:', streamingMessages.length, 'Last update:', new Date(streamingLastUpdate).toISOString())
    }
  }, [streamingMessages.length, streamingLastUpdate])
  
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  
  const [isMobile, setIsMobile] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTask, setCurrentTask] = useState(0)
  const [navigationDirection, setNavigationDirection] = useState<'forward' | 'backward'>('forward')
  const [connectingToVM, setConnectingToVM] = useState(false)
  const itemsPerTask = 1 // Show one tool action at a time for clear navigation
  
  // State for maintaining last screenshots and terminal outputs  
  const [lastBrowserScreenshot, setLastBrowserScreenshot] = useState<string | null>(null)
  const [lastTerminalOutput, setLastTerminalOutput] = useState<{ command?: string; output?: string; error?: string } | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  // State for task plan tracking
  const [taskPlan, setTaskPlan] = useState<TaskPlan | null>(null)
  const [currentExecutingTaskId, setCurrentExecutingTaskId] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Extract task plan from messages (both streaming and persisted)
  useEffect(() => {
    // Use the messages that are already determined above
    const allMessages = messages
    
    console.log('[ProjectNavigator] Checking messages for task plan:', {
      messageCount: allMessages.length,
      isStreaming: streamingMessages.length > 0,
      messages: allMessages.map(m => ({
        role: m.role,
        contentLength: m.content?.length || 0,
        contentPreview: m.content?.substring(0, 100)
      }))
    })
    
    // Reset task plan first to avoid stale data
    let foundPlan: any = null
    let foundCurrentTaskId: any = null
    
    allMessages.forEach((message, index) => {
      if (message.role === 'assistant') {
        // Check content field (for persisted messages)
        const content = typeof message.content === 'string' ? message.content : ''
        
        // Debug log
        if (content.includes('[TASK_PLAN_START]')) {
          console.log(`[ProjectNavigator] Found TASK_PLAN_START in message ${index}, content length: ${content.length}`)
          console.log('[ProjectNavigator] Content preview:', content.substring(0, 500))
        }
        if (content.includes('task_plan')) {
          console.log(`[ProjectNavigator] Found 'task_plan' keyword in message ${index}`)
        }
        
        // Look for task plan in various formats
        // Format 1: [TASK_PLAN_START]...[TASK_PLAN_END]
        const taskPlanMatch = content.match(/\[TASK_PLAN_START\]([\s\S]*?)\[TASK_PLAN_END\]/)
        if (taskPlanMatch && !foundPlan) {
          try {
            const planData = JSON.parse(taskPlanMatch[1])
            foundPlan = planData
            console.log('[ProjectNavigator] Found task plan in content:', planData)
          } catch (e) {
            console.error('[ProjectNavigator] Failed to parse task plan:', e)
          }
        }
        
        // Format 2: JSON block with task_plan key
        const jsonMatch = content.match(/```json\s*(\{[\s\S]*?"task_plan"[\s\S]*?\})\s*```/);
        if (jsonMatch && !foundPlan) {
          try {
            const parsed = JSON.parse(jsonMatch[1])
            if (parsed.task_plan) {
              foundPlan = parsed.task_plan
              console.log('[ProjectNavigator] Found task plan in JSON block:', parsed.task_plan)
            }
          } catch (e) {
            // Silent fail - might be other JSON content
          }
        }
        
        // Format 3: Task status updates
        // [TASK_STATUS:T1:in_progress]
        const statusMatch = content.match(/\[TASK_STATUS:([^:]+):([^\]]+)\]/g)
        if (statusMatch && foundPlan) {
          statusMatch.forEach(match => {
            const [, taskId, status] = match.match(/\[TASK_STATUS:([^:]+):([^\]]+)\]/) || []
            if (taskId && status && foundPlan) {
              // Update the found plan
              foundPlan = {
                ...foundPlan,
                subtasks: foundPlan.subtasks.map((task: any) => 
                  task.task_id === taskId 
                    ? { ...task, status: status as any }
                    : task
                )
              }
              
              // Update current executing task
              if (status === 'in_progress') {
                foundCurrentTaskId = taskId
              }
            }
          })
        }
        
        // Format 4: Task summary updates
        // [TASK_SUMMARY:T1:summary text]
        const summaryMatch = content.match(/\[TASK_SUMMARY:([^:]+):([^\]]+)\]/g)
        if (summaryMatch && foundPlan) {
          summaryMatch.forEach(match => {
            const [, taskId, summary] = match.match(/\[TASK_SUMMARY:([^:]+):([^\]]+)\]/) || []
            if (taskId && summary && foundPlan) {
              foundPlan = {
                ...foundPlan,
                subtasks: foundPlan.subtasks.map((task: any) => 
                  task.task_id === taskId 
                    ? { ...task, summary }
                    : task
                )
              }
            }
          })
        }
      }
    })
    
    // Set the states after processing all messages
    if (foundPlan) {
      console.log('[ProjectNavigator] Setting task plan:', foundPlan)
      setTaskPlan(foundPlan)
    } else {
      console.log('[ProjectNavigator] No task plan found in messages')
      // Only clear if we're not streaming
      if (streamingMessages.length === 0) {
        setTaskPlan(null)
      }
    }
    if (foundCurrentTaskId) {
      setCurrentExecutingTaskId(foundCurrentTaskId)
    }
  }, [messages])
  

  // Check if current user is the chat owner
  useEffect(() => {
    const checkOwnership = async () => {
      if (!currentChat) {
        setIsOwner(false)
        return
      }

      const supabase = createClient()
      if (!supabase) {
        setIsOwner(false)
        return
      }

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)
          // Check if current user is the owner of the chat
          setIsOwner(currentChat.user_id === user.id)
        } else {
          setIsOwner(false)
        }
      } catch (error) {
        console.error('[ProjectNavigator] Error checking ownership:', error)
        setIsOwner(false)
      }
    }

    checkOwnership()
  }, [currentChat])

  // Extract tool invocations from messages (including real-time updates)
  // Force re-render when messages update
  const messageUpdateKey = messages.map(m => `${m.id}-${m.role}-${(m.parts || []).length}`).join(',')
  
  const toolInvocations = useMemo(() => {
    const invocationMap = new Map<string, ToolInvocationData>()
    
    // Debug logging
    const hasToolInvocations = messages.some(m => 
      m.role === 'assistant' && m.parts && 
      m.parts.some(p => p.type === 'tool-invocation')
    )
    if (hasToolInvocations) {
      console.log('[ProjectNavigator] Processing messages with tool invocations:', messages.length)
    }
    
    messages.forEach((message) => {
      // Handle both parts array and content array formats
      const parts = message.parts || (message as any).content
      
      if (message.role === 'assistant' && Array.isArray(parts)) {
        parts.forEach((part) => {
          if (part.type === 'tool-invocation') {
            const invocation = part.toolInvocation
            
            // Debug log
            if (invocation) {
              console.log('[ProjectNavigator] Found tool invocation:', {
                toolName: invocation.toolName,
                state: invocation.state,
                toolCallId: invocation.toolCallId
              })
            }
            const existing = invocationMap.get(invocation.toolCallId)
            
            // Always update to show real-time progress
            // Include all states: call, partial-call, and result
            // For collaborative rooms, always capture every update
            const shouldUpdate = !existing || 
                (invocation.state === 'result') ||
                (existing.state === 'call' && (invocation.state === 'partial-call' || invocation.state === 'result')) ||
                (existing.state === 'partial-call' && invocation.state === 'result') ||
                (existing.state !== invocation.state) // Always update if state changed
                
            if (shouldUpdate) {
              // Extract args from various possible locations
              let args = invocation.args || existing?.args
              
              
              // If args is a string (for some tools), wrap it in an object
              if (typeof args === 'string') {
                // For webSearch, the string is the query
                if (invocation.toolName === 'webSearch') {
                  args = { query: args }
                } else if (invocation.toolName === 'urlScraper') {
                  args = { url: args }
                } else {
                  args = { input: args }
                }
              }
              
              // Extract screenshot from result if present
              let frontendScreenshot = invocation.frontendScreenshot || existing?.frontendScreenshot
              let resultForDisplay = invocation.state === 'result' ? invocation.result : existing?.result
              
              // Check if screenshot is embedded in the result and extract it
              if (resultForDisplay && typeof resultForDisplay === 'object' && 'frontendScreenshot' in resultForDisplay) {
                frontendScreenshot = resultForDisplay.frontendScreenshot
                console.log('[ProjectNavigator] Found screenshot in result, size:', frontendScreenshot?.length || 0)
                // Remove it from display result to avoid showing base64 in text
                resultForDisplay = { ...resultForDisplay }
                delete resultForDisplay.frontendScreenshot
              }
              
              // Also check if screenshot is at the invocation level
              if (invocation.frontendScreenshot) {
                console.log('[ProjectNavigator] Found screenshot at invocation level, size:', invocation.frontendScreenshot?.length || 0)
              }
              
              invocationMap.set(invocation.toolCallId, {
                id: invocation.toolCallId,
                toolName: invocation.toolName,
                state: invocation.state,
                args: args,
                result: resultForDisplay,
                frontendScreenshot: frontendScreenshot,
                timestamp: message.createdAt?.toISOString() || new Date().toISOString(),
                messageId: message.id
              })
            }
          }
        })
      }
    })
    
    // Debug final count
    if (invocationMap.size > 0) {
      console.log('[ProjectNavigator] Total tool invocations found:', invocationMap.size)
    }
    
    // Convert to array and sort by timestamp (oldest first)
    return Array.from(invocationMap.values()).sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime()
      const timeB = new Date(b.timestamp || 0).getTime()
      return timeA - timeB
    })
  }, [messages, messageUpdateKey, streamingLastUpdate])

  // Count active and completed tools
  const { activeTools, completedTools } = useMemo(() => {
    const active = toolInvocations.filter(t => t.state === 'call' || t.state === 'partial-call').length
    const completed = toolInvocations.filter(t => t.state === 'result').length
    return { activeTools: active, completedTools: completed }
  }, [toolInvocations])
  
  // Auto-open panel when first tool invocation appears (unless disabled)
  useEffect(() => {
    if (!disableAutoOpen && toolInvocations.length > 0 && !isOpen) {
      console.log('[ProjectNavigator] Auto-opening panel, found invocations:', toolInvocations.length)
      onToggle()
    }
  }, [toolInvocations.length, isOpen, onToggle, disableAutoOpen])
  
  // Track new invocations for animation
  const [newInvocationIds, setNewInvocationIds] = useState<Set<string>>(new Set())
  const prevInvocationCount = useRef(0)
  
  useEffect(() => {
    if (toolInvocations.length > prevInvocationCount.current) {
      // Find new invocations
      const newIds = new Set<string>()
      toolInvocations.slice(prevInvocationCount.current).forEach(inv => {
        newIds.add(inv.id)
      })
      setNewInvocationIds(newIds)
      
      // Clear after animation
      setTimeout(() => {
        setNewInvocationIds(new Set())
      }, 3000)
    }
    prevInvocationCount.current = toolInvocations.length
  }, [toolInvocations])

  // Calculate task navigation
  const totalTasks = Math.ceil(toolInvocations.length / itemsPerTask)
  const currentTaskTools = useMemo(() => {
    const start = currentTask * itemsPerTask
    const end = start + itemsPerTask
    const tools = toolInvocations.slice(start, end)
    console.log('[ProjectNavigator] Current task tools:', {
      currentTask,
      totalInvocations: toolInvocations.length,
      start,
      end,
      toolsCount: tools.length
    })
    return tools
  }, [toolInvocations, currentTask, itemsPerTask])

  // Auto-advance task when playing
  useEffect(() => {
    if (!isPlaying || toolInvocations.length === 0) return
    
    const interval = setInterval(() => {
      setNavigationDirection('forward')
      setCurrentTask(prev => {
        const next = prev + 1
        if (next >= totalTasks) {
          setIsPlaying(false)
          return 0
        }
        return next
      })
      setCurrentStep(prev => {
        const next = prev + 1
        if (next >= toolInvocations.length) {
          return 0
        }
        return next
      })
    }, 2000) // Advance every 2 seconds
    
    return () => clearInterval(interval)
  }, [isPlaying, toolInvocations.length, totalTasks])

  // Track if user has manually navigated
  const [hasUserNavigated, setHasUserNavigated] = useState(false)
  const [lastAutoNavigatedTo, setLastAutoNavigatedTo] = useState(-1)
  
  // Auto-expand current task tool and auto-navigate to latest
  useEffect(() => {
    if (currentTaskTools.length > 0) {
      // Auto-expand all tools in the current task
      currentTaskTools.forEach(tool => {
        setExpandedTools(prev => {
          const newSet = new Set(prev)
          newSet.add(tool.id)
          return newSet
        })
      })
    }
    
    // Auto-navigate to the latest task when new invocations appear
    // But only if user hasn't manually navigated
    if (toolInvocations.length > 0 && !isPlaying && !hasUserNavigated) {
      const lastTaskIndex = Math.floor((toolInvocations.length - 1) / itemsPerTask)
      // Only auto-navigate if we're not already on the last task and haven't already navigated there
      if (currentTask < lastTaskIndex && lastAutoNavigatedTo !== lastTaskIndex) {
        console.log('[ProjectNavigator] Auto-navigating to latest task:', lastTaskIndex)
        setCurrentTask(lastTaskIndex)
        setCurrentStep(lastTaskIndex)
        setLastAutoNavigatedTo(lastTaskIndex)
      }
    }
  }, [currentTaskTools, toolInvocations.length, currentTask, isPlaying, itemsPerTask, hasUserNavigated, lastAutoNavigatedTo])
  
  // Reset user navigation flag after some time
  useEffect(() => {
    if (hasUserNavigated) {
      const timer = setTimeout(() => {
        setHasUserNavigated(false)
      }, 5000) // Reset after 5 seconds
      return () => clearTimeout(timer)
    }
  }, [hasUserNavigated])

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Open VNC connection for selected VM
  const openVNCConnection = async () => {
    if (!selectedVMId) {
      toast.error("No virtual machine selected")
      return
    }

    setConnectingToVM(true)

    try {
      // Fetch machine details to get IP and VNC password
      const response = await fetch(`/api/machines/${selectedVMId}`)

      if (!response.ok) {
        toast.error("Failed to fetch machine details")
        return
      }

      const data = await response.json()
      const machine = data.machine

      if (!machine.publicIpAddress) {
        toast.error("Machine is not ready. Please wait for it to get an IP address.")
        return
      }

      // Always use HTTP for VNC connection
      const protocol = 'http:'
      const websocketPort = machine.websocketPort || 6080

      // Properly encode the password for URL
      const encodedPassword = encodeURIComponent(machine.vncPassword)

      const url = `${protocol}//${machine.publicIpAddress}:${websocketPort}/vnc.html?autoconnect=1&resize=scale&password=${encodedPassword}`

      window.open(url, '_blank')
      toast.success("Opening desktop connection...")
    } catch (error) {
      console.error("Error opening VNC connection:", error)
      toast.error("Failed to open desktop connection")
    } finally {
      setConnectingToVM(false)
    }
  }

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return
    
    const windowWidth = window.innerWidth
    const deltaX = startXRef.current - e.clientX
    const deltaPercent = (deltaX / windowWidth) * 100
    const newWidth = Math.max(30, Math.min(50, startWidthRef.current + deltaPercent))
    
    setWidth(newWidth)
  }, [setWidth])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const toggleToolExpansion = (toolId: string) => {
    setExpandedTools(prev => {
      const newSet = new Set(prev)
      if (newSet.has(toolId)) {
        newSet.delete(toolId)
      } else {
        newSet.add(toolId)
      }
      return newSet
    })
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
      toast.success("Copied to clipboard")
    } catch (error) {
      toast.error("Failed to copy")
    }
  }


  const getToolIcon = (toolName: string, invocationData?: ToolInvocationData) => {
    // Special handling for web search - show composite thumbnails if we have results
    if ((toolName === 'webSearch' || toolName === 'googleSearch') && invocationData?.result && invocationData.state === 'result') {
      // Try to parse the result to get thumbnails
      let parsedResult = invocationData.result
      if (invocationData.result && typeof invocationData.result === 'object' && 'content' in invocationData.result) {
        if (Array.isArray(invocationData.result.content)) {
          const textContent = invocationData.result.content.find((item: any) => item.type === 'text')
          if (textContent?.text) {
            try {
              parsedResult = JSON.parse(textContent.text)
            } catch {
              parsedResult = null
            }
          }
        } else if (typeof invocationData.result.content === 'string') {
          try {
            parsedResult = JSON.parse(invocationData.result.content)
          } catch {
            parsedResult = null
          }
        }
      }
      
      // If we have search results with images, create a composite thumbnail
      if (Array.isArray(parsedResult)) {
        const resultsWithImages = parsedResult.filter((item: any) => 
          item && typeof item === 'object' && (item.image || item.thumbnail)
        ).slice(0, 4) // Get up to 4 images
        
        if (resultsWithImages.length > 0) {
          return (
            <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-700/30">
              {resultsWithImages.length === 1 ? (
                // Single image
                <img
                  src={resultsWithImages[0].image || resultsWithImages[0].thumbnail}
                  alt=""
                  className="w-full h-full object-cover opacity-90"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : resultsWithImages.length === 2 ? (
                // Two images side by side
                <div className="flex h-full">
                  {resultsWithImages.map((item: any, i: number) => (
                    <div key={i} className="w-1/2 h-full relative overflow-hidden">
                      <img
                        src={item.image || item.thumbnail}
                        alt=""
                        className="w-full h-full object-cover opacity-90"
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
                  {resultsWithImages.map((item: any, i: number) => (
                    <div key={i} className="relative overflow-hidden bg-zinc-900">
                      <img
                        src={item.image || item.thumbnail}
                        alt=""
                        className="w-full h-full object-cover opacity-90"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {/* Overlay badge to indicate search */}
              <div className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-black/80 backdrop-blur-sm rounded-md flex items-center justify-center">
                <MagnifyingGlass className="h-2.5 w-2.5 text-white/90" />
              </div>
            </div>
          )
        }
      }
    }
    
    // Check for browser tools
    if (toolName.toLowerCase().startsWith('browser')) {
      return <Globe className="h-4 w-4" />
    }
    
    // Check for terminal tools
    if (toolName.toLowerCase().startsWith('terminal')) {
      return <Terminal className="h-4 w-4" />
    }
    
    // Check for file tools
    if (toolName.toLowerCase().startsWith('file_')) {
      return <FileText className="h-4 w-4" />
    }
    
    switch (toolName) {
      case 'codeExecution':
        return <Code className="h-4 w-4" />
      case 'webSearch':
      case 'googleSearch':
        return <MagnifyingGlass className="h-4 w-4" />
      case 'imageSearch':
        return <Image className="h-4 w-4" />
      case 'urlScraper':
        return <Link className="h-4 w-4" />
      case 'vmScreenshot':
        return <Camera className="h-4 w-4" />
      case 'vmAction':
        return <Desktop className="h-4 w-4" />
      default:
        return <Wrench className="h-4 w-4" />
    }
  }

  const getToolActionDescription = (toolName: string, state?: string) => {
    const isActive = state === 'call' || state === 'partial-call'
    
    // Browser tools
    if (toolName.toLowerCase().startsWith('browser')) {
      return isActive ? 'Navigating through web pages to gather information...' : 'Successfully retrieved web content'
    }
    
    // Terminal tools
    if (toolName.toLowerCase().startsWith('terminal')) {
      const terminalCommand = toolName.replace('terminal_', '').toLowerCase()
      switch (terminalCommand) {
        case 'connect':
          return isActive ? 'Establishing terminal session...' : 'Terminal session established'
        case 'execute':
          return isActive ? 'Processing command in terminal environment...' : 'Command processed successfully'
        case 'read':
          return isActive ? 'Reading terminal output...' : 'Terminal output captured'
        case 'clear':
          return isActive ? 'Clearing terminal display...' : 'Terminal display cleared'
        case 'close':
          return isActive ? 'Closing terminal session...' : 'Terminal session closed'
        default:
          return isActive ? 'Processing terminal operation...' : 'Terminal operation completed'
      }
    }
    
    // File tools
    if (toolName.toLowerCase().startsWith('file_')) {
      const fileCommand = toolName.replace('file_', '').toLowerCase()
      switch (fileCommand) {
        case 'read':
          return isActive ? 'Reading file contents from the system...' : 'File contents retrieved'
        case 'write':
          return isActive ? 'Writing data to file system...' : 'File successfully written'
        case 'edit':
          return isActive ? 'Modifying file contents...' : 'File modifications saved'
        case 'delete':
          return isActive ? 'Removing file from system...' : 'File removed successfully'
        case 'exists':
          return isActive ? 'Checking file existence...' : 'File check completed'
        case 'append':
          return isActive ? 'Appending content to file...' : 'Content appended successfully'
        default:
          return isActive ? 'Processing file operation...' : 'File operation completed'
      }
    }
    
    // Directory tools
    if (toolName.toLowerCase().includes('directory') || toolName.toLowerCase().includes('dir')) {
      return isActive ? 'Navigating directory structure...' : 'Directory navigation completed'
    }
    
    // Search tools
    if (toolName === 'webSearch' || toolName === 'googleSearch') {
      return isActive ? 'Searching the web for relevant information...' : 'Web search results obtained'
    }
    
    // Code execution
    if (toolName === 'codeExecution') {
      return isActive ? 'Executing code in isolated environment...' : 'Code execution completed'
    }
    
    // Image search
    if (toolName === 'imageSearch') {
      return isActive ? 'Searching for relevant images...' : 'Image search completed'
    }
    
    // URL scraper
    if (toolName === 'urlScraper') {
      return isActive ? 'Extracting content from webpage...' : 'Webpage content extracted'
    }
    
    // VM tools
    if (toolName === 'vmScreenshot') {
      return isActive ? 'Capturing virtual machine screen...' : 'Screen capture completed'
    }
    if (toolName === 'vmAction') {
      return isActive ? 'Performing action on virtual machine...' : 'Virtual machine action completed'
    }
    
    // Default
    return isActive ? 'Processing action...' : 'Action completed'
  }

  const getToolDisplayName = (toolName: string, state?: string) => {
    const isActive = state === 'call' || state === 'partial-call'
    
    // Check for browser tools
    if (toolName.toLowerCase().startsWith('browser')) {
      return isActive ? 'ðŸŒ Browsing web...' : 'âœ“ Browsed web'
    }
    
    // Check for terminal tools
    if (toolName.toLowerCase().startsWith('terminal')) {
      const terminalCommand = toolName.replace('terminal_', '')
      switch (terminalCommand) {
        case 'connect':
          return isActive ? 'ðŸ’» Opening terminal...' : 'âœ“ Terminal opened'
        case 'execute':
          return isActive ? 'âš¡ Executing command...' : 'âœ“ Command executed'
        case 'read':
          return isActive ? 'ðŸ“– Reading output...' : 'âœ“ Output read'
        case 'clear':
          return isActive ? 'ðŸ§¹ Clearing terminal...' : 'âœ“ Terminal cleared'
        case 'close':
          return isActive ? 'ðŸšª Closing terminal...' : 'âœ“ Terminal closed'
        default:
          return isActive ? `ðŸ’» ${terminalCommand}...` : `âœ“ ${terminalCommand}`
      }
    }
    
    // Check for file tools
    if (toolName.toLowerCase().startsWith('file_')) {
      const fileCommand = toolName.replace('file_', '')
      switch (fileCommand) {
        case 'read':
          return isActive ? 'ðŸ“„ Reading file...' : 'âœ“ File read'
        case 'write':
          return isActive ? 'âœï¸ Writing file...' : 'âœ“ File written'
        case 'edit':
          return isActive ? 'âœ‚ï¸ Editing file...' : 'âœ“ File edited'
        case 'append':
          return isActive ? 'âž• Appending to file...' : 'âœ“ Appended to file'
        case 'delete':
          return isActive ? 'ðŸ—‘ï¸ Deleting file...' : 'âœ“ File deleted'
        case 'exists':
          return isActive ? 'ðŸ” Checking file...' : 'âœ“ File checked'
        default:
          return isActive ? `ðŸ“„ ${fileCommand}...` : `âœ“ ${fileCommand}`
      }
    }
    
    switch (toolName) {
      case 'codeExecution':
        return isActive ? 'âš¡ Running code...' : 'âœ“ Ran code'
      case 'webSearch':
      case 'googleSearch':
        return isActive ? 'ðŸ” Searching web...' : 'âœ“ Searched the web'
      case 'imageSearch':
        return isActive ? 'ðŸ–¼ï¸ Searching images...' : 'âœ“ Found images'
      case 'urlScraper':
        return isActive ? 'ðŸ“– Reading webpage...' : 'âœ“ Read webpage'
      case 'vmScreenshot':
        return isActive ? 'ðŸ“¸ Capturing VM screenshot...' : 'âœ“ Captured VM screenshot'
      case 'vmAction':
        return isActive ? 'ðŸ–±ï¸ Controlling VM...' : 'âœ“ Executed VM action'
      default:
        return toolName
    }
  }

  const renderToolResult = (invocation: ToolInvocationData) => {
    const { result, toolName } = invocation
    
    // Parse result if needed
    let parsedResult = result
    if (result && typeof result === 'object' && 'content' in result) {
      // Check if content is an array before using find
      if (Array.isArray(result.content)) {
        const textContent = result.content.find((item: any) => item.type === 'text')
        if (textContent?.text) {
          try {
            parsedResult = JSON.parse(textContent.text)
          } catch {
            parsedResult = textContent.text
          }
        }
      } else if (typeof result.content === 'string') {
        // If content is already a string, use it directly
        try {
          parsedResult = JSON.parse(result.content)
        } catch {
          parsedResult = result.content
        }
      } else {
        // If content is an object or something else, use it as is
        parsedResult = result.content || result
      }
    }
    
    // Special rendering for file commands - Terminal style
    if (toolName.toLowerCase().startsWith('file_') && parsedResult && typeof parsedResult === 'object') {
      const { success, filepath, content, exists, is_file, is_directory, size, error, message, old_content, new_content } = parsedResult as any
      
      // Debug log
      console.log('[FileOperation] Rendering:', { toolName, success, filepath, hasContent: !!content, error })
      
      // For file_read - Exact terminal design with "File" title
      // Always use this view if we have content or an error to display
      if (toolName === 'file_read' && (content || error || filepath)) {
        const lines = content ? content.split('\n') : []
        const maxLines = 30  // Limit for performance
        const truncated = lines.length > maxLines
        const displayLines = truncated ? lines.slice(0, maxLines) : lines
        const fileExt = filepath ? filepath.split('.').pop() : ''
        
        return (
          <div className="w-full">
            <div className="relative rounded-xl overflow-hidden bg-black border border-zinc-800" style={{ minHeight: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              {/* Terminal-style Header with "File" */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-black border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  </div>
                  <div className="h-3 w-px bg-zinc-800" />
                  <span className="text-[11px] text-zinc-500 font-mono tracking-wider uppercase">File</span>
                </div>
                {size !== undefined && (
                  <span className="text-[10px] font-mono text-zinc-500">
                    {size < 1024 ? `${size}B` : `${(size / 1024).toFixed(1)}KB`}
                  </span>
                )}
              </div>
              
              {/* Terminal-style Body */}
              <div className="p-4 font-mono text-[13px] overflow-auto bg-black flex-1">
                {/* Filepath */}
                {filepath && (
                  <div className="mb-3 flex items-start gap-2">
                    <span className="text-zinc-500 select-none">â€º</span>
                    <span className="text-zinc-100 font-medium">{filepath}</span>
                  </div>
                )}
                
                {/* Content */}
                {content ? (
                  <>
                    <pre className="text-zinc-400 whitespace-pre-wrap break-all leading-[1.6] font-light">
                      {displayLines.join('\n')}
                    </pre>
                    {truncated && (
                      <div className="text-zinc-600 italic text-[11px] mt-3 pt-3 border-t border-zinc-800">
                        ... {lines.length - maxLines} more lines (truncated)
                      </div>
                    )}
                  </>
                ) : error ? (
                  <div className="text-red-400">
                    Error: {error}
                  </div>
                ) : (
                  <div className="text-zinc-600 italic text-[12px]">
                    Empty file
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
      
      // For file_write, file_edit, file_append - Exact terminal design
      if (toolName === 'file_write' || toolName === 'file_edit' || toolName === 'file_append') {
        const operation = toolName === 'file_write' ? 'create' : 
                         toolName === 'file_edit' ? 'modify' : 'append'
        
        return (
          <div className="w-full">
            <div className="relative rounded-xl overflow-hidden bg-black border border-zinc-800" style={{ minHeight: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              {/* Terminal-style Header with "File" */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-black border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  </div>
                  <div className="h-3 w-px bg-zinc-800" />
                  <span className="text-[11px] text-zinc-500 font-mono tracking-wider uppercase">File</span>
                </div>
                {success && (
                  <span className="text-[10px] font-mono tracking-wide text-zinc-500">
                    âœ“
                  </span>
                )}
              </div>
              
              {/* Terminal-style Body */}
              <div className="p-4 font-mono text-[13px] bg-black overflow-auto flex-1">
                <div className="flex items-start gap-2">
                  <span className="text-zinc-500 select-none">â€º</span>
                  <div>
                    <span className="text-zinc-100 font-medium">{operation} {filepath || 'file'}</span>
                    {success && (
                      <div className="text-zinc-600 text-[11px] mt-1">
                        {toolName === 'file_write' && '1 file created'}
                        {toolName === 'file_edit' && '1 file modified'}
                        {toolName === 'file_append' && '1 file updated'}
                      </div>
                    )}
                    {error && (
                      <div className="text-zinc-400 text-[11px] mt-1">
                        error: {error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }
      
      // For file_delete - Exact terminal design
      if (toolName === 'file_delete') {
        return (
          <div className="w-full">
            <div className="relative rounded-xl overflow-hidden bg-black border border-zinc-800" style={{ minHeight: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              {/* Terminal-style Header with "File" */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-black border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  </div>
                  <div className="h-3 w-px bg-zinc-800" />
                  <span className="text-[11px] text-zinc-500 font-mono tracking-wider uppercase">File</span>
                </div>
                {success && (
                  <span className="text-[10px] font-mono tracking-wide text-zinc-500">
                    âœ“
                  </span>
                )}
              </div>
              
              {/* Terminal-style Body */}
              <div className="p-4 font-mono text-[13px] bg-black overflow-auto flex-1">
                <div className="flex items-start gap-2">
                  <span className="text-zinc-500 select-none">â€º</span>
                  <div>
                    <span className="text-zinc-100 font-medium">
                      remove <span className={success ? "line-through" : ""}>{filepath}</span>
                    </span>
                    {success && (
                      <div className="text-zinc-600 text-[11px] mt-1">
                        1 file deleted
                      </div>
                    )}
                    {error && (
                      <div className="text-zinc-400 text-[11px] mt-1">
                        error: {error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }
      
      // For file_exists - Exact terminal design with "File" or "Directory"
      if (toolName === 'file_exists') {
        const titleText = is_directory ? "Directory" : "File"
        
        return (
          <div className="w-full">
            <div className="relative rounded-xl overflow-hidden bg-black border border-zinc-800" style={{ minHeight: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              {/* Terminal-style Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-black border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  </div>
                  <div className="h-3 w-px bg-zinc-800" />
                  <span className="text-[11px] text-zinc-500 font-mono tracking-wider uppercase">{titleText}</span>
                </div>
                {exists && (
                  <span className="text-[10px] font-mono tracking-wide text-zinc-500">
                    âœ“
                  </span>
                )}
              </div>
              
              {/* Terminal-style Body */}
              <div className="p-4 font-mono text-[13px] bg-black overflow-auto flex-1">
                <div className="flex items-start gap-2">
                  <span className="text-zinc-500 select-none">â€º</span>
                  <div>
                    <span className="text-zinc-100 font-medium">stat {filepath}</span>
                    {exists && (is_file || is_directory || size !== undefined) && (
                      <div className="text-zinc-600 text-[11px] mt-1">
                        {is_file && 'â€¢ regular file'}
                        {is_directory && 'â€¢ directory'}
                        {size !== undefined && ` â€¢ ${size} bytes`}
                      </div>
                    )}
                    {!exists && (
                      <div className="text-zinc-600 text-[11px] mt-1">
                        No such file or directory
                      </div>
                    )}
                    {error && (
                      <div className="text-zinc-400 text-[11px] mt-1">
                        error: {error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }
    }
    
    // Special rendering for directory_list command - Terminal style display
    if (toolName === 'directory_list' && parsedResult && typeof parsedResult === 'object') {
      const { success, dirpath, items, summary, error, message } = parsedResult as any
      
      if (success && items) {
        // Format directory listing in terminal style
        const directories = items.filter((item: any) => item.type === 'directory')
        const files = items.filter((item: any) => item.type === 'file')
        
        return (
          <div className="w-full">
            <div className="relative rounded-xl overflow-hidden bg-black border border-zinc-800" style={{ minHeight: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-black border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  </div>
                  <div className="h-3 w-px bg-zinc-800" />
                  <span className="text-[11px] text-zinc-500 font-mono tracking-wider uppercase">Directory</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  {summary ? `${summary.directories} dirs, ${summary.files} files` : ''}
                </span>
              </div>
              
              {/* Terminal Body */}
              <div className="p-4 font-mono text-[13px] overflow-auto bg-black flex-1">
                {/* Current directory path */}
                <div className="mb-3 flex items-start gap-2">
                  <span className="text-zinc-500 select-none">›</span>
                  <span className="text-zinc-100 font-medium">ls {dirpath}</span>
                </div>
                
                {/* Directory listing */}
                <div className="space-y-1">
                  {/* Show directories first */}
                  {directories.map((item: any, index: number) => (
                    <div key={`dir-${index}`} className="flex items-center gap-3 text-zinc-400 hover:text-zinc-300 transition-colors">
                      <span className="text-blue-400 text-[11px]">[Dir]</span>
                      <span className="flex-1">{item.name}/</span>
                      {item.item_count !== undefined && (
                        <span className="text-zinc-600 text-[11px]">({item.item_count} items)</span>
                      )}
                      <span className="text-zinc-600 text-[11px]">{item.modified}</span>
                    </div>
                  ))}
                  
                  {/* Show files */}
                  {files.map((item: any, index: number) => (
                    <div key={`file-${index}`} className="flex items-center gap-3 text-zinc-400 hover:text-zinc-300 transition-colors">
                      <span className="text-green-400 text-[11px]">[File]</span>
                      <span className="flex-1">{item.name}</span>
                      {item.size !== undefined && (
                        <span className="text-zinc-600 text-[11px]">
                          {item.size < 1024 ? `${item.size}B` :
                           item.size < 1024*1024 ? `${(item.size/1024).toFixed(1)}KB` :
                           `${(item.size/(1024*1024)).toFixed(1)}MB`}
                        </span>
                      )}
                      <span className="text-zinc-600 text-[11px]">{item.modified}</span>
                    </div>
                  ))}
                  
                  {/* Empty directory message */}
                  {items.length === 0 && (
                    <span className="text-zinc-600 italic text-[12px]">Empty directory</span>
                  )}
                </div>
                
                {/* Summary line */}
                {summary && (
                  <div className="mt-3 pt-3 border-t border-zinc-800 text-zinc-500 text-[11px]">
                    Total: {summary.total_items} items
                    {summary.total_size > 0 && ` (${(summary.total_size/(1024*1024)).toFixed(1)}MB)`}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      } else if (error) {
        // Error state
        return (
          <div className="w-full">
            <div className="relative rounded-xl overflow-hidden bg-black border border-zinc-800" style={{ minHeight: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-center justify-between px-4 py-2.5 bg-black border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  </div>
                  <div className="h-3 w-px bg-zinc-800" />
                  <span className="text-[11px] text-zinc-500 font-mono tracking-wider uppercase">Directory</span>
                </div>
              </div>
              <div className="p-4 font-mono text-[13px] bg-black overflow-auto flex-1">
                <div className="text-red-400">
                  Error: {error}
                </div>
              </div>
            </div>
          </div>
        )
      }
    }
    
    // Special rendering for terminal commands
    if (toolName.toLowerCase().startsWith('terminal') && parsedResult && typeof parsedResult === 'object') {
      const { success, command, output, error, exit_code, stdout, stderr, last_command, history, window_id } = parsedResult as any
      
      // For terminal_execute or terminal_read
      if (toolName === 'terminal_execute' || toolName === 'terminal_read') {
        const terminalOutput = output || stdout || ''
        const terminalError = error || stderr || ''
        const executedCommand = command || last_command || ''

        return (
          <div className="w-full">
            <div className="relative rounded-xl overflow-hidden bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800" style={{ minHeight: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-100 dark:bg-black border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700" />
                  </div>
                  <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-800" />
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-500 font-mono tracking-wider uppercase">Terminal</span>
                </div>
                {exit_code !== undefined && (
                  <span className={cn(
                    "text-[10px] font-mono tracking-wide",
                    exit_code === 0 ? "text-zinc-600 dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-400"
                  )}>
                    {exit_code === 0 ? 'âœ"' : `âœ— ${exit_code}`}
                  </span>
                )}
              </div>

              {/* Terminal Body */}
              <div className="p-4 font-mono text-[13px] overflow-auto bg-zinc-50 dark:bg-black flex-1">
                {/* Command */}
                {executedCommand && (
                  <div className="mb-3 flex items-start gap-2">
                    <span className="text-zinc-600 dark:text-zinc-500 select-none">â€º</span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-medium">{executedCommand}</span>
                  </div>
                )}

                {/* Output */}
                {terminalOutput && (
                  <div>
                    <pre className="text-zinc-700 dark:text-zinc-400 whitespace-pre-wrap break-all leading-[1.6] font-light">
                      {(() => {
                        const lines = terminalOutput.split('\n')
                        const maxLines = 20
                        const truncated = lines.length > maxLines
                        const displayLines = truncated ? lines.slice(0, maxLines) : lines
                        return (
                          <>
                            {displayLines.join('\n')}
                            {truncated && (
                              <span className="text-zinc-500 dark:text-zinc-600 italic block mt-2">
                                ... {lines.length - maxLines} more lines (truncated)
                              </span>
                            )}
                          </>
                        )
                      })()}
                    </pre>
                  </div>
                )}

                {/* Error */}
                {terminalError && (
                  <div>
                    <pre className="text-red-700 dark:text-zinc-300 whitespace-pre-wrap break-all mt-2 leading-[1.6] opacity-90">
                      {(() => {
                        const lines = terminalError.split('\n')
                        const maxLines = 10
                        const truncated = lines.length > maxLines
                        const displayLines = truncated ? lines.slice(0, maxLines) : lines
                        return (
                          <>
                            {displayLines.join('\n')}
                            {truncated && (
                              <span className="text-zinc-500 dark:text-zinc-600 italic block mt-2">
                                ... {lines.length - maxLines} more error lines (truncated)
                              </span>
                            )}
                          </>
                        )
                      })()}
                    </pre>
                  </div>
                )}

                {/* If empty output */}
                {!terminalOutput && !terminalError && !executedCommand && (
                  <span className="text-zinc-500 dark:text-zinc-600 italic text-[12px]">No output</span>
                )}
              </div>
            </div>
          </div>
        )
      }
      
      // For terminal_connect
      if (toolName === 'terminal_connect') {
        return (
          <div className="w-full">
            <div className="relative rounded-xl overflow-hidden bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800" style={{ minHeight: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-100 dark:bg-black border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700" />
                  </div>
                  <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-800" />
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-500 font-mono tracking-wider uppercase">Terminal</span>
                </div>
              </div>
              <div className="p-4 font-mono text-[13px] bg-zinc-50 dark:bg-black overflow-auto flex-1">
                <div className="text-zinc-700 dark:text-zinc-400 mb-2">
                  <span className="text-zinc-600 dark:text-zinc-500">âœ"</span> Session initialized
                </div>
                {window_id && (
                  <div className="text-zinc-500 dark:text-zinc-600 text-[11px]">
                    ID: {window_id}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
      
      // For terminal_clear
      if (toolName === 'terminal_clear') {
        return (
          <div className="w-full">
            <div className="relative rounded-xl overflow-hidden bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800" style={{ minHeight: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-100 dark:bg-black border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700" />
                  </div>
                  <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-800" />
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-500 font-mono tracking-wider uppercase">Terminal</span>
                </div>
              </div>
              <div className="p-4 font-mono text-[13px] bg-zinc-50 dark:bg-black overflow-auto flex-1">
                <div className="text-zinc-500 dark:text-zinc-600 italic">
                  Terminal screen cleared
                </div>
              </div>
            </div>
          </div>
        )
      }
      
      // For terminal_close
      if (toolName === 'terminal_close') {
        return (
          <div className="w-full">
            <div className="relative rounded-xl overflow-hidden bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800" style={{ minHeight: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-100 dark:bg-black border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700" />
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700" />
                  </div>
                  <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-800" />
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-500 font-mono tracking-wider uppercase">Terminal</span>
                </div>
              </div>
              <div className="p-4 font-mono text-[13px] bg-zinc-50 dark:bg-black overflow-auto flex-1">
                <div className="text-zinc-500 dark:text-zinc-600 italic">
                  Terminal session closed
                </div>
              </div>
            </div>
          </div>
        )
      }
    }

    // Special rendering for web search results (both webSearch and googleSearch)
    if ((toolName === 'webSearch' || toolName === 'googleSearch') && Array.isArray(parsedResult)) {
      const searchResults = parsedResult.filter(item => 
        item && typeof item === 'object' && 'url' in item && 'title' in item
      )
      
      if (searchResults.length > 0) {
        return (
          <div className="w-full h-full flex flex-col">
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-zinc-100/95 to-white/95 dark:from-zinc-900/95 dark:to-black/95 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 flex-1 flex flex-col" style={{ minHeight: '600px' }}>
              {/* Modern Header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-zinc-100/50 via-zinc-200/30 to-zinc-100/50 dark:from-zinc-900/50 dark:via-zinc-800/30 dark:to-zinc-900/50 border-b border-zinc-200/30 dark:border-zinc-800/30">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-violet-500/20 blur-xl" />
                    <MagnifyingGlass className="relative h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Search Results</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 backdrop-blur-sm">
                    <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      {searchResults.length} found
                    </span>
                  </div>
                </div>
              </div>

              {/* Modern Body with Cards */}
              <div className="p-4 overflow-auto flex-1 bg-gradient-to-b from-transparent to-zinc-50/20 dark:to-black/20">
                <div className="space-y-3">
                  {searchResults.slice(0, expandedResults.has(invocation.id) ? searchResults.length : 4).map((item: any, index: number) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block"
                      >
                        <div className="relative rounded-xl bg-gradient-to-r from-zinc-200/20 to-zinc-200/10 dark:from-zinc-800/20 dark:to-zinc-800/10 backdrop-blur-sm border border-zinc-300/30 dark:border-zinc-800/30 hover:border-zinc-400/50 dark:hover:border-zinc-700/50 transition-all duration-300 hover:shadow-lg hover:shadow-zinc-300/20 dark:hover:shadow-black/20 overflow-hidden">
                          <div className="flex gap-4 p-4">
                            {/* Thumbnail Section */}
                            <div className="flex-shrink-0">
                              {item.image || item.thumbnail ? (
                                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-900">
                                  <img
                                    src={item.image || item.thumbnail}
                                    alt=""
                                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                                    onError={(e) => {
                                      const favicon = `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=128`
                                      e.currentTarget.src = favicon
                                      e.currentTarget.className = "w-10 h-10 m-auto mt-5 opacity-60"
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-200/30 dark:from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              ) : (
                                <div className="relative w-20 h-20 rounded-lg bg-gradient-to-br from-zinc-200/50 to-zinc-300/50 dark:from-zinc-800/50 dark:to-zinc-900/50 flex items-center justify-center group-hover:from-zinc-300/50 group-hover:to-zinc-400/50 dark:group-hover:from-zinc-700/50 dark:group-hover:to-zinc-800/50 transition-all duration-300">
                                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-violet-500/5 rounded-lg" />
                                  <img
                                    src={`https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=64`}
                                    alt=""
                                    className="w-8 h-8 opacity-70 group-hover:opacity-90 transition-opacity"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Content Section */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-800 dark:group-hover:text-white line-clamp-1 transition-colors">
                                {item.title}
                              </h4>
                              <div className="mt-1 flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <div className="w-1 h-1 rounded-full bg-blue-400/50" />
                                  <span className="text-[11px] text-zinc-600 dark:text-zinc-500 truncate max-w-[200px]">
                                    {new URL(item.url).hostname.replace('www.', '')}
                                  </span>
                                </div>
                              </div>
                              {item.snippet && (
                                <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                  {item.snippet}
                                </p>
                              )}
                            </div>

                            {/* Hover Arrow */}
                            <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                              <ArrowUpRight className="h-4 w-4 text-zinc-600 dark:text-zinc-500" />
                            </div>
                          </div>

                          {/* Subtle gradient overlay on hover */}
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-violet-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                        </div>
                      </a>
                    </motion.div>
                  ))}
                </div>
                
                {/* Show more/less buttons */}
                {searchResults.length > 4 && (
                  <div className="mt-4 flex justify-center">
                    {!expandedResults.has(invocation.id) ? (
                      <button
                        className="px-4 py-2 rounded-full bg-zinc-200/30 dark:bg-zinc-800/30 hover:bg-zinc-300/50 dark:hover:bg-zinc-800/50 border border-zinc-400/30 dark:border-zinc-700/30 hover:border-zinc-500/50 dark:hover:border-zinc-600/50 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all duration-300 flex items-center gap-2"
                        onClick={() => {
                          setExpandedResults(prev => {
                            const newSet = new Set(prev)
                            newSet.add(invocation.id)
                            return newSet
                          })
                        }}
                      >
                        <span>Show {searchResults.length - 4} more</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        className="px-4 py-2 rounded-full bg-zinc-200/30 dark:bg-zinc-800/30 hover:bg-zinc-300/50 dark:hover:bg-zinc-800/50 border border-zinc-400/30 dark:border-zinc-700/30 hover:border-zinc-500/50 dark:hover:border-zinc-600/50 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all duration-300 flex items-center gap-2"
                        onClick={() => {
                          setExpandedResults(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(invocation.id)
                            return newSet
                          })
                        }}
                      >
                        <span>Show less</span>
                        <ChevronUp className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
    }

    // Special rendering for code execution results
    if (toolName === 'codeExecution' && parsedResult && typeof parsedResult === 'object') {
      const { success, output, error, executionTime, exitCode } = parsedResult as any
      
      return (
        <div className="space-y-2">
          {/* Simplified status */}
          <div className="flex items-center gap-2">
            {success ? (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">âœ“ Executed successfully</span>
            ) : (
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">âœ— Execution failed</span>
            )}
            {executionTime !== undefined && (
              <span className="text-xs text-muted-foreground">({executionTime}ms)</span>
            )}
          </div>
          
          {/* Output */}
          {output && (
            <div className="bg-neutral-200/30 dark:bg-neutral-900/30 rounded-lg p-3 border border-border/20">
              <pre className="text-xs font-mono whitespace-pre-wrap line-clamp-6 text-muted-foreground">
                {output}
              </pre>
            </div>
          )}
          
          {/* Error */}
          {error && (
            <div className="bg-red-50/50 dark:bg-red-950/10 rounded-lg p-3 border border-red-200/50 dark:border-red-800/30">
              <pre className="text-xs font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap line-clamp-3">
                {error}
              </pre>
            </div>
          )}
        </div>
      )
    }

    // Special rendering for URL scraper results
    if (toolName === 'urlScraper' && parsedResult && typeof parsedResult === 'object') {
      const scraperResult = parsedResult as any
      
      if (scraperResult.error) {
        return (
          <div className="bg-red-50/50 dark:bg-red-950/10 rounded-lg p-3 border border-red-200/50 dark:border-red-800/30">
            <p className="text-xs text-red-600 dark:text-red-400">{scraperResult.error}</p>
          </div>
        )
      }
      
      return (
        <div className="space-y-3">
          {/* Main content card */}
          <div className="bg-neutral-50/50 dark:bg-neutral-900/50 border border-border/30 rounded-lg p-3">
            <div className="flex gap-3">
              {/* Simple favicon */}
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                  <img
                    src={scraperResult.favicon || `https://www.google.com/s2/favicons?domain=${scraperResult.url ? new URL(scraperResult.url).hostname : ''}&sz=32`}
                    alt=""
                    className="w-5 h-5"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              </div>
              
              <div className="flex-1">
                {scraperResult.title && (
                  <h4 className="text-sm font-medium line-clamp-1">{scraperResult.title}</h4>
                )}
                {scraperResult.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{scraperResult.description}</p>
                )}
                {scraperResult.url && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {new URL(scraperResult.url).hostname.replace('www.', '')}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Content preview - shorter */}
          {scraperResult.content && (
            <div className="bg-neutral-200/30 dark:bg-neutral-900/30 rounded-lg p-3 border border-border/20">
              <p className="text-xs line-clamp-3 text-muted-foreground">
                {scraperResult.content}
              </p>
            </div>
          )}
        </div>
      )
    }

    // Special rendering for VM screenshot results
    if (toolName === 'vmScreenshot' && parsedResult && typeof parsedResult === 'object') {
      const { success, screenshot, timestamp, resolution, message, error } = parsedResult as any
      
      if (success && screenshot) {
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                VM Screenshot {resolution ? `(${resolution})` : ''}
              </span>
              {timestamp && (
                <span className="text-xs text-muted-foreground">
                  {new Date(timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
            
            {/* Display the screenshot */}
            <div className="relative rounded-lg overflow-hidden border border-border/50 bg-background">
              <img
                src={screenshot}
                alt="VM Screenshot"
                className="w-full h-auto block"
                style={{ maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
                loading="lazy"
              />
              {/* Overlay with hover effect */}
              <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors cursor-pointer"
                onClick={() => {
                  // Open image in new tab for full view
                  const win = window.open()
                  if (win) {
                    win.document.write(`<img src="${screenshot}" style="width:100%; height:auto;" />`)
                  }
                }}
              />
            </div>
            
            {message && (
              <p className="text-xs text-muted-foreground italic">{message}</p>
            )}
          </div>
        )
      } else if (error) {
        return (
          <div className="bg-red-50/50 dark:bg-red-950/10 rounded-lg p-3 border border-red-200/50 dark:border-red-800/30">
            <p className="text-xs text-red-600 dark:text-red-400">
              Failed to capture screenshot: {error}
            </p>
          </div>
        )
      }
    }

    // Special rendering for VM action results
    if (toolName === 'vmAction' && parsedResult && typeof parsedResult === 'object') {
      const { success, action, screenshot_before, screenshot_after, error, position, text } = parsedResult as any
      
      return (
        <div className="space-y-3">
          {/* Action status */}
          <div className="flex items-center gap-2">
            {success ? (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                âœ“ {action} executed successfully
              </span>
            ) : (
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                âœ— {action} failed
              </span>
            )}
          </div>
          
          {/* Action details */}
          {position && (
            <div className="text-xs text-muted-foreground">
              Position: ({position.x}, {position.y})
            </div>
          )}
          {text && (
            <div className="text-xs text-muted-foreground">
              Typed: "{text}"
            </div>
          )}
          
          {/* Before/After screenshots */}
          {(screenshot_before || screenshot_after) && (
            <div className="grid grid-cols-2 gap-2">
              {screenshot_before && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Before</p>
                  <div className="relative rounded overflow-hidden border border-border/30">
                    <img
                      src={screenshot_before}
                      alt="Before action"
                      className="w-full h-auto"
                      style={{ maxHeight: '40vh', objectFit: 'contain' }}
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
              {screenshot_after && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">After</p>
                  <div className="relative rounded overflow-hidden border border-border/30">
                    <img
                      src={screenshot_after}
                      alt="After action"
                      className="w-full h-auto"
                      style={{ maxHeight: '40vh', objectFit: 'contain' }}
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
          {error && (
            <div className="bg-red-50/50 dark:bg-red-950/10 rounded-lg p-3 border border-red-200/50 dark:border-red-800/30">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>
      )
    }

    // Special rendering for image search results
    if (toolName === 'imageSearch' && Array.isArray(parsedResult)) {
      const imageResults = parsedResult.filter(item => 
        item && typeof item === 'object' && 'url' in item
      )
      
      if (imageResults.length > 0) {
        return (
          <div className="w-full h-full flex flex-col">
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-zinc-900/95 to-black/95 backdrop-blur-xl border border-zinc-800/50 flex-1 flex flex-col" style={{ minHeight: '600px' }}>
              {/* Modern Header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-zinc-900/50 via-zinc-800/30 to-zinc-900/50 border-b border-zinc-800/30">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-pink-500/20 blur-xl" />
                    <Image className="relative h-4 w-4 text-zinc-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-300">Image Results</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 rounded-full bg-zinc-800/50 backdrop-blur-sm">
                    <span className="text-[11px] font-medium text-zinc-400">
                      {imageResults.length} images
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Modern Body with masonry grid */}
              <div className="p-4 overflow-auto flex-1 bg-gradient-to-b from-transparent to-black/20">
                <div className="grid grid-cols-3 gap-3">
                  {imageResults.slice(0, expandedResults.has(invocation.id) ? imageResults.length : 6).map((item: any, index: number) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.03, duration: 0.3 }}
                    >
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative block"
                      >
                        <div className="relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-800/30 hover:border-zinc-700/50 transition-all duration-300 hover:shadow-xl hover:shadow-black/30">
                          <img
                            src={item.thumbnailUrl || item.url}
                            alt={item.title || `Image ${index + 1}`}
                            className="h-full w-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                            loading="lazy"
                          />
                          
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          
                          {/* Image info on hover */}
                          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-medium text-white/90 truncate max-w-[80%]">
                                {item.title || `Image ${index + 1}`}
                              </span>
                              <ArrowUpRight className="h-3 w-3 text-white/70" />
                            </div>
                          </div>
                          
                          
                          {/* Subtle shine effect on hover */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                        </div>
                      </a>
                    </motion.div>
                  ))}
                </div>
                
                {/* Show more/less buttons */}
                {imageResults.length > 6 && (
                  <div className="mt-4 flex justify-center">
                    {!expandedResults.has(invocation.id) ? (
                      <button 
                        className="px-4 py-2 rounded-full bg-zinc-800/30 hover:bg-zinc-800/50 border border-zinc-700/30 hover:border-zinc-600/50 text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-all duration-300 flex items-center gap-2"
                        onClick={() => {
                          setExpandedResults(prev => {
                            const newSet = new Set(prev)
                            newSet.add(invocation.id)
                            return newSet
                          })
                        }}
                      >
                        <span>Show {imageResults.length - 6} more</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    ) : (
                      <button 
                        className="px-4 py-2 rounded-full bg-zinc-800/30 hover:bg-zinc-800/50 border border-zinc-700/30 hover:border-zinc-600/50 text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-all duration-300 flex items-center gap-2"
                        onClick={() => {
                          setExpandedResults(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(invocation.id)
                            return newSet
                          })
                        }}
                      >
                        <span>Show less</span>
                        <ChevronUp className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
    }

    // Pretty print for other structured data
    if (parsedResult && typeof parsedResult === 'object') {
      // Check if it's an array of objects with consistent structure
      if (Array.isArray(parsedResult) && parsedResult.length > 0) {
        const firstItem = parsedResult[0]
        if (typeof firstItem === 'object') {
          return (
            <div className="space-y-2">
              {parsedResult.slice(0, 3).map((item: any, index: number) => (
                <div key={index} className="bg-neutral-200/30 dark:bg-neutral-900/30 rounded-lg p-3 border border-border/20">
                  {Object.entries(item).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="flex gap-2 text-xs">
                      <span className="font-medium text-muted-foreground">{key}:</span>
                      <span className="text-foreground truncate">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              {parsedResult.length > 3 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{parsedResult.length - 3} more items
                </div>
              )}
            </div>
          )
        }
      }
      
      // For single objects, show key-value pairs
      return (
        <div className="bg-neutral-200/30 dark:bg-neutral-900/30 rounded-lg p-3 border border-border/20 space-y-1">
          {Object.entries(parsedResult).slice(0, 10).map(([key, value]) => (
            <div key={key} className="flex gap-2 text-xs">
              <span className="font-medium text-muted-foreground min-w-[80px]">{key}:</span>
              <span className="text-foreground break-all">
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </span>
            </div>
          ))}
          {Object.keys(parsedResult).length > 10 && (
            <div className="text-xs text-muted-foreground pt-2">
              +{Object.keys(parsedResult).length - 10} more fields
            </div>
          )}
        </div>
      )
    }

    // For simple strings or other types
    if (typeof parsedResult === 'string') {
      return (
        <div className="bg-neutral-200/30 dark:bg-neutral-900/30 rounded-lg p-3 border border-border/20">
          <p className="text-xs whitespace-pre-wrap break-all">{parsedResult}</p>
        </div>
      )
    }

    // Fallback to JSON for anything else
    return (
      <pre className="text-xs bg-neutral-200/30 dark:bg-neutral-900/30 rounded-lg p-3 border border-border/20 overflow-auto" style={{ maxHeight: '50vh' }}>
        <code className="break-all">{JSON.stringify(parsedResult, null, 2)}</code>
      </pre>
    )
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key="project-navigator-panel"
            ref={containerRef}
            initial={{ 
              opacity: 0,
              scale: 0.5,
              x: isMobile ? 0 : "-50%",
              y: "50%"
            }}
            animate={{ 
              opacity: 1,
              scale: 1,
              x: 0,
              y: 0
            }}
            exit={{ 
              opacity: 0,
              scale: 0.5,
              x: isMobile ? 0 : "-50%",
              y: "50%"
            }}
            transition={{ 
              duration: 0.11, 
              ease: "easeOut"
            }}
            className={cn(
            "fixed bg-neutral-100 dark:bg-neutral-800 shadow-xl z-50 flex flex-col",
            "top-[var(--spacing-app-header,56px)] sm:top-[calc(var(--spacing-app-header,56px)+1rem)]",
            "bottom-0 sm:bottom-4",
            "rounded-t-xl sm:rounded-xl overflow-hidden",
            isMobile ? "right-0 w-full" : ""
          )}
          style={{
              transformOrigin: "center bottom", 
            ...(isMobile ? {} : {
              width: `${width}%`,
              right: '1rem'
            })
          }}
        >
          {/* Resize handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-4 cursor-col-resize group hidden sm:flex items-center justify-center z-10"
            onMouseDown={handleMouseDown}
          >
            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-0 top-1/2 -translate-y-1/2">
              <div className="w-1 h-8 bg-primary/50 rounded-full" />
            </div>
          </div>
          <div className="relative flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-4">
              {/* Content */}
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Coasty's personal machine</h3>
                {activeTab === 'activity' && !taskPlan && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs" title="Total number of tasks performed">
                      {toolInvocations.length} {toolInvocations.length === 1 ? 'action' : 'actions'}
                    </Badge>
                    {activeTools > 0 && (
                      <Badge variant="default" className="text-xs bg-orange-500">
                        {activeTools} active
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="relative flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
                  onClick={onToggle}
                  title="Minimize panel"
                >
                  <ArrowsIn className="h-4 w-4" weight="bold" />
                </Button>
              </div>
            </div>

            {/* Task Checklist - Minimal display under header - Hide on mobile */}
            {taskPlan && !isMobile && (
              <div className="px-4 py-2">
                <TaskChecklist 
                  taskPlan={taskPlan}
                  currentTaskId={currentExecutingTaskId || undefined}
                />
              </div>
            )}

            {/* Minimalist Tab Switcher - Only show for owner */}
            {isOwner ? (
              <div className="flex items-center gap-1 px-4 py-2">
                <button
                  onClick={() => setActiveTab('activity')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === 'activity'
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Desktop className="h-3.5 w-3.5" weight="duotone" />
                  Activity
                </button>
                <button
                  onClick={() => setActiveTab('files')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === 'files'
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Files
                </button>
              </div>
            ) : null}
            
            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <AnimatePresence mode="wait">
                {!isOwner || activeTab === 'activity' ? (
                  <motion.div
                    key="activity"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{
                      duration: 0.3,
                      ease: [0.4, 0.0, 0.2, 1]
                    }}
                    className={cn(
                      "p-3 sm:p-3 flex-1 overflow-y-auto scrollbar-invisible absolute top-0 left-0 right-0",
                      toolInvocations.length > 0 ? "bottom-[72px]" : "bottom-0"
                    )}
                  >
                    {toolInvocations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 animate-scale-bounce">
                      <Globe className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Coasty's personal machine is ready</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      I'll search the web, run code, and more to help complete your tasks
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Tasks will appear here in real-time as I work
                    </p>
                  </div>
                  ) : (
                    <div className="relative w-full h-full">
                    <AnimatePresence mode="wait">
                      {(() => {
                        // Find the screenshot for the current step
                        const currentInv = currentTaskTools[0]
                        let screenshot = currentInv?.frontendScreenshot
                        // Also check inside result
                        if (!screenshot && currentInv?.result && typeof currentInv.result === 'object' && 'frontendScreenshot' in currentInv.result) {
                          screenshot = (currentInv.result as any).frontendScreenshot
                        }
                        // Fallback: scan backwards from current step for latest screenshot
                        if (!screenshot) {
                          for (let i = Math.min(currentTask, toolInvocations.length - 1); i >= 0; i--) {
                            const inv = toolInvocations[i]
                            const s = inv?.frontendScreenshot || (inv?.result && typeof inv.result === 'object' && 'frontendScreenshot' in inv.result ? (inv.result as any).frontendScreenshot : null)
                            if (s) { screenshot = s; break }
                          }
                        }
                        // Update lastBrowserScreenshot state for other usages
                        if (screenshot && screenshot !== lastBrowserScreenshot) {
                          setTimeout(() => setLastBrowserScreenshot(screenshot!), 50)
                        }
                        const displayScreenshot = screenshot || lastBrowserScreenshot

                        if (displayScreenshot) {
                          return (
                            <motion.div
                              key={`screenshot-${currentTask}`}
                              className="w-full h-full"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15, ease: "easeOut" }}
                            >
                              <div className="relative w-full h-full rounded-lg overflow-hidden">
                                <img
                                  src={displayScreenshot}
                                  alt="VM Screenshot"
                                  className="w-full h-auto object-cover"
                                />
                                {/* Processing overlay when current step has no screenshot yet */}
                                {!screenshot && lastBrowserScreenshot && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                    <div className="bg-black/80 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                                      <div className="flex gap-1">
                                        {[0, 1, 2].map((i) => (
                                          <motion.div
                                            key={i}
                                            className="w-1 h-1 bg-white/60 rounded-full"
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5 }}
                                          />
                                        ))}
                                      </div>
                                      <span className="text-[11px] text-white/80 font-light tracking-wider uppercase">Processing</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )
                        }

                        // No screenshot at all — show placeholder
                        return (
                          <motion.div
                            key="placeholder"
                            className="w-full h-full flex items-center justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="text-center">
                              <motion.div
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <Desktop className="w-10 h-10 text-zinc-600/50 mx-auto mb-3" />
                              </motion.div>
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-[11px] text-zinc-500/80 font-light tracking-wider uppercase">Working</span>
                                <div className="flex gap-0.5">
                                  {[0, 1, 2].map((i) => (
                                    <motion.span
                                      key={i}
                                      className="text-[11px] text-zinc-400/60"
                                      animate={{ opacity: [0, 1, 0] }}
                                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5 }}
                                    >
                                      .
                                    </motion.span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })()}
                    </AnimatePresence>
                    </div>
                  )}
                  </motion.div>
                ) : isOwner && activeTab === 'files' ? (
                  <motion.div
                    key="files"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{
                      duration: 0.3,
                      ease: [0.4, 0.0, 0.2, 1]
                    }}
                    className="absolute inset-0 flex flex-col p-3"
                  >
                    <FileExplorer
                      machineId={selectedVMId || undefined}
                      userId={currentUserId || undefined}
                      className="flex-1 min-h-0"
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            
            {/* Progress Bar / Player Controls - Minimal Design */}
            {activeTab === 'activity' && toolInvocations.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-muted/80 dark:bg-neutral-800/90 backdrop-blur-sm rounded-b-xl border-t border-border/40 min-h-[72px] shadow-lg">
                <div className="p-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Play Controls */}
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-md"
                        onClick={() => {
                          setHasUserNavigated(true)
                          setNavigationDirection('backward')
                          const newTask = Math.max(0, currentTask - 1)
                          setCurrentTask(newTask)
                          setCurrentStep(newTask)
                          setIsPlaying(false)
                        }}
                        disabled={currentTask === 0}
                      >
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 sm:h-10 sm:w-10 rounded-md bg-primary/10 hover:bg-primary/20"
                        onClick={() => {
                          setIsPlaying(!isPlaying)
                        }}
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                        ) : (
                          <Play className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                        )}
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-md"
                        onClick={() => {
                          setHasUserNavigated(true)
                          setNavigationDirection('forward')
                          const newTask = Math.min(totalTasks - 1, currentTask + 1)
                          setCurrentTask(newTask)
                          setCurrentStep(newTask)
                          setIsPlaying(false)
                        }}
                        disabled={currentTask >= totalTasks - 1}
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Interactive Timeline */}
                    <div
                      className="flex-1 relative h-8 sm:h-8 flex items-center min-w-0"
                    >
                      <div
                        className="absolute inset-0 flex items-center cursor-pointer"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const percentage = Math.max(0, Math.min(1, x / rect.width))
                          const newStep = Math.round(percentage * Math.max(toolInvocations.length - 1, 1))
                          setNavigationDirection(newStep > currentTask ? 'forward' : 'backward')
                          setCurrentStep(newStep)
                          setCurrentTask(newStep)
                          setHasUserNavigated(true)
                          setIsPlaying(false)
                        }}
                      >
                        <div className="relative w-full h-2 bg-neutral-300 dark:bg-neutral-700 rounded-full overflow-hidden hover:h-3 transition-all">
                          <div
                            className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-primary/90 rounded-full transition-all duration-300 ease-out shadow-sm"
                            style={{
                              width: `${(currentStep / Math.max(toolInvocations.length - 1, 1)) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Live Button */}
                    <Button
                      size="sm"
                      variant={currentTask === totalTasks - 1 ? "default" : "ghost"}
                      className={cn(
                        "h-9 px-3 text-xs font-medium rounded-md whitespace-nowrap",
                        currentTask === totalTasks - 1
                          ? "bg-red-500 hover:bg-red-600 text-white min-w-[60px]"
                          : "min-w-[80px]"
                      )}
                      onClick={() => {
                        setHasUserNavigated(false)
                        setNavigationDirection('forward')
                        const lastTask = totalTasks - 1
                        setCurrentTask(lastTask)
                        setCurrentStep(toolInvocations.length - 1)
                        setIsPlaying(false)
                      }}
                      disabled={currentTask === totalTasks - 1}
                    >
                      {currentTask === totalTasks - 1 ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          LIVE
                        </div>
                      ) : (
                        "Go to Live"
                      )}
                    </Button>

                    {/* Connect to Desktop Button - Only show when VM is selected */}
                    {selectedVMId && (
                      <>
                        <div className="h-6 w-px bg-gray-300 dark:bg-zinc-700 mx-1" />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-3 text-xs font-medium rounded-md whitespace-nowrap border-primary/20 hover:bg-primary/10"
                          onClick={openVNCConnection}
                          disabled={connectingToVM}
                        >
                          {connectingToVM ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <MousePointer className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          <span className="hidden sm:inline">
                            {connectingToVM ? "Connecting..." : "Connect to Desktop"}
                          </span>
                          <span className="sm:hidden">
                            {connectingToVM ? "..." : "Connect"}
                          </span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  )
}
