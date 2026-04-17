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

function CoastyLogo({ size = 'w-11 h-11' }: { size?: string }) {
  return (
    <svg className={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="permLogo" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" stopOpacity={0} />
          <stop offset="30%" stopColor="rgba(255,255,255,0.1)" stopOpacity={1} />
          <stop offset="50%" stopColor="rgba(255,255,255,0.3)" stopOpacity={1} />
          <stop offset="70%" stopColor="rgba(255,255,255,0.6)" stopOpacity={1} />
          <stop offset="100%" stopColor="rgba(255,255,255,1)" stopOpacity={1} />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="100" fill="url(#permLogo)" />
    </svg>
  )
}

function ScreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function AccessibilityIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" />
      <path d="M4 9h16" />
      <path d="M10 22V12" />
      <path d="M14 22V12" />
      <path d="M12 12v-3" />
    </svg>
  )
}

function CheckBadge() {
  return (
    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  )
}

function PermissionCard({
  granted,
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  granted: boolean
  icon: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div
      className={`relative rounded-xl border overflow-hidden transition-colors ${
        granted
          ? 'bg-emerald-500/[0.04] border-emerald-500/20'
          : 'bg-neutral-900/60 border-neutral-800/80'
      }`}
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
            granted
              ? 'bg-emerald-500/10 text-emerald-300'
              : 'bg-neutral-800/80 text-neutral-300'
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="text-[12.5px] font-medium text-white leading-tight truncate">{title}</div>
            {granted && <CheckBadge />}
          </div>
          <div className="text-[10.5px] text-neutral-500 leading-snug mt-1">{description}</div>
        </div>
        {!granted && actionLabel && onAction && (
          <button
            onClick={onAction}
            className="flex-shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-white text-neutral-900 text-[11px] font-medium hover:bg-neutral-100 transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

const PERMISSIONS_DISMISSED_KEY = 'coasty_permissions_dismissed'
const PERMISSIONS_GRANTED_KEY = 'coasty_permissions_granted'

type GuideType = 'screen' | 'accessibility'

const GUIDE_COPY: Record<GuideType, { title: string; pane: string; icon: React.ReactNode }> = {
  screen: {
    title: 'Allow Screen Recording',
    pane: 'Privacy & Security → Screen Recording',
    icon: <ScreenIcon />,
  },
  accessibility: {
    title: 'Allow Accessibility',
    pane: 'Privacy & Security → Accessibility',
    icon: <AccessibilityIcon />,
  },
}

/**
 * The real native-drag source. The outer tile is marked `draggable`; on
 * `dragstart` we call `preventDefault()` to suppress the browser's own
 * drag handling and send an IPC that triggers `webContents.startDrag`
 * with a file reference to `/Applications/Coasty.app`. macOS then owns
 * the drag and the user can release it over the System Settings list
 * exactly as if they'd clicked `+` in Settings and picked the app.
 *
 * The static hint icon and "Drag" label sit on top of the animated
 * preview arrow so it's visually obvious the tile is grabbable.
 */
function DragDropDemo({ active }: { active: boolean }) {
  const [isDragging, setIsDragging] = React.useState(false)

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // Must preventDefault so Electron's native startDrag can take over —
    // the browser's HTML5 drag would otherwise produce a text/html drag
    // that System Settings ignores.
    e.preventDefault()
    if (!active) return
    setIsDragging(true)
    window.coasty.startDragAppBundle()
    // Reset the visual state on the next tick; the native drag is already
    // out of this window by then so further renderer state doesn't matter.
    setTimeout(() => setIsDragging(false), 400)
  }

  return (
    <div className="relative w-full rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.025] to-transparent overflow-hidden">
      <div className="flex items-stretch gap-2 px-2.5 py-3">
        {/* Source: the real drag handle */}
        <div
          draggable={active}
          onDragStart={handleDragStart}
          className={`flex-1 min-w-0 rounded-lg border px-2 py-2 flex flex-col items-center justify-center gap-1.5 select-none transition-colors ${
            active
              ? `cursor-grab active:cursor-grabbing ${
                  isDragging
                    ? 'bg-white/[0.08] border-white/20'
                    : 'bg-neutral-900/70 border-white/[0.08] hover:bg-neutral-900 hover:border-white/15'
                }`
              : 'bg-neutral-900/40 border-white/[0.04] opacity-60'
          }`}
          title={active ? 'Drag onto the Settings list' : 'Unavailable in dev mode'}
        >
          <div className="text-[9px] tracking-[0.14em] uppercase text-neutral-500 font-medium">Coasty.app</div>

          {/* Coasty app tile: macOS-style rounded square housing the real
              Coasty brand mark. Static tile is always visible under the
              looping hint so the drag target never looks empty. */}
          <div className="relative w-10 h-10 flex items-center justify-center">
            <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-neutral-800 to-neutral-950 border border-white/[0.08] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-center overflow-hidden">
              <CoastyLogo size="w-7 h-7" />
            </div>
            {active && (
              <div
                className="absolute inset-0 flex items-center justify-center perm-drag-icon pointer-events-none"
                style={{ ['--drag-dx' as any]: '110px', opacity: 0.55 }}
              >
                <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-neutral-800/90 to-neutral-950/90 border border-white/[0.08] flex items-center justify-center overflow-hidden">
                  <CoastyLogo size="w-7 h-7" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 text-[9.5px] text-neutral-300 font-medium">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 L13 6" />
              <path d="M13 18 L13 22" />
              <path d="M2 13 L6 13" />
              <path d="M18 13 L22 13" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Drag me
          </div>
        </div>

        {/* Arrow (animated hint) */}
        <div className="flex items-center flex-shrink-0">
          <svg className="perm-arrow" width="24" height="20" viewBox="0 0 28 20" fill="none">
            <path d="M2 10 H22" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
            <path d="M18 5 L24 10 L18 15" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>

        {/* Target visualization (not a real drop zone — the user drops onto
            the actual Settings window, not this). */}
        <div className="flex-1 min-w-0 rounded-lg bg-neutral-900/40 border border-dashed border-emerald-400/40 px-2 py-2 flex flex-col items-center justify-center gap-1 perm-drop-zone">
          <div className="text-[9px] tracking-[0.14em] uppercase text-emerald-300/80 font-medium">Settings</div>
          <div className="w-9 h-9 rounded-lg border border-dashed border-emerald-400/40 bg-emerald-500/5 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400/90">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div className="text-[9.5px] text-neutral-500 font-medium">Drop here</div>
        </div>
      </div>
    </div>
  )
}

function PermissionGuide({
  guideFor,
  onBack,
  onReopen,
  onRestart,
}: {
  guideFor: GuideType
  onBack: () => void
  onReopen: () => void
  onRestart: () => void
}) {
  const copy = GUIDE_COPY[guideFor]
  // Drag is only meaningful on macOS — on other platforms these permissions
  // don't exist in this shape and there's no bundle to drop.
  const canDrag = window.coasty.getPlatform() === 'darwin'

  return (
    <div key={guideFor} className="perm-view-in w-full mx-auto flex flex-col gap-3 pt-1 pb-3">
      {/* Header with back */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-neutral-400 hover:text-neutral-100 transition-colors"
          title="Back"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-white tracking-tight leading-tight truncate">{copy.title}</div>
          <div className="text-[10px] text-neutral-500 leading-snug truncate">{copy.pane}</div>
        </div>
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.06] flex items-center justify-center text-neutral-300">
          {copy.icon}
        </div>
      </div>

      {/* Native-drag source + visual hint */}
      <DragDropDemo active={canDrag} />

      {/* Step list */}
      <ol className="flex flex-col gap-1">
        {[
          'Grab the Coasty tile and drag it onto the Settings list.',
          'macOS adds it and toggles it on automatically.',
          'Come back and hit Restart now.',
        ].map((text, i) => (
          <li key={i} className="flex items-start gap-2 px-1 py-1 rounded-lg">
            <div className="mt-[1px] flex-shrink-0 w-4 h-4 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[9.5px] text-neutral-300 font-semibold tabular-nums">
              {i + 1}
            </div>
            <div className="text-[11px] text-neutral-400 leading-snug">{text}</div>
          </li>
        ))}
      </ol>

      {/* Secondary actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onReopen}
          className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-[10.5px] text-neutral-300 hover:text-white transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          <span className="truncate">Reopen Settings</span>
        </button>
        <button
          onClick={onRestart}
          className="flex-shrink-0 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white text-neutral-900 text-[10.5px] font-medium hover:bg-neutral-100 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0115-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 01-15 6.7L3 16" />
          </svg>
          Restart now
        </button>
      </div>
    </div>
  )
}

export function PermissionsGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<PermissionStatus | null>(null)
  const [dismissed, setDismissed] = React.useState(() => {
    return localStorage.getItem(PERMISSIONS_DISMISSED_KEY) === 'true' ||
           localStorage.getItem(PERMISSIONS_GRANTED_KEY) === 'true'
  })
  const [guideFor, setGuideFor] = React.useState<GuideType | null>(null)
  const isMac = window.coasty.getPlatform() === 'darwin'

  const openGuide = React.useCallback((type: GuideType) => {
    setGuideFor(type)
    // Main process: resize window to 'guide' dock, open the Privacy pane,
    // start tracking System Settings so we dock alongside it.
    window.coasty.startPermissionGuide(type).catch(() => {
      // Fall back to just opening the pane if the combined flow fails.
      if (type === 'screen') window.coasty.openScreenRecordingSettings()
      else window.coasty.requestAccessibility()
    })
  }, [])

  const closeGuide = React.useCallback(() => {
    setGuideFor(null)
    // Stops the tracker child process and returns the window to auth size.
    window.coasty.stopPermissionGuide().catch(() => {})
  }, [])

  React.useEffect(() => {
    if (!isMac) return
    window.coasty.checkPermissions()
      .then((s) => {
        setStatus(s)
        if (allGranted(s)) {
          localStorage.setItem(PERMISSIONS_GRANTED_KEY, 'true')
        }
      })
      .catch(() => setStatus(null))
  }, [isMac])

  const needsPermissions = isMac && status && !allGranted(status) && !dismissed
  const showGuard = needsPermissions === true

  React.useEffect(() => {
    if (!showGuard) {
      window.coasty.setWindowMode('compact')
      return
    }
    // The `guide` mode is owned by the main process — don't clobber it
    // here, or the window would snap back to auth size mid-flow.
    if (!guideFor) {
      window.coasty.setWindowMode('auth')
    }
  }, [showGuard, guideFor])

  if (!showGuard) return <>{children}</>

  const screenOk = status!.screenRecording === 'granted'
  const accessOk = status!.accessibility === 'granted'
  const grantedCount = (screenOk ? 1 : 0) + (accessOk ? 1 : 0)

  return (
    <div className="relative flex flex-col h-screen bg-neutral-950 rounded-xl overflow-hidden">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-gradient-to-b from-white/[0.07] via-white/[0.015] to-transparent blur-3xl" />
      </div>

      {/* Draggable title bar */}
      <div className="titlebar-drag relative flex items-center justify-between px-4 py-2 flex-shrink-0">
        <span className="text-[11px] text-neutral-600 font-medium tracking-wide">Coasty Desktop</span>
        <div className="titlebar-no-drag flex items-center gap-1">
          <button
            onClick={() => {
              // If we're inside a guide, tear down the tracker + resize the
              // window back before marking dismissed — otherwise the next
              // render would leave the window in guide size.
              if (guideFor) window.coasty.stopPermissionGuide().catch(() => {})
              localStorage.setItem(PERMISSIONS_DISMISSED_KEY, 'true')
              setGuideFor(null)
              setDismissed(true)
            }}
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

      {/* Scrollable header + cards (or guide view) */}
      <div className={`relative flex-1 min-h-0 overflow-y-auto ${guideFor ? 'px-3' : 'px-6'}`}>
        {guideFor ? (
          <PermissionGuide
            guideFor={guideFor}
            onBack={closeGuide}
            onReopen={() => { window.coasty.startPermissionGuide(guideFor).catch(() => {}) }}
            onRestart={() => {
              localStorage.removeItem(PERMISSIONS_DISMISSED_KEY)
              localStorage.removeItem(PERMISSIONS_GRANTED_KEY)
              window.coasty.relaunch()
            }}
          />
        ) : (
        <div key="list" className="perm-view-in w-full max-w-sm mx-auto flex flex-col gap-5 pt-3 pb-4">
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-3">
            <CoastyLogo size="w-12 h-12" />

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-[9.5px] tracking-[0.14em] uppercase text-neutral-400 font-medium">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-emerald-400/60 animate-ping" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              </span>
              State of the Art
            </span>

            <div className="flex flex-col items-center gap-2">
              <h2 className="text-[18px] font-semibold text-white tracking-tight leading-[1.25]">
                Enable Coasty Computer Use
              </h2>
              <p className="text-[11.5px] text-neutral-500 leading-relaxed max-w-[17.5rem]">
                Grant these macOS permissions so Coasty can see your screen and control mouse &amp; keyboard.
              </p>
            </div>
          </div>

          {/* Progress hairline */}
          <div className="flex items-center gap-2.5 px-0.5">
            <div className="flex-1 h-[3px] rounded-full bg-neutral-800/80 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-white/60 to-white transition-[width] duration-500 ease-out"
                style={{ width: `${(grantedCount / 2) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-500 tabular-nums font-medium">
              {grantedCount}<span className="text-neutral-700">/2</span>
            </span>
          </div>

          {/* Permission cards */}
          <div className="flex flex-col gap-2.5">
            <PermissionCard
              granted={screenOk}
              icon={<ScreenIcon />}
              title="Screen Recording"
              description="Lets Coasty take screenshots so the AI can see what's on screen."
              actionLabel="Open Settings"
              onAction={() => openGuide('screen')}
            />
            <PermissionCard
              granted={accessOk}
              icon={<AccessibilityIcon />}
              title="Accessibility"
              description="Lets Coasty control the mouse, keyboard, and windows."
              actionLabel="Grant"
              onAction={() => openGuide('accessibility')}
            />
          </div>
        </div>
        )}
      </div>

      {/* Pinned footer — CTA for the list view. Guide view has its own
          Restart / Reopen buttons inline, so hide this when guide is active. */}
      <div className={`relative flex-shrink-0 px-6 pt-3 pb-4 border-t border-white/[0.04] bg-neutral-950/80 backdrop-blur-sm ${guideFor ? 'hidden' : ''}`}>
        <div className="w-full max-w-sm mx-auto flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                localStorage.removeItem(PERMISSIONS_DISMISSED_KEY)
                localStorage.removeItem(PERMISSIONS_GRANTED_KEY)
                window.coasty.relaunch()
              }}
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-neutral-900 rounded-lg font-medium text-[13px] hover:bg-neutral-100 transition-colors shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_30px_-10px_rgba(255,255,255,0.2)]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0115-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 01-15 6.7L3 16" />
              </svg>
              <span className="truncate">Restart &amp; Recheck</span>
            </button>
            <button
              onClick={() => { localStorage.setItem(PERMISSIONS_DISMISSED_KEY, 'true'); setDismissed(true) }}
              className="flex-shrink-0 px-3.5 py-2 rounded-lg border border-neutral-800 bg-neutral-900/40 text-[13px] text-neutral-400 hover:text-neutral-100 hover:border-neutral-700 hover:bg-neutral-900 transition-colors"
            >
              Skip
            </button>
          </div>
          <p className="text-[10px] text-neutral-600 text-center leading-snug">
            After granting access, restart so macOS recognizes the change.
          </p>
        </div>
      </div>
    </div>
  )
}
