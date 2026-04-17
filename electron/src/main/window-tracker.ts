/**
 * Native macOS window tracker for the System Settings window.
 *
 * Uses CGWindowListCopyWindowInfo which — unlike the content capture APIs —
 * does NOT require Screen Recording or Accessibility permission for the
 * metadata we read (bounds, owner, layer). This is important for the
 * permission-guide flow: we're trying to help the user GRANT those
 * permissions, so we can't depend on them being granted already.
 *
 * Runs a long-lived Swift child process that prints one JSON line every
 * ~200ms with the current bounds of the System Settings window. The main
 * process consumes this stream to dock the helper window alongside.
 *
 * Swift source is compiled on first use (cached in tmpdir) — same pattern
 * as native-screenshot.ts.
 */

import { execFile, spawn, ChildProcess } from 'child_process'
import { existsSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'crypto'

export interface SettingsBounds {
  owner: string
  x: number
  y: number
  w: number
  h: number
}

export type TrackerUpdate = { found: true; bounds: SettingsBounds } | { found: false }

// ── Swift source ────────────────────────────────────────────────────────
// Polls CGWindowListCopyWindowInfo in a loop, prints newline-delimited JSON.
// Filters: layer 0 (normal windows), min size 320x240 (skip dropdowns/menus).
// Targets System Settings (Ventura+) and System Preferences (pre-Ventura).

const SWIFT_SOURCE = `
import Cocoa
import Foundation

// Target process names — macOS Ventura renamed the app but the binary process
// name changed too. We search all of these to stay compatible across versions.
let targets: Set<String> = ["System Settings", "System Preferences", "systempreferences"]

func findWindow() -> String {
    guard let rawWindows = CGWindowListCopyWindowInfo(
        [.optionOnScreenOnly, .excludeDesktopElements],
        kCGNullWindowID
    ) as? [[String: Any]] else {
        return "{\\"found\\":false}"
    }

    for w in rawWindows {
        guard let owner = w[kCGWindowOwnerName as String] as? String,
              targets.contains(owner),
              let bounds = w[kCGWindowBounds as String] as? [String: CGFloat],
              let layer = w[kCGWindowLayer as String] as? Int,
              layer == 0 else { continue }

        let x = bounds["X"] ?? 0
        let y = bounds["Y"] ?? 0
        let width = bounds["Width"] ?? 0
        let height = bounds["Height"] ?? 0

        // Ignore tiny auxiliary windows (popovers, tooltips, menu-bar items).
        if width < 320 || height < 240 { continue }

        let escaped = owner.replacingOccurrences(of: "\\"", with: "\\\\\\"")
        return "{\\"found\\":true,\\"owner\\":\\"\\(escaped)\\",\\"x\\":\\(x),\\"y\\":\\(y),\\"w\\":\\(width),\\"h\\":\\(height)}"
    }

    return "{\\"found\\":false}"
}

// Standard output is line-buffered by default when attached to a pipe; force
// flush after each write so the parent process gets updates in real time.
setbuf(stdout, nil)

// Poll interval: 180ms is snappy enough to feel "locked" to window drags
// without burning CPU (~5-6 samples/sec on a 120Hz display still feels fluid
// because macOS interpolates drag movement.)
while true {
    print(findWindow())
    Thread.sleep(forTimeInterval: 0.18)
}
`

// ── Compilation & caching (mirrors native-screenshot.ts) ────────────────

const SOURCE_HASH = createHash('md5').update(SWIFT_SOURCE).digest('hex').slice(0, 8)
const CACHE_DIR = join(tmpdir(), 'coasty-native')
const BIN_NAME = `window-tracker-${SOURCE_HASH}`
const BIN_PATH = join(CACHE_DIR, BIN_NAME)
const SRC_PATH = join(CACHE_DIR, `${BIN_NAME}.swift`)

let compilePromise: Promise<string | null> | null = null
let compileFailed = false

function compile(): Promise<string | null> {
  if (compileFailed) return Promise.resolve(null)
  if (compilePromise) return compilePromise

  compilePromise = new Promise((resolve) => {
    if (existsSync(BIN_PATH)) {
      resolve(BIN_PATH)
      return
    }

    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true })
    }

    writeFileSync(SRC_PATH, SWIFT_SOURCE)

    execFile(
      'swiftc',
      [
        SRC_PATH,
        '-o', BIN_PATH,
        '-framework', 'Cocoa',
        '-O',
        '-suppress-warnings',
      ],
      { timeout: 60000 },
      (error, _stdout, stderr) => {
        if (error) {
          console.warn('[WindowTracker] Compilation failed:', stderr || error.message)
          compileFailed = true
          compilePromise = null
          resolve(null)
          return
        }
        console.log('[WindowTracker] Helper compiled')
        resolve(BIN_PATH)
      },
    )
  })

  return compilePromise
}

// ── Public API ──────────────────────────────────────────────────────────

let tracker: ChildProcess | null = null
let currentCallback: ((update: TrackerUpdate) => void) | null = null

/**
 * Start tracking the System Settings window. The callback fires every ~180ms
 * with the latest bounds (or a `{ found: false }` update when Settings is
 * hidden / no longer visible on screen).
 *
 * Idempotent — calling while already tracking restarts with the new callback.
 * Silently no-ops on non-darwin or if swiftc isn't available.
 */
export async function startWindowTracking(
  callback: (update: TrackerUpdate) => void,
): Promise<void> {
  if (process.platform !== 'darwin') return
  if (tracker) stopWindowTracking()

  const bin = await compile()
  if (!bin) return
  if (!existsSync(bin)) {
    // Binary evicted between compile + spawn; reset so next call recompiles.
    compilePromise = null
    compileFailed = false
    return
  }

  currentCallback = callback
  tracker = spawn(bin, [], { stdio: ['ignore', 'pipe', 'pipe'] })

  let buffer = ''
  tracker.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8')
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed.found) {
          currentCallback?.({
            found: true,
            bounds: {
              owner: parsed.owner,
              x: parsed.x,
              y: parsed.y,
              w: parsed.w,
              h: parsed.h,
            },
          })
        } else {
          currentCallback?.({ found: false })
        }
      } catch {
        // Ignore partial / malformed lines; a resync happens on the next tick.
      }
    }
  })

  tracker.stderr?.on('data', (chunk: Buffer) => {
    console.warn('[WindowTracker] stderr:', chunk.toString('utf8').trim())
  })

  tracker.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn('[WindowTracker] exited with code', code)
    }
    tracker = null
    currentCallback = null
  })
}

export function stopWindowTracking(): void {
  if (!tracker) return
  try {
    tracker.kill('SIGTERM')
  } catch {
    /* child already exited */
  }
  tracker = null
  currentCallback = null
}

export function isTracking(): boolean {
  return tracker !== null
}

/** Pre-compile the helper during app startup so the first guide is instant. */
export function warmupWindowTracker(): void {
  if (process.platform !== 'darwin') return
  compile().catch(() => {})
}
