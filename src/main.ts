import { app, BrowserWindow, ipcMain, screen } from 'electron'
import * as path from 'path'
import { loadConfig } from './config'
import { ensureStorageDir } from './storage'
import { startScheduler } from './scheduler'
import { ScreensaverController } from './screensaver'

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

  // Normal level with negative offset: sits above the desktop wallpaper but below app windows.
  // Screensaver elevates to 'screen-saver' level on idle.
  mainWindow.setAlwaysOnTop(true, 'normal', -1)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  startScheduler(mainWindow, config)

  // Screensaver: idle detection + window level toggling
  const screensaver = new ScreensaverController()
  screensaver.start(mainWindow, config.screensaver)

  mainWindow.on('closed', () => {
    screensaver.stop()
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
