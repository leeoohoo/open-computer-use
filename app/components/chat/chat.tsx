"use client"

import { ChatInput } from "@/app/components/chat-input/chat-input"
import { Conversation } from "@/app/components/chat/conversation"
import { ToolInvocation } from "@/app/components/chat/tool-invocation"
import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { MODEL_DEFAULT } from "@/lib/config"
import { SystemPrompts } from "@/lib/prompts/system-prompts"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { useUser } from "@/lib/user-store/provider"
import { cn } from "@/lib/utils"
import type { Message } from "@ai-sdk/react"
import { AnimatePresence, motion } from "motion/react"
import { Caveat } from "next/font/google"
import dynamic from "next/dynamic"
import { redirect } from "next/navigation"
import { useEffect, useMemo, useState, useRef, useCallback } from "react"
import { useChatCore } from "./use-chat-core"
import { InsufficientCreditsModal } from "@/app/components/credits/insufficient-credits-modal"
import { useChatOperations } from "./use-chat-operations"
import { useVMFileUpload } from "./use-vm-file-upload"
import { Card } from "@/components/ui/card"
import { useProjectNavigator } from "@/lib/project-navigator-store/provider"
import { useChatStreaming } from "@/lib/chat-streaming-store/provider"
// import { ResearchSuggestions } from "./research-suggestions" // Removed trending searches
import { themeConfig } from "@/lib/theme-config"
import { Switch } from "@/components/ui/switch"
import { QuickStartGuide } from "./quick-start-guide"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { SwarmPanel } from "./swarm-panel"
import { ActiveSwarmBanner, type ActiveSwarm } from "./active-swarm-banner"

// ── Task templates by role & use-case (activation metric: first task < 5 min) ──
const ROLE_TEMPLATES: Record<string, { label: string; prompt: string }[]> = {
  founder: [
    { label: "Research competitors", prompt: "Research the top 5 competitors in my space, compare their pricing, features, and positioning. Compile everything into a spreadsheet." },
    { label: "Draft investor update", prompt: "Go to my email and draft a monthly investor update summarizing key metrics, milestones hit, and next month's priorities." },
    { label: "Find leads on LinkedIn", prompt: "Search LinkedIn for 20 potential customers matching [your ICP] and export their names, titles, companies, and profile URLs." },
  ],
  developer: [
    { label: "Test a web app", prompt: "Go to [URL] and test the full signup → onboarding → dashboard flow. Screenshot each step and report any bugs or broken UI." },
    { label: "Scrape API docs", prompt: "Go to [documentation URL] and extract all API endpoints, methods, parameters, and response examples into a structured JSON file." },
    { label: "Fill out forms", prompt: "Go to [URL] and fill out the registration form with the following details: [name, email, etc.]" },
  ],
  marketer: [
    { label: "Post on social media", prompt: "Log in to Twitter/X and post: \"[your message]\". Then check for early engagement and reply to any comments." },
    { label: "Research trending topics", prompt: "Search Google, Reddit, and Hacker News for trending topics in [your niche] this week. Summarize the top 10 with links." },
    { label: "Competitor ad analysis", prompt: "Visit [competitor URLs] and screenshot their landing pages, pricing pages, and any ads. Summarize their messaging strategy." },
  ],
  product_manager: [
    { label: "Collect user feedback", prompt: "Go to G2, Capterra, and Product Hunt for [product name]. Extract all reviews from the last 3 months, noting common complaints and feature requests." },
    { label: "Competitive feature matrix", prompt: "Research [competitor 1], [competitor 2], and [competitor 3]. Build a feature comparison matrix covering pricing, integrations, and key capabilities." },
    { label: "Monitor release notes", prompt: "Check the changelogs and release notes of [competitor URLs]. Summarize any new features or changes from the past month." },
  ],
  data_analyst: [
    { label: "Scrape public data", prompt: "Go to [website] and extract all the data from the table on the page. Export it as a CSV file." },
    { label: "Research market stats", prompt: "Search for the latest market size, growth rate, and key statistics for [your industry]. Compile sources and numbers." },
    { label: "Pull financial data", prompt: "Go to Yahoo Finance and pull the last 12 months of stock price data for [ticker symbols]. Save as a spreadsheet." },
  ],
  operations: [
    { label: "Automate data entry", prompt: "Go to [web app URL] and enter the following records into the system: [paste your data or describe the source]." },
    { label: "Vendor price check", prompt: "Visit [vendor website 1] and [vendor website 2]. Compare pricing for [product/service] and summarize the best deal." },
    { label: "Process invoices", prompt: "Go to [email/portal] and download all invoices from the last month. Extract vendor names, amounts, and dates into a spreadsheet." },
  ],
  designer: [
    { label: "Screenshot competitor UIs", prompt: "Visit [competitor URLs] and take full-page screenshots of their homepage, pricing page, and dashboard. Save all images." },
    { label: "Check responsive design", prompt: "Go to [your URL] and test it at mobile (375px), tablet (768px), and desktop (1440px) widths. Screenshot each and note any layout issues." },
    { label: "Find design inspiration", prompt: "Search Dribbble and Behance for the best [dashboard/landing page/mobile app] designs in [your industry]. Save the top 10 screenshots." },
  ],
}

const USE_CASE_TEMPLATES: Record<string, { label: string; prompt: string }[]> = {
  web_scraping: [
    { label: "Scrape a website", prompt: "Go to [URL] and extract all [product names / prices / emails / data] from the page. Export as a CSV." },
  ],
  browser_automation: [
    { label: "Automate a workflow", prompt: "Go to [website], log in with my saved credentials, navigate to [section], and [perform action]. Repeat for all items." },
  ],
  data_entry: [
    { label: "Bulk data entry", prompt: "Go to [web app] and enter these records one by one: [paste data]. Confirm each entry was saved." },
  ],
  email_outreach: [
    { label: "Send personalized emails", prompt: "Go to my email and send personalized messages to these contacts: [list]. Use this template: [your template]." },
  ],
  testing: [
    { label: "QA test a website", prompt: "Go to [URL] and test the core user flows: signup, login, main feature, and logout. Screenshot each step and report any bugs." },
  ],
  ecommerce: [
    { label: "Monitor product prices", prompt: "Check [competitor store URLs] for [product name] pricing. Record current prices, availability, and any active promotions." },
  ],
  social_media: [
    { label: "Post & engage", prompt: "Log in to [Twitter/LinkedIn/Reddit] and post: \"[your content]\". Then engage with any replies for the next few minutes." },
  ],
  general_automation: [
    { label: "Automate a task", prompt: "Go to [website] and [describe what you need done step by step]." },
  ],
}

function getTaskTemplates(role: string | null | undefined, useCase: string | null | undefined): { label: string; prompt: string }[] {
  const templates: { label: string; prompt: string }[] = []
  const seen = new Set<string>()

  // Add role-based templates first (primary persona)
  const roles = (role || "").split(",").map(r => r.trim()).filter(Boolean)
  for (const r of roles) {
    for (const t of ROLE_TEMPLATES[r] || []) {
      if (!seen.has(t.label)) {
        seen.add(t.label)
        templates.push(t)
      }
    }
  }

  // Fill with use-case templates
  const useCases = (useCase || "").split(",").map(u => u.trim()).filter(Boolean)
  for (const uc of useCases) {
    for (const t of USE_CASE_TEMPLATES[uc] || []) {
      if (!seen.has(t.label)) {
        seen.add(t.label)
        templates.push(t)
      }
    }
  }

  // Fallback if nothing matched
  if (templates.length === 0) {
    return [
      { label: "Scrape a website", prompt: "Go to [URL] and extract all the data from the page. Export as a CSV." },
      { label: "Test a web app", prompt: "Go to [URL] and test the full signup → dashboard flow. Screenshot each step and report any bugs." },
      { label: "Research a topic", prompt: "Search Google for [your topic] and summarize the top 10 results with key takeaways and links." },
      { label: "Fill out a form", prompt: "Go to [URL] and fill out the form with the following details: [your data]." },
    ]
  }

  return templates.slice(0, 4)
}

const handwriting = Caveat({
  subsets: ["latin"],
  weight: ["600"],
})


const DialogAuth = dynamic(
  () => import("./dialog-auth").then((mod) => mod.DialogAuth),
  { ssr: false }
)

export function Chat() {
  const { chatId } = useChatSession()
  const {
    createNewChat,
    getChatById,
    updateChatModel,
    bumpChat,
    isLoading: isChatsLoading,
  } = useChats()

  // Text rotation state
  const words = ["Co-worker", "Employee", "Friend", "Assistant", "Partner", "Teammate", "Collaborator", "Helper"]
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [wordWidth, setWordWidth] = useState(150)
  const wordRef = useRef<HTMLSpanElement>(null)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % words.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])
  
  // Measure word width
  useEffect(() => {
    if (wordRef.current) {
      const width = wordRef.current.offsetWidth
      setWordWidth(width + 16) // Add minimal padding
    }
  }, [currentWordIndex])

  // Local chat ID state to handle chat creation timing issues
  const [localChatId, setLocalChatId] = useState<string | null>(null)
  const effectiveChatId = localChatId || chatId

  // Sync local chat ID with URL-based chat ID when URL changes
  useEffect(() => {
    if (chatId && chatId !== localChatId) {
      setLocalChatId(chatId)
    } else if (!chatId && localChatId) {
      // Reset local chat ID when navigating away from a chat
      setLocalChatId(null)
    }
  }, [chatId, localChatId])

  const currentChat = useMemo(
    () => (effectiveChatId ? getChatById(effectiveChatId) : null),
    [effectiveChatId, getChatById]
  )

  // Get messages from provider for collaborative rooms
  const { 
    messages: providerMessages, 
    isCollaborativeRoom: isCollaborativeFromProvider,
    cacheAndAddMessage,
    setStreamingStatus
  } = useMessages()
  
  // Clean tool invocations from provider messages to ensure only complete ones are passed
  const cleanMessageToolInvocations = (messages: Message[]): Message[] => {
    return messages.map(message => {
      // Check if message has parts array (newer format)
      if (message.role === "assistant" && message.parts && Array.isArray(message.parts)) {
        // Filter out incomplete tool invocations from parts
        const cleanedParts = message.parts.filter(part => {
          if (part.type === "tool-invocation") {
            const toolInvocation = part.toolInvocation
            // Only keep tool invocations that have state "result" AND have a result property
            return toolInvocation?.state === "result" && 
                   'result' in toolInvocation &&
                   toolInvocation.result !== undefined
          }
          return true // Keep all non-tool content
        })
        
        // Extract text content from parts for the content field
        const textContent = cleanedParts
          .filter(part => part.type === "text")
          .map(part => part.text)
          .join("")
        
        return { 
          ...message, 
          content: textContent || message.content,
          parts: cleanedParts 
        }
      }
      
      // Check if message has content array (older format or mixed format)
      if (message.role === "assistant" && typeof message.content !== 'string' && Array.isArray((message as any).content)) {
        // Filter out incomplete tool invocations
        const cleanedContent = (message as any).content.filter((part: any) => {
          if (part.type === "tool-invocation") {
            const toolInvocation = part.toolInvocation
            // Only keep tool invocations that have state "result" AND have a result property
            return toolInvocation?.state === "result" && 
                   'result' in toolInvocation &&
                   toolInvocation.result !== undefined
          }
          return true // Keep all non-tool content
        })
        
        // Extract text content
        const textContent = cleanedContent
          .filter((part: any) => part.type === "text")
          .map((part: any) => part.text || "")
          .join("")
        
        return { 
          ...message, 
          content: textContent || "",
          parts: cleanedContent 
        } as any
      }
      
      return message
    })
  }
  
  // Use cleaned providerMessages as initialMessages for consistency
  const initialMessages = cleanMessageToolInvocations(providerMessages)

  const { user } = useUser()
  const { preferences } = useUserPreferences()
  const { draftValue, clearDraft } = useChatDraft(effectiveChatId)

  // Fetch subscription tier + machine limits for swarm gating
  const [userTier, setUserTier] = useState<string | null>(null)
  const [maxSwarmMachines, setMaxSwarmMachines] = useState(2)
  useEffect(() => {
    if (!user?.id) return
    fetch("/api/machines")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.subscriptionTier) setUserTier(data.subscriptionTier)
        else setUserTier("free")
        // Swarm limit = 3x persistent machine limit, capped at 10
        const planMax = data?.limits?.max_machines || 1
        setMaxSwarmMachines(Math.min(planMax * 3, 10))
      })
      .catch(() => { setUserTier("free"); setMaxSwarmMachines(3) })
  }, [user?.id])
  const { 
    isOpen: isNavigatorOpen, 
    width: navigatorWidth,
    selectedVMId,
    setSelectedVMId 
  } = useProjectNavigator()
  
  // File upload functionality - VM only
  const {
    files,
    setFiles,
    handleFileUpload,
    handleFileRemove,
    createOptimisticAttachments,
    cleanupOptimisticAttachments,
    handleFileUploads: vmHandleFileUploads,
  } = useVMFileUpload()
  
  // Wrap handleFileUploads for compatibility with existing code
  const handleFileUploads = useCallback(async (uid: string, chatId: string) => {
    // Ignore uid and chatId, use VM upload with machineId
    return vmHandleFileUploads(selectedVMId)
  }, [selectedVMId, vmHandleFileUploads])

  // Always use the default model
  const selectedModel = MODEL_DEFAULT

  // State to pass between hooks
  const [hasDialogAuth, setHasDialogAuth] = useState(false)
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])
  const systemPrompt = useMemo(
    () => user?.system_prompt || SystemPrompts.main(),
    [user?.system_prompt]
  )

  // Chat operations (utils + handlers) - created first
  const { checkLimitsAndNotify, ensureChatExists, handleDelete, handleEdit } =
    useChatOperations({
      isAuthenticated,
      chatId: effectiveChatId,
      messages: initialMessages,
      initialMessages,
      selectedModel,
      systemPrompt,
      createNewChat,
      setHasDialogAuth,
      setMessages: () => {},
      setInput: () => {},
      setLocalChatId,
    })

  // Check if current chat is collaborative (always false now)
  const isCollaborativeRoom = false
  const isProject = false

  // Core chat functionality (initialization + state + actions)
  const {
    messages,
    input,
    status,
    stop,
    hasSentFirstMessageRef,
    isSubmitting,
    enableSearch,
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
    creditsModalOpen,
    setCreditsModalOpen,
    creditsModalData,
  } = useChatCore({
    initialMessages,
    draftValue,
    cacheAndAddMessage,
    chatId: effectiveChatId,
    user,
    // File upload parameters
    files,
    createOptimisticAttachments,
    setFiles,
    checkLimitsAndNotify,
    cleanupOptimisticAttachments,
    ensureChatExists,
    handleFileUploads,
    selectedModel,
    selectedVMId,
    clearDraft,
    bumpChat,
  })

  // Inform messages provider about streaming status
  useEffect(() => {
    setStreamingStatus(status)
  }, [status, setStreamingStatus])

  // Input change handler
  const handleCollaborativeInputChange = handleInputChange

  // Keep track of recently completed messages to prevent them from disappearing
  const [recentlyCompletedMessages, setRecentlyCompletedMessages] = useState<Set<string>>(new Set())
  
  // Keep track of optimistic messages that should be hidden once real message arrives
  const [optimisticToHide, setOptimisticToHide] = useState<Set<string>>(new Set())
  
  // Track when streaming completes to preserve messages
  useEffect(() => {
    if (status === 'ready' && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.role === 'assistant') {
        setRecentlyCompletedMessages(prev => new Set(prev).add(lastMessage.id))
        
        // Remove from recently completed after a delay
        setTimeout(() => {
          setRecentlyCompletedMessages(prev => {
            const next = new Set(prev)
            next.delete(lastMessage.id)
            return next
          })
        }, 3000) // Keep for 3 seconds to ensure DB sync
      }
    }
  }, [status, messages])
  
  // Detect when optimistic messages have been saved to DB
  useEffect(() => {
    if (!isCollaborativeRoom) return
    
    // Find optimistic messages in streaming messages
    const optimisticMessages = messages.filter(m => m.id.startsWith('optimistic-') && m.role === 'user')
    
    optimisticMessages.forEach(optMsg => {
      // Check if a real message exists in provider messages with similar content
      // Use a more lenient check that doesn't rely on exact timing
      const hasRealVersion = providerMessages.some(provMsg => {
        if (provMsg.role !== 'user') return false
        
        // Compare content (trimmed and normalized)
        const sameContent = provMsg.content.trim() === optMsg.content.trim()
        
        // Don't check timing at all - just match by content
        // This ensures the first message duplicate is properly detected
        return sameContent
      })
      
      if (hasRealVersion && !optimisticToHide.has(optMsg.id)) {
        setOptimisticToHide(prev => new Set(prev).add(optMsg.id))
      }
    })
  }, [messages, providerMessages, isCollaborativeRoom, optimisticToHide])

  // Merge streaming messages with provider messages for collaborative rooms
  const effectiveMessages = useMemo(() => {
    if (!isCollaborativeRoom) return messages
    
    // Debug logging for duplicate message issue
    if (messages.length > 0 || providerMessages.length > 0) {
      console.log('[Chat] Merging messages:', {
        streamingMessages: messages.map(m => ({ 
          id: m.id, 
          role: m.role,
          content: m.content.substring(0, 50) + '...',
          createdAt: m.createdAt 
        })),
        providerMessages: providerMessages.map(m => ({ 
          id: m.id, 
          role: m.role,
          content: m.content.substring(0, 50) + '...',
          createdAt: m.createdAt 
        })),
        optimisticToHide: Array.from(optimisticToHide),
        isCollaborativeRoom
      })
    }
    
    // Always merge both sources to prevent messages from disappearing
    const mergedMap = new Map<string, Message>()
    
    // Keep track of content we've already added to prevent exact duplicates
    const addedContent = new Set<string>()
    
    // Add provider messages (from database) - these are the "real" messages
    providerMessages.forEach(msg => {
      mergedMap.set(msg.id, msg)
      // Track message content to prevent duplicates (both user and assistant)
      addedContent.add(`${msg.role}:${msg.content.trim()}`)
    })
    
    // Then overlay streaming messages, but filter out duplicates
    messages.forEach(msg => {
      // Skip optimistic messages that we know have real versions
      if (msg.id.startsWith('optimistic-') && optimisticToHide.has(msg.id)) {
        return // Skip this message
      }
      
      if (msg.id.startsWith('optimistic-')) {
        // Check if we already have this content from provider messages
        const contentKey = `${msg.role}:${msg.content.trim()}`
        
        // If this exact content already exists in provider messages, skip it
        if (addedContent.has(contentKey)) {
          console.log('[Chat] Skipping duplicate optimistic message:', {
            optimisticId: msg.id, 
            role: msg.role,
            content: msg.content.substring(0, 50) + '...',
            alreadyInProvider: true
          })
          return
        }
        
        // For other optimistic messages, check if real version exists
        const hasRealVersion = Array.from(mergedMap.values()).some(existingMsg => {
          if (existingMsg.role !== msg.role) return false
          
          // Compare content exactly (trim whitespace but keep case)
          const sameContent = existingMsg.content.trim() === msg.content.trim()
          
          // For optimistic messages, just check content match
          // Don't check timing as it can vary greatly for first messages
          return sameContent
        })
        
        // Only add optimistic message if no real version exists
        if (!hasRealVersion) {
          mergedMap.set(msg.id, msg)
          addedContent.add(`${msg.role}:${msg.content.trim()}`)
        }
      } else {
        // For non-optimistic messages, check for content duplicates for all messages
        const contentKey = `${msg.role}:${msg.content.trim()}`
        
        // Check if we already have a message with this exact content
        const hasDuplicate = Array.from(mergedMap.values()).some(existing => 
          existing.role === msg.role && 
          existing.id !== msg.id &&
          existing.content.trim() === msg.content.trim()
        )
        
        if (hasDuplicate) {
          console.log('[Chat] Skipping duplicate message:', {
            messageId: msg.id,
            role: msg.role,
            content: msg.content.substring(0, 50) + '...'
          })
          return
        }
        
        // For non-optimistic messages, always prefer streaming version during active streaming
        const existingMsg = mergedMap.get(msg.id)
        if (!existingMsg || 
            status === 'streaming' || 
            status === 'submitted' ||
            recentlyCompletedMessages.has(msg.id) ||
            (msg.parts && msg.parts.length > 0)) {
          mergedMap.set(msg.id, msg)
          
          // Track message content for both user and assistant
          addedContent.add(`${msg.role}:${msg.content.trim()}`)
        }
      }
    })
    
    // Return merged messages sorted by creation time
    return Array.from(mergedMap.values()).sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime()
      const bTime = new Date(b.createdAt || 0).getTime()
      return aTime - bTime
    })
  }, [isCollaborativeRoom, providerMessages, messages, status, recentlyCompletedMessages, optimisticToHide])

  // Memoize the conversation props to prevent unnecessary rerenders
  const conversationProps = useMemo(
    () => ({
      messages: effectiveMessages,
      status,
      onDelete: handleDelete,
      onEdit: handleEdit,
      onReload: handleReload,
    }),
    [effectiveMessages, status, handleDelete, handleEdit, handleReload]
  )

  // Swarm mode state — only available on homepage (no active chat)
  const [swarmMode, setSwarmMode] = useState(false)
  const [swarmCount, setSwarmCount] = useState(3)
  const [swarmActive, setSwarmActive] = useState(false)
  const [swarmId, setSwarmId] = useState<string | null>(null)
  const [swarmPrompt, setSwarmPrompt] = useState("")
  // Track if an existing active swarm was detected on page load
  const [existingActiveSwarm, setExistingActiveSwarm] = useState<ActiveSwarm | null>(null)

  const handleActiveSwarmDetected = useCallback((swarm: ActiveSwarm | null) => {
    setExistingActiveSwarm(swarm)
  }, [])

  // Reset swarm mode when entering a chat
  useEffect(() => {
    if (effectiveChatId) {
      setSwarmMode(false)
    }
  }, [effectiveChatId])

  // Check if there are tool invocations to show above the chat input
  const hasToolInvocations = useMemo(() => {
    const messagesWithTools = [...effectiveMessages]
      .reverse()
      .filter(m => m.role === 'assistant' && m.parts?.some((p: any) => p.type === 'tool-invocation'))
    if (messagesWithTools.length === 0) return false
    const latestMessageWithTools = messagesWithTools[0]
    const toolInvocationParts = (latestMessageWithTools.parts?.filter(
      (part: any) => part.type === 'tool-invocation'
    ) || []) as any[]
    return toolInvocationParts.length > 0
  }, [effectiveMessages])

  // Swarm submit handler
  const handleSwarmSubmit = useCallback(() => {
    if (swarmMode && input.trim()) {
      const id = crypto.randomUUID()
      setSwarmId(id)
      setSwarmPrompt(input)
      setSwarmActive(true)
      handleCollaborativeInputChange("")
    } else {
      submit()
    }
  }, [swarmMode, input, submit, handleCollaborativeInputChange])

  const handleSwarmStop = useCallback(() => {
    // Don't dismiss the panel — it stays visible showing final state.
    // The panel itself handles showing completed/cancelled results.
  }, [])

  const handleSwarmDismiss = useCallback(() => {
    // User explicitly wants to start fresh — dismiss the panel
    setSwarmActive(false)
    setSwarmId(null)
    setSwarmPrompt("")
  }, [])

  // Memoize the chat input props
  const chatInputProps = useMemo(
    () => {
      return {
      value: input,
      onSuggestion: handleSuggestion,
        onValueChange: handleCollaborativeInputChange,
      onSend: handleSwarmSubmit,
      isSubmitting,
      // File upload props
      files,
      onFileUpload: handleFileUpload,
      onFileRemove: handleFileRemove,
      hasSuggestions: false,
      selectedVMId,
      setSelectedVMId,
      isUserAuthenticated: isAuthenticated,
      stop,
      status,
      onAuthRequired: () => setHasDialogAuth(true),
      hasToolInvocations,
      // Swarm mode only available on homepage (no active chat)
      swarmMode: !effectiveChatId ? swarmMode : false,
      onSwarmModeChange: !effectiveChatId ? setSwarmMode : undefined,
      swarmCount: !effectiveChatId ? swarmCount : undefined,
      onSwarmCountChange: !effectiveChatId ? setSwarmCount : undefined,
      userTier,
      maxSwarmMachines,
      }
    },
    [
      isCollaborativeRoom,
      providerMessages,
      messages,
      input,
      handleSuggestion,
      handleCollaborativeInputChange,
      handleSwarmSubmit,
      isSubmitting,
      // File upload dependencies
      files,
      handleFileUpload,
      handleFileRemove,
      preferences.promptSuggestions,
      effectiveChatId,
      selectedVMId,
      setSelectedVMId,
      isAuthenticated,
      stop,
      status,
      setHasDialogAuth,
      hasToolInvocations,
      swarmMode,
      swarmCount,
      userTier,
      maxSwarmMachines,
    ]
  )

  // Handle redirect for invalid chatId - only redirect if we're certain the chat doesn't exist
  // and we're not in a transient state during chat creation
  // Update streaming messages in the global store
  const { setStreamingMessages } = useChatStreaming()
  useEffect(() => {
    setStreamingMessages(effectiveMessages)
  }, [effectiveMessages, setStreamingMessages])
  
  const redirectCheckMessages = isCollaborativeRoom ? providerMessages : messages
  if (
    effectiveChatId &&
    !isChatsLoading &&
    !currentChat &&
    !isSubmitting &&
    status === "ready" &&
    redirectCheckMessages.length === 0 &&
    !hasSentFirstMessageRef.current // Don't redirect if we've already sent a message in this session
  ) {
    return redirect("/")
  }

  const showOnboarding = !effectiveChatId && redirectCheckMessages.length === 0

  // Quick start guide for first-time users
  // Start as false on both server and client to avoid hydration mismatch,
  // then sync from localStorage after mount.
  const [quickStartDismissed, setQuickStartDismissed] = useState(false)
  useEffect(() => {
    if (localStorage.getItem("coasty-quickstart-dismissed") === "true") {
      setQuickStartDismissed(true)
    }
  }, [])

  // Check if user has saved credentials (for nudge in greeting)
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null)
  useEffect(() => {
    if (!isAuthenticated) return
    fetch("/api/secrets")
      .then((r) => r.json())
      .then((data) => setHasCredentials((data.secrets ?? []).length > 0))
      .catch(() => {})
  }, [isAuthenticated])

  const showQuickStart =
    showOnboarding &&
    !!user &&
    !quickStartDismissed

  // Task templates based on onboarding role + use-case (activation metric)
  const taskTemplates = useMemo(
    () => getTaskTemplates(user?.role, user?.use_case),
    [user?.role, user?.use_case]
  )

  // Any swarm is taking over the screen (new or returning)
  const swarmFullscreen = swarmActive || (!!existingActiveSwarm && showOnboarding)

  return (
    <div
        className={cn(
          "@container/main relative flex h-full flex-col items-center no-scrollbar",
          swarmFullscreen ? "justify-start" : "justify-end md:justify-center"
        )}
      >
        <DialogAuth open={hasDialogAuth} setOpen={setHasDialogAuth} />
        <InsufficientCreditsModal
          isOpen={creditsModalOpen}
          onClose={() => setCreditsModalOpen(false)}
          currentBalance={creditsModalData.currentBalance}
          requiredCredits={creditsModalData.requiredCredits}
          estimatedRuntime={creditsModalData.estimatedRuntime}
          errorMessage={creditsModalData.errorMessage}
        />

      
      <AnimatePresence initial={false} mode="popLayout">
        {showOnboarding && !swarmFullscreen && (
          <motion.div
            key="onboarding"
            className="absolute bottom-[25%] sm:bottom-auto mx-auto sm:relative w-full overflow-visible pb-16 sm:pb-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } }}
            layout="position"
            layoutId="onboarding"
            transition={{
              layout: {
                duration: 0,
              },
            }}
          >
            {/* Crossfade between guide and greeting */}
            <AnimatePresence mode="wait" initial={false}>
              {showQuickStart ? (
                <motion.div
                  key="guide"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <QuickStartGuide
                    userName={user?.display_name || undefined}
                    selectedVMId={selectedVMId}
                    setSelectedVMId={setSelectedVMId}
                    onFillInput={handleInputChange}
                    isUserAuthenticated={isAuthenticated}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="greeting"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="max-w-[50rem] mx-auto px-4"
                >
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                    className="text-center mb-2"
                  >
                    <h1
                      className={cn(
                        "text-4xl sm:text-5xl font-bold tracking-tight relative z-10 leading-relaxed pb-1 flex items-center justify-center gap-2 flex-wrap",
                        user ? handwriting.className : ""
                      )}
                    >
                      {user ? (
                        <>
                          <span className="inline-block -rotate-1 text-primary/90">Hello</span>
                          {user.display_name && (
                            <>
                              <span className="inline-block -rotate-1 text-primary/90">, {user.display_name}</span>
                            </>
                          )}
                          <span className="inline-block -rotate-1 text-primary/90">!</span>
                        </>
                      ) : (
                        <>
                          <span className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Coasty: Your AI
                          </span>
                        </>
                      )}
                      {!user && (
                        <motion.span
                          className="relative inline-flex items-center overflow-hidden align-middle"
                          animate={{ width: wordWidth }}
                          transition={{
                            type: "spring",
                            stiffness: 100,
                            damping: 15,
                            mass: 0.5
                          }}
                          style={{ height: "1.4em" }}
                        >
                          <motion.span
                            className={`absolute inset-0 rounded-xl bg-gradient-to-r ${themeConfig.gradients.wordRotation.base}`}
                            animate={{
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                          <motion.span
                            className="absolute inset-0 rounded-xl"
                            style={{
                              background: `radial-gradient(circle at 50% 50%, ${themeConfig.gradients.wordRotation.radialGlow} 0%, transparent 70%)`,
                            }}
                          />
                          <AnimatePresence mode="sync">
                            <motion.span
                              key={currentWordIndex}
                              initial={{ y: "100%", opacity: 0 }}
                              animate={{ y: "0%", opacity: 1 }}
                              exit={{ y: "-100%", opacity: 0 }}
                              transition={{
                                duration: 0.5,
                                ease: [0.25, 0.46, 0.45, 0.94]
                              }}
                              className="absolute w-full h-full flex items-center justify-center"
                            >
                              <span
                                ref={wordRef}
                                className={`relative px-2 ${themeConfig.primary.tw.text.base} font-bold whitespace-nowrap`}
                              >
                                {words[currentWordIndex]}
                              </span>
                            </motion.span>
                          </AnimatePresence>
                          <motion.span
                            className={`absolute inset-0 rounded-xl border ${themeConfig.gradients.wordRotation.border}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          />
                        </motion.span>
                      )}
                    </h1>
                  </motion.div>

                  <motion.div
                    className="flex justify-center mb-6 px-2"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    <p className="text-center text-muted-foreground text-sm sm:text-base md:text-lg">
                      {user
                        ? "I'll handle the computer work. What's the task?"
                        : "AI that works the computer so you don't have to. Just tell it what you need done."
                      }
                    </p>
                  </motion.div>

                </motion.div>
              )}
            </AnimatePresence>

            {/* Guide toggle + credential nudge */}
            {user && (
              <motion.div
                className="flex items-center justify-center gap-3 mt-4 sm:mt-6 mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <span className="text-xs text-muted-foreground">Guide</span>
                  <Switch
                    checked={!quickStartDismissed}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        localStorage.removeItem("coasty-quickstart-dismissed")
                        setQuickStartDismissed(false)
                      } else {
                        localStorage.setItem("coasty-quickstart-dismissed", "true")
                        setQuickStartDismissed(true)
                      }
                    }}
                  />
                </label>
                {hasCredentials === false && (
                  <>
                    <span className="text-muted-foreground/20 text-xs select-none">&middot;</span>
                    <Link
                      href="/secrets"
                      className="group inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/15 px-3 py-1 text-[11px] text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                    >
                      <ShieldCheck className="h-3 w-3 shrink-0" />
                      <span className="underline underline-offset-2 decoration-blue-400/30 group-hover:decoration-blue-400/60">Save logins for auto-fill</span>
                      <span className="hidden sm:inline text-blue-500/50">&middot; encrypted, never seen by AI</span>
                      <span className="text-[10px] group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                    </Link>
                  </>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
        {!showOnboarding && !swarmFullscreen && (
          <Conversation key="conversation" {...conversationProps} />
        )}
      </AnimatePresence>

      {/* Swarm panel — fills available space between header and input */}
      <AnimatePresence>
        {swarmActive && (
          <motion.div
            key="swarm-panel"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30, transition: { duration: 0.25 } }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
            className="flex-1 w-full mx-auto px-4 sm:px-6 md:px-8 min-h-0 pb-2 flex flex-col"
          >
            <SwarmPanel
              isActive={swarmActive}
              swarmId={swarmId}
              prompt={swarmPrompt}
              machineCount={swarmCount}
              onStop={handleSwarmStop}
              onDismiss={handleSwarmDismiss}
            />
          </motion.div>
        )}
        {!swarmActive && existingActiveSwarm && showOnboarding && (
          <motion.div
            key="active-swarm-fullscreen"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30, transition: { duration: 0.25 } }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
            className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 min-h-0 pb-2 flex flex-col"
          >
            <ActiveSwarmBanner fullscreen onSwarmDetected={handleActiveSwarmDetected} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={cn(
          "relative inset-x-0 bottom-0 z-50 mx-auto w-full px-4 sm:px-6 md:px-8",
          !isProject || !isNavigatorOpen ? "max-w-3xl" : "max-w-4xl"
        )}
        layout="position"
        layoutId="chat-input-container"
        transition={{
          layout: {
            duration: effectiveMessages.length === 1 ? 0.3 : 0,
          },
        }}
      >
        {/* Show tool invocations dock above chat input */}
        {(() => {
          const messagesWithTools = [...effectiveMessages]
            .reverse()
            .filter(m => m.role === 'assistant' && m.parts?.some((p: any) => p.type === 'tool-invocation'))

          if (messagesWithTools.length === 0) return null

          const latestMessageWithTools = messagesWithTools[0]

          const toolInvocationParts = (latestMessageWithTools.parts?.filter(
            (part: any) => part.type === 'tool-invocation'
          ) || []) as any[]

          if (toolInvocationParts.length > 0) {
            return (
              <div className="relative z-10">
                <ToolInvocation toolInvocations={toolInvocationParts} />
              </div>
            )
          }

          return null
        })()}
        
        {/* Research suggestions removed
        {showOnboarding && (
          <ResearchSuggestions 
            onSelectSuggestion={handleSuggestion} 
            className="mb-3 -mx-4 sm:mx-0"
          />
        )} */}
        {/* Show inline active swarm banner only when not in fullscreen swarm mode */}
        {showOnboarding && !swarmFullscreen && <ActiveSwarmBanner onSwarmDetected={handleActiveSwarmDetected} />}
        <ChatInput {...chatInputProps} />

        {/* Task templates — reduces friction to first task completion */}
        <AnimatePresence>
          {showOnboarding && !swarmMode && !swarmFullscreen && user && (
            <motion.div
              key="task-templates"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
              transition={{ delay: 0.3, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="mt-3 mb-1"
            >
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-muted-foreground/50">
                  <path d="M8 1l1.796 4.898L15 7.5l-3.804 2.952L12.392 16 8 12.6 3.608 16l1.196-5.548L1 7.5l5.204-1.602L8 1z" fill="currentColor" opacity="0.5" />
                  <path d="M8 1l1.796 4.898L15 7.5l-3.804 2.952L12.392 16 8 12.6 3.608 16l1.196-5.548L1 7.5l5.204-1.602L8 1z" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                </svg>
                <span className="text-[11px] text-muted-foreground/50 font-medium tracking-wide">Try a task</span>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {taskTemplates.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => handleCollaborativeInputChange(t.prompt)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border/40 bg-card/60 hover:bg-accent/60 hover:border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
