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

  // Memoize the chat input props
  const chatInputProps = useMemo(
    () => {
      return {
      value: input,
      onSuggestion: handleSuggestion,
        onValueChange: handleCollaborativeInputChange,
      onSend: () => submit(),
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
      }
    },
    [
      isCollaborativeRoom,
      providerMessages,
      messages,
      input,
      handleSuggestion,
      handleCollaborativeInputChange,
      submit,
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

  return (
    <div
        className={cn(
          "@container/main relative flex h-full flex-col items-center justify-end md:justify-center no-scrollbar"
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
        {showOnboarding ? (
          <motion.div
            key="onboarding"
            className="absolute bottom-[30%] md:bottom-[60%] mx-auto max-w-[50rem] md:relative md:bottom-auto relative w-full px-4 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            layout="position"
            layoutId="onboarding"
            transition={{
              layout: {
                duration: 0,
              },
            }}
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
                      LLMHub: Your AI
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
        ) : (
          <Conversation key="conversation" {...conversationProps} />
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
        {/* Show tool invocations above chat input for any message */}
        {(() => {
          // Find ANY assistant message with tool invocations (from newest to oldest)
          const messagesWithTools = [...effectiveMessages]
            .reverse()
            .filter(m => m.role === 'assistant' && m.parts?.some((p: any) => p.type === 'tool-invocation'))
          
          if (messagesWithTools.length === 0) return null
          
          // Get the latest message with tools
          const latestMessageWithTools = messagesWithTools[0]
          
          const toolInvocationParts = (latestMessageWithTools.parts?.filter(
            (part: any) => part.type === 'tool-invocation'
          ) || []) as any[]
          
          // Always show if there are tool invocations
          if (toolInvocationParts.length > 0) {
            return (
              <div className="relative z-0 px-1 mx-auto max-w-[52rem]">
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
        <ChatInput {...chatInputProps} />
      </motion.div>
    </div>
  )
}
