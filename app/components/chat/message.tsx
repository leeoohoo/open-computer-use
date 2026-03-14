import { Message as MessageType } from "@ai-sdk/react"
import React, { useState } from "react"
import { MessageAssistant } from "./message-assistant"
import { MessageUser } from "./message-user"
import { ScheduledRunIndicator, isScheduledRunMarker } from "./scheduled-run-indicator"

type MessageProps = {
  variant: MessageType["role"]
  children: string
  id: string
  attachments?: MessageType["experimental_attachments"]
  isLast?: boolean
  onDelete: (id: string) => void
  onEdit: (id: string, newText: string) => void
  onReload: () => void
  hasScrollAnchor?: boolean
  parts?: MessageType["parts"]
  status?: "streaming" | "ready" | "submitted" | "error"
  className?: string
  user_id?: string
  users?: {
    display_name: string | null
    profile_image: string | null
    email: string
  }
  isChunked?: boolean | null
  isCompressed?: boolean | null
  truncated?: boolean | null
  contentSize?: number
}

export function Message({
  variant,
  children,
  id,
  attachments,
  isLast,
  onDelete,
  onEdit,
  onReload,
  hasScrollAnchor,
  parts,
  status,
  className,
  user_id,
  users,
  isChunked,
  isCompressed,
  truncated,
  contentSize,
}: MessageProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 500)
  }

  if (variant === "user" && isScheduledRunMarker(children)) {
    return <ScheduledRunIndicator raw={children} />
  }

  if (variant === "user") {
    return (
      <MessageUser
        copied={copied}
        copyToClipboard={copyToClipboard}
        onReload={onReload}
        onEdit={onEdit}
        onDelete={onDelete}
        id={id}
        hasScrollAnchor={hasScrollAnchor}
        attachments={attachments}
        className={className}
        user_id={user_id}
        users={users}
      >
        {children}
      </MessageUser>
    )
  }

  if (variant === "assistant") {
    return (
      <MessageAssistant
        messageId={id}
        copied={copied}
        copyToClipboard={copyToClipboard}
        onReload={onReload}
        isLast={isLast}
        hasScrollAnchor={hasScrollAnchor}
        parts={parts}
        status={status}
        className={className}
        isChunked={isChunked}
        isCompressed={isCompressed}
        truncated={truncated}
        contentSize={contentSize}
      >
        {children}
      </MessageAssistant>
    )
  }

  return null
}
