import { powerMonitor, BrowserWindow } from 'electron'
import type { ScreensaverConfig } from './types'

const POLL_INTERVAL = 5000 // check idle every 5 seconds

export class ScreensaverController {
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private isActive = false

  start(win: BrowserWindow, config: ScreensaverConfig): void {
    if (!config.enabled) return

    const thresholdSeconds = config.idleMinutes * 60

    this.pollInterval = setInterval(() => {
      const idleSeconds = powerMonitor.getSystemIdleTime()

      if (idleSeconds >= thresholdSeconds && !this.isActive) {
        this.activate(win)
      } else if (idleSeconds < thresholdSeconds && this.isActive) {
        this.deactivate(win)
      }
    }, POLL_INTERVAL)
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  private activate(win: BrowserWindow): void {
    this.isActive = true
    // Elevate above all windows
    win.setAlwaysOnTop(true, 'screen-saver')
    // Enable mouse events so any click can wake
    win.setIgnoreMouseEvents(false)
    // Notify renderer
    win.webContents.send('screensaver:activate')
  }

  private deactivate(win: BrowserWindow): void {
    this.isActive = false
    // Restore to normal level (above wallpaper, below app windows)
    win.setAlwaysOnTop(true, 'normal', -1)
    // Restore click-through
    win.setIgnoreMouseEvents(true, { forward: true })
    // Notify renderer
    win.webContents.send('screensaver:deactivate')
  }
}
