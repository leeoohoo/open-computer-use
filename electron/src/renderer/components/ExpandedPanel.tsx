import React from 'react'
import { useWindowStore } from '../stores/window-store'
import { useConnectionStore } from '../stores/connection-store'
import { useAuthStore } from '../stores/auth-store'
import { useChatSubmit } from '../hooks/useChatSubmit'
import { MessageList } from './MessageList'

function statusDot(state: string): string {
  switch (state) {
    case 'connected': return 'bg-emerald-400'
    case 'connecting': return 'bg-yellow-400 animate-pulse'
    case 'error': return 'bg-red-400'
    default: return 'bg-neutral-500'
  }
}

export function ExpandedPanel() {
  const { toggleExpanded } = useWindowStore()
  const connectionState = useConnectionStore((s) => s.state)
  const { signOut } = useAuthStore()
  const {
    messages, isStreaming, chatTitle,
    canSend, handleSubmit, handleStop, clearMessages,
  } = useChatSubmit()

  const [input, setInput] = React.useState('')
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!canSend(input)) return
    handleSubmit(input)
    setInput('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  // Auto-resize textarea
  React.useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }, [input])

  return (
    <div className="glow-border animate-expand-in flex flex-col w-full h-full rounded-2xl bg-neutral-900/95 backdrop-blur-xl overflow-hidden">
      {/* Header bar */}
      <div className="titlebar-drag flex items-center justify-between px-4 py-2.5 border-b border-neutral-800/50 flex-shrink-0">
        <div className="titlebar-no-drag flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(connectionState)}`} />
          <span className="text-xs font-medium text-neutral-200 truncate max-w-[160px]">
            {chatTitle || 'Coasty'}
          </span>
        </div>

        <div className="titlebar-no-drag flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="px-2 py-1 rounded-md text-[10px] text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60 transition-colors"
            title="New chat"
          >
            New
          </button>
          <button
            onClick={signOut}
            className="p-1.5 rounded-lg hover:bg-neutral-800/60 text-neutral-500 hover:text-neutral-300 transition-colors"
            title="Sign out"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
          <button
            onClick={() => toggleExpanded()}
            className="p-1.5 rounded-lg hover:bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Collapse"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <MessageList messages={messages} isStreaming={isStreaming} />

      {/* Input area */}
      <div className="border-t border-neutral-800/50 px-3 py-2 flex-shrink-0">
        {connectionState !== 'connected' && (
          <div className="mb-1.5 text-[10px] text-yellow-500 text-center">
            Not connected — waiting for backend
          </div>
        )}

        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Send a message..."
            rows={1}
            disabled={connectionState !== 'connected'}
            className="flex-1 bg-neutral-800/60 border border-neutral-700/50 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-600 disabled:opacity-50"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="px-3 py-2 bg-red-600/20 border border-red-600/30 text-red-400 rounded-xl text-xs font-medium hover:bg-red-600/30 transition-colors flex-shrink-0"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend(input)}
              className="px-3 py-2 bg-brand-600 text-white rounded-xl text-xs font-medium hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              Send
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
