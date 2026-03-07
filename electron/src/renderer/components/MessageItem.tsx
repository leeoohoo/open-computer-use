import React, { useMemo } from 'react'
import type { ChatMessage } from '../stores/chat-store'
import { ToolInvocationDisplay } from './ToolInvocationDisplay'
import { hasCuaSections, CuaSectionRenderer } from './CuaSectionRenderer'
import { Markdown } from './Markdown'

function toDataUri(raw: string): string | null {
  const clean = raw.trim()
  if (!clean) return null
  if (clean.startsWith('data:image/')) return clean
  if (clean.startsWith('/9j/')) return `data:image/jpeg;base64,${clean}`
  if (clean.startsWith('iVBOR')) return `data:image/png;base64,${clean}`
  return `data:image/jpeg;base64,${clean}`
}

interface Props {
  message: ChatMessage
}

export function MessageItem({ message }: Props) {
  const isUser = message.role === 'user'
  const isCua = !isUser && message.content && hasCuaSections(message.content)

  const screenshots = useMemo(() => {
    if (!isCua || !message.toolInvocations) return []
    const result: string[] = []
    for (const inv of message.toolInvocations) {
      if (inv.frontendScreenshot) {
        const uri = toDataUri(inv.frontendScreenshot)
        if (uri) { result.push(uri); continue }
      }
      if (inv.state === 'result' && inv.result && typeof inv.result === 'object' && 'frontendScreenshot' in inv.result) {
        const uri = toDataUri(inv.result.frontendScreenshot)
        if (uri) { result.push(uri); continue }
      }
    }
    return result
  }, [isCua, message.toolInvocations])

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
          ) : isCua ? (
            <CuaSectionRenderer
              content={message.content}
              screenshots={screenshots}
            />
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
