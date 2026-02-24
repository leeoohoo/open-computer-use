import WebSocket from 'ws'
import { BrowserWindow, screen } from 'electron'
import * as os from 'os'
import { LocalExecutor } from './local-executor'
import { ApprovalManager } from './approval-manager'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

/** Collect local system details to send to the backend. */
function getSystemInfo(): Record<string, string> {
  const primary = screen.getPrimaryDisplay()
  return {
    platform: process.platform,                    // win32, darwin, linux
    os_name: `${os.type()} ${os.release()}`,       // Windows_NT 10.0.26200, Darwin 23.2.0, etc.
    os_version: os.release(),
    arch: os.arch(),                               // x64, arm64
    hostname: os.hostname(),
    username: os.userInfo().username,
    home_dir: os.homedir(),
    shell: process.platform === 'win32' ? 'powershell' : (process.env.SHELL || '/bin/bash'),
    screen_width: String(primary.size.width),
    screen_height: String(primary.size.height),
  }
}

export class WebSocketBridge {
  private ws: WebSocket | null = null
  private executor: LocalExecutor
  private backendUrl: string
  private token: string
  private machineId: string
  private userId: string
  private reconnectAttempts = 0
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private state: ConnectionState = 'disconnected'
  private intentionalClose = false
  private approvalManager: ApprovalManager

  constructor(backendUrl: string, token: string, machineId: string, userId: string, approvalManager: ApprovalManager) {
    this.backendUrl = backendUrl
    this.token = token
    this.machineId = machineId
    this.userId = userId
    this.executor = new LocalExecutor()
    this.approvalManager = approvalManager
  }

  getState(): ConnectionState {
    return this.state
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return

    this.setState('connecting')
    this.intentionalClose = false

    // Only non-sensitive system info goes in the URL query params.
    // Auth credentials (token, user_id, machine_id) are sent in the
    // first message after the connection opens — this avoids exposing
    // tokens in URLs which get logged by proxies, servers, and CDNs.
    const sysInfo = getSystemInfo()
    const params = new URLSearchParams(sysInfo)
    const wsUrl = `${this.backendUrl.replace(/^http/, 'ws')}/api/electron/ws?${params.toString()}`

    this.ws = new WebSocket(wsUrl)

    this.ws.on('open', () => {
      console.log('[WS Bridge] Connected, authenticating...')
      // Send auth credentials in the message body, not the URL
      this.send({
        type: 'auth',
        token: this.token,
        machine_id: this.machineId,
        user_id: this.userId,
      })
    })

    this.ws.on('message', async (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString())

        if (message.type === 'command') {
          const { command, parameters } = message.data
          console.log(`[WS Bridge] Received command: ${command}`)

          // Check approval mode before executing
          if (this.approvalManager.isDenyAll()) {
            console.log(`[WS Bridge] Denied (mode=off): ${command}`)
            this.send({
              type: 'result',
              data: { success: false, error: 'Action blocked: agent actions are currently paused by user' },
            })
          } else if (this.approvalManager.shouldAutoApprove(command)) {
            console.log(`[WS Bridge] Auto-approved: ${command}`)
            try {
              const result = await this.executor.executeCommand(command, parameters)
              this.send({ type: 'result', data: result })
            } catch (error: any) {
              this.send({
                type: 'result',
                data: { success: false, error: error.message || String(error) },
              })
            }
          } else {
            console.log(`[WS Bridge] Requesting approval: ${command}`)
            const { approved, reason } = await this.approvalManager.requestApproval(command, parameters)
            if (approved) {
              console.log(`[WS Bridge] User approved: ${command}`)
              try {
                const result = await this.executor.executeCommand(command, parameters)
                this.send({ type: 'result', data: result })
              } catch (error: any) {
                this.send({
                  type: 'result',
                  data: { success: false, error: error.message || String(error) },
                })
              }
            } else {
              const msg = reason ? `Action denied by user: ${reason}` : 'Action denied by user'
              console.log(`[WS Bridge] User denied: ${command} — ${msg}`)
              this.send({
                type: 'result',
                data: { success: false, error: msg },
              })
            }
          }
        } else if (message.type === 'ping') {
          this.send({ type: 'heartbeat' })
        } else if (message.type === 'auth_success') {
          console.log('[WS Bridge] Authenticated with backend')
          this.reconnectAttempts = 0
          this.setState('connected')
          this.startHeartbeat()
        } else if (message.type === 'auth_failed') {
          console.error('[WS Bridge] Authentication failed:', message.reason)
          this.setState('error')
          this.intentionalClose = true
          this.ws?.close()
        }
      } catch (e) {
        console.error('[WS Bridge] Error processing message:', e)
      }
    })

    this.ws.on('close', (code, reason) => {
      console.log(`[WS Bridge] Disconnected: ${code} ${reason}`)
      this.stopHeartbeat()

      if (!this.intentionalClose) {
        this.setState('disconnected')
        this.scheduleReconnect()
      }
    })

    this.ws.on('error', (error) => {
      console.error('[WS Bridge] Error:', error.message)
      this.setState('error')
    })
  }

  disconnect(): void {
    this.intentionalClose = true
    this.stopHeartbeat()
    this.clearReconnectTimer()
    this.approvalManager.cancelAll()
    this.ws?.close()
    this.ws = null
    this.setState('disconnected')
  }

  updateToken(token: string): void {
    this.token = token
    // Reconnect with new token
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.disconnect()
      this.connect()
    }
  }

  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'heartbeat' })
    }, 30000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private scheduleReconnect(): void {
    // Cap backoff at 15s so the overlay reconnects quickly when the backend comes up
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000)
    this.reconnectAttempts++
    console.log(`[WS Bridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  private setState(state: ConnectionState): void {
    this.state = state
    // Notify all renderer windows
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('connection-state-changed', state)
    })
  }
}
