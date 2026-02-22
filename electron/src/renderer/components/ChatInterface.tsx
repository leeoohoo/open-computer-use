import React from 'react'
import { useChatStore } from '../stores/chat-store'
import { useAuthStore } from '../stores/auth-store'
import { useConnectionStore } from '../stores/connection-store'
import { sendChatMessage } from '../lib/api'
import { MessageList } from './MessageList'
import { ConnectionStatus } from './ConnectionStatus'
import { ChatSidebar } from './ChatSidebar'

export function ChatInterface() {
  const {
    messages, isStreaming, chatId, chatTitle, isSynced,
    addUserMessage, setStreaming, appendAssistantContent,
    addToolCall, updateToolResult, finishAssistantMessage,
    clearMessages, ensureChat, loadChatList,
  } = useChatStore()
  const { user, machineId, signOut } = useAuthStore()
  const connectionState = useConnectionStore((s) => s.state)

  const [input, setInput] = React.useState('')
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const canSend = input.trim() && !isStreaming && connectionState === 'connected'

  // Load chat list on mount
  React.useEffect(() => {
    if (user) {
      loadChatList()
    }
  }, [user])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!canSend || !user || !machineId) return

    const userMessage = input.trim()
    setInput('')
    addUserMessage(userMessage)
    setStreaming(true)

    // Ensure we have a real Supabase chat before sending
    const activeChatId = await ensureChat(userMessage)

    // Build message history for the backend
    const allMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ]

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await sendChatMessage(
        {
          messages: allMessages,
          chatId: activeChatId,
          userId: user.id,
          machineId,
        },
        {
          onText: (text) => appendAssistantContent(text),
          onToolCall: (data) =>
            addToolCall({
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              args: data.args,
              state: 'pending',
            }),
          onToolResult: (data) =>
            updateToolResult(data.toolCallId, data.result, data.frontendScreenshot),
          onReasoning: (_text) => {
            // Could display reasoning in a separate section
          },
          onFinish: (data) => {
            finishAssistantMessage(data.content, data.toolInvocations)
            // Refresh chat list so this chat appears with a preview
            loadChatList()
          },
          onError: (error) => {
            appendAssistantContent(`\n\nError: ${error}`)
            setStreaming(false)
          },
        },
        controller.signal,
      )
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        appendAssistantContent(`\n\nError: ${err.message}`)
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setStreaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Auto-resize textarea
  React.useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 200) + 'px'
    }
  }, [input])

  return (
    <div className="flex h-screen bg-neutral-950">
      {/* Sidebar */}
      <ChatSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="titlebar-drag flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
          <div className="titlebar-no-drag flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Toggle chat history"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold text-neutral-200 truncate max-w-[200px]">
              {chatTitle || 'Coasty Desktop'}
            </h1>
            <ConnectionStatus />
          </div>

          <div className="titlebar-no-drag flex items-center gap-3">
            <button
              onClick={clearMessages}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              New Chat
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">{user?.email}</span>
              <button
                onClick={signOut}
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* Messages */}
        <MessageList messages={messages} isStreaming={isStreaming} />

        {/* Input */}
        <div className="border-t border-neutral-800 px-4 py-3 bg-neutral-950">
          {connectionState !== 'connected' && (
            <div className="mb-2 text-xs text-yellow-500 text-center">
              Not connected to backend. Please connect to send messages.
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              rows={1}
              disabled={connectionState !== 'connected'}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-700 disabled:opacity-50"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="px-4 py-3 bg-red-600/20 border border-red-600/30 text-red-400 rounded-xl text-sm font-medium hover:bg-red-600/30 transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                className="px-4 py-3 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
