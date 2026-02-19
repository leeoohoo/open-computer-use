"use client"

import { useChatSession } from "@/lib/chat-store/session/provider"
import { createClient } from "@/lib/supabase/client"
import type { Message as MessageAISDK } from "ai"
import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from "react"
import { writeToIndexedDB } from "../persist"
import {
  cacheMessages,
  clearMessagesForChat,
  getCachedMessages,
  getMessagesFromDb,
  setMessages as saveMessages,
} from "./api"

interface MessagesContextType {
  messages: MessageAISDK[]
  isLoading: boolean
  setMessages: React.Dispatch<React.SetStateAction<MessageAISDK[]>>
  refresh: () => Promise<void>
  saveAllMessages: (messages: MessageAISDK[]) => Promise<void>
  cacheAndAddMessage: (message: MessageAISDK) => Promise<void>
  resetMessages: () => Promise<void>
  deleteMessages: () => Promise<void>
  isCollaborativeRoom: boolean
  lastSyncTime: Date | null
  syncStatus: 'idle' | 'syncing' | 'completed' | 'error'
  setStreamingStatus: (status: 'streaming' | 'ready' | 'submitted' | 'error' | null) => void
}

const MessagesContext = createContext<MessagesContextType | null>(null)

export function useMessages() {
  const context = useContext(MessagesContext)
  if (!context)
    throw new Error("useMessages must be used within MessagesProvider")
  return context
}

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<MessageAISDK[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCollaborativeRoom, setIsCollaborativeRoom] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'completed' | 'error'>('idle')
  const [streamingStatus, setStreamingStatus] = useState<'streaming' | 'ready' | 'submitted' | 'error' | null>(null)
  const { chatId } = useChatSession()

  const subscriptionRef = useRef<any>(null)
  const isRefreshingRef = useRef(false)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messagesRef = useRef<MessageAISDK[]>([])
  const streamingJustCompletedRef = useRef(false)
  const streamingCompletedTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const processedMessageIdsRef = useRef<Set<string>>(new Set())
  const pendingRefreshRef = useRef<boolean>(false)
  const lastRefreshTimeRef = useRef<number>(0)
  const subscriptionStateRef = useRef<{
    chatId: string | null
    isSubscribed: boolean
    isSettingUp: boolean
    channelName: string | null
    lastProcessedMessageId?: string
    recentEvents?: Set<string>
  }>({
    chatId: null,
    isSubscribed: false,
    isSettingUp: false,
    channelName: null,
    lastProcessedMessageId: undefined,
    recentEvents: new Set()
  })
  const supabase = createClient()

  // Improved refresh function with incremental updates
  const refresh = useCallback(async (force = false, incremental = true) => {
    if (!chatId) return
    
    // Improved concurrent refresh prevention
    const now = Date.now()
    if (!force) {
      // If already refreshing or refreshed within last 300ms, skip
      if (isRefreshingRef.current || (now - lastRefreshTimeRef.current) < 300) {
        pendingRefreshRef.current = true
        return
      }
    }

    // Prevent refresh if streaming just completed (within 2 seconds)
    if (streamingJustCompletedRef.current) {
      return
    }

    // During streaming, always do incremental updates to preserve tool invocations
    if (streamingStatus === 'streaming') {
      incremental = true
    }

    isRefreshingRef.current = true
    lastRefreshTimeRef.current = now
    pendingRefreshRef.current = false
    
    // Only show syncing status for non-incremental updates
    if (!incremental) {
      setSyncStatus('syncing')
    }

    try {
      const fresh = await getMessagesFromDb(chatId)
      
      // Filter out any messages that contain only incomplete tool invocations
      const filteredFresh = fresh.map(msg => {
        if (msg.role === 'assistant' && msg.parts && Array.isArray(msg.parts)) {
          // Check if message has only incomplete tool invocations
          const nonToolParts = msg.parts.filter(part => part.type !== 'tool-invocation')
          const toolParts = msg.parts.filter(part => part.type === 'tool-invocation')
          
          if (nonToolParts.length === 0 && toolParts.length > 0) {
            // Check if all tool invocations are incomplete
            const allIncomplete = toolParts.every(part => 
              part.toolInvocation?.state === 'call' && 
              !('result' in (part.toolInvocation || {}))
            )
            
            if (allIncomplete) {
              // Return message with empty parts to prevent processing
              return { ...msg, parts: [], content: '' }
            }
          }
        }
        return msg
      })
      
      if (incremental && messages.length > 0) {
        // Incremental update: merge new messages while preventing duplicates
        setMessages(currentMessages => {
          const messageMap = new Map<string, MessageAISDK>()
          const messageIds = new Set<string>()
          
          // Track all message IDs to prevent duplicates
          currentMessages.forEach(msg => {
            if (!messageIds.has(msg.id)) {
              messageMap.set(msg.id, msg)
              messageIds.add(msg.id)
            }
          })
          
          // Process fresh messages
          filteredFresh.forEach(freshMsg => {
            const currentMsg = messageMap.get(freshMsg.id)
            
            if (currentMsg) {
              // For assistant messages, be very careful about replacing
              if (currentMsg.role === 'assistant') {
                // If we're streaming, always keep current version
                if (streamingStatus === 'streaming') {
                  return
                }
                
                // If current has content but fresh doesn't, keep current
                if (currentMsg.content && !freshMsg.content) {
                  return
                }
                
                // If current has parts (tool invocations) but fresh doesn't, keep current
                if (currentMsg.parts && currentMsg.parts.length > 0 && 
                    (!freshMsg.parts || freshMsg.parts.length === 0)) {
                  return
                }
                
                // If both have parts, merge tool invocations properly
                if (currentMsg.parts && freshMsg.parts) {
                  const toolInvocationMap = new Map() as Map<string, any>
                  
                  // First add all current tool invocations
                  currentMsg.parts.forEach((part: any) => {
                    if (part.type === 'tool-invocation' && part.toolInvocation?.toolCallId) {
                      toolInvocationMap.set(part.toolInvocation.toolCallId, part)
                    }
                  })
                  
                  // Then update with fresh tool invocations
                  freshMsg.parts.forEach((part: any) => {
                    if (part.type === 'tool-invocation' && part.toolInvocation?.toolCallId) {
                      const existing = toolInvocationMap.get(part.toolInvocation.toolCallId)
                      
                      // Only update if the fresh invocation has a more complete state
                      if (!existing || 
                          (existing.toolInvocation?.state === 'call' && part.toolInvocation?.state !== 'call') ||
                          (existing.toolInvocation?.state === 'partial-call' && part.toolInvocation?.state === 'result')) {
                        toolInvocationMap.set(part.toolInvocation.toolCallId, part)
                      }
                    }
                  })
                  
                  // Merge non-tool parts with deduplicated tool invocations
                  const nonToolParts = (freshMsg.parts || []).filter((part: any) => part.type !== 'tool-invocation')
                  const mergedParts = [...nonToolParts, ...Array.from(toolInvocationMap.values())] as any[]
                  
                  // Update the message with merged parts
                  messageMap.set(freshMsg.id, {
                    ...freshMsg,
                    parts: mergedParts
                  })
                  return
                }
                
                // Update the assistant message
                messageMap.set(freshMsg.id, freshMsg)
              } else if (freshMsg.role === 'user' && isCollaborativeRoom) {
                // For user messages in collaborative rooms, merge user data properly
                const freshMsgWithUser = freshMsg as any
                const currentMsgWithUser = currentMsg as any
                messageMap.set(freshMsg.id, {
                  ...freshMsg,
                  // Ensure user data is preserved from either source
                  user_id: freshMsgWithUser.user_id || currentMsgWithUser.user_id,
                  users: freshMsgWithUser.users || currentMsgWithUser.users
                } as MessageAISDK)
              } else {
                // For other messages, use fresh data
                messageMap.set(freshMsg.id, freshMsg)
              }
            } else if (!messageIds.has(freshMsg.id)) {
              // New message - add it only if not already present
              messageMap.set(freshMsg.id, freshMsg)
              messageIds.add(freshMsg.id)
            }
          })
          
          // Convert back to array and sort by creation time
          // Use a stable sort to preserve order of messages with same timestamp
          const sortedMessages = Array.from(messageMap.values()).sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime()
            const bTime = new Date(b.createdAt || 0).getTime()
            if (aTime === bTime) {
              // If timestamps are equal, maintain original order by comparing IDs
              return a.id.localeCompare(b.id)
            }
            return aTime - bTime
          })
          
          // Update processed message IDs to track what we've seen
          processedMessageIdsRef.current = new Set(sortedMessages.map(m => m.id))
          
          return sortedMessages
        })
      } else {
        // Full replacement only when necessary - but never during streaming
        if (streamingStatus === 'streaming') {
          // During streaming, always merge instead of replace
          setMessages(currentMessages => {
            const messageMap = new Map<string, MessageAISDK>()
            currentMessages.forEach(msg => messageMap.set(msg.id, msg))
            filteredFresh.forEach(msg => {
              if (!messageMap.has(msg.id) || !messageMap.get(msg.id)?.content) {
                messageMap.set(msg.id, msg)
              }
            })
            return Array.from(messageMap.values()).sort((a, b) => {
              const aTime = new Date(a.createdAt || 0).getTime()
              const bTime = new Date(b.createdAt || 0).getTime()
              return aTime - bTime
            })
          })
        } else {
          setMessages(filteredFresh)
          // Update processed message IDs
          processedMessageIdsRef.current = new Set(filteredFresh.map(m => m.id))
        }
      }
      
      setLastSyncTime(new Date())
      
      // Only show completed status for non-incremental updates
      if (!incremental) {
        setSyncStatus('completed')
        setTimeout(() => setSyncStatus('idle'), 1500)
      }
      
      // Cache update
      cacheMessages(chatId, filteredFresh).catch(() => {})
    } catch (error) {
      // Refresh error occurred
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 2000)
    } finally {
      isRefreshingRef.current = false
      
      // If there was a pending refresh, execute it after a short delay
      if (pendingRefreshRef.current) {
        setTimeout(() => {
          if (pendingRefreshRef.current && !isRefreshingRef.current) {
            refresh(false, true)
          }
        }, 100)
      }
    }
  }, [chatId, streamingStatus, messages, isCollaborativeRoom])

  // Check if chat is collaborative
  const checkCollaborativeStatus = useCallback(async () => {
    if (!chatId || !supabase) return false
    
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('collaborative')
        .eq('id', chatId)
        .single()
      
      if (error) return false
      
      const isCollab = data?.collaborative === true
      setIsCollaborativeRoom(isCollab)
      return isCollab
    } catch (error) {
      return false
    }
  }, [chatId, supabase])

  // Clean up subscription
  const cleanupSubscription = useCallback(async () => {
    if (subscriptionRef.current && supabase) {
      try {
        // Cleaning up subscription
        await supabase.removeChannel(subscriptionRef.current)
        // Add a small delay to ensure cleanup is complete
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        // Error removing channel
      }
      subscriptionRef.current = null
    }
    subscriptionStateRef.current = {
      chatId: null,
      isSubscribed: false,
      isSettingUp: false,
      channelName: null,
      lastProcessedMessageId: undefined,
      recentEvents: new Set()
    }
  }, [supabase])

  // Real-time subscription for collaborative rooms
  const setupRealtimeSubscription = useCallback(async () => {
    if (!chatId || !supabase) return

    // Prevent multiple simultaneous setup attempts
    if (subscriptionStateRef.current.isSettingUp) {
      // Subscription setup already in progress
      return
    }

    // Check if we already have a subscription for this chat
    if (subscriptionStateRef.current.chatId === chatId && subscriptionStateRef.current.isSubscribed) {
      // Subscription already exists
      return
    }

    subscriptionStateRef.current.isSettingUp = true

    // Clean up any existing subscription
    await cleanupSubscription()

    // Check if collaborative
    const isCollab = await checkCollaborativeStatus()
    if (!isCollab) {
      subscriptionStateRef.current.isSettingUp = false
      return
    }

    const maxRetries = 3
    let retryCount = 0

    while (retryCount < maxRetries) {
      try {
        // Setting up subscription
        
        // Create a unique channel name with timestamp to avoid conflicts
        const channelName = `messages-${chatId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        
        const channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "messages",
              filter: `chat_id=eq.${chatId}`,
            },
            (payload: any) => {
              const messageData = payload.new as any
              if (messageData?.chat_id !== chatId) return
              
              // Improved duplicate detection using only message ID
              const messageId = messageData?.id
              if (!messageId) return
              
              // Skip if we've already processed this message
              if (processedMessageIdsRef.current.has(messageId)) {
                // For UPDATE events, check if it's a meaningful change
                if (payload.eventType === 'UPDATE') {
                  const existingMessage = messagesRef.current.find(msg => msg.id === messageId)
                  if (existingMessage) {
                    const contentChanged = existingMessage.content !== (messageData?.content || '')
                    
                    // Check for tool invocation updates more carefully
                    let hasToolInvocationUpdate = false
                    if (messageData?.parts && existingMessage.parts) {
                      const existingToolIds = new Set(
                        (existingMessage.parts || [])
                          .filter((p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolCallId)
                          .map((p: any) => p.toolInvocation.toolCallId)
                      )
                      
                      const newToolInvocations = (messageData.parts || []).filter((p: any) => 
                        p.type === 'tool-invocation' && p.toolInvocation?.toolCallId
                      )
                      
                      // Check for new tool invocations or state changes
                      hasToolInvocationUpdate = newToolInvocations.some((newTool: any) => {
                        const toolId = newTool.toolInvocation.toolCallId
                        if (!existingToolIds.has(toolId)) return true
                        
                        // Check if state has progressed
                        const existingTool = (existingMessage.parts || []).find((p: any) => 
                          p.type === 'tool-invocation' && 
                          p.toolInvocation?.toolCallId === toolId
                        )
                        
                        return existingTool && 
                          existingTool.type === 'tool-invocation' &&
                          existingTool.toolInvocation?.state !== newTool.toolInvocation?.state
                      })
                    }
                    
                    // Only process if there's actual new content or tool updates
                    if (!contentChanged && !hasToolInvocationUpdate) {
                      return
                    }
                  }
                } else {
                  // For INSERT events, skip if already processed
                  return
                }
              }
              
              // Track event to prevent immediate re-processing
              const eventKey = `${payload.eventType}-${messageId}`
              if (!subscriptionStateRef.current.recentEvents) {
                subscriptionStateRef.current.recentEvents = new Set()
              }
              
              // Skip if we just processed this event
              if (subscriptionStateRef.current.recentEvents.has(eventKey)) {
                return
              }
              
              subscriptionStateRef.current.recentEvents.add(eventKey)
              setTimeout(() => {
                subscriptionStateRef.current.recentEvents?.delete(eventKey)
              }, 1000)
              
              // Skip refresh if we're currently streaming
              if (streamingStatus === 'streaming' || streamingJustCompletedRef.current) {
                return
              }
              
              // For tool invocations, handle updates more carefully
              if (messageData?.parts && Array.isArray(messageData.parts)) {
                const hasToolInvocations = messageData.parts.some(
                  (part: any) => part?.type === 'tool-invocation'
                )
                
                if (hasToolInvocations) {
                  // Always use incremental refresh for tool invocations to preserve deduplication
                  refresh(true, true)
                  return
                }
              }
              
              // Improved debouncing with pending refresh check
              if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current)
              }
              
              refreshTimeoutRef.current = setTimeout(() => {
                // Only refresh if not streaming and no pending refresh
                if (!streamingJustCompletedRef.current && !isRefreshingRef.current) {
                  refresh(true, true)
                }
              }, 300) // Reduced delay for better responsiveness
            }
          )
          // Removed chat_activity subscription to prevent duplicate message loading
          // Messages are already tracked through the messages table subscription above

        // Subscribe to the channel with timeout
        const subscriptionPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Subscription timeout'))
          }, 5000)

          channel.subscribe((status: any) => {
            // Subscription status changed
            if (status === 'SUBSCRIBED') {
              clearTimeout(timeout)
              subscriptionStateRef.current = {
                chatId,
                isSubscribed: true,
                isSettingUp: false,
                channelName,
                lastProcessedMessageId: undefined
              }
              // Subscription setup completed
              resolve(status)
            } else if (status === 'CHANNEL_ERROR') {
              clearTimeout(timeout)
              reject(new Error('Channel error'))
            }
          })
        })

        subscriptionRef.current = channel
        
        // Wait for subscription to complete
        await subscriptionPromise
        return // Success - exit retry loop
        
      } catch (error) {
        // Subscription setup error
        
        // Clean up failed subscription attempt
        if (subscriptionRef.current) {
          try {
            await supabase.removeChannel(subscriptionRef.current)
          } catch (cleanupError) {
            console.warn('Error cleaning up failed subscription:', cleanupError)
          }
          subscriptionRef.current = null
        }
        
        retryCount++
        
        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, retryCount), 5000)))
        }
      }
    }

    // If we get here, all retries failed
    subscriptionStateRef.current.isSettingUp = false
    console.error('All subscription setup attempts failed')
    setSyncStatus('error')
    
  }, [chatId, supabase, cleanupSubscription]) // Minimal dependencies to avoid re-runs

  // Initialize chat
  useEffect(() => {
    const initializeChat = async () => {
      if (!chatId) {
        setMessages([])
        setIsLoading(false)
        setIsCollaborativeRoom(false)
        processedMessageIdsRef.current.clear()
        await cleanupSubscription()
        return
      }

      setIsLoading(true)
      // Clear processed message IDs for new chat
      processedMessageIdsRef.current.clear()
      
      try {
        // Load cached messages first for instant display
        const cached = await getCachedMessages(chatId)
        if (cached.length > 0) {
          setMessages(cached)
          // Populate processedMessageIdsRef with cached messages immediately
          processedMessageIdsRef.current = new Set(cached.map(m => m.id))
          setIsLoading(false) // Show cached messages immediately
        }
        
        // Check if collaborative and setup subscription
        const isCollab = await checkCollaborativeStatus()
        if (isCollab) {
          await setupRealtimeSubscription()
        }
        
        // Fetch fresh messages incrementally
        await refresh(true, cached.length > 0) // Use incremental if we have cached
        
        // CRITICAL: Populate processedMessageIdsRef with initial messages
        // This prevents duplicates when the first new message arrives
        setMessages(currentMessages => {
          processedMessageIdsRef.current = new Set(currentMessages.map(m => m.id))
          return currentMessages
        })
      } catch (error) {
        console.error("Initialization error:", error)
        setSyncStatus('error')
      } finally {
        setIsLoading(false)
      }
    }

    initializeChat()

    // Cleanup on unmount or chat change
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      cleanupSubscription().catch(console.warn)
    }
  }, [chatId]) // Minimal dependencies to avoid re-runs

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Track streaming status changes to prevent race conditions
  const prevStreamingStatusRef = useRef<typeof streamingStatus>(null)
  useEffect(() => {
    const prevStatus = prevStreamingStatusRef.current
    
    // When transitioning from streaming to ready/null, block refreshes temporarily
    if (prevStatus === 'streaming' && (streamingStatus === 'ready' || streamingStatus === null)) {
      streamingJustCompletedRef.current = true
      
      // Clear any existing timeout
      if (streamingCompletedTimeoutRef.current) {
        clearTimeout(streamingCompletedTimeoutRef.current)
      }
      
      // Allow refreshes again after 3 seconds
      streamingCompletedTimeoutRef.current = setTimeout(() => {
        streamingJustCompletedRef.current = false
      }, 3000)
    }
    
    // Update previous status
    prevStreamingStatusRef.current = streamingStatus
    
    // Cleanup on unmount
    return () => {
      if (streamingCompletedTimeoutRef.current) {
        clearTimeout(streamingCompletedTimeoutRef.current)
      }
    }
  }, [streamingStatus])

  // Message operations
  const cacheAndAddMessage = async (message: MessageAISDK) => {
    if (!chatId) return

    try {
      // Optimistic update for immediate display
      setMessages(current => {
        // Check if message already exists by ID
        const existingIndex = current.findIndex(m => m.id === message.id)
        
        if (existingIndex !== -1) {
          // Update existing message (preserve content during streaming completion)
          const updated = [...current]
          
          // For collaborative rooms, ensure user data is preserved
          if (isCollaborativeRoom && message.role === 'user') {
            const messageWithUser = message as any
            const existingWithUser = updated[existingIndex] as any
            updated[existingIndex] = {
              ...updated[existingIndex],
              ...message,
              // Preserve parts if the new message doesn't have them
              parts: message.parts || updated[existingIndex].parts,
              // Preserve user data if not in new message
              ...(messageWithUser.user_id && { user_id: messageWithUser.user_id || existingWithUser.user_id }),
              ...(messageWithUser.users && { users: messageWithUser.users || existingWithUser.users })
            } as MessageAISDK
          } else {
            updated[existingIndex] = {
              ...updated[existingIndex],
              ...message,
              // Preserve parts if the new message doesn't have them
              parts: message.parts || updated[existingIndex].parts
            }
          }
          return updated
        }
        
        // For new messages in collaborative rooms, skip duplicate content check
        // as the same content might be sent by different users
        if (!isCollaborativeRoom) {
          // For non-collaborative rooms, check for duplicate content
          const duplicateIndex = current.findIndex(m => 
            m.content === message.content && 
            m.role === message.role && 
            Math.abs(new Date(m.createdAt || 0).getTime() - new Date(message.createdAt || 0).getTime()) < 1000
          )
          
          if (duplicateIndex !== -1) {
            // Update the duplicate instead of adding
            const updated = [...current]
            updated[duplicateIndex] = message
            return updated
          }
        }
        
        return [...current, message]
      })
      
      // Cache update in background
      const current = await getCachedMessages(chatId)
      const existingIndex = current.findIndex(m => m.id === message.id)
      let updated: MessageAISDK[]
      
      if (existingIndex !== -1) {
        updated = [...current]
        updated[existingIndex] = message
      } else {
        updated = [...current, message]
      }
      
      await writeToIndexedDB("messages", { id: chatId, messages: updated })
    } catch (error) {
      console.error("Failed to cache message:", error)
    }
  }

  const saveAllMessages = async (newMessages: MessageAISDK[]) => {
    if (!chatId) return

    try {
      await saveMessages(chatId, newMessages)
      await cacheMessages(chatId, newMessages)
      setMessages(newMessages)
    } catch (error) {
      console.error("Failed to save messages:", error)
    }
  }

  const deleteMessages = async () => {
    if (!chatId) return
    await clearMessagesForChat(chatId)
    setMessages([])
  }

  const resetMessages = async () => {
    if (!chatId) return
    await clearMessagesForChat(chatId)
    setMessages([])
  }

  return (
    <MessagesContext.Provider
      value={{
        messages,
        isLoading,
        setMessages,
        refresh,
        saveAllMessages,
        cacheAndAddMessage,
        resetMessages,
        deleteMessages,
        isCollaborativeRoom,
        lastSyncTime,
        syncStatus,
        setStreamingStatus,
      }}
    >
      {children}
    </MessagesContext.Provider>
  )
}
