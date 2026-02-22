import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow } from 'electron'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'        // downloaded, will install on restart
  | 'error'

let currentStatus: UpdateStatus = 'idle'
let updateInfo: UpdateInfo | null = null

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
    console.error('[Updater] Error:', err.message)
    setStatus('error')
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

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
