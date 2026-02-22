import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js'
import { safeStorage, shell } from 'electron'
import * as http from 'http'
import * as url from 'url'
import * as crypto from 'crypto'

export class ElectronAuth {
  private supabase: SupabaseClient
  private session: Session | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    // Read env at construction time (after dotenv.config() has run)
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

  async signInWithGoogle(): Promise<{ user: User; session: Session }> {
    return new Promise((resolve, reject) => {
      // Find a random available port for the callback server
      const server = http.createServer()
      server.listen(0, '127.0.0.1', async () => {
        const addr = server.address() as { port: number }
        const callbackPort = addr.port
        const redirectUrl = `http://127.0.0.1:${callbackPort}/auth/callback`

        // Handle the OAuth callback
        server.on('request', async (req, res) => {
          const parsed = url.parse(req.url || '', true)

          if (parsed.pathname === '/auth/callback') {
            // Supabase implicit flow returns tokens as a URL fragment (#access_token=...).
            // Fragments never reach the server, so we serve an HTML page that
            // extracts the fragment and redirects to /auth/complete as query params.
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(`
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
              </html>
            `)
            return
          }

          if (parsed.pathname === '/auth/complete') {
            const accessToken = parsed.query.access_token as string
            const refreshToken = parsed.query.refresh_token as string

            if (!accessToken) {
              res.writeHead(400, { 'Content-Type': 'text/html' })
              res.end('<html><head><style>*{margin:0;padding:0}body{display:flex;justify-content:center;align-items:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#0a0a0a;color:#fff}.c{text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px}p{font-size:13px;color:#a3a3a3}h2{font-size:16px;font-weight:600;color:#f87171}</style></head><body><div class="c"><h2>Something went wrong</h2><p>Missing access token. Please close this tab and try again.</p></div></body></html>')
              server.close()
              reject(new Error('Missing access token'))
              return
            }

            try {
              // Set the session using the tokens from the implicit flow
              const { data, error } = await this.supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              })

              if (error || !data.session || !data.user) {
                res.writeHead(500, { 'Content-Type': 'text/html' })
                res.end('<html><head><style>*{margin:0;padding:0}body{display:flex;justify-content:center;align-items:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#0a0a0a;color:#fff}.c{text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px}p{font-size:13px;color:#a3a3a3}h2{font-size:16px;font-weight:600;color:#f87171}</style></head><body><div class="c"><h2>Authentication failed</h2><p>Please close this tab and try again.</p></div></body></html>')
                server.close()
                reject(error || new Error('No session returned'))
                return
              }

              this.session = data.session
              this.storeSession(data.session)
              this.scheduleRefresh(data.session)

              // Show success page
              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(`
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
                        <p>Minimize this window to see Coasty waiting on your desktop.</p>
                      </div>
                      <div class="hint">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>
                        <span>Type a task in the floating pill and you're done.</span>
                      </div>
                    </div>
                  </body>
                </html>
              `)
              server.close()
              resolve({ user: data.user, session: data.session })
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'text/html' })
              res.end('<html><head><style>*{margin:0;padding:0}body{display:flex;justify-content:center;align-items:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#0a0a0a;color:#fff}.c{text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px}p{font-size:13px;color:#a3a3a3}h2{font-size:16px;font-weight:600;color:#f87171}</style></head><body><div class="c"><h2>Something went wrong</h2><p>Please close this tab and try again.</p></div></body></html>')
              server.close()
              reject(err)
            }
          }
        })

        // Open the browser for Google OAuth
        try {
          const { data, error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: redirectUrl,
              skipBrowserRedirect: true,
            },
          })

          if (error || !data.url) {
            server.close()
            reject(error || new Error('Failed to get OAuth URL'))
            return
          }

          shell.openExternal(data.url)
        } catch (err) {
          server.close()
          reject(err)
        }

        // Timeout after 5 minutes
        setTimeout(() => {
          server.close()
          reject(new Error('Authentication timed out'))
        }, 5 * 60 * 1000)
      })
    })
  }

  async getSession(): Promise<Session | null> {
    return this.session
  }

  getAccessToken(): string | null {
    return this.session?.access_token || null
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
    // Check if token is expired
    const expiresAt = this.session.expires_at
    if (expiresAt && Date.now() / 1000 > expiresAt) {
      return false
    }
    return true
  }

  getMachineId(): string {
    const userId = this.getUserId() || 'unknown'
    const hostname = require('os').hostname()
    const username = require('os').userInfo().username
    const platform = process.platform
    const name = `electron-${userId}-${hostname}-${username}-${platform}`
    return uuidv5FromName(name)
  }

  private storeSession(session: Session): void {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          user: session.user,
        }))
        // Store encrypted buffer in a file or electron-store
        // For simplicity, use a global variable. In production, use electron-store.
        ;(global as any).__coasty_encrypted_session = encrypted
      }
    } catch {
      // Encryption not available, skip
    }
  }

  private loadStoredSession(): void {
    try {
      const encrypted = (global as any).__coasty_encrypted_session
      if (encrypted && safeStorage.isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(encrypted)
        const data = JSON.parse(decrypted)
        this.session = data as Session
        if (this.isAuthenticated()) {
          this.scheduleRefresh(this.session!)
        } else {
          this.session = null
        }
      }
    } catch {
      this.session = null
    }
  }

  private clearStoredSession(): void {
    ;(global as any).__coasty_encrypted_session = null
  }

  private scheduleRefresh(session: Session): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }

    const expiresAt = session.expires_at
    if (!expiresAt) return

    // Refresh 5 minutes before expiry
    const refreshIn = Math.max((expiresAt - Date.now() / 1000 - 300) * 1000, 10000)

    this.refreshTimer = setTimeout(async () => {
      try {
        const { data, error } = await this.supabase.auth.refreshSession({
          refresh_token: session.refresh_token,
        })
        if (data.session) {
          this.session = data.session
          this.storeSession(data.session)
          this.scheduleRefresh(data.session)
        }
      } catch {
        // Refresh failed, user will need to re-authenticate
        this.session = null
      }
    }, refreshIn)
  }
}

/** Generate a deterministic UUID v5 from a name string (no external deps). */
function uuidv5FromName(name: string): string {
  // Use a fixed namespace UUID for Coasty Electron machines
  const namespace = Buffer.from('a1b2c3d4e5f67890abcdef1234567890', 'hex')
  const nameBuffer = Buffer.from(name, 'utf8')
  const hash = crypto.createHash('sha1').update(Buffer.concat([namespace, nameBuffer])).digest()
  // Set version 5
  hash[6] = (hash[6] & 0x0f) | 0x50
  // Set variant
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.toString('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}
