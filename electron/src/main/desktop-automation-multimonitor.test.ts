/**
 * Multi-monitor regression tests for desktop-automation.
 *
 * libnut's Windows moveMouse normalizes against `SM_CXSCREEN` / `SM_CYSCREEN`
 * (primary monitor only). Coordinates that fall on a non-primary monitor
 * land in the wrong place if we hand them straight to libnut. The fix is a
 * single signed-assembly PowerShell call (System.Windows.Forms.Cursor) for
 * non-primary displays, while libnut still emits the actual click/drag
 * after the cursor is positioned.
 *
 * This file pins down:
 *   - On primary display → libnut.moveMouse called, no PowerShell spawn.
 *   - On non-primary display (Windows only) → PowerShell called, libnut
 *     does NOT receive a moveMouse for that step.
 *   - The PowerShell command uses ONLY signed-assembly references, never
 *     `Add-Type @"...inline C#..."@` (the AMSI-tripping pattern).
 *   - On macOS / Linux libnut is used regardless of which display the
 *     coords target (libnut handles multi-monitor correctly there).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  libnut: {
    setKeyboardDelay: vi.fn(), setMouseDelay: vi.fn(),
    keyTap: vi.fn(), keyToggle: vi.fn(),
    typeString: vi.fn(), typeStringDelayed: vi.fn(),
    moveMouse: vi.fn(), moveMouseSmooth: vi.fn(),
    mouseClick: vi.fn(), mouseToggle: vi.fn(),
    dragMouse: vi.fn(), scrollMouse: vi.fn(),
    getMousePos: vi.fn(() => ({ x: 0, y: 0 })),
    getScreenSize: vi.fn(() => ({ width: 1920, height: 1080 })),
  },
  // Mutable display state — tests flip between primary and non-primary
  display: {
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    workAreaSize: { width: 1920, height: 1040 },
    size: { width: 1920, height: 1080 },
  },
  execFileCalls: [] as Array<{ cmd: string; args: string[] }>,
}))

vi.mock('./libnut-loader', () => ({ loadLibnut: () => h.libnut }))
vi.mock('./permissions', () => ({
  isAccessibilityGranted: () => true,
  requestAccessibility: vi.fn(),
}))
vi.mock('./display-manager', () => ({
  getActiveDisplay: () => h.display,
}))
vi.mock('child_process', () => ({
  execFile: vi.fn((cmd: string, args: string[], _opts: any, cb: Function) => {
    h.execFileCalls.push({ cmd, args })
    cb(null, '', '')
  }),
  spawn: vi.fn(),
}))

const desktopAutomation = await import('./desktop-automation')

beforeEach(() => {
  Object.values(h.libnut).forEach((fn) => {
    if (typeof (fn as any).mockClear === 'function') (fn as any).mockClear()
  })
  h.execFileCalls = []
  // Reset to primary display
  h.display = {
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    workAreaSize: { width: 1920, height: 1040 },
    size: { width: 1920, height: 1080 },
  }
})

describe('multi-monitor cursor positioning', () => {
  it('primary display → libnut.moveMouse is used (no PowerShell spawn)', async () => {
    const result = await desktopAutomation.desktopClick({ x: 500, y: 400 })
    expect(result.success).toBe(true)
    expect(h.libnut.moveMouse).toHaveBeenCalledWith(500, 400)
    // Either no execFile, or no powershell.exe in any execFile call
    const psCalls = h.execFileCalls.filter((c) => /powershell/i.test(c.cmd))
    expect(psCalls).toHaveLength(0)
  })

  it('non-primary display on win32 → PowerShell signed-assembly fallback', async () => {
    if (process.platform !== 'win32') return  // skip on mac/linux

    // Move active display to (1920, 0) — a virtual second monitor
    h.display = {
      id: 2,
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
      workAreaSize: { width: 1920, height: 1040 },
      size: { width: 1920, height: 1080 },
    }

    const result = await desktopAutomation.desktopClick({ x: 2400, y: 200 })
    expect(result.success).toBe(true)

    // libnut.moveMouse should NOT have been called (its normalization is broken
    // for off-primary coords)
    expect(h.libnut.moveMouse).not.toHaveBeenCalled()

    // PowerShell call DID happen
    const psCalls = h.execFileCalls.filter((c) => /powershell/i.test(c.cmd))
    expect(psCalls.length).toBeGreaterThanOrEqual(1)

    // libnut.mouseClick still emits the click at the now-positioned cursor
    expect(h.libnut.mouseClick).toHaveBeenCalledWith('left')
  })

  it('non-primary fallback uses ONLY signed-assembly references — no inline Add-Type C#', async () => {
    if (process.platform !== 'win32') return

    h.display = {
      id: 2,
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
      workAreaSize: { width: 1920, height: 1040 },
      size: { width: 1920, height: 1080 },
    }

    await desktopAutomation.desktopClick({ x: 2400, y: 200 })
    const psCalls = h.execFileCalls.filter((c) => /powershell/i.test(c.cmd))
    expect(psCalls.length).toBeGreaterThanOrEqual(1)

    for (const call of psCalls) {
      const script = call.args.join(' ')
      // Critical: ONLY -AssemblyName references (signed Microsoft DLLs).
      // No `Add-Type @"..."@` inline C# (the pattern AMSI flags).
      expect(script).toContain('-AssemblyName')
      expect(script).toContain('System.Windows.Forms')
      expect(script).not.toMatch(/Add-Type\s+@"/)
      expect(script).not.toMatch(/DllImport/)
      expect(script).not.toMatch(/mouse_event/)
      expect(script).not.toMatch(/keybd_event/)
    }
  })

  it('non-primary display drag → moveTo(start), moveTo(mid), moveTo(end) all use PowerShell on win32', async () => {
    if (process.platform !== 'win32') return

    h.display = {
      id: 2,
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
      workAreaSize: { width: 1920, height: 1040 },
      size: { width: 1920, height: 1080 },
    }

    await desktopAutomation.desktopDrag({ x1: 2000, y1: 100, x2: 2400, y2: 500 })

    // Three position changes (start, mid, end) all via PowerShell
    const psCalls = h.execFileCalls.filter((c) => /powershell/i.test(c.cmd))
    expect(psCalls.length).toBeGreaterThanOrEqual(3)

    // mouseToggle still uses libnut for the actual button-down/up
    expect(h.libnut.mouseToggle).toHaveBeenCalledTimes(2)
    expect(h.libnut.mouseToggle).toHaveBeenNthCalledWith(1, 'down', 'left')
    expect(h.libnut.mouseToggle).toHaveBeenNthCalledWith(2, 'up', 'left')

    // libnut.moveMouse never called for off-primary coords
    expect(h.libnut.moveMouse).not.toHaveBeenCalled()
  })

  it('on darwin / linux libnut handles multi-monitor itself — no PowerShell ever spawns', async () => {
    if (process.platform === 'win32') return

    h.display = {
      id: 2,
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
      workAreaSize: { width: 1920, height: 1040 },
      size: { width: 1920, height: 1080 },
    }

    await desktopAutomation.desktopClick({ x: 2400, y: 200 })

    expect(h.libnut.moveMouse).toHaveBeenCalledWith(2400, 200)
    const psCalls = h.execFileCalls.filter((c) => /powershell/i.test(c.cmd))
    expect(psCalls).toHaveLength(0)
  })
})
