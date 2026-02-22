import { useChatStore } from '../stores/chat-store'
import { useAuthStore } from '../stores/auth-store'
import { useConnectionStore } from '../stores/connection-store'
import { sendChatMessage } from '../lib/api'

export function useChatSubmit() {
  const {
    messages, isStreaming, chatId, chatTitle,
    addUserMessage, setStreaming, setAbortController, stopStreaming,
    appendAssistantContent, addToolCall, updateToolResult,
    finishAssistantMessage, clearMessages, ensureChat, loadChatList,
  } = useChatStore()
  const { user, machineId } = useAuthStore()
  const connectionState = useConnectionStore((s) => s.state)

  const canSend = (input: string) =>
    input.trim().length > 0 && !isStreaming && connectionState === 'connected'

  const handleSubmit = async (input: string) => {
    if (!canSend(input) || !user || !machineId) return

    const userMessage = input.trim()
    addUserMessage(userMessage)
    setStreaming(true)

    const activeChatId = await ensureChat(userMessage)

    const allMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ]

    const controller = new AbortController()
    setAbortController(controller)

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
          onReasoning: () => {},
          onFinish: (data) => {
            finishAssistantMessage(data.content, data.toolInvocations)
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
      setAbortController(null)
    }
  }

  return {
    messages,
    isStreaming,
    chatId,
    chatTitle,
    connectionState,
    canSend,
    handleSubmit,
    handleStop: stopStreaming,
    clearMessages,
    loadChatList,
  }
}
