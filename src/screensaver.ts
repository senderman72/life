import { powerMonitor, BrowserWindow } from 'electron'
import type { ScreensaverConfig } from './types'

const POLL_INTERVAL = 5000

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
    // Elevate above everything for screensaver mode
    win.setAlwaysOnTop(true, 'screen-saver')
    win.webContents.send('screensaver:activate')
  }

  private deactivate(win: BrowserWindow): void {
    this.isActive = false
    // Return to desktop level (behind icons, behind all windows)
    win.setAlwaysOnTop(false)
    win.webContents.send('screensaver:deactivate')
  }
}
