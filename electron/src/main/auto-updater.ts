import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow } from 'electron'
// Static import: error-reporter is also statically imported by index.ts and
// ws-bridge.ts, so any dynamic `import()` here would land in the same main
// chunk anyway — Vite warned about exactly that on the win:signed build.
// Keep the static path so we don't synthesise a useless dynamic-import
// boundary that the bundler can't honour.
import { reportError } from './error-reporter'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'        // downloaded, will install on restart
  | 'error'

let currentStatus: UpdateStatus = 'idle'
let updateInfo: UpdateInfo | null = null
let lastErrorMessage: string | null = null

/**
 * Sanitise an auto-updater error message so it never leaks internal paths,
 * server URLs, certificate details, or stack traces to the renderer or logs.
 */
export function sanitizeUpdateError(err: Error): string {
  const msg = err.message || 'Unknown update error'

  // Map known error classes to safe, user-facing messages
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(msg)) {
    return 'Update server is unreachable. Check your network connection.'
  }
  if (/certificate|ssl|tls|self.signed/i.test(msg)) {
    return 'Update server certificate error. Try again later.'
  }
  if (/404|not found/i.test(msg)) {
    return 'Update not found on server.'
  }
  if (/checksum|sha512|hash|verify|signature/i.test(msg)) {
    return 'Update integrity check failed. The download may be corrupt.'
  }
  if (/ENOSPC|disk.?full|no space/i.test(msg)) {
    return 'Not enough disk space to download update.'
  }
  if (/EPERM|EACCES|permission/i.test(msg)) {
    return 'Permission denied while applying update.'
  }

  // Generic fallback — strip anything that looks like a file path or URL
  return 'Update check failed. Try again later.'
}

function setStatus(status: UpdateStatus): void {
  currentStatus = status
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('update-status-changed', status)
  })
}

export function getUpdateStatus(): UpdateStatus {
  return currentStatus
}

export function getUpdateVersion(): string | null {
  return updateInfo?.version || null
}

export function getUpdateErrorMessage(): string | null {
  return lastErrorMessage
}

export function initAutoUpdater(): void {
  // Don't auto-install on download — let the user restart when ready
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    setStatus('checking')
  })

  autoUpdater.on('update-available', (info) => {
    updateInfo = info
    setStatus('available')
  })

  autoUpdater.on('download-progress', () => {
    setStatus('downloading')
  })

  autoUpdater.on('update-downloaded', (info) => {
    updateInfo = info
    setStatus('ready')
    console.log(`[Updater] Update ${info.version} downloaded, will install on restart`)
  })

  autoUpdater.on('update-not-available', () => {
    setStatus('idle')
  })

  autoUpdater.on('error', (err) => {
    const safeMessage = sanitizeUpdateError(err)
    lastErrorMessage = safeMessage
    console.error('[Updater] Error:', safeMessage)
    setStatus('error')
    // Pass the SANITIZED message — the original `err` may contain signing-cert
    // paths or update-server URLs that the reporter's PII scrubber wouldn't
    // otherwise know to redact. The reporter still applies its own scrub
    // pass, but giving it pre-sanitised input is defence in depth.
    reportError('auto_updater', {
      message: `Auto-update failed: ${safeMessage}`,
      context: { sanitized: safeMessage },
    })
  })

  // Check after a short delay so the app starts up fast
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)

  // Then check every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 4 * 60 * 60 * 1000)
}

export function checkForUpdates(): void {
  autoUpdater.checkForUpdates().catch(() => {})
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
