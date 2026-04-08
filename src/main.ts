import { app, BrowserWindow, screen } from 'electron'
import * as path from 'path'
import { loadConfig } from './config'
import { ensureStorageDir } from './storage'
import { startScheduler } from './scheduler'
import { ScreensaverController } from './screensaver'

let mainWindow: BrowserWindow | null = null

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
    type: 'desktop',       // True desktop level — behind icons, unfocusable, no input
    frame: false,
    transparent: true,
    hasShadow: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

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

// Hide dock icon
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
