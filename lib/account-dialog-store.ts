"use client"

import { create } from "zustand"

export type AccountSectionType =
  | "account"
  | "billing"
  | "privacy"
  | "notifications"
  | "appearance"
  | "api-keys"
  | "data"
  | "feedback"
  | "about"
  | "social"

interface AccountDialogStore {
  isOpen: boolean
  section: AccountSectionType
  /** The path the user was on before opening the dialog */
  _previousPath: string | null
  open: (section?: AccountSectionType) => void
  close: () => void
  setSection: (section: AccountSectionType) => void
  /** Called from the dialog component to sync state without URL side-effects */
  _syncFromUrl: (section: AccountSectionType) => void
}

export const useAccountDialog = create<AccountDialogStore>((set, get) => ({
  isOpen: false,
  section: "account",
  _previousPath: null,

  open: (section = "account") => {
    if (typeof window === "undefined") return
    const current = get()
    // Save current path if we're not already on /account
    const currentPath = window.location.pathname + window.location.search
    const previousPath = currentPath.startsWith("/account") ? current._previousPath : currentPath

    set({ isOpen: true, section, _previousPath: previousPath })

    // Push /account?section=X to the URL
    const url = section === "account" ? "/account" : `/account?section=${section}`
    if (window.location.pathname !== "/account" || window.location.search !== (section === "account" ? "" : `?section=${section}`)) {
      window.history.pushState({ accountDialog: true, section }, "", url)
    }
  },

  close: () => {
    if (typeof window === "undefined") return
    const { _previousPath } = get()
    set({ isOpen: false, _previousPath: null })

    // Navigate back to previous path
    if (_previousPath && _previousPath !== window.location.pathname + window.location.search) {
      window.history.pushState(null, "", _previousPath)
    } else if (window.location.pathname === "/account" || window.location.pathname === "/credits") {
      // If we're on /account directly (e.g. typed in URL), go to home
      window.history.pushState(null, "", "/")
    }
  },

  setSection: (section) => {
    if (typeof window === "undefined") return
    set({ section })
    // Replace URL to update section without adding history entry
    const url = section === "account" ? "/account" : `/account?section=${section}`
    window.history.replaceState({ accountDialog: true, section }, "", url)
  },

  _syncFromUrl: (section) => {
    set({ isOpen: true, section })
  },
}))
