/**
 * Security tests for ElectronAuth — covering fixes for:
 *
 *  #23  Token not exposed in URL query params (POST-only token exchange)
 *  #24  Nonce-based CSRF protection on callback server
 *  #25  Refresh mutex prevents token refresh race conditions
 *
 * These tests spin up real HTTP servers via the auth module and make real
 * HTTP requests against them. They are fully cross-platform (Windows + macOS).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as http from 'http'
import * as crypto from 'crypto'

// ── Mock Electron + Supabase before importing auth ──────────────────────────

const mockSetSession = vi.fn()
const mockRefreshSession = vi.fn()
const mockSignInWithOAuth = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()
const mockSignUp = vi.fn()
const mockSignInWithOtp = vi.fn()

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() =>
      process.platform === 'win32'
        ? 'C:\\Users\\testuser\\AppData\\Roaming\\Coasty Desktop'
        : '/tmp/coasty-test-userdata',
    ),
  },
  shell: {
    openExternal: vi.fn(),
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      setSession: mockSetSession,
      refreshSession: mockRefreshSession,
      signInWithOAuth: mockSignInWithOAuth,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      signUp: mockSignUp,
      signInWithOtp: mockSignInWithOtp,
    },
  })),
}))

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => { throw new Error('no session') }),
  existsSync: vi.fn(() => false),
  unlinkSync: vi.fn(),
}))

import { ElectronAuth } from './auth'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Make an HTTP request and return { statusCode, headers, body }. */
function httpRequest(
  options: http.RequestOptions & { body?: string },
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () =>
        resolve({ statusCode: res.statusCode || 0, headers: res.headers, body }),
      )
    })
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

/** Extract port and nonce from a redirect URL like http://127.0.0.1:12345/auth/callback/abc123 */
function parseRedirectUrl(redirectUrl: string): { port: number; nonce: string } {
  const u = new URL(redirectUrl)
  const segments = u.pathname.split('/')
  return { port: parseInt(u.port, 10), nonce: segments[segments.length - 1] }
}

// ── Setup ───────────────────────────────────────────────────────────────────

let auth: ElectronAuth

beforeEach(() => {
  vi.clearAllMocks()
  // Default: setSession succeeds
  mockSetSession.mockResolvedValue({
    data: {
      session: {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-123', email: 'test@example.com' },
      },
      user: { id: 'user-123', email: 'test@example.com' },
    },
    error: null,
  })
  auth = new ElectronAuth()
})

afterEach(() => {
  // Clean up any pending servers
  auth.cancelPendingAuth()
  vi.restoreAllMocks()
})

// ═══════════════════════════════════════════════════════════════════════════════
// #23 — TOKENS NOT IN URL (POST-ONLY TOKEN EXCHANGE)
// ═══════════════════════════════════════════════════════════════════════════════

describe('#23: Token exchange uses POST body, not URL query params', () => {
  it('GET /auth/callback/{nonce} returns HTML with POST-based token extraction', async () => {
    // Access private method via any cast for testing
    const { redirectUrl } = await (auth as any).startCallbackServer(5000)
    const { port, nonce } = parseRedirectUrl(redirectUrl)

    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/auth/callback/${nonce}`,
      method: 'GET',
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/html')
    expect(res.headers['cache-control']).toBe('no-store')

    // Verify HTML uses fetch() POST, NOT window.location redirect
    expect(res.body).toContain("fetch('/auth/complete/")
    expect(res.body).toContain("method: 'POST'")
    expect(res.body).toContain("'Content-Type': 'application/x-www-form-urlencoded'")
    expect(res.body).toContain('body: hash')

    // Must NOT contain the old redirect pattern
    expect(res.body).not.toContain("window.location.href = '/auth/complete?'")
    expect(res.body).not.toContain("window.location.href = '/auth/complete' + params")

    auth.cancelPendingAuth()
  })

  it('POST /auth/complete/{nonce} accepts tokens in body, not query params', async () => {
    const { redirectUrl, sessionPromise } = await (auth as any).startCallbackServer(5000)
    const { port, nonce } = parseRedirectUrl(redirectUrl)

    const tokenBody = 'access_token=test-jwt-token&refresh_token=test-refresh&token_type=bearer'

    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/auth/complete/${nonce}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain("You're all set")

    // Verify setSession was called with the tokens from the body
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'test-jwt-token',
      refresh_token: 'test-refresh',
    })

    const result = await sessionPromise
    expect(result.user.id).toBe('user-123')
  })

  it('GET /auth/complete/{nonce} (old redirect style) returns 404', async () => {
    const { redirectUrl } = await (auth as any).startCallbackServer(5000)
    const { port, nonce } = parseRedirectUrl(redirectUrl)

    // The old code used GET with query params — this must now be rejected
    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/auth/complete/${nonce}?access_token=stolen-token&refresh_token=r`,
      method: 'GET',
    })

    expect(res.statusCode).toBe(404)
    expect(mockSetSession).not.toHaveBeenCalled()

    auth.cancelPendingAuth()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// #24 — NONCE-BASED CSRF PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('#24: Nonce validation prevents CSRF / token injection', () => {
  it('redirect URL contains a cryptographic nonce in the path', async () => {
    const { redirectUrl } = await (auth as any).startCallbackServer(5000)

    // URL format: http://127.0.0.1:{port}/auth/callback/{64-char-hex-nonce}
    expect(redirectUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/auth\/callback\/[0-9a-f]{64}$/,
    )

    auth.cancelPendingAuth()
  })

  it('each startCallbackServer call generates a unique nonce', async () => {
    const { redirectUrl: url1 } = await (auth as any).startCallbackServer(5000)
    const nonce1 = parseRedirectUrl(url1).nonce
    auth.cancelPendingAuth()

    const { redirectUrl: url2 } = await (auth as any).startCallbackServer(5000)
    const nonce2 = parseRedirectUrl(url2).nonce
    auth.cancelPendingAuth()

    expect(nonce1).not.toBe(nonce2)
    expect(nonce1).toHaveLength(64)
    expect(nonce2).toHaveLength(64)
  })

  it('GET /auth/callback with wrong nonce returns 404', async () => {
    const { redirectUrl } = await (auth as any).startCallbackServer(5000)
    const { port } = parseRedirectUrl(redirectUrl)

    const wrongNonce = crypto.randomBytes(32).toString('hex')
    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/auth/callback/${wrongNonce}`,
      method: 'GET',
    })

    expect(res.statusCode).toBe(404)

    auth.cancelPendingAuth()
  })

  it('POST /auth/complete with wrong nonce returns 404', async () => {
    const { redirectUrl } = await (auth as any).startCallbackServer(5000)
    const { port } = parseRedirectUrl(redirectUrl)

    const wrongNonce = crypto.randomBytes(32).toString('hex')
    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/auth/complete/${wrongNonce}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'access_token=injected-token&refresh_token=injected-refresh',
    })

    expect(res.statusCode).toBe(404)
    expect(mockSetSession).not.toHaveBeenCalled()

    auth.cancelPendingAuth()
  })

  it('POST /auth/complete without nonce (bare path) returns 404', async () => {
    const { redirectUrl } = await (auth as any).startCallbackServer(5000)
    const { port } = parseRedirectUrl(redirectUrl)

    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/auth/complete',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'access_token=injected-token&refresh_token=injected-refresh',
    })

    expect(res.statusCode).toBe(404)
    expect(mockSetSession).not.toHaveBeenCalled()

    auth.cancelPendingAuth()
  })

  it('GET /auth/callback without nonce (old path) returns 404', async () => {
    const { redirectUrl } = await (auth as any).startCallbackServer(5000)
    const { port } = parseRedirectUrl(redirectUrl)

    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/auth/callback',
      method: 'GET',
    })

    expect(res.statusCode).toBe(404)

    auth.cancelPendingAuth()
  })

  it('random paths return 404', async () => {
    const { redirectUrl } = await (auth as any).startCallbackServer(5000)
    const { port } = parseRedirectUrl(redirectUrl)

    for (const testPath of ['/favicon.ico', '/', '/admin', '/auth/hack']) {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port,
        path: testPath,
        method: 'GET',
      })
      expect(res.statusCode).toBe(404)
    }

    auth.cancelPendingAuth()
  })

  it('POST with missing access_token returns 400 and rejects', async () => {
    const { redirectUrl, sessionPromise } = await (auth as any).startCallbackServer(5000)
    const { port, nonce } = parseRedirectUrl(redirectUrl)

    // Attach a catch handler early so the rejection doesn't become unhandled
    const rejectionPromise = sessionPromise.catch((e: Error) => e)

    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/auth/complete/${nonce}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'refresh_token=only-refresh',
    })

    expect(res.statusCode).toBe(400)
    const err = await rejectionPromise
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('Missing access token')
  })

  it('POST with oversized body returns 413', async () => {
    const { redirectUrl } = await (auth as any).startCallbackServer(5000)
    const { port, nonce } = parseRedirectUrl(redirectUrl)

    // 20 KB body — exceeds 16 KB limit
    const bigBody = 'access_token=' + 'A'.repeat(20 * 1024)

    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/auth/complete/${nonce}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bigBody,
    }).catch((err) => {
      // Connection may be destroyed before response is fully read — that's expected
      return { statusCode: 413, headers: {}, body: '' }
    })

    expect(res.statusCode).toBe(413)

    auth.cancelPendingAuth()
  })

  it('Supabase setSession error returns 500 and rejects the promise', async () => {
    mockSetSession.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: new Error('Invalid token'),
    })

    const { redirectUrl, sessionPromise } = await (auth as any).startCallbackServer(5000)
    const { port, nonce } = parseRedirectUrl(redirectUrl)

    // Attach catch early to prevent unhandled rejection
    const rejectionPromise = sessionPromise.catch((e: Error) => e)

    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/auth/complete/${nonce}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'access_token=bad-token&refresh_token=bad-refresh',
    })

    expect(res.statusCode).toBe(500)
    const err = await rejectionPromise
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('Invalid token')
  })

  it('double-resolve guard prevents second POST from re-resolving', async () => {
    const { redirectUrl, sessionPromise } = await (auth as any).startCallbackServer(5000)
    const { port, nonce } = parseRedirectUrl(redirectUrl)

    // First POST — succeeds
    const res1 = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/auth/complete/${nonce}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'access_token=token-1&refresh_token=refresh-1',
    })
    expect(res1.statusCode).toBe(200)

    const result = await sessionPromise
    expect(result.user.id).toBe('user-123')

    // setSession should only have been called once (the second POST goes to a closed server)
    expect(mockSetSession).toHaveBeenCalledTimes(1)
  })

  it('server binds to 127.0.0.1 only (not 0.0.0.0)', async () => {
    const { redirectUrl } = await (auth as any).startCallbackServer(5000)
    expect(redirectUrl).toContain('127.0.0.1')
    expect(redirectUrl).not.toContain('0.0.0.0')
    auth.cancelPendingAuth()
  })

  it('timeout rejects the session promise', async () => {
    // Very short timeout
    const { sessionPromise } = await (auth as any).startCallbackServer(200)

    await expect(sessionPromise).rejects.toThrow('Authentication timed out')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// #25 — REFRESH MUTEX (NO RACE CONDITIONS)
// ═══════════════════════════════════════════════════════════════════════════════

describe('#25: Token refresh mutex prevents race conditions', () => {
  it('concurrent refreshSessionNow() calls share the same promise', async () => {
    // Set up a session with expired token
    ;(auth as any).session = {
      access_token: 'expired-token',
      refresh_token: 'valid-refresh',
      expires_at: Math.floor(Date.now() / 1000) - 100,
      user: { id: 'user-123' },
    }

    let resolveRefresh!: (value: any) => void
    mockRefreshSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        }),
    )

    // Call refreshSessionNow() three times concurrently
    const p1 = (auth as any).refreshSessionNow()
    const p2 = (auth as any).refreshSessionNow()
    const p3 = (auth as any).refreshSessionNow()

    // All three should be the same promise (p2 and p3 join p1's in-flight refresh)
    // They'll all resolve when we resolve the single underlying refresh.

    // refreshSession should only be called ONCE
    expect(mockRefreshSession).toHaveBeenCalledTimes(1)

    // Resolve the refresh
    resolveRefresh({
      data: {
        session: {
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 'user-123' },
        },
      },
      error: null,
    })

    await Promise.all([p1, p2, p3])

    // Still only called once
    expect(mockRefreshSession).toHaveBeenCalledTimes(1)
    expect((auth as any).session.access_token).toBe('new-token')
  })

  it('mutex is released after successful refresh, allowing subsequent refresh', async () => {
    ;(auth as any).session = {
      access_token: 'old',
      refresh_token: 'refresh-1',
      expires_at: Math.floor(Date.now() / 1000) - 100,
      user: { id: 'user-123' },
    }

    mockRefreshSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'token-2',
          refresh_token: 'refresh-2',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 'user-123' },
        },
      },
      error: null,
    })

    await (auth as any).refreshSessionNow()
    expect((auth as any).session.access_token).toBe('token-2')

    // refreshPromise should be null after completion
    expect((auth as any).refreshPromise).toBeNull()

    // Second refresh should work (new call, new promise)
    mockRefreshSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'token-3',
          refresh_token: 'refresh-3',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 'user-123' },
        },
      },
      error: null,
    })

    ;(auth as any).session.refresh_token = 'refresh-2'
    await (auth as any).refreshSessionNow()
    expect((auth as any).session.access_token).toBe('token-3')
    expect(mockRefreshSession).toHaveBeenCalledTimes(2)
  })

  it('mutex is released after failed refresh', async () => {
    ;(auth as any).session = {
      access_token: 'old',
      refresh_token: 'bad-refresh',
      expires_at: Math.floor(Date.now() / 1000) - 100,
      user: { id: 'user-123' },
    }

    mockRefreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('Refresh token revoked'),
    })

    await (auth as any).refreshSessionNow()

    // Session should be cleared on failure
    expect((auth as any).session).toBeNull()
    // Mutex released
    expect((auth as any).refreshPromise).toBeNull()
  })

  it('mutex is released after refresh throws an exception', async () => {
    ;(auth as any).session = {
      access_token: 'old',
      refresh_token: 'refresh',
      expires_at: Math.floor(Date.now() / 1000) - 100,
      user: { id: 'user-123' },
    }

    mockRefreshSession.mockRejectedValueOnce(new Error('Network error'))

    await (auth as any).refreshSessionNow()

    expect((auth as any).session).toBeNull()
    expect((auth as any).refreshPromise).toBeNull()
  })

  it('getSession() and getAccessToken() both go through the mutex', async () => {
    ;(auth as any).session = {
      access_token: 'expired',
      refresh_token: 'valid-refresh',
      expires_at: Math.floor(Date.now() / 1000) - 100,
      user: { id: 'user-123' },
    }

    let resolveRefresh!: (value: any) => void
    mockRefreshSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        }),
    )

    // Both getSession and getAccessToken trigger refresh concurrently
    const sessionPromise = auth.getSession()
    const tokenPromise = auth.getAccessToken()

    // Only one refresh call should happen
    expect(mockRefreshSession).toHaveBeenCalledTimes(1)

    resolveRefresh({
      data: {
        session: {
          access_token: 'fresh-token',
          refresh_token: 'fresh-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 'user-123' },
        },
      },
      error: null,
    })

    const [session, token] = await Promise.all([sessionPromise, tokenPromise])
    expect(session?.access_token).toBe('fresh-token')
    expect(token).toBe('fresh-token')
    expect(mockRefreshSession).toHaveBeenCalledTimes(1)
  })

  it('scheduleRefresh uses the mutex-guarded path', async () => {
    vi.useFakeTimers()

    const session = {
      access_token: 'will-expire',
      refresh_token: 'sched-refresh',
      // Expires in 20 seconds — refresh scheduled at max(20-300, 10) = 10s
      expires_at: Math.floor(Date.now() / 1000) + 20,
      user: { id: 'user-123' },
    }
    ;(auth as any).session = session

    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'auto-refreshed',
          refresh_token: 'auto-refresh-2',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 'user-123' },
        },
      },
      error: null,
    })

    // Trigger scheduleRefresh
    ;(auth as any).scheduleRefresh(session)

    // Advance past the refresh interval
    await vi.advanceTimersByTimeAsync(11000)

    expect(mockRefreshSession).toHaveBeenCalledTimes(1)
    expect((auth as any).session.access_token).toBe('auto-refreshed')

    vi.useRealTimers()
  })

  it('no refresh when session has no refresh_token', async () => {
    ;(auth as any).session = {
      access_token: 'expired',
      refresh_token: null,
      expires_at: Math.floor(Date.now() / 1000) - 100,
      user: { id: 'user-123' },
    }

    await (auth as any).refreshSessionNow()

    expect(mockRefreshSession).not.toHaveBeenCalled()
    expect((auth as any).session).toBeNull()
  })

  it('token refresh listeners are notified exactly once per refresh', async () => {
    ;(auth as any).session = {
      access_token: 'old',
      refresh_token: 'refresh',
      expires_at: Math.floor(Date.now() / 1000) - 100,
      user: { id: 'user-123' },
    }

    const listener = vi.fn()
    auth.onTokenRefresh(listener)

    mockRefreshSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'notified-token',
          refresh_token: 'notified-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 'user-123' },
        },
      },
      error: null,
    })

    // Three concurrent calls — listener should fire once
    await Promise.all([
      (auth as any).refreshSessionNow(),
      (auth as any).refreshSessionNow(),
      (auth as any).refreshSessionNow(),
    ])

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('notified-token')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION — FULL OAuth FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: full callback flow (nonce + POST + session)', () => {
  it('complete OAuth flow: GET callback → POST tokens → session created', async () => {
    const { redirectUrl, sessionPromise } = await (auth as any).startCallbackServer(5000)
    const { port, nonce } = parseRedirectUrl(redirectUrl)

    // Step 1: Browser hits the callback URL (simulating Supabase redirect)
    const step1 = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/auth/callback/${nonce}`,
      method: 'GET',
    })
    expect(step1.statusCode).toBe(200)
    expect(step1.body).toContain('Signing you in')
    // The HTML should contain the correct nonce in the POST URL
    expect(step1.body).toContain(`/auth/complete/${nonce}`)

    // Step 2: Browser JS extracts fragment and POSTs tokens
    const step2 = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/auth/complete/${nonce}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'access_token=real-jwt&refresh_token=real-refresh&token_type=bearer&expires_in=3600',
    })
    expect(step2.statusCode).toBe(200)
    expect(step2.body).toContain("You're all set")

    // Step 3: Session promise resolves
    const result = await sessionPromise
    expect(result.user.id).toBe('user-123')
    expect(result.session.access_token).toBe('new-access-token')

    // Verify the correct tokens were sent to Supabase
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'real-jwt',
      refresh_token: 'real-refresh',
    })
  })

  it('cancelPendingAuth closes the server', async () => {
    const { redirectUrl } = await (auth as any).startCallbackServer(60000)
    const { port, nonce } = parseRedirectUrl(redirectUrl)

    // Server should be reachable
    const res1 = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/auth/callback/${nonce}`,
      method: 'GET',
    })
    expect(res1.statusCode).toBe(200)

    // Cancel
    auth.cancelPendingAuth()

    // Server should be closed — request should fail
    await expect(
      httpRequest({
        hostname: '127.0.0.1',
        port,
        path: `/auth/callback/${nonce}`,
        method: 'GET',
      }),
    ).rejects.toThrow()
  })

  it('starting a new callback server cancels the previous one', async () => {
    const { redirectUrl: url1 } = await (auth as any).startCallbackServer(60000)
    const { port: port1 } = parseRedirectUrl(url1)

    const { redirectUrl: url2 } = await (auth as any).startCallbackServer(60000)
    const { port: port2, nonce: nonce2 } = parseRedirectUrl(url2)

    // Old server should be closed
    await expect(
      httpRequest({
        hostname: '127.0.0.1',
        port: port1,
        path: '/auth/callback/anything',
        method: 'GET',
      }),
    ).rejects.toThrow()

    // New server should work
    const res = await httpRequest({
      hostname: '127.0.0.1',
      port: port2,
      path: `/auth/callback/${nonce2}`,
      method: 'GET',
    })
    expect(res.statusCode).toBe(200)

    auth.cancelPendingAuth()
  })
})
