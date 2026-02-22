import { create } from 'zustand'

export interface ToolInvocation {
  toolCallId: string
  toolName: string
  args: Record<string, any>
  state: 'pending' | 'result'
  result?: any
  frontendScreenshot?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolInvocations?: ToolInvocation[]
  createdAt: string
}

export interface ChatSummary {
  id: string
  title: string | null
  created_at: string | null
  updated_at: string | null
  model: string | null
  last_message_preview?: string
}

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  chatId: string
  chatTitle: string | null
  /** Whether chatId points to a real Supabase chat */
  isSynced: boolean
  /** AbortController for the current streaming request */
  abortController: AbortController | null

  // Chat list
  chatList: ChatSummary[]
  chatListLoading: boolean

  addUserMessage: (content: string) => void
  setStreaming: (streaming: boolean) => void
  setAbortController: (controller: AbortController | null) => void
  /** Abort the current stream and stop */
  stopStreaming: () => void
  appendAssistantContent: (content: string) => void
  addToolCall: (invocation: ToolInvocation) => void
  updateToolResult: (toolCallId: string, result: any, screenshot?: string) => void
  finishAssistantMessage: (content: string, toolInvocations?: ToolInvocation[]) => void
  clearMessages: () => void

  /** Create a new chat in Supabase and set chatId. Call before first message. */
  ensureChat: (firstMessageContent?: string) => Promise<string>
  /** Load chat list from backend */
  loadChatList: () => Promise<void>
  /** Switch to an existing chat and load its messages */
  loadChat: (chatId: string) => Promise<void>
  /** Delete a chat */
  removeChat: (chatId: string) => Promise<void>
  /** Update chat title */
  renameChat: (chatId: string, title: string) => Promise<void>
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  chatId: '',
  chatTitle: null,
  isSynced: false,
  abortController: null,
  chatList: [],
  chatListLoading: false,

  addUserMessage: (content) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: generateId(),
          role: 'user',
          content,
          createdAt: new Date().toISOString(),
        },
      ],
    }))
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setAbortController: (controller) => set({ abortController: controller }),

  stopStreaming: () => {
    const { abortController } = get()
    if (abortController) {
      abortController.abort()
    }
    set({ isStreaming: false, abortController: null })
  },

  appendAssistantContent: (content) => {
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]

      if (last?.role === 'assistant' && !last.id.startsWith('final_')) {
        messages[messages.length - 1] = { ...last, content: last.content + content }
      } else {
        messages.push({
          id: `streaming_${Date.now()}`,
          role: 'assistant',
          content,
          toolInvocations: [],
          createdAt: new Date().toISOString(),
        })
      }

      return { messages }
    })
  },

  addToolCall: (invocation) => {
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]

      if (last?.role === 'assistant') {
        const tools = [...(last.toolInvocations || []), invocation]
        messages[messages.length - 1] = { ...last, toolInvocations: tools }
      }

      return { messages }
    })
  },

  updateToolResult: (toolCallId, result, screenshot) => {
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]

      if (last?.role === 'assistant' && last.toolInvocations) {
        const tools = last.toolInvocations.map((t) =>
          t.toolCallId === toolCallId
            ? { ...t, state: 'result' as const, result, frontendScreenshot: screenshot }
            : t,
        )
        messages[messages.length - 1] = { ...last, toolInvocations: tools }
      }

      return { messages }
    })
  },

  finishAssistantMessage: (content, toolInvocations) => {
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]

      if (last?.role === 'assistant') {
        messages[messages.length - 1] = {
          ...last,
          id: `final_${Date.now()}`,
          content: content || last.content,
          toolInvocations: toolInvocations || last.toolInvocations,
        }
      }

      return { messages, isStreaming: false }
    })
  },

  clearMessages: () => set({ messages: [], chatId: '', chatTitle: null, isSynced: false }),

  ensureChat: async (firstMessageContent?: string) => {
    const state = get()
    // Already have a synced chat
    if (state.isSynced && state.chatId) {
      return state.chatId
    }

    try {
      const title = firstMessageContent
        ? firstMessageContent.slice(0, 60) + (firstMessageContent.length > 60 ? '...' : '')
        : 'New Task'

      const result = await window.coasty.createChat({ title })
      if (result.success && result.chat) {
        const newChatId = result.chat.id
        set({ chatId: newChatId, chatTitle: result.chat.title, isSynced: true })
        return newChatId
      }
    } catch (err) {
      console.error('Failed to create chat in Supabase:', err)
    }

    // Fallback to local-only ID if backend is unavailable
    const fallbackId = `local_${Date.now()}`
    set({ chatId: fallbackId, isSynced: false })
    return fallbackId
  },

  loadChatList: async () => {
    set({ chatListLoading: true })
    try {
      const result = await window.coasty.listChats()
      if (result.success && result.chats) {
        set({ chatList: result.chats, chatListLoading: false })
      } else {
        set({ chatListLoading: false })
      }
    } catch (err) {
      console.error('Failed to load chat list:', err)
      set({ chatListLoading: false })
    }
  },

  loadChat: async (chatId: string) => {
    try {
      const result = await window.coasty.getChatMessages(chatId)
      if (result.success && result.messages) {
        // Transform DB messages to ChatMessage format
        const messages: ChatMessage[] = result.messages.map((msg: any) => ({
          id: String(msg.id),
          role: msg.role as 'user' | 'assistant',
          content: msg.content || '',
          createdAt: msg.created_at || new Date().toISOString(),
          toolInvocations: msg.parts
            ? msg.parts
                .filter((p: any) => p.type === 'tool-invocation')
                .map((p: any) => p.toolInvocation)
            : undefined,
        }))

        // Find the chat in chatList for the title
        const chatInfo = get().chatList.find((c) => c.id === chatId)

        set({
          chatId,
          messages,
          isSynced: true,
          chatTitle: chatInfo?.title || null,
        })
      }
    } catch (err) {
      console.error('Failed to load chat messages:', err)
    }
  },

  removeChat: async (chatId: string) => {
    try {
      const result = await window.coasty.deleteChat(chatId)
      if (result.success) {
        const state = get()
        set({
          chatList: state.chatList.filter((c) => c.id !== chatId),
          // If we deleted the current chat, clear messages
          ...(state.chatId === chatId
            ? { messages: [], chatId: '', chatTitle: null, isSynced: false }
            : {}),
        })
      }
    } catch (err) {
      console.error('Failed to delete chat:', err)
    }
  },

  renameChat: async (chatId: string, title: string) => {
    try {
      const result = await window.coasty.updateChat({ chatId, title })
      if (result.success) {
        const state = get()
        set({
          chatList: state.chatList.map((c) =>
            c.id === chatId ? { ...c, title } : c
          ),
          ...(state.chatId === chatId ? { chatTitle: title } : {}),
        })
      }
    } catch (err) {
      console.error('Failed to rename chat:', err)
    }
  },
}))
