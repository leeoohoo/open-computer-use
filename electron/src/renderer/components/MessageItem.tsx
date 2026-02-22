import React from 'react'
import type { ChatMessage } from '../stores/chat-store'
import { ToolInvocationDisplay } from './ToolInvocationDisplay'
import { hasCuaSections, CuaSectionRenderer } from './CuaSectionRenderer'
import { Markdown } from './Markdown'

interface Props {
  message: ChatMessage
}

export function MessageItem({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] space-y-3 ${
          isUser
            ? 'bg-neutral-800 rounded-3xl px-5 py-2.5'
            : 'bg-transparent'
        }`}
      >
        {/* Message content */}
        {message.content && (
          isUser ? (
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-200">
              {message.content}
            </div>
          ) : hasCuaSections(message.content) ? (
            <CuaSectionRenderer content={message.content} />
          ) : (
            <div className="markdown-prose text-sm leading-relaxed text-neutral-300">
              <Markdown>{message.content}</Markdown>
            </div>
          )
        )}

        {/* Tool invocations */}
        {!isUser && message.toolInvocations && message.toolInvocations.length > 0 && (
          <ToolInvocationDisplay invocations={message.toolInvocations} />
        )}
      </div>
    </div>
  )
}
