import { create } from 'zustand'

interface AuthUser {
  id: string
  email: string | null
  name: string | null
  avatar?: string
}

interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  machineId: string | null
  loading: boolean

  checkSession: () => Promise<void>
  signIn: () => Promise<boolean>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  machineId: null,
  loading: true,

  checkSession: async () => {
    try {
      const session = await window.coasty.getSession()
      set({
        isAuthenticated: session.isAuthenticated,
        user: session.isAuthenticated
          ? { id: session.userId!, email: session.email, name: session.name, avatar: session.avatar ?? undefined }
          : null,
        machineId: session.machineId,
        loading: false,
      })
    } catch {
      set({ isAuthenticated: false, user: null, loading: false })
    }
  },

  signIn: async () => {
    set({ loading: true })
    try {
      const result = await window.coasty.signIn()
      if (result.success && result.user) {
        const session = await window.coasty.getSession()
        set({
          isAuthenticated: true,
          user: result.user,
          machineId: session.machineId,
          loading: false,
        })
        return true
      }
      set({ loading: false })
      return false
    } catch {
      set({ loading: false })
      return false
    }
  },

  signOut: async () => {
    await window.coasty.signOut()
    set({ isAuthenticated: false, user: null, machineId: null })
  },
}))
