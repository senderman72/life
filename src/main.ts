import { app, BrowserWindow, ipcMain, screen } from 'electron'
import * as path from 'path'
import { loadConfig } from './config'
import { ensureStorageDir } from './storage'
import { startScheduler } from './scheduler'

let mainWindow: BrowserWindow | null = null

// IPC: toggle click-through for Pomodoro card region — registered once
ipcMain.on('window:set-clickable', (_, clickable: unknown) => {
  if (typeof clickable !== 'boolean') return
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(!clickable, { forward: true })
  }
})

function createWindow(): void {
  const config = loadConfig()
  ensureStorageDir()

  const primaryDisplay = screen.getPrimaryDisplay()
  const { x, y, width, height } = primaryDisplay.bounds

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    hasShadow: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // 'floating' level keeps window above desktop but below modal dialogs.
  // True desktop-level (type: 'desktop') blocks all input — revisit with native module if needed.
  mainWindow.setAlwaysOnTop(true, 'floating')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  startScheduler(mainWindow, config)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Hide dock icon — wallpaper app should not appear in the dock
app.dock?.hide()

app.whenReady().then(createWindow)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('window-all-closed', () => {
  app.quit()
})
