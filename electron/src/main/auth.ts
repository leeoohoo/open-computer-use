import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js'
import { app, shell } from 'electron'
import * as http from 'http'
import * as url from 'url'
import * as crypto from 'crypto'
import * as path from 'path'
import * as fs from 'fs'

// ── Shared HTML templates for the local callback server ──────────────────

const SPINNER_HTML = `
<html>
  <head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{display:flex;justify-content:center;align-items:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#0a0a0a;color:#fff}
    .card{text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px}
    .logo{width:40px;height:40px;opacity:0;animation:fadeIn .6s ease forwards}
    .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.1);border-top-color:rgba(255,255,255,.6);border-radius:50%;animation:spin .8s linear infinite}
    p{font-size:13px;color:#737373;letter-spacing:.01em}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeIn{to{opacity:1}}
  </style></head>
  <body>
    <div class="card">
      <svg class="logo" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
          <stop offset="30%" stop-color="rgba(255,255,255,.1)"/>
          <stop offset="50%" stop-color="rgba(255,255,255,.3)"/>
          <stop offset="70%" stop-color="rgba(255,255,255,.6)"/>
          <stop offset="100%" stop-color="#fff"/>
        </linearGradient></defs>
        <circle cx="100" cy="100" r="100" fill="url(#g)"/>
      </svg>
      <div class="spinner"></div>
      <p>Signing you in...</p>
    </div>
    <script>
      const hash = window.location.hash.substring(1);
      if (hash) {
        window.location.href = '/auth/complete?' + hash;
      } else {
        const params = window.location.search;
        if (params) {
          window.location.href = '/auth/complete' + params;
        } else {
          document.querySelector('.spinner').style.display='none';
          document.querySelector('p').textContent='Authentication failed. Please try again.';
          document.querySelector('p').style.color='#f87171';
        }
      }
    </script>
  </body>
</html>`

const SUCCESS_HTML = `
<html>
  <head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{display:flex;justify-content:center;align-items:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#0a0a0a;color:#fff}
    .card{text-align:center;display:flex;flex-direction:column;align-items:center;gap:24px;max-width:320px;opacity:0;animation:slideUp .6s cubic-bezier(.22,1,.36,1) forwards}
    .logo{width:48px;height:48px}
    .check{width:36px;height:36px;border-radius:50%;background:rgba(16,185,129,.12);display:flex;align-items:center;justify-content:center}
    .check svg{width:20px;height:20px;color:#10b981}
    h2{font-size:18px;font-weight:600;letter-spacing:-.02em}
    p{font-size:13px;color:#737373;line-height:1.6}
    .hint{display:flex;align-items:center;gap:8px;margin-top:4px;padding:10px 16px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
    .hint svg{flex-shrink:0;color:#a3a3a3}
    .hint span{font-size:12px;color:#a3a3a3;text-align:left}
    @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  </style></head>
  <body>
    <div class="card">
      <svg class="logo" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
          <stop offset="30%" stop-color="rgba(255,255,255,.1)"/>
          <stop offset="50%" stop-color="rgba(255,255,255,.3)"/>
          <stop offset="70%" stop-color="rgba(255,255,255,.6)"/>
          <stop offset="100%" stop-color="#fff"/>
        </linearGradient></defs>
        <circle cx="100" cy="100" r="100" fill="url(#g)"/>
      </svg>
      <div class="check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div>
        <h2>You're all set</h2>
        <p>You can close this tab. Coasty is ready on your desktop.</p>
      </div>
      <div class="hint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>
        <span>Type a task in the floating pill and you're done.</span>
      </div>
    </div>
  </body>
</html>`

function errorHtml(message: string): string {
  return `<html><head><style>*{margin:0;padding:0}body{display:flex;justify-content:center;align-items:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#0a0a0a;color:#fff}.c{text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px}p{font-size:13px;color:#a3a3a3}h2{font-size:16px;font-weight:600;color:#f87171}</style></head><body><div class="c"><h2>Something went wrong</h2><p>${message}</p></div></body></html>`
}

// ── ElectronAuth class ───────────────────────────────────────────────────

export class ElectronAuth {
  private supabase: SupabaseClient
  private session: Session | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private pendingCallbackServer: http.Server | null = null
  private pendingSessionPromise: Promise<{ user: User; session: Session }> | null = null
  private tokenRefreshListeners: Array<(token: string) => void> = []

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[Auth] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set in .env')
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    this.loadStoredSession()
  }

  // ── Shared callback server ─────────────────────────────────────────────
  // Starts a local HTTP server that captures Supabase auth tokens from browser redirects.
  // Used by Google OAuth, email sign-up confirmation, and magic link flows.

  private startCallbackServer(timeoutMs: number = 5 * 60 * 1000): Promise<{
    redirectUrl: string
    sessionPromise: Promise<{ user: User; session: Session }>
  }> {
    // Cancel any previous pending auth flow
    this.cancelPendingAuth()

    return new Promise((resolveSetup, rejectSetup) => {
      const server = http.createServer()
      this.pendingCallbackServer = server

      server.on('error', (err) => {
        this.pendingCallbackServer = null
        rejectSetup(err)
      })

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number }
        const redirectUrl = `http://127.0.0.1:${addr.port}/auth/callback`

        const sessionPromise = new Promise<{ user: User; session: Session }>((resolve, reject) => {
          server.on('request', async (req, res) => {
            const parsed = url.parse(req.url || '', true)

            if (parsed.pathname === '/auth/callback') {
              // Serve HTML that extracts the URL fragment and forwards as query params
              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(SPINNER_HTML)
              return
            }

            if (parsed.pathname === '/auth/complete') {
              const accessToken = parsed.query.access_token as string
              const refreshToken = parsed.query.refresh_token as string

              if (!accessToken) {
                res.writeHead(400, { 'Content-Type': 'text/html' })
                res.end(errorHtml('Missing access token. Please close this tab and try again.'))
                this.pendingCallbackServer = null
                server.close()
                reject(new Error('Missing access token'))
                return
              }

              try {
                const { data, error } = await this.supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                })

                if (error || !data.session || !data.user) {
                  res.writeHead(500, { 'Content-Type': 'text/html' })
                  res.end(errorHtml('Authentication failed. Please close this tab and try again.'))
                  this.pendingCallbackServer = null
                  server.close()
                  reject(error || new Error('No session returned'))
                  return
                }

                this.session = data.session
                this.storeSession(data.session)
                this.scheduleRefresh(data.session)

                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end(SUCCESS_HTML)
                this.pendingCallbackServer = null
                server.close()
                resolve({ user: data.user, session: data.session })
              } catch (err) {
                res.writeHead(500, { 'Content-Type': 'text/html' })
                res.end(errorHtml('Something went wrong. Please close this tab and try again.'))
                this.pendingCallbackServer = null
                server.close()
                reject(err)
              }
            }
          })

          // Timeout
          setTimeout(() => {
            if (this.pendingCallbackServer === server) {
              this.pendingCallbackServer = null
            }
            server.close()
            reject(new Error('Authentication timed out'))
          }, timeoutMs)
        })

        resolveSetup({ redirectUrl, sessionPromise })
      })
    })
  }

  /** Cancel any pending auth flow (sign-up waiting for confirmation, magic link, etc.) */
  cancelPendingAuth(): void {
    if (this.pendingCallbackServer) {
      this.pendingCallbackServer.close()
      this.pendingCallbackServer = null
      console.log('[Auth] Pending auth flow cancelled')
    }
  }

  // ── Auth methods ───────────────────────────────────────────────────────

  async signInWithGoogle(): Promise<{ user: User; session: Session }> {
    const { redirectUrl, sessionPromise } = await this.startCallbackServer(5 * 60 * 1000)

    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    })

    if (error || !data.url) {
      this.cancelPendingAuth()
      throw error || new Error('Failed to get OAuth URL')
    }

    shell.openExternal(data.url)
    return sessionPromise
  }

  async signUpWithEmail(email: string, password: string): Promise<{ user: User; session: Session }> {
    // Start local server first so we have a redirect URL for the confirmation email
    const { redirectUrl, sessionPromise } = await this.startCallbackServer(10 * 60 * 1000)

    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    })

    if (error) {
      this.cancelPendingAuth()
      throw error
    }

    // If identities is empty, the email is already registered
    if (data?.user?.identities?.length === 0) {
      this.cancelPendingAuth()
      throw new Error('An account with this email already exists.')
    }

    // Wait for the user to click the confirmation link in their email.
    // When they do, their browser redirects to our local server → tokens captured → session set.
    return sessionPromise
  }

  async signInWithEmail(email: string, password: string): Promise<{ user: User; session: Session }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    if (!data.session || !data.user) {
      throw new Error('No session returned')
    }

    this.session = data.session
    this.storeSession(data.session)
    this.scheduleRefresh(data.session)

    return { user: data.user, session: data.session }
  }

  /** Phase 1: Send the magic link OTP. Returns quickly with success or throws on error. */
  async sendMagicLink(email: string): Promise<void> {
    const { redirectUrl, sessionPromise } = await this.startCallbackServer(10 * 60 * 1000)

    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: false,
      },
    })

    if (error) {
      this.cancelPendingAuth()
      throw error
    }

    // OTP sent successfully — store the session promise for phase 2
    this.pendingSessionPromise = sessionPromise
  }

  /** Phase 2: Wait for the user to click the magic link (long-running). */
  async awaitMagicLinkSession(): Promise<{ user: User; session: Session }> {
    if (!this.pendingSessionPromise) {
      throw new Error('No pending magic link session')
    }
    try {
      const result = await this.pendingSessionPromise
      return result
    } finally {
      this.pendingSessionPromise = null
    }
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
    // User resets password in the browser, then signs in with new password in Electron.
  }

  // ── Session management ─────────────────────────────────────────────────

  async getSession(): Promise<Session | null> {
    if (this.session && !this.isAuthenticated() && this.session.refresh_token) {
      await this.refreshSessionNow()
    }
    return this.session
  }

  async getAccessToken(): Promise<string | null> {
    // Refresh expired tokens before returning — mirrors getSession() logic
    if (this.session && !this.isAuthenticated() && this.session.refresh_token) {
      await this.refreshSessionNow()
    }
    return this.session?.access_token || null
  }

  /** Expose the authenticated Supabase client for direct DB queries.
   *  Ensures the client has a valid session set before returning. */
  async getSupabaseClient(): Promise<SupabaseClient> {
    // Make sure the client has the current session's JWT
    if (this.session?.access_token) {
      await this.supabase.auth.setSession({
        access_token: this.session.access_token,
        refresh_token: this.session.refresh_token,
      })
    }
    return this.supabase
  }

  getUserId(): string | null {
    return this.session?.user?.id || null
  }

  getUserEmail(): string | null {
    return this.session?.user?.email || null
  }

  getUserName(): string | null {
    return this.session?.user?.user_metadata?.full_name || null
  }

  getUserAvatar(): string | null {
    return this.session?.user?.user_metadata?.avatar_url || null
  }

  async signOut(): Promise<void> {
    this.cancelPendingAuth()
    this.session = null
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    this.clearStoredSession()
    try {
      await this.supabase.auth.signOut()
    } catch {
      // Ignore sign-out errors
    }
  }

  isAuthenticated(): boolean {
    if (!this.session) return false
    const expiresAt = this.session.expires_at
    if (expiresAt && Date.now() / 1000 > expiresAt) {
      return false
    }
    return true
  }

  /** Register a callback that fires whenever the access token is refreshed. */
  onTokenRefresh(listener: (token: string) => void): void {
    this.tokenRefreshListeners.push(listener)
  }

  private notifyTokenRefresh(token: string): void {
    for (const listener of this.tokenRefreshListeners) {
      try { listener(token) } catch { /* ignore listener errors */ }
    }
  }

  getMachineId(): string {
    const userId = this.getUserId() || 'unknown'
    const hostname = require('os').hostname()
    const username = require('os').userInfo().username
    const platform = process.platform
    const name = `electron-${userId}-${hostname}-${username}-${platform}`
    return uuidv5FromName(name)
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private getSessionPath(): string {
    return path.join(app.getPath('userData'), '.session')
  }

  private storeSession(session: Session): void {
    try {
      const json = JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user: session.user,
      })

      const sessionPath = this.getSessionPath()

      fs.writeFileSync(sessionPath, json, 'utf-8')
      console.log('[Auth] Session saved to disk')
    } catch (err) {
      console.error('[Auth] Failed to store session:', err)
    }
  }

  private loadStoredSession(): void {
    try {
      const sessionPath = this.getSessionPath()
      if (!fs.existsSync(sessionPath)) return

      const raw = fs.readFileSync(sessionPath)
      let json: string

      json = raw.toString('utf-8')

      const data = JSON.parse(json)
      this.session = data as Session

      if (this.isAuthenticated()) {
        console.log('[Auth] Restored valid session from disk')
        // Set the session on the Supabase client so RLS-protected queries work.
        // Without this, the client has no JWT and all DB queries fail with RLS errors.
        this.supabase.auth.setSession({
          access_token: this.session!.access_token,
          refresh_token: this.session!.refresh_token,
        }).catch((err) => {
          console.error('[Auth] Failed to set restored session on Supabase client:', err)
        })
        this.scheduleRefresh(this.session!)
      } else if (this.session?.refresh_token) {
        console.log('[Auth] Access token expired, refreshing eagerly...')
        // Refresh immediately instead of deferring — getAccessToken() callers
        // need a valid token and the old "lazy refresh on getSession()" approach
        // left the token stale since nothing called getSession().
        this.refreshSessionNow().catch((err) => {
          console.error('[Auth] Eager refresh failed:', err)
        })
      } else {
        console.log('[Auth] Stored session fully expired, clearing')
        this.session = null
        this.clearStoredSession()
      }
    } catch (err) {
      console.error('[Auth] Failed to load stored session:', err)
      this.session = null
    }
  }

  private clearStoredSession(): void {
    try {
      const sessionPath = this.getSessionPath()
      if (fs.existsSync(sessionPath)) {
        fs.unlinkSync(sessionPath)
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private async refreshSessionNow(): Promise<void> {
    if (!this.session?.refresh_token) {
      this.session = null
      return
    }

    console.log('[Auth] Refreshing expired access token...')
    try {
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: this.session.refresh_token,
      })

      if (error || !data.session) {
        console.error('[Auth] Refresh failed:', error?.message || 'No session returned')
        this.session = null
        this.clearStoredSession()
        return
      }

      this.session = data.session
      this.storeSession(data.session)
      this.scheduleRefresh(data.session)
      this.notifyTokenRefresh(data.session.access_token)
      console.log('[Auth] Token refreshed successfully')
    } catch (err: any) {
      console.error('[Auth] Refresh error:', err.message)
      this.session = null
      this.clearStoredSession()
    }
  }

  private scheduleRefresh(session: Session): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }

    const expiresAt = session.expires_at
    if (!expiresAt) return

    const refreshIn = Math.max((expiresAt - Date.now() / 1000 - 300) * 1000, 10000)

    this.refreshTimer = setTimeout(async () => {
      try {
        const { data } = await this.supabase.auth.refreshSession({
          refresh_token: session.refresh_token,
        })
        if (data.session) {
          this.session = data.session
          this.storeSession(data.session)
          this.scheduleRefresh(data.session)
          this.notifyTokenRefresh(data.session.access_token)
        }
      } catch {
        this.session = null
      }
    }, refreshIn)
  }
}

/** Generate a deterministic UUID v5 from a name string (no external deps). */
function uuidv5FromName(name: string): string {
  const namespace = Buffer.from('a1b2c3d4e5f67890abcdef1234567890', 'hex')
  const nameBuffer = Buffer.from(name, 'utf8')
  const hash = crypto.createHash('sha1').update(Buffer.concat([namespace, nameBuffer])).digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.toString('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}
