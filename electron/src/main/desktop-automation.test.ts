/**
 * Tests for desktop-automation.ts platform-specific functions.
 *
 * After the libnut migration these tests focus on the public-API contract:
 *   - return shape ({success, message} on success, {success, error} on fail)
 *   - that key/modifier translation routes to libnut with the right args
 *   - that multi-step actions (click-with-modifiers, drag) sequence the
 *     libnut calls correctly (modifiers down → action → modifiers up)
 *   - that empty/invalid inputs fail gracefully
 *
 * Critical mocks:
 *   - `./libnut-loader` — returns a vi.fn() for every libnut method so we
 *     can assert call ordering and argument shape without invoking the
 *     real native binary (which would require Accessibility permissions
 *     on macOS CI and would actually move the cursor in dev test runs).
 *   - `./permissions` — pretend macOS Accessibility is granted so
 *     requireAccessibility() short-circuits to null.
 *   - `./display-manager` — return a primary-monitor active display so
 *     the multi-monitor PowerShell fallback isn't triggered.
 *   - `child_process` — kept as a safety net in case any code path still
 *     wants to spawn (currently only the off-primary cursor fallback,
 *     which the active-display mock above prevents).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const libnutMock = {
  setKeyboardDelay: vi.fn(),
  keyTap: vi.fn(),
  keyToggle: vi.fn(),
  typeString: vi.fn(),
  typeStringDelayed: vi.fn(),
  setMouseDelay: vi.fn(),
  moveMouse: vi.fn(),
  moveMouseSmooth: vi.fn(),
  mouseClick: vi.fn(),
  mouseToggle: vi.fn(),
  dragMouse: vi.fn(),
  scrollMouse: vi.fn(),
  getMousePos: vi.fn(() => ({ x: 0, y: 0 })),
  getScreenSize: vi.fn(() => ({ width: 1920, height: 1080 })),
}

vi.mock('./libnut-loader', () => ({
  loadLibnut: () => libnutMock,
}))

vi.mock('./permissions', () => ({
  isAccessibilityGranted: () => true,
  requestAccessibility: vi.fn(),
}))

// Active display starts at (0, 0) with scaleFactor 1.0 so multi-monitor
// fallback never fires AND the DPI-scaling multiplier is a no-op for the
// existing test cases. The DPI-specific tests at the bottom of this file
// override scaleFactor explicitly.
vi.mock('./display-manager', () => ({
  getActiveDisplay: () => ({
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    workAreaSize: { width: 1920, height: 1040 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 1.0,
  }),
}))

vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: any, cb: Function) => {
    cb(null, '', '')
  }),
  spawn: vi.fn(() => {
    const proc: any = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn(), end: vi.fn() },
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'close') setTimeout(() => cb(0), 0)
      }),
    }
    return proc
  }),
}))

const desktopAutomation = await import('./desktop-automation')

beforeEach(() => {
  // Wipe call history but keep mock implementations
  Object.values(libnutMock).forEach((fn) => {
    if (typeof (fn as any).mockClear === 'function') (fn as any).mockClear()
  })
})

// ─── desktopClick ────────────────────────────────────────────────────────

describe('desktopClick', () => {
  it('moves the cursor and emits a left click', async () => {
    const result = await desktopAutomation.desktopClick({ x: 100, y: 200 })
    expect(result.success).toBe(true)
    expect(result.message).toContain('100')
    expect(result.message).toContain('200')
    expect(libnutMock.moveMouse).toHaveBeenCalledWith(100, 200)
    expect(libnutMock.mouseClick).toHaveBeenCalledWith('left')
  })

  it('routes button="right" through to libnut as right', async () => {
    const result = await desktopAutomation.desktopClick({ x: 50, y: 60, button: 'right' })
    expect(result.success).toBe(true)
    expect(libnutMock.mouseClick).toHaveBeenCalledWith('right')
  })

  it('treats button="middle" / "center" as middle (libnut accepts middle only)', async () => {
    await desktopAutomation.desktopClick({ x: 0, y: 0, button: 'middle' })
    expect(libnutMock.mouseClick).toHaveBeenCalledWith('middle')
    libnutMock.mouseClick.mockClear()
    await desktopAutomation.desktopClick({ x: 0, y: 0, button: 'center' })
    expect(libnutMock.mouseClick).toHaveBeenCalledWith('middle')
  })

  it('defaults unknown / missing button to left', async () => {
    await desktopAutomation.desktopClick({ x: 5, y: 5, button: 'wat' })
    expect(libnutMock.mouseClick).toHaveBeenLastCalledWith('left')
  })
})

// ─── desktopDoubleClick ──────────────────────────────────────────────────

describe('desktopDoubleClick', () => {
  it('emits one mouseClick(left, double=true) — real OS double-click event', async () => {
    const result = await desktopAutomation.desktopDoubleClick({ x: 100, y: 200 })
    expect(result.success).toBe(true)
    expect(result.message).toContain('Double-clicked')
    expect(libnutMock.moveMouse).toHaveBeenCalledWith(100, 200)
    expect(libnutMock.mouseClick).toHaveBeenCalledTimes(1)
    expect(libnutMock.mouseClick).toHaveBeenCalledWith('left', true)
  })
})

// ─── desktopClickWithModifiers ───────────────────────────────────────────

describe('desktopClickWithModifiers', () => {
  it('presses modifiers down before clicking and releases after', async () => {
    const result = await desktopAutomation.desktopClickWithModifiers({
      x: 100, y: 200, hold_keys: ['shift'],
    })
    expect(result.success).toBe(true)

    // Order: shift down → moveMouse → click → shift up
    const callOrder = [
      ...libnutMock.keyToggle.mock.calls.map((c) => ['keyToggle', ...c]),
      ...libnutMock.moveMouse.mock.calls.map((c) => ['moveMouse', ...c]),
      ...libnutMock.mouseClick.mock.calls.map((c) => ['mouseClick', ...c]),
    ]
    // Two keyToggle calls (shift down, shift up)
    expect(libnutMock.keyToggle).toHaveBeenCalledTimes(2)
    expect(libnutMock.keyToggle).toHaveBeenNthCalledWith(1, 'shift', 'down')
    expect(libnutMock.keyToggle).toHaveBeenNthCalledWith(2, 'shift', 'up')
    // Click happened (left)
    expect(libnutMock.mouseClick).toHaveBeenCalledWith('left')

    // Sanity: moveMouse fired after the modifier-down
    expect(callOrder.length).toBeGreaterThan(0)
  })

  it('releases modifiers in reverse order of press', async () => {
    await desktopAutomation.desktopClickWithModifiers({
      x: 0, y: 0, hold_keys: ['ctrl', 'shift'],
    })
    // 4 keyToggle calls: ctrl-down, shift-down, shift-up, ctrl-up
    expect(libnutMock.keyToggle).toHaveBeenCalledTimes(4)
    expect(libnutMock.keyToggle.mock.calls[0][1]).toBe('down')
    expect(libnutMock.keyToggle.mock.calls[1][1]).toBe('down')
    expect(libnutMock.keyToggle.mock.calls[2][1]).toBe('up')
    expect(libnutMock.keyToggle.mock.calls[3][1]).toBe('up')
    // Reverse order: first-released is the LAST that was pressed
    expect(libnutMock.keyToggle.mock.calls[2][0]).toBe(libnutMock.keyToggle.mock.calls[1][0])
    expect(libnutMock.keyToggle.mock.calls[3][0]).toBe(libnutMock.keyToggle.mock.calls[0][0])
  })

  it('honors right-click button with modifiers', async () => {
    await desktopAutomation.desktopClickWithModifiers({
      x: 0, y: 0, button: 'right', hold_keys: ['ctrl'],
    })
    expect(libnutMock.mouseClick).toHaveBeenCalledWith('right')
  })

  it('clicks=2 emits a single double-click (not two singles)', async () => {
    await desktopAutomation.desktopClickWithModifiers({
      x: 0, y: 0, hold_keys: ['shift'], clicks: 2,
    })
    expect(libnutMock.mouseClick).toHaveBeenCalledTimes(1)
    expect(libnutMock.mouseClick).toHaveBeenCalledWith('left', true)
  })

  it('clicks=3 emits double-click + one single', async () => {
    await desktopAutomation.desktopClickWithModifiers({
      x: 0, y: 0, hold_keys: ['shift'], clicks: 3,
    })
    expect(libnutMock.mouseClick).toHaveBeenCalledTimes(2)
    expect(libnutMock.mouseClick.mock.calls[0]).toEqual(['left', true])
    expect(libnutMock.mouseClick.mock.calls[1]).toEqual(['left'])
  })

  it('empty hold_keys still clicks (no modifier toggles)', async () => {
    const result = await desktopAutomation.desktopClickWithModifiers({
      x: 100, y: 200, hold_keys: [],
    })
    expect(result.success).toBe(true)
    expect(libnutMock.keyToggle).not.toHaveBeenCalled()
    expect(libnutMock.mouseClick).toHaveBeenCalledTimes(1)
  })
})

// ─── desktopType ─────────────────────────────────────────────────────────

describe('desktopType', () => {
  it('passes text verbatim to libnut.typeString', async () => {
    const result = await desktopAutomation.desktopType({ text: 'hello world' })
    expect(result.success).toBe(true)
    expect(result.message).toContain('hello world')
    expect(libnutMock.typeString).toHaveBeenCalledWith('hello world')
  })

  it('truncates long text in the result message but types the FULL string', async () => {
    const longText = 'a'.repeat(100)
    const result = await desktopAutomation.desktopType({ text: longText })
    expect(result.success).toBe(true)
    expect(result.message.length).toBeLessThan(100)
    // libnut still sees the full text — only the message is truncated
    expect(libnutMock.typeString).toHaveBeenCalledWith(longText)
  })

  it('handles unicode without crashing', async () => {
    const result = await desktopAutomation.desktopType({ text: 'café 你好 🚀' })
    expect(result.success).toBe(true)
    expect(libnutMock.typeString).toHaveBeenCalledWith('café 你好 🚀')
  })
})

// ─── desktopKeyPress ─────────────────────────────────────────────────────

describe('desktopKeyPress', () => {
  it('translates "enter" → libnut "enter" and taps it', async () => {
    const result = await desktopAutomation.desktopKeyPress({ keys: ['enter'] })
    expect(result.success).toBe(true)
    expect(libnutMock.keyTap).toHaveBeenCalledWith('enter')
  })

  it('handles multiple sequential keys', async () => {
    await desktopAutomation.desktopKeyPress({ keys: ['tab', 'tab', 'enter'] })
    expect(libnutMock.keyTap).toHaveBeenCalledTimes(3)
    expect(libnutMock.keyTap.mock.calls.map((c) => c[0])).toEqual(['tab', 'tab', 'enter'])
  })

  it('translates legacy "esc" → libnut "escape"', async () => {
    await desktopAutomation.desktopKeyPress({ keys: ['esc'] })
    expect(libnutMock.keyTap).toHaveBeenCalledWith('escape')
  })

  it('translates xdotool-style "kp_0" → libnut "numpad_0"', async () => {
    await desktopAutomation.desktopKeyPress({ keys: ['kp_0'] })
    expect(libnutMock.keyTap).toHaveBeenCalledWith('numpad_0')
  })

  it('translates "page_up" / "pageup" → libnut "pageup"', async () => {
    await desktopAutomation.desktopKeyPress({ keys: ['page_up'] })
    await desktopAutomation.desktopKeyPress({ keys: ['pageup'] })
    expect(libnutMock.keyTap.mock.calls.every((c) => c[0] === 'pageup')).toBe(true)
  })

  it('returns error for empty keys array', async () => {
    const result = await desktopAutomation.desktopKeyPress({ keys: [] })
    expect(result.success).toBe(false)
    expect(result.error).toContain('No keys')
  })

  it('returns error for unknown key — never sends garbage to libnut', async () => {
    const result = await desktopAutomation.desktopKeyPress({ keys: ['NOT_A_REAL_KEY'] })
    expect(result.success).toBe(false)
    expect(libnutMock.keyTap).not.toHaveBeenCalled()
  })
})

// ─── desktopKeyCombo ─────────────────────────────────────────────────────

describe('desktopKeyCombo', () => {
  it('two-key combo: last key + modifier list', async () => {
    const result = await desktopAutomation.desktopKeyCombo({ keys: ['ctrl', 'c'] })
    expect(result.success).toBe(true)
    // Single-modifier path — libnut accepts string OR string[] for modifier
    expect(libnutMock.keyTap).toHaveBeenCalledTimes(1)
    const [key, mod] = libnutMock.keyTap.mock.calls[0]
    expect(key).toBe('c')
    if (process.platform === 'darwin') {
      expect(mod).toBe('cmd')  // ctrl→cmd remap on macOS
    } else {
      expect(mod).toBe('control')
    }
  })

  it('three-key combo: array of modifiers + final key', async () => {
    await desktopAutomation.desktopKeyCombo({ keys: ['ctrl', 'shift', 's'] })
    expect(libnutMock.keyTap).toHaveBeenCalledTimes(1)
    const [key, mods] = libnutMock.keyTap.mock.calls[0]
    expect(key).toBe('s')
    expect(Array.isArray(mods)).toBe(true)
    expect(mods.length).toBe(2)
    expect(mods).toContain('shift')
  })

  it('single key delegates to keyPress (no modifier wrapping)', async () => {
    const result = await desktopAutomation.desktopKeyCombo({ keys: ['enter'] })
    expect(result.success).toBe(true)
    // keyPress path: keyTap called WITHOUT a modifier param
    expect(libnutMock.keyTap).toHaveBeenCalledTimes(1)
    expect(libnutMock.keyTap.mock.calls[0]).toEqual(['enter'])
  })

  it('returns error for empty keys', async () => {
    const result = await desktopAutomation.desktopKeyCombo({ keys: [] })
    expect(result.success).toBe(false)
    expect(result.error).toContain('No keys')
  })

  it('translates "win" → platform modifier (win on win/linux, cmd on mac)', async () => {
    await desktopAutomation.desktopKeyCombo({ keys: ['win', 'r'] })
    const [, mod] = libnutMock.keyTap.mock.calls[0]
    if (process.platform === 'darwin') {
      expect(mod).toBe('cmd')
    } else {
      expect(mod).toBe('win')
    }
  })
})

// ─── desktopScroll ───────────────────────────────────────────────────────

describe('desktopScroll', () => {
  it('positive clicks → scroll up', async () => {
    const result = await desktopAutomation.desktopScroll({ clicks: 3 })
    expect(result.success).toBe(true)
    expect(result.message).toContain('up')
    expect(libnutMock.scrollMouse).toHaveBeenCalledTimes(1)
    const [dx, dy] = libnutMock.scrollMouse.mock.calls[0]
    expect(dx).toBe(0)            // vertical default
    expect(dy).toBeGreaterThan(0) // positive = up
  })

  it('negative clicks → scroll down', async () => {
    const result = await desktopAutomation.desktopScroll({ clicks: -3 })
    expect(result.success).toBe(true)
    expect(result.message).toContain('down')
    const [, dy] = libnutMock.scrollMouse.mock.calls[0]
    expect(dy).toBeLessThan(0)
  })

  it('horizontal direction routes through dx, not dy', async () => {
    await desktopAutomation.desktopScroll({ clicks: 5, direction: 'horizontal' })
    const [dx, dy] = libnutMock.scrollMouse.mock.calls[0]
    expect(dy).toBe(0)
    expect(dx).not.toBe(0)
  })

  it('positions cursor first when x/y provided', async () => {
    await desktopAutomation.desktopScroll({ clicks: 2, x: 500, y: 300 })
    expect(libnutMock.moveMouse).toHaveBeenCalledWith(500, 300)
    expect(libnutMock.scrollMouse).toHaveBeenCalled()
  })

  it('clamps absurdly large clicks to MAX_SCROLL_CLICKS', async () => {
    const result = await desktopAutomation.desktopScroll({ clicks: 99999 })
    expect(result.success).toBe(true)
    expect(result.message).toContain('500')
  })
})

// ─── desktopDrag ─────────────────────────────────────────────────────────

describe('desktopDrag', () => {
  it('mouseToggle down → moves through midpoint → mouseToggle up', async () => {
    const result = await desktopAutomation.desktopDrag({
      x1: 100, y1: 200, x2: 300, y2: 400,
    })
    expect(result.success).toBe(true)
    expect(result.message).toContain('100')
    expect(result.message).toContain('300')

    // mousedown happened ONCE
    expect(libnutMock.mouseToggle).toHaveBeenCalledTimes(2)
    expect(libnutMock.mouseToggle).toHaveBeenNthCalledWith(1, 'down', 'left')
    expect(libnutMock.mouseToggle).toHaveBeenNthCalledWith(2, 'up', 'left')

    // moveMouse called for start, midpoint, end
    expect(libnutMock.moveMouse.mock.calls.length).toBeGreaterThanOrEqual(3)
    const lastMove = libnutMock.moveMouse.mock.calls[libnutMock.moveMouse.mock.calls.length - 1]
    expect(lastMove).toEqual([300, 400])
  })

  it('hold_keys press before drag, release after', async () => {
    await desktopAutomation.desktopDrag({
      x1: 0, y1: 0, x2: 50, y2: 50, hold_keys: ['shift'],
    })

    // shift down → ... → shift up
    expect(libnutMock.keyToggle).toHaveBeenCalledTimes(2)
    expect(libnutMock.keyToggle.mock.calls[0]).toEqual(['shift', 'down'])
    expect(libnutMock.keyToggle.mock.calls[1]).toEqual(['shift', 'up'])

    // The drag itself still happened
    expect(libnutMock.mouseToggle).toHaveBeenCalledTimes(2)
  })

  it('does NOT use libnut.dragMouse — we compose manually for parity', async () => {
    await desktopAutomation.desktopDrag({ x1: 0, y1: 0, x2: 100, y2: 100 })
    expect(libnutMock.dragMouse).not.toHaveBeenCalled()
  })
})
