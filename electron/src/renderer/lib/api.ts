import { parseSSEStream, SSECallbacks } from './sse-parser'

/**
 * Get the base URL for API calls.
 *
 * In dev, Vite proxies /api → backend. In production, use the full backend
 * URL from config. All Electron HTTP calls go through the Next.js proxy
 * path (/api/electron/proxy/) which accepts Bearer tokens and forwards
 * to the Python backend with X-Internal-Key.
 */
async function getApiBase(): Promise<string> {
  // @ts-ignore import.meta.env is injected by vite
  if (import.meta?.env?.DEV) return ''
  return await window.coasty.getBackendUrl()
}

/**
 * Send a chat message to the backend and stream the response.
 *
 * Uses /api/electron/proxy/chat/ so the Next.js proxy handles Bearer
 * token verification and forwards to the Python backend.
 */
export async function sendChatMessage(
  params: {
    messages: Array<{ role: string; content: string }>
    chatId: string
    userId: string
    machineId: string
    model?: string
  },
  callbacks: SSECallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const apiBase = await getApiBase()
  const token = await window.coasty.getToken()

  const response = await fetch(`${apiBase}/api/electron/proxy/chat/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      messages: params.messages,
      chat_id: params.chatId,
      user_id: params.userId,
      machine_id: params.machineId,
      model: params.model || 'default',
      is_authenticated: true,
    }),
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    let errorMessage = `Request failed: ${response.status}`
    try {
      const json = JSON.parse(text)
      errorMessage = json.detail || json.error || errorMessage
    } catch { /* use default */ }

    if (response.status === 402) {
      callbacks.onError('Insufficient credits. Please purchase more credits to continue.')
    } else if (response.status === 503) {
      callbacks.onError('Electron desktop app is not connected to the backend. Please check your connection.')
    } else {
      callbacks.onError(errorMessage)
    }
    return
  }

  await parseSSEStream(response, callbacks, signal)
}
