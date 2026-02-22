import { create } from 'zustand'

export type WindowMode = 'auth' | 'compact' | 'expanded'

interface WindowState {
  mode: WindowMode
  setMode: (mode: WindowMode) => void
  toggleExpanded: () => void
  init: () => () => void
}

export const useWindowStore = create<WindowState>((set, get) => ({
  mode: 'auth',

  setMode: (mode) => {
    set({ mode })
    window.coasty.setWindowMode(mode)
  },

  toggleExpanded: () => {
    const current = get().mode
    if (current === 'compact') {
      set({ mode: 'expanded' })
      window.coasty.setWindowMode('expanded')
    } else if (current === 'expanded') {
      set({ mode: 'compact' })
      window.coasty.setWindowMode('compact')
    }
  },

  init: () => {
    const cleanup = window.coasty.onWindowModeChanged((mode: string) => {
      set({ mode: mode as WindowMode })
    })
    return cleanup
  },
}))
