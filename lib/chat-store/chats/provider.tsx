"use client"

import { toast } from "@/components/ui/toast"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { MODEL_DEFAULT } from "../../config"
import { SystemPrompts } from "../../prompts/system-prompts"
import type { Chats } from "../types"
import {
  createNewChat as createNewChatFromDb,
  deleteChat as deleteChatFromDb,
  fetchAndCacheChats,
  getCachedChats,
  updateChatModel as updateChatModelFromDb,
  updateChatTitle,
} from "./api"
import { createClient } from "@/lib/supabase/client"

interface ChatsContextType {
  chats: Chats[]
  refresh: () => Promise<void>
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  updateTitle: (id: string, title: string) => Promise<void>
  updateChat: (id: string, updates: Partial<Chats>) => Promise<void>
  deleteChat: (
    id: string,
    currentChatId?: string,
    redirect?: () => void
  ) => Promise<void>
  setChats: React.Dispatch<React.SetStateAction<Chats[]>>
  createNewChat: (
    userId: string,
    title?: string,
    model?: string,
    isAuthenticated?: boolean,
    systemPrompt?: string,
    // projectId?: string  // COMMENTED OUT - Project feature disabled
  ) => Promise<Chats | undefined>
  resetChats: () => Promise<void>
  getChatById: (id: string) => Chats | undefined
  updateChatModel: (id: string, model: string) => Promise<void>
  bumpChat: (id: string) => Promise<void>
}
const ChatsContext = createContext<ChatsContextType | null>(null)

export function useChats() {
  const context = useContext(ChatsContext)
  if (!context) throw new Error("useChats must be used within ChatsProvider")
  return context
}

export function ChatsProvider({
  userId,
  children,
}: {
  userId?: string
  children: React.ReactNode
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [chats, setChats] = useState<Chats[]>([])
  const offsetRef = useRef(0)

  useEffect(() => {
    if (!userId) return

    const load = async () => {
      setIsLoading(true)
      const cached = await getCachedChats()
      setChats(cached)

      try {
        const { chats: fresh, hasMore: more } = await fetchAndCacheChats(userId, 0)
        setChats(fresh)
        setHasMore(more)
        offsetRef.current = fresh.length
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [userId])

  const loadMore = useCallback(async () => {
    if (!userId || isLoadingMore || !hasMore) return

    setIsLoadingMore(true)
    try {
      const { chats: moreChats, hasMore: stillMore } = await fetchAndCacheChats(
        userId,
        offsetRef.current
      )
      setChats(prev => {
        const existingIds = new Set(prev.map(c => c.id))
        const newChats = moreChats.filter(c => !existingIds.has(c.id))
        return [...prev, ...newChats]
      })
      setHasMore(stillMore)
      offsetRef.current += moreChats.length
    } finally {
      setIsLoadingMore(false)
    }
  }, [userId, isLoadingMore, hasMore])

  const refresh = async () => {
    if (!userId) return

    const { chats: fresh, hasMore: more } = await fetchAndCacheChats(userId, 0)
    setChats(fresh)
    setHasMore(more)
    offsetRef.current = fresh.length
  }

  const updateTitle = async (id: string, title: string) => {
    const prev = [...chats]
    const updatedChatWithNewTitle = prev.map((c) =>
      c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c
    )
    const sorted = updatedChatWithNewTitle.sort(
      (a, b) => +new Date(b.updated_at || "") - +new Date(a.updated_at || "")
    )
    setChats(sorted)
    try {
      await updateChatTitle(id, title)
    } catch {
      setChats(prev)
      toast({ title: "Failed to update title", status: "error" })
    }
  }

  const deleteChat = async (
    id: string,
    currentChatId?: string,
    redirect?: () => void
  ) => {
    const prev = [...chats]
    setChats((prev) => prev.filter((c) => c.id !== id))

    try {
      await deleteChatFromDb(id)
      if (id === currentChatId && redirect) redirect()
    } catch {
      setChats(prev)
      toast({ title: "Failed to delete chat", status: "error" })
    }
  }

  const createNewChat = async (
    userId: string,
    title?: string,
    model?: string,
    isAuthenticated?: boolean,
    systemPrompt?: string,
    // projectId?: string  // COMMENTED OUT - Project feature disabled
  ) => {
    if (!userId) return
    const prev = [...chats]

    const optimisticId = `optimistic-${Date.now().toString()}`
    const optimisticChat = {
      id: optimisticId,
      title: title || "New Chat",
      created_at: new Date().toISOString(),
      model: model || MODEL_DEFAULT,
      system_prompt: systemPrompt || SystemPrompts.main(),
      user_id: userId,
      public: true,
      updated_at: new Date().toISOString(),
      project_id: null,
      collaborative: false,
      max_participants: null,
      invite_code: null,
      room_settings: null,
    }
    setChats((prev) => [optimisticChat, ...prev])

    try {
      const newChat = await createNewChatFromDb(
        userId,
        title,
        model,
        isAuthenticated,
        // projectId  // COMMENTED OUT - Project feature disabled
      )

      setChats((prev) => [
        newChat,
        ...prev.filter((c) => c.id !== optimisticId),
      ])

      return newChat
    } catch {
      setChats(prev)
      toast({ title: "Failed to create chat", status: "error" })
    }
  }

  const resetChats = async () => {
    setChats([])
  }

  const getChatById = (id: string) => {
    const chat = chats.find((c) => c.id === id)
    return chat
  }

  const updateChatModel = async (id: string, model: string) => {
    const prev = [...chats]
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, model } : c)))
    try {
      await updateChatModelFromDb(id, model)
    } catch {
      setChats(prev)
      toast({ title: "Failed to update model", status: "error" })
    }
  }

  const bumpChat = async (id: string) => {
    const prev = [...chats]
    const updatedChatWithNewUpdatedAt = prev.map((c) =>
      c.id === id ? { ...c, updated_at: new Date().toISOString() } : c
    )
    const sorted = updatedChatWithNewUpdatedAt.sort(
      (a, b) => +new Date(b.updated_at || "") - +new Date(a.updated_at || "")
    )
    setChats(sorted)
  }

  const updateChat = async (id: string, updates: Partial<Chats>) => {
    const prev = [...chats]
    const updatedChats = prev.map((c) =>
      c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
    )
    setChats(updatedChats)
    
    try {
      const supabase = createClient()
      if (supabase) {
        const { error } = await supabase
          .from("chats")
          .update(updates)
          .eq("id", id)
        
        if (error) throw error
      }
    } catch (error) {
      console.error("Failed to update chat:", error)
      setChats(prev)
      toast({ title: "Failed to update project info", status: "error" })
    }
  }

  return (
    <ChatsContext.Provider
      value={{
        chats,
        refresh,
        updateTitle,
        deleteChat,
        setChats,
        createNewChat,
        resetChats,
        getChatById,
        updateChatModel,
        updateChat,
        bumpChat,
        isLoading,
        isLoadingMore,
        hasMore,
        loadMore,
      }}
    >
      {children}
    </ChatsContext.Provider>
  )
}
