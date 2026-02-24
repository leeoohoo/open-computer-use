import { execFile, spawn } from 'child_process'
import * as os from 'os'

function runPowershell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', script], {
      timeout: 10000,
    }, (error, stdout, stderr) => {
      if (error) reject(error)
      else resolve(stdout.trim())
    })
  })
}

function runBash(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('/bin/bash', ['-c', command], {
      timeout: 10000,
    }, (error, stdout, stderr) => {
      if (error) reject(error)
      else resolve(stdout.trim())
    })
  })
}

/** Run an inline Swift script via stdin. Uses CoreGraphics for native mouse control on macOS. */
function runSwift(code: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('swift', ['-'], { timeout: 10000 })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout += d })
    proc.stderr.on('data', (d) => { stderr += d })
    proc.on('close', (exitCode) => {
      if (exitCode !== 0) reject(new Error(stderr.trim() || `swift exited with code ${exitCode}`))
      else resolve(stdout.trim())
    })
    proc.on('error', reject)
    proc.stdin.write(code)
    proc.stdin.end()
  })
}

export async function desktopClick(params: {
  x: number
  y: number
  button?: string
}): Promise<any> {
  try {
    const { x, y, button = 'left' } = params

    if (process.platform === 'win32') {
      const clickType = button === 'right' ? 'RightClick' : 'Click'
      await runPowershell(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseOps {
    [DllImport("user32.dll")]
    public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
    public const int MOUSEEVENTF_LEFTDOWN = 0x02;
    public const int MOUSEEVENTF_LEFTUP = 0x04;
    public const int MOUSEEVENTF_RIGHTDOWN = 0x08;
    public const int MOUSEEVENTF_RIGHTUP = 0x10;
}
"@
${button === 'right'
          ? '[MouseOps]::mouse_event([MouseOps]::MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0); [MouseOps]::mouse_event([MouseOps]::MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)'
          : '[MouseOps]::mouse_event([MouseOps]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0); [MouseOps]::mouse_event([MouseOps]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)'}
`)
    } else if (process.platform === 'linux') {
      await runBash(`xdotool mousemove ${x} ${y} click ${button === 'right' ? '3' : '1'}`)
    } else if (process.platform === 'darwin') {
      const downType = button === 'right' ? '.rightMouseDown' : '.leftMouseDown'
      const upType = button === 'right' ? '.rightMouseUp' : '.leftMouseUp'
      const btn = button === 'right' ? '.right' : '.left'
      await runSwift(`
import Cocoa
let pt = CGPoint(x: ${x}, y: ${y})
CGEvent(mouseEventSource: nil, mouseType: ${downType}, mouseCursorPosition: pt, mouseButton: ${btn})?.post(tap: .cghidEventTap)
usleep(50000)
CGEvent(mouseEventSource: nil, mouseType: ${upType}, mouseCursorPosition: pt, mouseButton: ${btn})?.post(tap: .cghidEventTap)
`)
    }

    return { success: true, message: `Clicked at (${x}, ${y})` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function desktopDoubleClick(params: {
  x: number
  y: number
}): Promise<any> {
  try {
    const { x, y } = params

    if (process.platform === 'win32') {
      await runPowershell(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseOps2 {
    [DllImport("user32.dll")]
    public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
    public const int MOUSEEVENTF_LEFTDOWN = 0x02;
    public const int MOUSEEVENTF_LEFTUP = 0x04;
}
"@
[MouseOps2]::mouse_event([MouseOps2]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
[MouseOps2]::mouse_event([MouseOps2]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
Start-Sleep -Milliseconds 50
[MouseOps2]::mouse_event([MouseOps2]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
[MouseOps2]::mouse_event([MouseOps2]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
`)
    } else if (process.platform === 'linux') {
      await runBash(`xdotool mousemove ${x} ${y} click --repeat 2 1`)
    } else if (process.platform === 'darwin') {
      await runSwift(`
import Cocoa
let pt = CGPoint(x: ${x}, y: ${y})
let down1 = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: pt, mouseButton: .left)
down1?.post(tap: .cghidEventTap)
usleep(30000)
let up1 = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: pt, mouseButton: .left)
up1?.post(tap: .cghidEventTap)
usleep(50000)
let down2 = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: pt, mouseButton: .left)
down2?.setIntegerValueField(.mouseEventClickState, value: 2)
down2?.post(tap: .cghidEventTap)
usleep(30000)
let up2 = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: pt, mouseButton: .left)
up2?.setIntegerValueField(.mouseEventClickState, value: 2)
up2?.post(tap: .cghidEventTap)
`)
    }

    return { success: true, message: `Double-clicked at (${x}, ${y})` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function desktopType(params: { text: string }): Promise<any> {
  try {
    const { text } = params

    if (process.platform === 'win32') {
      // Use PowerShell SendKeys for typing. Escape special SendKeys characters.
      const escaped = text
        .replace(/[+^%~(){}[\]]/g, '{$&}')
      await runPowershell(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${escaped.replace(/'/g, "''")}')
`)
    } else if (process.platform === 'linux') {
      await runBash(`xdotool type --clearmodifiers -- ${JSON.stringify(text)}`)
    } else if (process.platform === 'darwin') {
      await runBash(`osascript -e 'tell application "System Events" to keystroke "${text.replace(/"/g, '\\"')}"'`)
    }

    return { success: true, message: `Typed "${text.slice(0, 50)}"` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

const KEY_MAP_WIN: Record<string, string> = {
  enter: '{ENTER}', tab: '{TAB}', escape: '{ESC}', backspace: '{BACKSPACE}',
  delete: '{DELETE}', up: '{UP}', down: '{DOWN}', left: '{LEFT}', right: '{RIGHT}',
  home: '{HOME}', end: '{END}', pageup: '{PGUP}', pagedown: '{PGDN}', space: ' ',
  f1: '{F1}', f2: '{F2}', f3: '{F3}', f4: '{F4}', f5: '{F5}', f6: '{F6}',
  f7: '{F7}', f8: '{F8}', f9: '{F9}', f10: '{F10}', f11: '{F11}', f12: '{F12}',
}

const KEY_MAP_XDOTOOL: Record<string, string> = {
  enter: 'Return', tab: 'Tab', escape: 'Escape', backspace: 'BackSpace',
  delete: 'Delete', up: 'Up', down: 'Down', left: 'Left', right: 'Right',
  home: 'Home', end: 'End', pageup: 'Page_Up', pagedown: 'Page_Down', space: 'space',
  f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4', f5: 'F5', f6: 'F6',
  f7: 'F7', f8: 'F8', f9: 'F9', f10: 'F10', f11: 'F11', f12: 'F12',
}

// Virtual key codes for keybd_event (user32.dll) — used for keys that
// SendKeys cannot handle (e.g. Windows key).
const VK_CODES: Record<string, number> = {
  win: 0x5B, lwin: 0x5B, rwin: 0x5C, super: 0x5B, command: 0x5B, cmd: 0x5B,
  ctrl: 0xA2, lctrl: 0xA2, rctrl: 0xA3, control: 0xA2,
  alt: 0xA4, lalt: 0xA4, ralt: 0xA5, menu: 0xA4,
  shift: 0xA0, lshift: 0xA0, rshift: 0xA1,
  enter: 0x0D, return: 0x0D,
  tab: 0x09, escape: 0x1B, esc: 0x1B,
  backspace: 0x08, delete: 0x2E, space: 0x20,
  up: 0x26, down: 0x28, left: 0x25, right: 0x27,
  home: 0x24, end: 0x23, pageup: 0x21, pagedown: 0x22,
  f1: 0x70, f2: 0x71, f3: 0x72, f4: 0x73, f5: 0x74, f6: 0x75,
  f7: 0x76, f8: 0x77, f9: 0x78, f10: 0x79, f11: 0x7A, f12: 0x7B,
  a: 0x41, b: 0x42, c: 0x43, d: 0x44, e: 0x45, f: 0x46, g: 0x47,
  h: 0x48, i: 0x49, j: 0x4A, k: 0x4B, l: 0x4C, m: 0x4D, n: 0x4E,
  o: 0x4F, p: 0x50, q: 0x51, r: 0x52, s: 0x53, t: 0x54, u: 0x55,
  v: 0x56, w: 0x57, x: 0x58, y: 0x59, z: 0x5A,
  '0': 0x30, '1': 0x31, '2': 0x32, '3': 0x33, '4': 0x34,
  '5': 0x35, '6': 0x36, '7': 0x37, '8': 0x38, '9': 0x39,
}

// Keys that are modifiers (held down during combos)
const WIN_MODIFIERS = new Set(['ctrl', 'control', 'lctrl', 'rctrl', 'alt', 'lalt', 'ralt', 'menu', 'shift', 'lshift', 'rshift', 'win', 'lwin', 'rwin', 'super', 'command', 'cmd'])

/** Generate PowerShell script using keybd_event to press/release keys. */
function buildKeybdEventScript(keys: { vk: number; isModifier: boolean }[]): string {
  const lines = [
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class KbdOps {',
    '    [DllImport("user32.dll")]',
    '    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);',
    '    public const uint KEYEVENTF_KEYUP = 0x02;',
    '}',
    '"@',
  ]

  const modifiers = keys.filter(k => k.isModifier)
  const nonModifiers = keys.filter(k => !k.isModifier)

  // Press modifiers down
  for (const m of modifiers) {
    lines.push(`[KbdOps]::keybd_event(${m.vk}, 0, 0, 0)`)
  }
  if (modifiers.length > 0) {
    lines.push('Start-Sleep -Milliseconds 50')
  }

  // Press and release non-modifier keys
  for (const k of nonModifiers) {
    lines.push(`[KbdOps]::keybd_event(${k.vk}, 0, 0, 0)`)
    lines.push('Start-Sleep -Milliseconds 30')
    lines.push(`[KbdOps]::keybd_event(${k.vk}, 0, [KbdOps]::KEYEVENTF_KEYUP, 0)`)
  }

  // If only modifiers and no other keys, press and release them (e.g. just Win key)
  if (nonModifiers.length === 0) {
    lines.push('Start-Sleep -Milliseconds 50')
  }

  // Release modifiers in reverse
  for (const m of [...modifiers].reverse()) {
    lines.push(`[KbdOps]::keybd_event(${m.vk}, 0, [KbdOps]::KEYEVENTF_KEYUP, 0)`)
  }

  return lines.join('\n')
}

/** Check if any key in the list requires keybd_event (e.g. Win key, or not in SendKeys map). */
function needsKeybdEvent(keys: string[]): boolean {
  return keys.some(k => {
    const lower = k.toLowerCase()
    return lower === 'win' || lower === 'lwin' || lower === 'rwin' ||
           lower === 'super' || lower === 'command' || lower === 'cmd'
  })
}

/**
 * On macOS, convert Windows-style key names to their macOS equivalents.
 * Most Ctrl shortcuts on Windows correspond to Cmd shortcuts on macOS (copy, paste, save, etc.).
 */
const MAC_KEY_NORMALIZATION: Record<string, string> = {
  // Modifiers: Ctrl → Cmd (Ctrl+C on Windows = Cmd+C on macOS)
  ctrl: 'cmd',
  control: 'cmd',
  lctrl: 'cmd',
  rctrl: 'cmd',
  // Alt → Option
  alt: 'option',
  lalt: 'option',
  ralt: 'option',
  menu: 'option',
  // Windows/Super key → Command
  win: 'cmd',
  lwin: 'cmd',
  rwin: 'cmd',
  super: 'cmd',
  windows: 'cmd',
  meta: 'cmd',
  // Function key
  fn: 'fn',
  function: 'fn',
  // Backspace/Delete: Windows "backspace" = Mac "delete" (the key labeled delete on Mac)
  // Windows "delete" = Mac "forwarddelete" (fn+delete on Mac keyboards)
  backspace: 'backspace',
  delete: 'forwarddelete',
  del: 'forwarddelete',
  // Escape aliases
  esc: 'escape',
  // Enter aliases
  return: 'enter',
  // Print screen → Cmd+Shift+3 can't be mapped as a single key, keep as-is
  // These stay the same on both platforms
  // shift, enter, tab, escape, space, arrows, home, end, pageup, pagedown, f1-f12
}

function normalizeKeysForPlatform(keys: string[]): string[] {
  if (process.platform !== 'darwin') return keys

  return keys.map(k => {
    const lower = k.toLowerCase()
    return MAC_KEY_NORMALIZATION[lower] ?? k
  })
}

export async function desktopKeyPress(params: { keys: string[] }): Promise<any> {
  try {
    const { keys: rawKeys } = params
    const keys = normalizeKeysForPlatform(rawKeys)

    if (process.platform === 'win32') {
      if (needsKeybdEvent(keys)) {
        // Use keybd_event for Win key and other special keys
        const vkKeys = keys.map(k => ({
          vk: VK_CODES[k.toLowerCase()] || k.toUpperCase().charCodeAt(0),
          isModifier: WIN_MODIFIERS.has(k.toLowerCase()),
        }))
        await runPowershell(buildKeybdEventScript(vkKeys))
      } else {
        const sendKeys = keys.map(k => KEY_MAP_WIN[k.toLowerCase()] || k).join('')
        await runPowershell(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${sendKeys.replace(/'/g, "''")}')
`)
      }
    } else if (process.platform === 'linux') {
      for (const key of keys) {
        const mapped = KEY_MAP_XDOTOOL[key.toLowerCase()] || key
        await runBash(`xdotool key ${mapped}`)
      }
    } else if (process.platform === 'darwin') {
      for (const key of keys) {
        const lower = key.toLowerCase()
        const macKeyCode = KEY_MAP_MACOS[lower]
        if (macKeyCode !== undefined) {
          await runBash(`osascript -e 'tell application "System Events" to key code ${macKeyCode}'`)
        } else {
          // Single character — use keystroke
          await runBash(`osascript -e 'tell application "System Events" to keystroke "${key.replace(/"/g, '\\"')}"'`)
        }
      }
    }

    return { success: true, message: `Pressed keys: ${keys.join(', ')}` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

const MODIFIER_MAP_XDOTOOL: Record<string, string> = {
  ctrl: 'ctrl', alt: 'alt', shift: 'shift', cmd: 'super', win: 'super',
}

// macOS virtual key codes (CGKeyCode) for special keys
const KEY_MAP_MACOS: Record<string, number> = {
  enter: 36, return: 36,
  tab: 48,
  space: 49,
  backspace: 51, delete: 51,
  escape: 53, esc: 53,
  up: 126, down: 125, left: 123, right: 124,
  home: 115, end: 119,
  pageup: 116, pagedown: 121,
  forwarddelete: 117,
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97,
  f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
}

export async function desktopKeyCombo(params: { keys: string[] }): Promise<any> {
  try {
    const { keys: rawKeys } = params
    const keys = normalizeKeysForPlatform(rawKeys)

    // Single key: delegate to keyPress (e.g. pyautogui.hotkey('win'))
    if (keys.length === 1) {
      return desktopKeyPress({ keys })
    }

    if (keys.length === 0) {
      return { success: false, error: 'No keys specified' }
    }

    if (process.platform === 'win32') {
      // Always use keybd_event on Windows — it handles all keys including Win
      const vkKeys = keys.map(k => ({
        vk: VK_CODES[k.toLowerCase()] || k.toUpperCase().charCodeAt(0),
        isModifier: WIN_MODIFIERS.has(k.toLowerCase()),
      }))
      await runPowershell(buildKeybdEventScript(vkKeys))
    } else if (process.platform === 'linux') {
      const modifiers: string[] = []
      let finalKey = ''
      for (const key of keys) {
        const lower = key.toLowerCase()
        if (MODIFIER_MAP_XDOTOOL[lower]) {
          modifiers.push(MODIFIER_MAP_XDOTOOL[lower])
        } else {
          finalKey = KEY_MAP_XDOTOOL[lower] || lower
        }
      }
      const combo = [...modifiers, finalKey].join('+')
      await runBash(`xdotool key ${combo}`)
    } else if (process.platform === 'darwin') {
      const modifiers: string[] = []
      let finalKey = ''
      for (const key of keys) {
        const lower = key.toLowerCase()
        if (['ctrl', 'control', 'alt', 'option', 'shift', 'cmd', 'command', 'win', 'fn', 'function'].includes(lower)) {
          const mapped = (lower === 'ctrl' || lower === 'control') ? 'control down'
            : (lower === 'alt' || lower === 'option') ? 'option down'
            : (lower === 'cmd' || lower === 'command' || lower === 'win') ? 'command down'
            : (lower === 'fn' || lower === 'function') ? 'fn down'
            : `${lower} down`
          modifiers.push(mapped)
        } else {
          finalKey = key
        }
      }
      const using = modifiers.length ? ` using {${modifiers.join(', ')}}` : ''
      const macKeyCode = KEY_MAP_MACOS[finalKey.toLowerCase()]
      if (macKeyCode !== undefined) {
        // Special key (Enter, Backspace, arrows, etc.) — must use key code
        await runBash(`osascript -e 'tell application "System Events" to key code ${macKeyCode}${using}'`)
      } else {
        // Regular character — use keystroke
        await runBash(`osascript -e 'tell application "System Events" to keystroke "${finalKey.replace(/"/g, '\\"')}"${using}'`)
      }
    }

    return { success: true, message: `Key combo: ${keys.join('+')}` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function desktopScroll(params: {
  clicks: number
  direction?: 'vertical' | 'horizontal'
  x?: number
  y?: number
}): Promise<any> {
  try {
    const { clicks, direction = 'vertical', x, y } = params
    const amount = Math.abs(clicks)
    const scrollUp = clicks > 0

    if (process.platform === 'win32') {
      // Move mouse to position first (if specified), then scroll via mouse_event
      const moveScript = (x !== undefined && y !== undefined)
        ? `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})\nStart-Sleep -Milliseconds 100\n`
        : ''
      // MOUSEEVENTF_WHEEL = 0x0800, one notch = 120 units
      const wheelDelta = (scrollUp ? 120 : -120) * amount
      await runPowershell(`
Add-Type -AssemblyName System.Windows.Forms
${moveScript}Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ScrollOps {
    [DllImport("user32.dll")]
    public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
    public const int MOUSEEVENTF_WHEEL = 0x0800;
}
"@
[ScrollOps]::mouse_event([ScrollOps]::MOUSEEVENTF_WHEEL, 0, 0, ${wheelDelta}, 0)
`)
    } else if (process.platform === 'linux') {
      const parts: string[] = []
      if (x !== undefined && y !== undefined) {
        parts.push(`xdotool mousemove --sync ${x} ${y}`)
      }
      // xdotool: button 4=scroll up, 5=scroll down
      const button = scrollUp ? 4 : 5
      parts.push(`xdotool click --repeat ${amount} --delay 50 ${button}`)
      await runBash(parts.join(' && '))
    } else if (process.platform === 'darwin') {
      // Use CGEvent for reliable scrolling. Positive = scroll up, negative = scroll down.
      const delta = scrollUp ? amount * 3 : -(amount * 3)
      const moveCmd = (x !== undefined && y !== undefined)
        ? `CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: CGPoint(x: ${x}, y: ${y}), mouseButton: .left)?.post(tap: .cghidEventTap)\nusleep(50000)\n`
        : ''
      await runSwift(`
import Cocoa
${moveCmd}if let scrollEvent = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 1, wheel1: Int32(${delta}), wheel2: 0, wheel3: 0) {
    scrollEvent.post(tap: .cghidEventTap)
}
`)
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
    const { x1, y1, x2, y2, hold_keys = [] } = params

    if (process.platform === 'win32') {
      // Windows: move to start, mousedown, move to end, mouseup
      await runPowershell(`
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DragOps {
    [DllImport("user32.dll")]
    public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
    public const int MOUSEEVENTF_LEFTDOWN = 0x02;
    public const int MOUSEEVENTF_LEFTUP = 0x04;
    public const int MOUSEEVENTF_ABSOLUTE = 0x8000;
    public const int MOUSEEVENTF_MOVE = 0x0001;
}
"@
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x1}, ${y1})
Start-Sleep -Milliseconds 100
[DragOps]::mouse_event([DragOps]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
Start-Sleep -Milliseconds 50
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x2}, ${y2})
Start-Sleep -Milliseconds 100
[DragOps]::mouse_event([DragOps]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
`)
    } else if (process.platform === 'linux') {
      const parts: string[] = []
      for (const key of hold_keys) {
        parts.push(`xdotool keydown ${key}`)
      }
      parts.push(`xdotool mousemove --sync ${x1} ${y1}`)
      parts.push('sleep 0.2')
      parts.push('xdotool mousedown 1')
      parts.push('sleep 0.15')
      const xm = Math.round((x1 + x2) / 2), ym = Math.round((y1 + y2) / 2)
      parts.push(`xdotool mousemove --sync ${xm} ${ym}`)
      parts.push('sleep 0.05')
      parts.push(`xdotool mousemove --sync ${x2} ${y2}`)
      parts.push('sleep 0.15')
      parts.push('xdotool mouseup 1')
      for (const key of hold_keys) {
        parts.push(`xdotool keyup ${key}`)
      }
      await runBash(parts.join(' && '))
    } else if (process.platform === 'darwin') {
      await runSwift(`
import Cocoa
let start = CGPoint(x: ${x1}, y: ${y1})
let end = CGPoint(x: ${x2}, y: ${y2})
CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: start, mouseButton: .left)?.post(tap: .cghidEventTap)
usleep(100000)
let mid = CGPoint(x: (start.x + end.x) / 2, y: (start.y + end.y) / 2)
CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged, mouseCursorPosition: mid, mouseButton: .left)?.post(tap: .cghidEventTap)
usleep(50000)
CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged, mouseCursorPosition: end, mouseButton: .left)?.post(tap: .cghidEventTap)
usleep(100000)
CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: end, mouseButton: .left)?.post(tap: .cghidEventTap)
`)
    }

    return { success: true, message: `Dragged from (${x1},${y1}) to (${x2},${y2})` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
