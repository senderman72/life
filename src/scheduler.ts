import type { BrowserWindow } from 'electron'
import type { AppConfig } from './types'
import { fetchWeather } from './fetchers/weather'

const THIRTY_MINUTES = 30 * 60 * 1000

export function startScheduler(win: BrowserWindow, config: AppConfig): void {
  // Weather: fetch immediately, then every 30 minutes
  const fetchAndSendWeather = async () => {
    try {
      const data = await fetchWeather(config)
      win.webContents.send('weather:update', data)
    } catch (err) {
      console.error('Weather fetch failed:', err)
    }
  }
  fetchAndSendWeather()
  setInterval(fetchAndSendWeather, THIRTY_MINUTES)
}
