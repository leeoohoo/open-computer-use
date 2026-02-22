import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from 'electron'
import { join } from 'path'
import { ElectronAuth } from './auth'
import { WebSocketBridge } from './ws-bridge'
import { registerIpcHandlers } from './ipc-handlers'
import { setMainWindow, setWindowMode, setWindowOpacity, getWindowOpacity } from './window-manager'
import { initAutoUpdater, getUpdateStatus, getUpdateVersion, quitAndInstall } from './auto-updater'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let auth: ElectronAuth | null = null
let wsBridge: WebSocketBridge | null = null

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

app.whenReady().then(async () => {
  // Initialize auth
  auth = new ElectronAuth()

  // Register IPC handlers
  registerIpcHandlers(auth, () => wsBridge, (bridge) => { wsBridge = bridge }, BACKEND_URL)

  // Window mode control — renderer requests mode changes
  ipcMain.handle('window:set-mode', async (_event, mode: string) => {
    setWindowMode(mode as 'auth' | 'compact' | 'expanded')
  })

  // Window opacity control
  ipcMain.handle('window:set-opacity', async (_event, value: number) => {
    setWindowOpacity(value)
  })
  ipcMain.handle('window:get-opacity', async () => {
    return getWindowOpacity()
  })

  // Auto-update IPC
  ipcMain.handle('update:get-status', () => getUpdateStatus())
  ipcMain.handle('update:get-version', () => getUpdateVersion())
  ipcMain.handle('update:install', () => quitAndInstall())

  // Launch on system startup (only in packaged builds)
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true })
    initAutoUpdater()
  }

  createWindow()
  createTray()

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
})
