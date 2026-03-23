import React from 'react'
import { useConnectionStore } from '../stores/connection-store'
import { useWindowStore } from '../stores/window-store'
import { useAuthStore } from '../stores/auth-store'
import { useChatSubmit } from '../hooks/useChatSubmit'
import { useChatStore } from '../stores/chat-store'
import { MessageList } from './MessageList'
import { ChatHistory } from './ChatHistory'
import { ApprovalPrompt } from './ApprovalPrompt'
import { useApprovalStore, APPROVAL_MODE_ORDER, APPROVAL_MODE_LABELS } from '../stores/approval-store'
import type { ApprovalMode } from '../stores/approval-store'

function statusDot(state: string): string {
  switch (state) {
    case 'connected': return 'bg-emerald-400'
    case 'connecting': return 'bg-yellow-400 animate-pulse'
    case 'error': return 'bg-red-400'
    default: return 'bg-neutral-500'
  }
}

const OPACITY_PRESETS = [1, 0.7, 0.4, 0.2]
const OPACITY_STEP = 0.05
const OPACITY_MIN = 0.15

/** Eye icon that reflects current opacity level */
function EyeIcon({ opacity }: { opacity: number }) {
  if (opacity > 0.8) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  if (opacity > 0.5) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    )
  }
  if (opacity > 0.25) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    )
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

/** Shield icon reflecting current approval mode */
function ShieldIcon({ mode }: { mode: string }) {
  const s = { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (mode === 'full_control') {
    return (<svg {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>)
  }
  if (mode === 'smart_approve') {
    return (<svg {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>)
  }
  if (mode === 'approve_all') {
    return (<svg {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>)
  }
  // off
  return (<svg {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="8" y1="8" x2="16" y2="16" /></svg>)
}

/** Approval mode descriptions for dropdown */
const MODE_DESCRIPTIONS: Record<ApprovalMode, string> = {
  full_control: 'Execute all actions automatically',
  smart_approve: 'Approve dangerous actions only',
  approve_all: 'Review every action before execution',
  off: 'Block all actions (pause agent)',
}

/** Shield button color by mode */
function shieldColor(mode: string, hasPending: boolean): string {
  const pulse = hasPending ? ' animate-pulse' : ''
  if (mode === 'off') return `text-red-400 hover:bg-red-950/40${pulse}`
  if (mode === 'approve_all') return `text-amber-400 hover:bg-amber-950/40${pulse}`
  if (mode === 'smart_approve') return `text-blue-400 hover:bg-blue-950/40${pulse}`
  return `text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200${pulse}`
}

/** User avatar — profile picture or fallback initial */
function UserAvatar({ avatar, name, size = 22 }: { avatar?: string; name?: string | null; size?: number }) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        referrerPolicy="no-referrer"
      />
    )
  }
  const initial = name?.charAt(0)?.toUpperCase() || '?'
  return (
    <div
      className="rounded-full bg-neutral-700 flex items-center justify-center text-neutral-300 font-medium flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </div>
  )
}

const PLACEHOLDER_SUGGESTIONS = [
  'Book me a flight to Tokyo...',
  'Find the best coffee shop nearby...',
  'Fill out that job application...',
  'Order groceries for the week...',
  'Research competitors and summarize...',
  'Book me a flight to Tokyo...',  // duplicate first for seamless loop
]

/** Rotating placeholder carousel for compact input */
function PlaceholderCarousel() {
  return (
    <div className="overflow-hidden h-[16px] pointer-events-none">
      <div className="carousel-track flex flex-col">
        {PLACEHOLDER_SUGGESTIONS.map((text, i) => (
          <span
            key={i}
            className="h-[16px] flex items-center text-xs text-neutral-500 truncate whitespace-nowrap shrink-0"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}

/** External-link arrow icon (reusable) */
function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600 flex-shrink-0">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

/** A single menu row that opens a URL in the user's browser */
function MenuLink({ icon, label, desc, url, onClose }: {
  icon: React.ReactNode; label: string; desc: string; url: string; onClose: () => void
}) {
  return (
    <button
      onClick={() => { window.open(url, '_blank'); onClose() }}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-neutral-800/60 transition-colors group"
    >
      <span className="text-neutral-500 group-hover:text-neutral-300 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-neutral-300 group-hover:text-neutral-100">{label}</div>
        <div className="text-[10px] text-neutral-600">{desc}</div>
      </div>
      <ExternalIcon />
    </button>
  )
}

/** Account menu panel shown in the expanded area */
function AccountMenu({ onClose, updateStatus }: { onClose: () => void; updateStatus: string }) {
  const { user, signOut } = useAuthStore()
  const [credits, setCredits] = React.useState<number | null>(null)
  const [runtime, setRuntime] = React.useState<number | null>(null)
  const [appVersion, setAppVersion] = React.useState('...')

  // Fetch credit balance and app version on mount
  React.useEffect(() => {
    window.coasty.getCredits().then((res) => {
      if (res.success) {
        setCredits(res.balance ?? 0)
        setRuntime(res.estimated_runtime_minutes ?? 0)
      }
    }).catch(() => {})
    window.coasty.getAppVersion().then(setAppVersion).catch(() => {})
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0 animate-chat-reveal">
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
        {/* Profile header */}
        <div className="flex items-center gap-3 px-2 py-2">
          <UserAvatar avatar={user?.avatar} name={user?.name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-neutral-100 truncate">
              {user?.name || 'User'}
            </div>
            <div className="text-[11px] text-neutral-500 truncate">
              {user?.email || ''}
            </div>
          </div>
        </div>

        {/* Credits card */}
        <button
          onClick={() => { window.open('https://coasty.ai/account?section=billing', '_blank'); onClose() }}
          className="w-full rounded-lg bg-neutral-800/50 border border-neutral-700/40 px-3 py-2.5 hover:bg-neutral-800/70 transition-colors group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Credits</span>
            <ExternalIcon />
          </div>
          {credits !== null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-neutral-100">{credits.toLocaleString()}</span>
              {runtime !== null && runtime > 0 && (
                <span className="text-[10px] text-neutral-500">{runtime} min remaining</span>
              )}
            </div>
          ) : (
            <div className="h-5 w-20 rounded bg-neutral-700/50 animate-pulse" />
          )}
        </button>

        {/* Update banner */}
        {updateStatus === 'ready' && (
          <button
            onClick={() => window.coasty.installUpdate()}
            className="w-full rounded-lg bg-emerald-950/40 border border-emerald-800/40 px-3 py-2.5 hover:bg-emerald-950/60 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-medium text-emerald-300">Update ready</div>
                <div className="text-[10px] text-emerald-600">Restart to apply</div>
              </div>
              <span className="text-[10px] font-medium text-emerald-500 group-hover:text-emerald-400">Restart</span>
            </div>
          </button>
        )}

        <div className="h-px bg-neutral-800/40" />

        {/* Account section */}
        <div className="space-y-0.5">
          <div className="px-3 pt-1 pb-0.5">
            <span className="text-[9px] font-medium text-neutral-600 uppercase tracking-widest">Account</span>
          </div>
          <MenuLink
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
            label="Account Settings"
            desc="Profile and preferences"
            url="https://coasty.ai/account"
            onClose={onClose}
          />
          <MenuLink
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>}
            label="Privacy & Security"
            desc="Data and security settings"
            url="https://coasty.ai/account?section=privacy"
            onClose={onClose}
          />
        </div>

        <div className="h-px bg-neutral-800/40" />

        {/* Support section */}
        <div className="space-y-0.5">
          <div className="px-3 pt-1 pb-0.5">
            <span className="text-[9px] font-medium text-neutral-600 uppercase tracking-widest">Support</span>
          </div>
          <MenuLink
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>}
            label="About"
            desc={`Coasty Desktop v${appVersion}`}
            url="https://coasty.ai"
            onClose={onClose}
          />
        </div>

        <div className="h-px bg-neutral-800/40" />

        {/* Connect section */}
        <div className="space-y-0.5">
          <div className="px-3 pt-1 pb-0.5">
            <span className="text-[9px] font-medium text-neutral-600 uppercase tracking-widest">Connect</span>
          </div>
          <MenuLink
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>}
            label="Follow on X"
            desc="@llmhub_dev"
            url="https://x.com/llmhub_dev"
            onClose={onClose}
          />
          <MenuLink
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" /></svg>}
            label="Star on GitHub"
            desc="coasty-ai"
            url="https://github.com/coasty-ai"
            onClose={onClose}
          />
          <MenuLink
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>}
            label="Contact Us"
            desc="founders@coasty.ai"
            url="mailto:founders@coasty.ai"
            onClose={onClose}
          />
        </div>

        <div className="h-px bg-neutral-800/40" />

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-red-950/30 transition-colors group"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500 group-hover:text-red-400 flex-shrink-0">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="text-xs font-medium text-neutral-400 group-hover:text-red-400">Sign Out</span>
        </button>
      </div>
    </div>
  )
}

export function Overlay() {
  const connectionState = useConnectionStore((s) => s.state)
  const reconnect = useConnectionStore((s) => s.connect)
  const { mode, toggleExpanded } = useWindowStore()
  const { user, signOut } = useAuthStore()
  const {
    messages, isStreaming, chatTitle,
    canSend, handleSubmit, handleStop, clearMessages,
  } = useChatSubmit()

  const loadChat = useChatStore((s) => s.loadChat)
  const { mode: approvalMode, setMode: setApprovalMode, pendingApprovals } = useApprovalStore()

  const isExpanded = mode === 'expanded'
  const [input, setInput] = React.useState('')
  const [opacity, setOpacity] = React.useState(1)
  const [showMenu, setShowMenu] = React.useState(false)
  const [showHistory, setShowHistory] = React.useState(false)
  const [showApprovalMenu, setShowApprovalMenu] = React.useState(false)
  const [updateStatus, setUpdateStatus] = React.useState('idle')

  // Close menus when collapsing
  React.useEffect(() => {
    if (!isExpanded) {
      setShowMenu(false)
      setShowHistory(false)
      setShowApprovalMenu(false)
    }
  }, [isExpanded])

  // Auto-expand when an approval prompt arrives in compact mode
  React.useEffect(() => {
    if (pendingApprovals.length > 0 && !isExpanded) {
      toggleExpanded()
    }
  }, [pendingApprovals.length])

  // Close approval popup on outside click
  const approvalPopupRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!showApprovalMenu) return
    const handler = (e: MouseEvent) => {
      if (approvalPopupRef.current && !approvalPopupRef.current.contains(e.target as Node)) {
        setShowApprovalMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showApprovalMenu])

  // Sync opacity from main process on mount
  React.useEffect(() => {
    window.coasty.getOpacity().then(setOpacity)
    const cleanup = window.coasty.onOpacityChanged(setOpacity)
    return cleanup
  }, [])

  // Track auto-update status
  React.useEffect(() => {
    window.coasty.getUpdateStatus().then(setUpdateStatus)
    const cleanup = window.coasty.onUpdateStatusChanged(setUpdateStatus)
    return cleanup
  }, [])

  // Ctrl+scroll to adjust opacity
  React.useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -OPACITY_STEP : OPACITY_STEP
      const next = Math.max(OPACITY_MIN, Math.min(1, opacity + delta))
      setOpacity(next)
      window.coasty.setOpacity(next)
    }
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [opacity])

  // Eye icon click: cycle through presets
  const cycleOpacity = () => {
    const currentIdx = OPACITY_PRESETS.findIndex((p) => opacity >= p - 0.05)
    const nextIdx = (currentIdx + 1) % OPACITY_PRESETS.length
    const next = OPACITY_PRESETS[nextIdx]
    setOpacity(next)
    window.coasty.setOpacity(next)
  }

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!canSend(input)) return
    handleSubmit(input)
    setInput('')
    // If submitted from compact mode, expand to show the conversation
    if (!isExpanded) {
      toggleExpanded()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  // Toggle account menu — expand window if needed
  const toggleMenu = () => {
    if (showMenu) {
      setShowMenu(false)
    } else {
      if (!isExpanded) toggleExpanded()
      setShowMenu(true)
      setShowHistory(false)
      setShowApprovalMenu(false)
    }
  }

  // Toggle approval mode picker — expand window if needed
  const toggleApprovalMenu = () => {
    if (showApprovalMenu) {
      setShowApprovalMenu(false)
    } else {
      if (!isExpanded) toggleExpanded()
      setShowApprovalMenu(true)
      setShowMenu(false)
      setShowHistory(false)
    }
  }

  return (
    <div className="glow-border relative flex flex-col w-full h-full rounded-2xl bg-neutral-900/95 backdrop-blur-xl overflow-hidden">
      {/* ── Pill bar — always visible ── */}
      <div className="titlebar-drag flex items-center gap-2.5 w-full h-14 px-3 flex-shrink-0 select-none">
        {/* Coasty logo — green dot when update is ready */}
        <div className="relative flex-shrink-0">
          <svg className="w-5 h-5" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="coastyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" stopOpacity={0} />
                <stop offset="30%" stopColor="rgba(255,255,255,0.1)" stopOpacity={1} />
                <stop offset="50%" stopColor="rgba(255,255,255,0.3)" stopOpacity={1} />
                <stop offset="70%" stopColor="rgba(255,255,255,0.6)" stopOpacity={1} />
                <stop offset="100%" stopColor="rgba(255,255,255,1)" stopOpacity={1} />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="100" fill="url(#coastyGrad)" />
          </svg>
          {updateStatus === 'ready' && (
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-neutral-900" />
          )}
        </div>

        {/* Status dot — clickable to reconnect when disconnected/error */}
        {connectionState === 'disconnected' || connectionState === 'error' ? (
          <button
            onClick={reconnect}
            className={`titlebar-no-drag w-1.5 h-1.5 rounded-full flex-shrink-0 cursor-pointer ${statusDot(connectionState)}`}
            title="Click to reconnect"
          />
        ) : (
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(connectionState)}`} />
        )}

        {/* Compact: inline input | Expanded: chat title or menu label */}
        {isExpanded ? (
          <span className="flex-1 min-w-0 text-xs font-medium text-neutral-200 truncate">
            {showMenu ? 'Account' : showHistory ? 'Chat History' : (chatTitle || 'Coasty')}
          </span>
        ) : (
          <div className="titlebar-no-drag flex-1 min-w-0 relative">
            {/* Show carousel when input is empty and not streaming */}
            {!input && !isStreaming && (
              <div className="absolute inset-0 flex items-center">
                <PlaceholderCarousel />
              </div>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={isStreaming ? 'Working...' : ''}
              disabled={connectionState !== 'connected' || isStreaming}
              className="relative z-10 w-full bg-transparent text-xs text-neutral-200 placeholder-neutral-500 outline-none disabled:opacity-50"
            />
          </div>
        )}

        {/* Actions */}
        <div className="titlebar-no-drag flex items-center gap-1">
          {!isExpanded && isStreaming ? (
            <button
              onClick={handleStop}
              className="px-2 py-1 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 text-[11px] font-medium hover:bg-red-600/30 transition-colors"
            >
              Stop
            </button>
          ) : !isExpanded && input.trim() ? (
            <button
              onClick={() => onSubmit()}
              disabled={!canSend(input)}
              className="px-2 py-1 rounded-lg bg-brand-600 text-white text-[11px] font-medium hover:bg-brand-500 disabled:opacity-30 transition-colors"
            >
              Send
            </button>
          ) : null}

          {isExpanded && !showMenu && !showHistory && (
            <button
              onClick={clearMessages}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60 transition-colors"
              title="Start a new task"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              New Task
            </button>
          )}

          {isExpanded && !showMenu && (
            <button
              onClick={() => { setShowHistory(!showHistory); setShowApprovalMenu(false) }}
              className={`p-1.5 rounded-lg transition-colors ${
                showHistory
                  ? 'bg-neutral-800 text-neutral-200'
                  : 'hover:bg-neutral-800/60 text-neutral-400 hover:text-neutral-200'
              }`}
              title="Chat history"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </button>
          )}

          <button
            onClick={cycleOpacity}
            className="p-1.5 rounded-lg hover:bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 transition-colors"
            title={`Opacity ${Math.round(opacity * 100)}% (Ctrl+Scroll)`}
          >
            <EyeIcon opacity={opacity} />
          </button>

          {/* Shield — approval mode control */}
          <button
            onClick={toggleApprovalMenu}
            className={`p-1.5 rounded-lg transition-colors ${shieldColor(approvalMode, pendingApprovals.length > 0)}`}
            title={APPROVAL_MODE_LABELS[approvalMode]}
          >
            <ShieldIcon mode={approvalMode} />
          </button>

          <button
            onClick={() => {
              if (showMenu) {
                setShowMenu(false)
              } else if (showHistory) {
                setShowHistory(false)
              } else {
                toggleExpanded()
              }
              setShowApprovalMenu(false)
            }}
            className="p-1.5 rounded-lg hover:bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isExpanded
                ? <polyline points="18 15 12 9 6 15" />
                : <polyline points="6 9 12 15 18 9" />}
            </svg>
          </button>

          {/* User avatar — replaces sign-out button */}
          <button
            onClick={toggleMenu}
            className={`p-0.5 rounded-full transition-all ${showMenu ? 'ring-2 ring-brand-500/60' : 'hover:ring-2 hover:ring-neutral-600'}`}
            title={user?.name || 'Account'}
          >
            <UserAvatar avatar={user?.avatar} name={user?.name} size={24} />
          </button>
        </div>
      </div>

      {/* Approval mode popup — floats over content */}
      {showApprovalMenu && (
        <div ref={approvalPopupRef} className="absolute right-3 top-[52px] w-56 rounded-xl bg-neutral-900 border border-neutral-700/60 shadow-2xl z-50 py-1.5 animate-chat-reveal">
          <div className="px-3 pt-1 pb-1.5">
            <span className="text-[9px] font-medium text-neutral-500 uppercase tracking-wider">Action Approval</span>
          </div>
          {APPROVAL_MODE_ORDER.map((m) => (
            <button
              key={m}
              onClick={() => { setApprovalMode(m); setShowApprovalMenu(false) }}
              className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                approvalMode === m
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
              }`}
            >
              <div className={`flex-shrink-0 ${approvalMode === m ? shieldColor(m, false).split(' ')[0] : 'text-neutral-500'}`}>
                <ShieldIcon mode={m} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium">{APPROVAL_MODE_LABELS[m]}</div>
                <div className="text-[9px] text-neutral-500">{MODE_DESCRIPTIONS[m]}</div>
              </div>
              {approvalMode === m && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 flex-shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Expanded panel — account menu, history, or chat ── */}
      {isExpanded && (
        showMenu ? (
          <AccountMenu onClose={() => setShowMenu(false)} updateStatus={updateStatus} />
        ) : showHistory ? (
          <ChatHistory
            onSelectChat={(id) => {
              loadChat(id)
              setShowHistory(false)
            }}
            onBack={() => setShowHistory(false)}
          />
        ) : (
          <div className="flex flex-col flex-1 min-h-0 animate-chat-reveal">
            {messages.length === 0 && !isStreaming ? (
              /* ── Welcome state — shown on first expand after sign-in ── */
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center gap-5">
                <div className="space-y-2">
                  <h3
                    className="text-3xl font-bold tracking-tight leading-relaxed"
                    style={{ fontFamily: "'Caveat', cursive" }}
                  >
                    <span className="inline-block -rotate-1 text-neutral-100/90">
                      Hello{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-500 leading-relaxed max-w-[240px]">
                    Type a task and I'll handle it. I can browse the web, fill out forms, research topics, and more.
                  </p>
                </div>
                <div className="w-full space-y-1.5">
                  {[
                    'Book me a flight to Tokyo',
                    'Fill out that job application',
                    'Research competitors and summarize',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        handleSubmit(suggestion)
                      }}
                      disabled={connectionState !== 'connected'}
                      className="w-full text-left px-3 py-2 rounded-xl bg-neutral-800/50 border border-neutral-700/30 text-[11px] text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80 hover:border-neutral-600/40 transition-all disabled:opacity-30"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <MessageList messages={messages} isStreaming={isStreaming} />
            )}

            {/* Pending approval prompts */}
            {pendingApprovals.length > 0 && (
              <div className="px-3 pt-1 space-y-2 flex-shrink-0">
                {pendingApprovals.map((a) => (
                  <ApprovalPrompt key={a.id} approval={a} />
                ))}
              </div>
            )}

            {/* Input area */}
            <div className="px-3 pb-3 pt-1 flex-shrink-0">
              {/* Update banner — compact inline bar above the input */}
              {updateStatus === 'ready' && (
                <button
                  onClick={() => window.coasty.installUpdate()}
                  className="group w-full flex items-center gap-2 px-3 py-1.5 mb-1.5 rounded-lg bg-emerald-950/40 border border-emerald-700/30 hover:border-emerald-600/50 transition-all"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                        <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                      </svg>
                    </div>
                    <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
                  </div>
                  <span className="text-[10px] font-medium text-emerald-400 flex-1 text-left">Update ready</span>
                  <span className="text-[9px] font-medium text-emerald-600 group-hover:text-emerald-300 transition-colors">Restart</span>
                </button>
              )}
              {connectionState !== 'connected' && (
                <div className="mb-1.5 flex items-center justify-center gap-2">
                  <span className="text-[10px] text-yellow-500">
                    {connectionState === 'connecting' ? 'Connecting to backend...' : 'Not connected to backend'}
                  </span>
                  {connectionState !== 'connecting' && (
                    <button
                      onClick={reconnect}
                      className="text-[10px] font-medium text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      Reconnect
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={onSubmit} className="rounded-2xl bg-neutral-800 border border-neutral-700/50 p-2 shadow-lg transition-all duration-300 focus-within:shadow-xl focus-within:border-neutral-600/50">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Tell your AI what to do..."
                  rows={1}
                  disabled={connectionState !== 'connected'}
                  className="w-full h-[60px] bg-transparent text-sm text-neutral-200 placeholder-neutral-500 resize-none px-3 pt-2 pb-1 outline-none overflow-y-auto disabled:opacity-50"
                />
                <div className="flex items-center justify-end px-1 pb-0.5">
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="size-8 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-500 transition-all duration-300"
                      aria-label="Stop"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!canSend(input)}
                      className="size-8 rounded-full bg-white text-neutral-900 flex items-center justify-center hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
                      aria-label="Send"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )
      )}
    </div>
  )
}
