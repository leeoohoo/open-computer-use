import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from 'electron'
import { join } from 'path'
import { ElectronAuth } from './auth'
import { WebSocketBridge } from './ws-bridge'
import { registerIpcHandlers } from './ipc-handlers'
import { setMainWindow, setWindowMode, setWindowOpacity, getWindowOpacity, getWindowSize, getWindowBounds, startResize, stopResize, moveToDisplay } from './window-manager'
import { initAutoUpdater, getUpdateStatus, getUpdateVersion, checkForUpdates, quitAndInstall } from './auto-updater'
import {
  checkAllPermissions,
  requestAccessibility,
  openScreenRecordingSettings,
  openAccessibilitySettings,
} from './permissions'
import { ApprovalManager } from './approval-manager'
import { destroyRainbowBorder, showAmbientRainbow, hideAmbientRainbow, moveRainbowToDisplay } from './rainbow-border'
import { warmupNativeScreenshot } from './native-screenshot'
import { getDisplayList, getActiveDisplayId, setActiveDisplayId, getActiveDisplay } from './display-manager'

// Prevent multiple instances — second instance just focuses the existing window.
// This also avoids GPU cache lock conflicts on Windows.
const gotSingleLock = app.requestSingleInstanceLock()
if (!gotSingleLock) {
  app.quit()
}

// Disable GPU shader disk cache — a small overlay app doesn't benefit from it,
// and on Windows the cache directory gets locked between restarts causing
// "Unable to move the cache: Access is denied" errors.
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let auth: ElectronAuth | null = null
let wsBridge: WebSocketBridge | null = null
let approvalManager: ApprovalManager | null = null

const BACKEND_URL = process.env.COASTY_BACKEND_URL || 'http://localhost:8001'

function getIconPath(): string {
  // In dev, icons are in electron/build/; in production, they're in resources/
  const devPath = join(__dirname, '../../build/icon.png')
  const prodPath = join(process.resourcesPath, 'icon.png')
  return app.isPackaged ? prodPath : devPath
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    title: 'Coasty Desktop',
    icon: getIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
  })

  // Set the dock icon on macOS (BrowserWindow.icon is ignored on macOS)
  if (process.platform === 'darwin' && app.dock) {
    const dockIcon = nativeImage.createFromPath(getIconPath())
    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon)
    }
  }

  // Register with window manager for mode switching & screenshot hiding
  setMainWindow(mainWindow)

  // Open all external links in the user's default browser instead of a new Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // In development, load from dev server; in production, load the built file
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Coasty Desktop')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    mainWindow?.show()
  })
}

// Second instance tried to launch — focus existing window instead
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

app.whenReady().then(async () => {
  // Initialize auth and approval manager
  auth = new ElectronAuth()
  approvalManager = new ApprovalManager()

  // Propagate refreshed tokens to the WebSocket bridge so reconnects use fresh JWTs
  auth.onTokenRefresh((token) => {
    if (wsBridge) {
      wsBridge.updateToken(token)
    }
  })

  // Register IPC handlers
  registerIpcHandlers(auth, () => wsBridge, (bridge) => { wsBridge = bridge }, BACKEND_URL, approvalManager)

  // App version — exposed to renderer for display
  ipcMain.handle('app:get-version', () => app.getVersion())

  // Window mode control — renderer requests mode changes
  ipcMain.handle('window:set-mode', async (_event, mode: string) => {
    setWindowMode(mode as 'auth' | 'compact' | 'expanded')
    // Show a subtle ambient rainbow when overlay is expanded, hide when collapsed
    if (mode === 'expanded') {
      showAmbientRainbow()
    } else if (mode === 'compact') {
      hideAmbientRainbow()
    }
  })

  // Window opacity control
  ipcMain.handle('window:set-opacity', async (_event, value: number) => {
    setWindowOpacity(value)
  })
  ipcMain.handle('window:get-opacity', async () => {
    return getWindowOpacity()
  })

  // Window size query
  ipcMain.handle('window:get-size', async () => {
    return getWindowSize()
  })

  // Window bounds for custom resize
  ipcMain.handle('window:get-bounds', async () => {
    return getWindowBounds()
  })

  // Custom resize for frameless transparent windows — main process polls cursor
  ipcMain.handle('window:start-resize', async (_event, edge: string) => {
    startResize(edge)
  })
  ipcMain.handle('window:stop-resize', async () => {
    stopResize()
  })

  // Action approval IPC
  ipcMain.handle('approval:get-mode', () => approvalManager!.getMode())
  ipcMain.handle('approval:set-mode', (_event, mode: string) => {
    approvalManager!.setMode(mode as any)
  })
  ipcMain.handle('approval:respond', (_event, id: string, approved: boolean, reason?: string) => {
    approvalManager!.handleResponse(id, approved, reason)
  })

  // Permissions IPC (macOS)
  ipcMain.handle('permissions:check', () => checkAllPermissions())
  ipcMain.handle('permissions:request-accessibility', () => requestAccessibility())
  ipcMain.handle('permissions:open-screen-recording', () => openScreenRecordingSettings())
  ipcMain.handle('permissions:open-accessibility', () => openAccessibilitySettings())

  // Display selection (multi-monitor)
  ipcMain.handle('displays:list', () => getDisplayList())
  ipcMain.handle('displays:get-active', () => getActiveDisplayId())
  ipcMain.handle('displays:set-active', (_event, id: number | null) => {
    setActiveDisplayId(id)
    // Move overlay + rainbow border to the selected display
    const display = getActiveDisplay()
    moveToDisplay(display)
    moveRainbowToDisplay(display)
  })

  // App restart (used after granting permissions)
  ipcMain.handle('app:relaunch', () => {
    app.relaunch()
    app.exit(0)
  })

  // Auto-update IPC
  ipcMain.handle('update:get-status', () => getUpdateStatus())
  ipcMain.handle('update:get-version', () => getUpdateVersion())
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:install', () => quitAndInstall())

  // Launch on system startup (only in packaged builds)
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true })
    initAutoUpdater()
  }

  createWindow()
  createTray()

  // Pre-compile the native screenshot helper (macOS only) so it's ready
  // before the first screenshot request. Compilation takes ~2-3s the first
  // time; the binary is cached to disk across app restarts.
  warmupNativeScreenshot()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Don't quit on macOS when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  wsBridge?.disconnect()
  destroyRainbowBorder()
})
