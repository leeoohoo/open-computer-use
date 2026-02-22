import { contextBridge, ipcRenderer } from 'electron'

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('coasty', {
  // Auth
  signIn: () => ipcRenderer.invoke('auth:sign-in'),
  signOut: () => ipcRenderer.invoke('auth:sign-out'),
  getSession: () => ipcRenderer.invoke('auth:get-session'),
  getToken: () => ipcRenderer.invoke('auth:get-token'),

  // WebSocket bridge
  connectBridge: () => ipcRenderer.invoke('bridge:connect'),
  disconnectBridge: () => ipcRenderer.invoke('bridge:disconnect'),
  getBridgeState: () => ipcRenderer.invoke('bridge:get-state'),

  // Config
  getBackendUrl: () => ipcRenderer.invoke('config:get-backend-url'),
  getMachineId: () => ipcRenderer.invoke('config:get-machine-id'),

  // Chat CRUD
  createChat: (params: { title?: string; model?: string }) =>
    ipcRenderer.invoke('chats:create', params),
  listChats: () => ipcRenderer.invoke('chats:list'),
  getChatMessages: (chatId: string) => ipcRenderer.invoke('chats:get-messages', chatId),
  updateChat: (params: { chatId: string; title: string }) =>
    ipcRenderer.invoke('chats:update', params),
  deleteChat: (chatId: string) => ipcRenderer.invoke('chats:delete', chatId),

  // Credits / Billing
  getCredits: () => ipcRenderer.invoke('credits:get-balance'),

  // Window mode control
  setWindowMode: (mode: string) => ipcRenderer.invoke('window:set-mode', mode),
  onWindowModeChanged: (callback: (mode: string) => void) => {
    const handler = (_event: any, mode: string) => callback(mode)
    ipcRenderer.on('window-mode-changed', handler)
    return () => ipcRenderer.removeListener('window-mode-changed', handler)
  },

  // Window opacity control
  setOpacity: (value: number) => ipcRenderer.invoke('window:set-opacity', value),
  getOpacity: () => ipcRenderer.invoke('window:get-opacity'),
  onOpacityChanged: (callback: (value: number) => void) => {
    const handler = (_event: any, value: number) => callback(value)
    ipcRenderer.on('window-opacity-changed', handler)
    return () => ipcRenderer.removeListener('window-opacity-changed', handler)
  },

  // Auto-update
  getUpdateStatus: () => ipcRenderer.invoke('update:get-status'),
  getUpdateVersion: () => ipcRenderer.invoke('update:get-version'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatusChanged: (callback: (status: string) => void) => {
    const handler = (_event: any, status: string) => callback(status)
    ipcRenderer.on('update-status-changed', handler)
    return () => ipcRenderer.removeListener('update-status-changed', handler)
  },

  // Events from main process
  onConnectionStateChanged: (callback: (state: string) => void) => {
    const handler = (_event: any, state: string) => callback(state)
    ipcRenderer.on('connection-state-changed', handler)
    return () => ipcRenderer.removeListener('connection-state-changed', handler)
  },
})

// Type declaration for renderer
export interface CoastyAPI {
  signIn: () => Promise<{ success: boolean; user?: any; error?: string }>
  signOut: () => Promise<{ success: boolean; error?: string }>
  getSession: () => Promise<{
    isAuthenticated: boolean
    userId: string | null
    email: string | null
    name: string | null
    avatar: string | null
    machineId: string
  }>
  getToken: () => Promise<string | null>

  connectBridge: () => Promise<{ success: boolean; machineId?: string; error?: string }>
  disconnectBridge: () => Promise<{ success: boolean }>
  getBridgeState: () => Promise<string>

  getBackendUrl: () => Promise<string>
  getMachineId: () => Promise<string>

  // Chat CRUD
  createChat: (params: { title?: string; model?: string }) =>
    Promise<{ success: boolean; chat?: any; error?: string }>
  listChats: () =>
    Promise<{ success: boolean; chats?: any[]; error?: string }>
  getChatMessages: (chatId: string) =>
    Promise<{ success: boolean; messages?: any[]; error?: string }>
  updateChat: (params: { chatId: string; title: string }) =>
    Promise<{ success: boolean; error?: string }>
  deleteChat: (chatId: string) =>
    Promise<{ success: boolean; error?: string }>

  getCredits: () => Promise<{
    success: boolean
    balance?: number
    can_start_session?: boolean
    estimated_runtime_minutes?: number
    error?: string
  }>

  setWindowMode: (mode: string) => Promise<void>
  onWindowModeChanged: (callback: (mode: string) => void) => () => void

  setOpacity: (value: number) => Promise<void>
  getOpacity: () => Promise<number>
  onOpacityChanged: (callback: (value: number) => void) => () => void

  getUpdateStatus: () => Promise<string>
  getUpdateVersion: () => Promise<string | null>
  installUpdate: () => Promise<void>
  onUpdateStatusChanged: (callback: (status: string) => void) => () => void

  onConnectionStateChanged: (callback: (state: string) => void) => () => void
}

declare global {
  interface Window {
    coasty: CoastyAPI
  }
}
