import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/prompt-kit/chat-container"
import { Loader } from "@/components/prompt-kit/loader"
import { Message as MessageType } from "@ai-sdk/react"
import { useRef, useEffect, useState } from "react"
import { Message } from "./message"
import { motion, AnimatePresence } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Users, Wifi, WifiOff, Loader2, AlertCircle } from "lucide-react"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { useProjectNavigator } from "@/lib/project-navigator-store/provider"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { cn } from "@/lib/utils"

type ConversationProps = {
  messages: MessageType[]
  status?: "streaming" | "ready" | "submitted" | "error"
  onDelete: (id: string) => void
  onEdit: (id: string, newText: string) => void
  onReload: () => void
}

export function Conversation({
  messages,
  status = "ready",
  onDelete,
  onEdit,
  onReload,
}: ConversationProps) {
  const { isLoading } = useMessages()
  const initialMessageCount = useRef(messages.length)
  const [isConnected, setIsConnected] = useState(true)
  const { lastSyncTime, syncStatus } = useMessages()
  const { isOpen: isNavigatorOpen, width: navigatorWidth } = useProjectNavigator()
  const { chatId } = useChatSession()
  const { getChatById } = useChats()
  
  const currentChat = chatId ? getChatById(chatId) : null
  const isProject = currentChat?.collaborative === true

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => setIsConnected(true)
    const handleOffline = () => setIsConnected(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Get sync status display with enhanced effects
  const getSyncStatusDisplay = () => {
    return null // No longer collaborative

    // During streaming, show simple "Live" status
    if (status === 'streaming') {
      return (
        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400 animate-pulse">
          <Wifi className="h-3 w-3 mr-1 text-green-600" />
          Live
        </Badge>
      )
    }

    switch (syncStatus) {
      case 'syncing':
        return (
          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-400">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Syncing...
          </Badge>
        )
      case 'completed':
        return (
          <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400 animate-pulse">
            <CheckCircle className="h-3 w-3 mr-1" />
            Synced
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="destructive" className="text-xs animate-pulse">
            <AlertCircle className="h-3 w-3 mr-1" />
            Sync Error
          </Badge>
        )
      default:
        return isConnected ? (
          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400">
            <Wifi className="h-3 w-3 mr-1 text-green-600" />
            Live
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-xs">
            <WifiOff className="h-3 w-3 mr-1" />
            Offline
          </Badge>
        )
    }
  }

  // Show skeleton loader during initial load
  if (false && isLoading && messages.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading collaborative room...</span>
        </div>
      </div>
    )
  }

  if (!messages || messages.length === 0)
    return <div className="h-full w-full"></div>

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-hidden no-scrollbar scroll-container">

      {/* Project status bar removed - no longer collaborative */}
      {/* {false && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ 
            opacity: 1, 
            y: 0,
            // Add subtle pulsing effect when syncing
            scale: syncStatus === 'syncing' ? [1, 1.02, 1] : 1
          }}
          transition={{ 
            duration: 0.3,
            scale: { repeat: syncStatus === 'syncing' ? Infinity : 0, duration: 1.5 }
          }}
          className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-20 border rounded-lg px-3 py-1.5 text-sm flex items-center gap-3 shadow-sm transition-all duration-300 ${
            syncStatus === 'completed' 
              ? 'bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-800' 
              : syncStatus === 'syncing'
              ? 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-800'
              : syncStatus === 'error'
              ? 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800'
              : 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className={`h-4 w-4 transition-colors duration-300 ${
              syncStatus === 'completed' 
                ? 'text-emerald-600' 
                : syncStatus === 'error'
                ? 'text-red-600'
                : 'text-blue-600'
            }`} />
            <span className={`font-medium transition-colors duration-300 ${
              syncStatus === 'completed' 
                ? 'text-emerald-700 dark:text-emerald-300' 
                : syncStatus === 'error'
                ? 'text-red-700 dark:text-red-300'
                : 'text-blue-700 dark:text-blue-300'
            }`}>Project</span>
          </div>
          
          <div className="flex items-center gap-2">
            {getSyncStatusDisplay()}
            
            {/* Show last sync time for completed status */}
            {/* {syncStatus === 'completed' && lastSyncTime && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-muted-foreground"
              >
                {new Date(lastSyncTime).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </motion.span>
            )} */}
          {/* </div>
        </motion.div>
      )} */}

      <ChatContainerRoot className="relative w-full h-full">
        <ChatContainerContent
          className="flex w-full flex-col items-center pt-4 pb-4"
        >
          <div className={cn(
            "w-full px-6 sm:px-8 md:px-10",
            !isProject || !isNavigatorOpen ? "max-w-[46rem]" : "max-w-[49rem]",
            "mx-auto"
          )}>
            <AnimatePresence initial={false} mode="popLayout">
              {messages?.map((message, index) => {
                const isLast =
                  index === messages.length - 1 && status !== "submitted"
                const hasScrollAnchor =
                  isLast && messages.length > initialMessageCount.current

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      duration: 0.2,
                      ease: "easeOut",
                    }}
                    layout
                    layoutId={message.id}
                    className="w-full"
                  >
                  <Message
                    id={message.id}
                    variant={message.role}
                    attachments={message.experimental_attachments}
                    isLast={isLast}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onReload={onReload}
                    hasScrollAnchor={hasScrollAnchor}
                    parts={message.parts}
                    status={status}
                    user_id={(message as any).user_id}
                    users={(message as any).users}
                    isChunked={(message as any).is_chunked}
                    isCompressed={(message as any).is_compressed}
                    truncated={(message as any).truncated}
                    contentSize={message.content ? message.content.length : undefined}
                  >
                    {message.content}
                  </Message>
                </motion.div>
                )
              })}
            </AnimatePresence>
            {(() => {
              // Show loader only when:
              // 1. Status is "submitted" 
              // 2. There are messages
              // 3. The last message is from user
              // 4. There's no assistant message being processed after the last user message
              if (status === "submitted" && messages.length > 0) {
                const lastUserIndex = messages.findLastIndex(m => m.role === "user")
                const hasAssistantAfterLastUser = messages.some((msg, idx) => 
                  msg.role === "assistant" && idx > lastUserIndex
                )
                
                // In collaborative rooms, also check if status is actually streaming
                const shouldShowLoader = lastUserIndex === messages.length - 1 && 
                                        !hasAssistantAfterLastUser &&
                                        (syncStatus !== 'idle')
                
                if (shouldShowLoader) {
                  return (
                    <div className="group min-h-scroll-anchor flex w-full flex-col items-start gap-2 pb-2">
                      <Loader />
                    </div>
                  )
                }
              }
              return null
            })()}
          </div>
        </ChatContainerContent>
      </ChatContainerRoot>
    </div>
  )
}
