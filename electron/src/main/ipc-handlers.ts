import { ipcMain } from 'electron'
import * as os from 'os'
import { ElectronAuth } from './auth'
import { WebSocketBridge } from './ws-bridge'
import { ApprovalManager } from './approval-manager'

/** Helper: make an authenticated fetch to the Python backend. */
async function backendFetch(
  backendUrl: string,
  path: string,
  auth: ElectronAuth,
  options: { method?: string; body?: any } = {},
): Promise<any> {
  const token = await auth.getAccessToken()
  const url = `${backendUrl}${path}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backend ${res.status}: ${text}`)
  }
  return res.json()
}

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
  ipcMain.handle('chats:create', async (_event, params: { title?: string; model?: string }) => {
    try {
      const userId = auth.getUserId()
      const machineId = auth.getMachineId()
      if (!userId) return { success: false, error: 'Not authenticated' }

      const result = await backendFetch(backendUrl, '/api/chats/create', auth, {
        method: 'POST',
        body: {
          user_id: userId,
          title: params.title || 'New Task',
          model: params.model || 'default',
          source: 'electron',
          machine_id: machineId,
          machine_name: `${os.hostname()} (Desktop)`,
          platform: process.platform,
        },
      })
      return { success: true, chat: result.chat }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chats:list', async () => {
    try {
      const userId = auth.getUserId()
      const machineId = auth.getMachineId()
      if (!userId) return { success: false, error: 'Not authenticated' }

      // Only load chats created on this machine
      const qs = new URLSearchParams({
        user_id: userId,
        machine_id: machineId,
      })
      const result = await backendFetch(backendUrl, `/api/chats/list?${qs.toString()}`, auth)
      return { success: true, chats: result.chats }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chats:get-messages', async (_event, chatId: string) => {
    try {
      const result = await backendFetch(backendUrl, `/api/chats/${encodeURIComponent(chatId)}/messages`, auth)
      return { success: true, messages: result.messages }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chats:update', async (_event, params: { chatId: string; title: string }) => {
    try {
      await backendFetch(backendUrl, `/api/chats/${encodeURIComponent(params.chatId)}`, auth, {
        method: 'PATCH',
        body: { title: params.title },
      })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chats:delete', async (_event, chatId: string) => {
    try {
      await backendFetch(backendUrl, `/api/chats/${encodeURIComponent(chatId)}`, auth, {
        method: 'DELETE',
      })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ── Credits / Billing ─────────────────────────────────────────────
  ipcMain.handle('credits:get-balance', async () => {
    try {
      const userId = auth.getUserId()
      if (!userId) return { success: false, error: 'Not authenticated' }
      const qs = new URLSearchParams({ user_id: userId })
      const result = await backendFetch(backendUrl, `/api/billing/credits/balance?${qs.toString()}`, auth)
      return { success: true, ...result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
