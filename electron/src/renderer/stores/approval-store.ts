import { create } from 'zustand'

export type ApprovalMode = 'full_control' | 'smart_approve' | 'approve_all' | 'off'

export interface PendingApproval {
  id: string
  command: string
  parameters: any
}

interface ApprovalState {
  mode: ApprovalMode
  pendingApprovals: PendingApproval[]

  setMode: (mode: ApprovalMode) => void
  addPending: (approval: PendingApproval) => void
  removePending: (id: string) => void
  approve: (id: string) => void
  deny: (id: string, reason?: string) => void
  init: () => () => void
}

export const APPROVAL_MODE_LABELS: Record<ApprovalMode, string> = {
  full_control: 'Full Control',
  smart_approve: 'Smart Approve',
  approve_all: 'Review All',
  off: 'Paused',
}

export const APPROVAL_MODE_ORDER: ApprovalMode[] = [
  'full_control', 'smart_approve',
  // 'approve_all',  // hidden for now
]

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  mode: 'full_control',
  pendingApprovals: [],

  setMode: (mode) => {
    set({ mode })
    window.coasty.setApprovalMode(mode)
  },

  addPending: (approval) => {
    set((state) => ({
      pendingApprovals: [...state.pendingApprovals, approval],
    }))
  },

  removePending: (id) => {
    set((state) => ({
      pendingApprovals: state.pendingApprovals.filter((a) => a.id !== id),
    }))
  },

  approve: (id) => {
    window.coasty.respondToApproval(id, true)
    get().removePending(id)
  },

  deny: (id, reason?) => {
    window.coasty.respondToApproval(id, false, reason)
    get().removePending(id)
  },

  init: () => {
    // Load initial mode from main process
    window.coasty.getApprovalMode().then((mode) => {
      set({ mode: mode as ApprovalMode })
    })

    const cleanupRequest = window.coasty.onApprovalRequest((data) => {
      get().addPending({
        id: data.id,
        command: data.command,
        parameters: data.parameters,
      })
    })

    const cleanupMode = window.coasty.onApprovalModeChanged((mode) => {
      set({ mode: mode as ApprovalMode })
    })

    return () => {
      cleanupRequest()
      cleanupMode()
    }
  },
}))
