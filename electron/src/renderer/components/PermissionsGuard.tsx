import React from 'react'

type PermValue = 'granted' | 'denied' | 'not-applicable'

interface PermissionStatus {
  screenRecording: PermValue
  accessibility: PermValue
}

function allGranted(status: PermissionStatus): boolean {
  return (
    (status.screenRecording === 'granted' || status.screenRecording === 'not-applicable') &&
    (status.accessibility === 'granted' || status.accessibility === 'not-applicable')
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function PermissionRow({
  granted,
  title,
  description,
  actionLabel,
  onAction,
}: {
  granted: boolean
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-neutral-800/40 border border-neutral-700/30">
      <div className="mt-0.5 flex-shrink-0">
        {granted ? <CheckIcon /> : <XIcon />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-neutral-200">{title}</div>
        <div className="text-[11px] text-neutral-500 leading-relaxed mt-0.5">{description}</div>
      </div>
      {!granted && actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex-shrink-0 mt-0.5 px-2.5 py-1 rounded-md bg-neutral-700/60 border border-neutral-600/40 text-[11px] font-medium text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function PermissionsGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<PermissionStatus | null>(null)
  const [dismissed, setDismissed] = React.useState(false)
  const isMac = window.coasty.getPlatform() === 'darwin'

  // Check permissions once on mount. macOS caches permission status in the
  // running process, so rechecking without a restart will always return stale
  // values. The "Restart & Recheck" button relaunches the app instead.
  React.useEffect(() => {
    if (!isMac) return
    window.coasty.checkPermissions()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [isMac])

  // Determine if we need to show the permissions guard
  const needsPermissions = isMac && status && !allGranted(status) && !dismissed
  const showGuard = needsPermissions === true

  // Manage window mode: show auth-size window for the guard, compact for overlay
  React.useEffect(() => {
    if (showGuard) {
      window.coasty.setWindowMode('auth')
    } else {
      // Permissions OK, not applicable, not yet checked, or dismissed — go to compact
      window.coasty.setWindowMode('compact')
    }
  }, [showGuard])

  // If not showing guard, always render children (the overlay)
  if (!showGuard) return <>{children}</>

  const screenOk = status!.screenRecording === 'granted'
  const accessOk = status!.accessibility === 'granted'

  return (
    <div className="flex flex-col h-screen bg-neutral-950 rounded-xl overflow-hidden">
      {/* Draggable title bar */}
      <div className="titlebar-drag flex items-center justify-between px-4 py-2 flex-shrink-0">
        <span className="text-[11px] text-neutral-600 font-medium">Coasty Desktop</span>
        <div className="titlebar-no-drag flex items-center gap-1">
          <button
            onClick={() => setDismissed(true)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
            title="Skip"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 px-6 pb-5 overflow-y-auto">
        <div className="w-full max-w-sm mx-auto space-y-5">
          {/* Header */}
          <div className="text-center space-y-2 pt-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Permissions Required</h2>
            <p className="text-[12px] text-neutral-500 leading-relaxed">
              Coasty needs these macOS permissions to control your computer — take screenshots, move the mouse, and type.
            </p>
          </div>

          {/* Permission rows */}
          <div className="space-y-2">
            <PermissionRow
              granted={screenOk}
              title="Screen Recording"
              description="Required to take screenshots of your desktop so the AI can see what's on screen."
              actionLabel="Open Settings"
              onAction={() => window.coasty.openScreenRecordingSettings()}
            />

            <PermissionRow
              granted={accessOk}
              title="Accessibility"
              description="Required for mouse clicks, keyboard input, and window management."
              actionLabel="Grant"
              onAction={() => window.coasty.requestAccessibility()}
            />
          </div>

          <p className="text-[10px] text-neutral-600 text-center leading-relaxed">
            After granting permissions, restart the app for macOS to recognize them.
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.coasty.relaunch()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-neutral-900 rounded-lg font-medium text-sm hover:bg-neutral-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0115-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 01-15 6.7L3 16" />
              </svg>
              Restart &amp; Recheck
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-4 py-2.5 rounded-lg border border-neutral-700/50 text-sm text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
            >
              Skip
            </button>
          </div>

          <p className="text-[10px] text-neutral-600 text-center">
            You can skip for now, but automation features won't work until permissions are granted.
          </p>
        </div>
      </div>
    </div>
  )
}
