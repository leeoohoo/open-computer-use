import { ipcMain, dialog } from 'electron'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { ElectronAuth } from './auth'
import { WebSocketBridge } from './ws-bridge'
import { ApprovalManager } from './approval-manager'

export function registerIpcHandlers(
  auth: ElectronAuth,
  getWsBridge: () => WebSocketBridge | null,
  setWsBridge: (bridge: WebSocketBridge) => void,
  backendUrl: string,
  approvalManager: ApprovalManager,
): void {
  // Auth handlers
  ipcMain.handle('auth:sign-in', async () => {
    try {
      const result = await auth.signInWithGoogle()
      return {
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.user_metadata?.full_name,
          avatar: result.user.user_metadata?.avatar_url,
        },
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('auth:sign-in-email', async (_event, email: string, password: string) => {
    try {
      const result = await auth.signInWithEmail(email, password)
      return {
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.user_metadata?.full_name || null,
          avatar: result.user.user_metadata?.avatar_url || null,
        },
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Sign-up: long-running — waits for user to click confirmation email link
  ipcMain.handle('auth:sign-up-email', async (_event, email: string, password: string) => {
    try {
      const result = await auth.signUpWithEmail(email, password)
      return {
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.user_metadata?.full_name || null,
          avatar: result.user.user_metadata?.avatar_url || null,
        },
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Magic link phase 1: send OTP (returns quickly)
  ipcMain.handle('auth:send-magic-link', async (_event, email: string) => {
    try {
      await auth.sendMagicLink(email)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Magic link phase 2: wait for user to click link (long-running)
  ipcMain.handle('auth:await-magic-link', async () => {
    try {
      const result = await auth.awaitMagicLinkSession()
      return {
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.user_metadata?.full_name || null,
          avatar: result.user.user_metadata?.avatar_url || null,
        },
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('auth:reset-password', async (_event, email: string) => {
    try {
      await auth.resetPassword(email)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Cancel any pending auth flow (sign-up confirmation wait, magic link wait)
  ipcMain.handle('auth:cancel-auth', async () => {
    auth.cancelPendingAuth()
    return { success: true }
  })

  ipcMain.handle('auth:sign-out', async () => {
    try {
      const bridge = getWsBridge()
      if (bridge) {
        bridge.disconnect()
      }
      await auth.signOut()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('auth:get-session', async () => {
    return {
      isAuthenticated: auth.isAuthenticated(),
      userId: auth.getUserId(),
      email: auth.getUserEmail(),
      name: auth.getUserName(),
      avatar: auth.getUserAvatar(),
      machineId: auth.getMachineId(),
    }
  })

  ipcMain.handle('auth:get-token', async () => {
    return await auth.getAccessToken()
  })

  // WebSocket bridge handlers
  ipcMain.handle('bridge:connect', async () => {
    try {
      const token = await auth.getAccessToken()
      const userId = auth.getUserId()
      const machineId = auth.getMachineId()

      if (!token || !userId) {
        return { success: false, error: 'Not authenticated' }
      }

      let bridge = getWsBridge()
      if (bridge) {
        bridge.disconnect()
      }

      bridge = new WebSocketBridge(backendUrl, token, machineId, userId, approvalManager)
      setWsBridge(bridge)
      bridge.connect()

      return { success: true, machineId }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('bridge:disconnect', async () => {
    const bridge = getWsBridge()
    if (bridge) {
      bridge.disconnect()
    }
    return { success: true }
  })

  ipcMain.handle('bridge:get-state', async () => {
    const bridge = getWsBridge()
    return bridge?.getState() || 'disconnected'
  })

  // Config handlers
  ipcMain.handle('config:get-backend-url', async () => {
    return backendUrl
  })

  ipcMain.handle('config:get-machine-id', async () => {
    return auth.getMachineId()
  })

  // ── Chat CRUD handlers ──────────────────────────────────────────────
  // Query Supabase directly — no proxy, no CORS, no routing issues.

  ipcMain.handle('chats:create', async (_event, params: { title?: string; model?: string }) => {
    try {
      const userId = auth.getUserId()
      const machineId = auth.getMachineId()
      if (!userId) return { success: false, error: 'Not authenticated' }

      const supabase = await auth.getSupabaseClient()
      const { data: chat, error } = await supabase
        .from('chats')
        .insert({
          user_id: userId,
          title: params.title || 'New Task',
          model: params.model || 'default',
          room_settings: {
            source: 'electron',
            machine_id: machineId,
            machine_name: `${os.hostname()} (Desktop)`,
            platform: process.platform,
          },
        })
        .select()
        .single()

      if (error) throw error
      return { success: true, chat }
    } catch (error: any) {
      console.error('[Chats] Create failed:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chats:list', async () => {
    try {
      const userId = auth.getUserId()
      const machineId = auth.getMachineId()
      if (!userId) return { success: false, error: 'Not authenticated' }

      const supabase = await auth.getSupabaseClient()
      const { data: chats, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) throw error

      // Filter to this machine's chats (room_settings.machine_id)
      const machineChats = (chats || []).filter((c: any) => {
        const settings = c.room_settings || {}
        return settings.machine_id === machineId
      })

      return { success: true, chats: machineChats }
    } catch (error: any) {
      console.error('[Chats] List failed:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chats:get-messages', async (_event, chatId: string) => {
    try {
      const supabase = await auth.getSupabaseClient()
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return { success: true, messages: messages || [] }
    } catch (error: any) {
      console.error('[Chats] Get messages failed:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chats:update', async (_event, params: { chatId: string; title: string }) => {
    try {
      const userId = auth.getUserId()
      if (!userId) return { success: false, error: 'Not authenticated' }

      const supabase = await auth.getSupabaseClient()
      const { error } = await supabase
        .from('chats')
        .update({ title: params.title, updated_at: new Date().toISOString() })
        .eq('id', params.chatId)
        .eq('user_id', userId)

      if (error) throw error
      return { success: true }
    } catch (error: any) {
      console.error('[Chats] Update failed:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chats:delete', async (_event, chatId: string) => {
    try {
      const userId = auth.getUserId()
      if (!userId) return { success: false, error: 'Not authenticated' }

      const supabase = await auth.getSupabaseClient()
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId)
        .eq('user_id', userId)

      if (error) throw error
      return { success: true }
    } catch (error: any) {
      console.error('[Chats] Delete failed:', error.message)
      return { success: false, error: error.message }
    }
  })

  // ── Credits / Billing ─────────────────────────────────────────────
  // Query Supabase directly from the main process — no proxy needed.
  // This is the same query the Next.js /api/credits/balance route does.
  ipcMain.handle('credits:get-balance', async () => {
    try {
      const userId = auth.getUserId()
      if (!userId) return { success: false, error: 'Not authenticated' }

      const supabase = await auth.getSupabaseClient()

      // Try RPC first (creates credits row if missing)
      const { data: credits, error: rpcError } = await (supabase as any)
        .rpc('get_or_create_user_credits', { p_user_id: userId })
        .single()

      if (!rpcError && credits) {
        return {
          success: true,
          balance: credits.balance ?? 0,
          can_start_session: (credits.balance ?? 0) >= 20,
          estimated_runtime_minutes: Math.floor((credits.balance ?? 0) / 10),
        }
      }

      // Fallback: direct select
      const { data: existing, error: selectError } = await (supabase as any)
        .from('user_credits')
        .select('balance, total_purchased, total_used')
        .eq('user_id', userId)
        .single()

      if (!selectError && existing) {
        return {
          success: true,
          balance: existing.balance ?? 0,
          can_start_session: (existing.balance ?? 0) >= 20,
          estimated_runtime_minutes: Math.floor((existing.balance ?? 0) / 10),
        }
      }

      // No credits row at all — return zero
      return {
        success: true,
        balance: 0,
        can_start_session: false,
        estimated_runtime_minutes: 0,
      }
    } catch (error: any) {
      console.error('[Credits] Failed to fetch balance:', error.message)
      return { success: false, error: error.message }
    }
  })

  // ── Chat SSE Streaming (main process, no CORS) ───────────────────
  // The renderer cannot fetch() external URLs without CORS issues
  // (it loads from file://). All streaming goes through the main process
  // which has no CORS restrictions. SSE events are forwarded to the
  // renderer via IPC events.

  // Active abort controllers for chat streams, keyed by requestId
  const chatAbortControllers = new Map<string, AbortController>()

  ipcMain.handle('chat:send-message', async (event, params: {
    requestId: string
    messages: Array<{ role: string; content: string }>
    chatId: string
    userId: string
    machineId: string
    model?: string
  }) => {
    const token = await auth.getAccessToken()

    // Use the Next.js /api/chat/ route which accepts Bearer tokens
    const url = `${backendUrl}/api/chat/`
    const controller = new AbortController()
    chatAbortControllers.set(params.requestId, controller)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: params.messages,
          chat_id: params.chatId,
          user_id: params.userId,
          machine_id: params.machineId,
          model: params.model || 'default',
          is_authenticated: true,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text()
        let errorMessage = `Request failed: ${response.status}`
        try {
          const json = JSON.parse(text)
          errorMessage = json.detail || json.error || errorMessage
        } catch { /* use default */ }

        // Send error to renderer
        const sender = event.sender
        if (!sender.isDestroyed()) {
          sender.send('chat:sse-event', {
            requestId: params.requestId,
            type: 'error',
            data: response.status === 402
              ? 'Insufficient credits. Please purchase more credits to continue.'
              : response.status === 503
                ? 'Electron desktop app is not connected. Please check your connection.'
                : errorMessage,
          })
        }
        return { success: false, error: errorMessage }
      }

      // Stream SSE events to the renderer
      const reader = response.body?.getReader()
      if (!reader) {
        return { success: false, error: 'No response body' }
      }

      const decoder = new TextDecoder()
      let buffer = ''
      const sender = event.sender

      try {
        while (true) {
          if (controller.signal.aborted) break

          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const events = buffer.split('\n\n')
          buffer = events.pop() || ''

          for (const sseEvent of events) {
            const trimmed = sseEvent.trim()
            if (!trimmed) continue

            const colonIndex = trimmed.indexOf(':')
            if (colonIndex === -1) continue

            const code = trimmed.slice(0, colonIndex)
            const rawData = trimmed.slice(colonIndex + 1)

            if (!sender.isDestroyed()) {
              sender.send('chat:sse-event', {
                requestId: params.requestId,
                type: code,
                data: rawData,
              })
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      return { success: true }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: true, aborted: true }
      }
      // Send error to renderer
      const sender = event.sender
      if (!sender.isDestroyed()) {
        sender.send('chat:sse-event', {
          requestId: params.requestId,
          type: 'error',
          data: err.message || 'Failed to connect to backend',
        })
      }
      return { success: false, error: err.message }
    } finally {
      chatAbortControllers.delete(params.requestId)
    }
  })

  ipcMain.handle('chat:abort', async (_event, requestId: string) => {
    const controller = chatAbortControllers.get(requestId)
    if (controller) {
      controller.abort()
      chatAbortControllers.delete(requestId)
    }
    return { success: true }
  })

  // File/folder picker — opens native OS dialog, returns selected paths + metadata
  ipcMain.handle('files:select', async (_event, opts?: { directories?: boolean }) => {
    const properties: Electron.OpenDialogOptions['properties'] = ['multiSelections']
    if (opts?.directories) {
      properties.push('openDirectory')
    } else {
      properties.push('openFile')
    }
    const result = await dialog.showOpenDialog({ properties })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, files: [] }
    }
    const files = result.filePaths.map((fp) => {
      let isDir = false
      try { isDir = fs.statSync(fp).isDirectory() } catch {}
      return {
        path: fp,
        name: path.basename(fp),
        ext: isDir ? '' : path.extname(fp).replace('.', ''),
        isDirectory: isDir,
      }
    })
    return { success: true, files }
  })
}
