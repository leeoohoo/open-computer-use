/**
 * Cross-platform desktop automation via @nut-tree-fork/libnut.
 *
 * This file used to be a 850-line tower of PowerShell `Add-Type @"..."@`
 * blocks importing user32.dll P/Invoke (mouse_event, keybd_event), Swift
 * scripts piped to `swift -`, and xdotool shell-outs. That stack worked but
 * tripped Windows AMSI / Defender / EDR products as a Cobalt-Strike /
 * Mimikatz fingerprint — runtime C# compilation + SendInput is the literal
 * keylogger pattern, and unsigned binaries doing it get flagged on first
 * run. Migrating to libnut (a signed N-API native module) gives us:
 *
 *   - Identical public API — every exported function keeps its signature,
 *     return shape, and platform-conditional behaviours (e.g. macOS
 *     ctrl-as-cmd remapping, multi-monitor coords).
 *   - Sub-millisecond startup per call instead of spawning a PowerShell
 *     interpreter (200-500ms cold).
 *   - One signed dependency for AV/Defender/EDR to scan ONCE, instead of
 *     synthesising new attack-surface strings on every action.
 *
 * Two libnut quirks the wrappers below paper over:
 *   1. Windows multi-monitor — libnut's moveMouse normalizes coords against
 *      SM_CXSCREEN (primary only), so off-primary clicks land wrong. We
 *      use a single signed-assembly PowerShell call to position the cursor
 *      via System.Windows.Forms.Cursor (Microsoft-signed, no inline C#,
 *      no AMSI heuristic match) and let libnut emit the click at the
 *      already-positioned cursor.
 *   2. Windows dragMouse is broken (no actual button-down). We do down →
 *      move → up manually on every platform for cross-platform parity.
 */

import { execFile } from 'child_process'
import { isAccessibilityGranted, requestAccessibility } from './permissions'
import { getActiveDisplay } from './display-manager'
import { loadLibnut, type LibnutAPI } from './libnut-loader'

// ─── macOS Accessibility gate ─────────────────────────────────────────────

let _hasPromptedAccessibility = false
function requireAccessibility(): { success: false; error: string; permissionDenied: true; permissionType: 'accessibility' } | null {
  if (process.platform !== 'darwin') return null
  if (isAccessibilityGranted()) return null

  if (!_hasPromptedAccessibility) {
    _hasPromptedAccessibility = true
    requestAccessibility()
  }

  return {
    success: false,
    error: 'macOS Accessibility permission is required for desktop automation (clicks, typing, scrolling). '
      + 'A permission prompt should have appeared — grant access to Coasty, then restart the app. '
      + 'You can also enable it manually: System Settings > Privacy & Security > Accessibility > enable Coasty.',
    permissionDenied: true,
    permissionType: 'accessibility',
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function validateInt(v: unknown, name: string): number {
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`Invalid ${name}: expected a number`)
  return Math.round(n)
}

/** Lazy libnut handle — throws once at first call if loading fails so the
 *  caller's try/catch surfaces a clear message instead of a silent no-op. */
let _libnut: LibnutAPI | null = null
function lib(): LibnutAPI {
  if (_libnut) return _libnut
  _libnut = loadLibnut()
  return _libnut
}

// ─── Multi-monitor cursor positioning (Windows-only fallback) ────────────

/**
 * Move the cursor to absolute (x, y). Two Windows quirks the wrapper handles:
 *
 *  1. **Multi-monitor**: libnut's `moveMouse` normalises against the PRIMARY
 *     monitor's pixel size, so coords that fall outside the primary display
 *     land wrong. Detect off-primary and fall back to a signed-assembly
 *     PowerShell call (System.Windows.Forms.Cursor uses virtual-desktop
 *     coords, no AMSI heuristic match).
 *
 *  2. **DPI scaling**: libnut on Windows calls
 *     `SetThreadDPIAwarenessContext(PER_MONITOR_AWARE_V2)` and operates in
 *     PHYSICAL pixels. The agent's pipeline runs in LOGICAL pixels — the
 *     screenshot is captured at `display.size` (logical), the agent reasons
 *     in that space, and emits clicks back in that same logical space.
 *     Pass logical coords directly to libnut and on a 4K@150% display every
 *     click lands at ~67% of intended position. Multiply by scaleFactor to
 *     bridge the two coordinate systems.
 *
 *     The old PowerShell path didn't have this bug because PowerShell is
 *     not DPI-aware, so Windows auto-scaled logical→physical for it. The
 *     libnut migration broke high-DPI Windows users until this scaling was
 *     restored — that's the "clicking in wrong places" symptom.
 *
 * On macOS / Linux libnut already uses logical coords correctly:
 *   - macOS: CGWarpMouseCursorPosition takes Cocoa points (logical pixels)
 *   - Linux: X11 has no DPI abstraction; scaleFactor is 1.0 in practice
 * So scaling is Windows-only.
 */
async function moveMouseAbsolute(x: number, y: number): Promise<void> {
  if (process.platform === 'win32') {
    const display = getActiveDisplay()
    const isPrimary = display.bounds.x === 0 && display.bounds.y === 0
    if (!isPrimary) {
      // Coordinates already include the active-display offset (LocalExecutor
      // applies it before this is called). For non-primary monitors libnut
      // can't reach them, so use System.Windows.Forms.Cursor instead.
      // PowerShell is non-DPI-aware so Windows handles the logical→physical
      // conversion automatically — pass logical coords through unchanged.
      await runPowershellCursor(x, y)
      return
    }
    // Primary monitor with libnut: scale logical → physical for DPI awareness.
    // scaleFactor of 1.0 makes this a no-op on standard 100% displays.
    const scale = display.scaleFactor || 1
    lib().moveMouse(Math.round(x * scale), Math.round(y * scale))
    return
  }
  lib().moveMouse(x, y)
}

/** Single signed-assembly PowerShell call to set cursor position on
 *  multi-monitor Windows. No `Add-Type @"...inline C#..."@`, just a
 *  `-AssemblyName` reference to a Microsoft-signed assembly. AMSI is fine
 *  with this; it's the inline C# + DllImport pattern that triggers
 *  "RAT-like" heuristics. */
function runPowershellCursor(x: number, y: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const script =
      `Add-Type -AssemblyName System.Windows.Forms; ` +
      `[System.Windows.Forms.Cursor]::Position = ` +
      `New-Object System.Drawing.Point(${x}, ${y})`
    execFile('powershell.exe', ['-NoProfile', '-Command', script], { timeout: 5000 }, (err) => {
      if (err) reject(err); else resolve()
    })
  })
}

// ─── Key vocabulary translation ──────────────────────────────────────────

/** Coasty key name → libnut key name. libnut's vocabulary is strict: any
 *  unknown name throws "Invalid key code specified" at runtime. */
const KEY_TO_LIBNUT: Record<string, string> = {
  // Editing
  enter: 'enter', return: 'enter', kp_enter: 'enter',
  tab: 'tab',
  escape: 'escape', esc: 'escape',
  backspace: 'backspace', back_space: 'backspace',
  delete: 'delete', del: 'delete', forwarddelete: 'delete', kp_delete: 'delete',
  space: 'space',
  insert: 'insert',
  // Navigation
  up: 'up', down: 'down', left: 'left', right: 'right',
  home: 'home', end: 'end',
  pageup: 'pageup', page_up: 'pageup',
  pagedown: 'pagedown', page_down: 'pagedown',
  // Locks / sysreq
  capslock: 'caps_lock', caps_lock: 'caps_lock',
  numlock: 'num_lock', num_lock: 'num_lock',
  scrolllock: 'scroll_lock', scroll_lock: 'scroll_lock',
  printscreen: 'printscreen', print: 'printscreen', sys_req: 'printscreen',
  pause: 'pause', break: 'pause',
  menu: 'menu',
  // Numpad
  kp_0: 'numpad_0', numpad_0: 'numpad_0',
  kp_1: 'numpad_1', numpad_1: 'numpad_1',
  kp_2: 'numpad_2', numpad_2: 'numpad_2',
  kp_3: 'numpad_3', numpad_3: 'numpad_3',
  kp_4: 'numpad_4', numpad_4: 'numpad_4',
  kp_5: 'numpad_5', numpad_5: 'numpad_5',
  kp_6: 'numpad_6', numpad_6: 'numpad_6',
  kp_7: 'numpad_7', numpad_7: 'numpad_7',
  kp_8: 'numpad_8', numpad_8: 'numpad_8',
  kp_9: 'numpad_9', numpad_9: 'numpad_9',
  kp_decimal: 'numpad_decimal', numpad_decimal: 'numpad_decimal',
  kp_add: 'add', kp_subtract: 'subtract',
  kp_multiply: 'multiply', kp_divide: 'divide',
  // Modifier-as-key (when pressed standalone, not as a modifier on another key)
  ctrl: 'control', control: 'control',
  alt: 'alt', option: 'alt',
  shift: 'shift',
  cmd: 'cmd', command: 'cmd',
  win: 'win', super: 'win', meta: 'win',
  fn: 'fn', function: 'fn',
}

// F-keys f1-f24 pass through verbatim
for (let i = 1; i <= 24; i++) KEY_TO_LIBNUT[`f${i}`] = `f${i}`

/** Translate a Coasty key name to libnut's vocabulary. Single ASCII chars
 *  pass through (libnut accepts lowercase a-z / 0-9 / common punctuation
 *  literally). Throws on unknown names. */
function toLibnutKey(key: string): string {
  if (!key) throw new Error('Empty key name')
  const lower = key.toLowerCase()
  const mapped = KEY_TO_LIBNUT[lower]
  if (mapped) return mapped
  if (/^[a-z0-9]$/.test(lower)) return lower
  if (/^[,./;'\[\]\\\-=`]$/.test(lower)) return lower
  throw new Error(`Unsupported key for automation: "${key}"`)
}

const MODIFIER_NAMES = new Set([
  'ctrl', 'control', 'alt', 'option', 'shift',
  'cmd', 'command', 'meta', 'win', 'super', 'fn',
])

function isModifier(key: string): boolean {
  return MODIFIER_NAMES.has(key.toLowerCase())
}

/**
 * Translate a Coasty modifier name to libnut's modifier vocabulary.
 *
 * macOS convention preserved from the previous PowerShell stack: ctrl/
 * control map to cmd because most agents emit "ctrl+c" meaning "the
 * platform copy shortcut," and that has to be Cmd-C on macOS to actually
 * copy. (See MAC_KEY_NORMALIZATION in the legacy code for the same rule.)
 */
function toLibnutModifier(key: string): string {
  const lower = key.toLowerCase()
  if (process.platform === 'darwin') {
    switch (lower) {
      case 'ctrl': case 'control':
      case 'cmd': case 'command': case 'meta':
      case 'win': case 'super':
        return 'cmd'
      case 'alt': case 'option': return 'alt'
      case 'shift': return 'shift'
      case 'fn': return 'fn'
    }
  }
  switch (lower) {
    case 'ctrl': case 'control': return 'control'
    case 'alt': case 'option': return 'alt'
    case 'shift': return 'shift'
    case 'cmd': case 'command': case 'meta':
    case 'win': case 'super':
      return 'win'
    case 'fn': return 'fn'
  }
  return lower
}

// libnut button vocabulary: 'left' | 'right' | 'middle' (NOT 'center').
function toLibnutButton(button?: string): 'left' | 'right' | 'middle' {
  switch ((button || '').toLowerCase()) {
    case 'right': return 'right'
    case 'middle': case 'center': return 'middle'
    default: return 'left'
  }
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function desktopClick(params: { x: number; y: number; button?: string }): Promise<any> {
  try {
    const denied = requireAccessibility()
    if (denied) return denied

    const x = validateInt(params.x, 'x')
    const y = validateInt(params.y, 'y')
    const button = toLibnutButton(params.button)

    await moveMouseAbsolute(x, y)
    lib().mouseClick(button)

    return { success: true, message: `Clicked at (${x}, ${y})` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function desktopDoubleClick(params: { x: number; y: number }): Promise<any> {
  try {
    const denied = requireAccessibility()
    if (denied) return denied

    const x = validateInt(params.x, 'x')
    const y = validateInt(params.y, 'y')

    await moveMouseAbsolute(x, y)
    // libnut's mouseClick(button, double=true) emits a real OS double-click
    // — registers as one event with clickCount=2, not two single clicks.
    // That's the platform-correct behaviour (apps differentiate them).
    lib().mouseClick('left', true)

    return { success: true, message: `Double-clicked at (${x}, ${y})` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function desktopClickWithModifiers(params: {
  x: number
  y: number
  button?: string
  hold_keys?: string[]
  clicks?: number
}): Promise<any> {
  try {
    const denied = requireAccessibility()
    if (denied) return denied

    const x = validateInt(params.x, 'x')
    const y = validateInt(params.y, 'y')
    const button = toLibnutButton(params.button)
    const clicks = params.clicks !== undefined ? validateInt(params.clicks, 'clicks') : 1
    const holdKeys = (params.hold_keys ?? []).map(toLibnutModifier)

    const libnut = lib()

    // Press modifiers, then position, then click N times, then release.
    for (const mod of holdKeys) libnut.keyToggle(mod, 'down')
    if (holdKeys.length) await sleep(50)

    await moveMouseAbsolute(x, y)
    await sleep(30)

    if (clicks >= 2) {
      // True double-click semantics for clicks=2 (preferred over two singles
      // because OS dispatchers latch click count for app behaviours like
      // "select word" vs "select line").
      libnut.mouseClick(button, true)
      // For clicks > 2, fire singles after to reach the count.
      for (let i = 2; i < clicks; i++) {
        await sleep(50)
        libnut.mouseClick(button)
      }
    } else {
      libnut.mouseClick(button)
    }

    if (holdKeys.length) await sleep(30)
    for (const mod of [...holdKeys].reverse()) libnut.keyToggle(mod, 'up')

    return {
      success: true,
      message: `Clicked at (${x}, ${y}) with modifiers [${holdKeys.join(', ')}]`,
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function desktopType(params: { text: string }): Promise<any> {
  try {
    const denied = requireAccessibility()
    if (denied) return denied

    const text = String(params.text ?? '')

    // libnut.typeString handles UTF-8 directly via OS-level Unicode input —
    // no clipboard, no shell escaping. SMP characters (some emoji) may
    // fall back to scancode injection on Windows; for those a paste-style
    // workaround would be needed, but the previous SendKeys path had the
    // same limitation so we preserve behaviour.
    lib().typeString(text)

    const truncated = text.length > 50 ? `${text.slice(0, 50)}...` : text
    return { success: true, message: `Typed "${truncated}"` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function desktopKeyPress(params: { keys: string[] }): Promise<any> {
  try {
    const denied = requireAccessibility()
    if (denied) return denied

    const keys = Array.isArray(params.keys) ? params.keys : []
    if (keys.length === 0) return { success: false, error: 'No keys specified' }

    const libnut = lib()
    for (const k of keys) {
      // keyTap = press+release. For sequential keys (typing "h-e-l-l-o"
      // word-by-word) this matches the old SendKeys / xdotool behaviour.
      libnut.keyTap(toLibnutKey(k))
    }

    return { success: true, message: `Pressed keys: ${keys.join(', ')}` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function desktopKeyCombo(params: { keys: string[] }): Promise<any> {
  try {
    const denied = requireAccessibility()
    if (denied) return denied

    const keys = Array.isArray(params.keys) ? params.keys : []
    if (keys.length === 0) return { success: false, error: 'No keys specified' }
    if (keys.length === 1) return desktopKeyPress({ keys })

    // Last key triggers; everything before it acts as held modifiers.
    // Non-modifier "leading" keys (e.g. agent emits ['shift', 'a', 'b'])
    // are passed verbatim — libnut's keyTap modifier list is permissive.
    const finalKey = keys[keys.length - 1]
    const modifiers = keys.slice(0, -1).map(toLibnutModifier)

    // libnut accepts string | string[] for the modifier param.
    lib().keyTap(toLibnutKey(finalKey), modifiers.length === 1 ? modifiers[0] : modifiers)

    return { success: true, message: `Key combo: ${keys.join('+')}` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

const MAX_SCROLL_CLICKS = 500

export async function desktopScroll(params: {
  clicks: number
  direction?: 'vertical' | 'horizontal'
  x?: number
  y?: number
}): Promise<any> {
  try {
    const denied = requireAccessibility()
    if (denied) return denied

    const rawClicks = validateInt(params.clicks, 'clicks')
    const amount = Math.min(Math.abs(rawClicks), MAX_SCROLL_CLICKS)
    const direction = params.direction || 'vertical'
    const scrollUp = rawClicks > 0
    const sign = scrollUp ? 1 : -1

    if (params.x !== undefined && params.y !== undefined) {
      const x = validateInt(params.x, 'x')
      const y = validateInt(params.y, 'y')
      await moveMouseAbsolute(x, y)
      await sleep(50)
    }

    // Per-platform unit normalisation. libnut passes raw deltas through to
    // the OS, which uses very different scales:
    //   Windows: WHEEL_DELTA = 120 per notch (MOUSEEVENTF_WHEEL)
    //   macOS:   pixels per line ≈ 10 (CGEventScrollWheel, line units would
    //            need a different event ctor; we send pixel units here)
    //   Linux:   button-press count, 1 unit per notch (XTest button 4/5)
    const perClick =
      process.platform === 'win32' ? 120 :
      process.platform === 'darwin' ? 10 : 1
    const delta = sign * perClick * amount

    if (direction === 'vertical') {
      lib().scrollMouse(0, delta)
    } else {
      lib().scrollMouse(delta, 0)
    }

    return { success: true, message: `Scrolled ${scrollUp ? 'up' : 'down'} ${amount} clicks` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function desktopDrag(params: {
  x1: number
  y1: number
  x2: number
  y2: number
  hold_keys?: string[]
}): Promise<any> {
  try {
    const denied = requireAccessibility()
    if (denied) return denied

    const x1 = validateInt(params.x1, 'x1')
    const y1 = validateInt(params.y1, 'y1')
    const x2 = validateInt(params.x2, 'x2')
    const y2 = validateInt(params.y2, 'y2')
    const holdKeys = (params.hold_keys ?? []).map(toLibnutModifier)

    const libnut = lib()

    // Modifiers down first (e.g. shift-drag for text-selection extension).
    for (const mod of holdKeys) libnut.keyToggle(mod, 'down')
    if (holdKeys.length) await sleep(50)

    // libnut.dragMouse on Windows is broken (no actual button-down — see
    // libnut-core src/win32/mouse.c). We compose down → move → up by hand
    // so the same code path runs identically on every platform.
    await moveMouseAbsolute(x1, y1)
    await sleep(100)
    libnut.mouseToggle('down', 'left')
    await sleep(50)

    // Smooth drag through the midpoint — many UIs (tile resize handles,
    // text-selection drag-to-select) only register a drag if intermediate
    // mousemove events fire between down and up.
    const xm = Math.round((x1 + x2) / 2)
    const ym = Math.round((y1 + y2) / 2)
    await moveMouseAbsolute(xm, ym)
    await sleep(50)
    await moveMouseAbsolute(x2, y2)
    await sleep(100)

    libnut.mouseToggle('up', 'left')

    if (holdKeys.length) await sleep(30)
    for (const mod of [...holdKeys].reverse()) libnut.keyToggle(mod, 'up')

    return {
      success: true,
      message: `Dragged from (${x1}, ${y1}) to (${x2}, ${y2})`,
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
