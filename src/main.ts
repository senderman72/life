import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import { loadConfig } from './config'
import { ensureStorageDir } from './storage'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Config loaded here; wired to scheduler/screensaver in Phase 1+
  loadConfig()
  ensureStorageDir()

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    transparent: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})
