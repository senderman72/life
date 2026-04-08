import type { BrowserWindow } from 'electron'
import type { AppConfig } from './types'
import { fetchWeather } from './fetchers/weather'
import { fetchCalendar } from './fetchers/calendar'

const THIRTY_MINUTES = 30 * 60 * 1000
const FIVE_MINUTES = 5 * 60 * 1000

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

  // Calendar: fetch immediately, then every 5 minutes
  const fetchAndSendCalendar = async () => {
    try {
      const events = await fetchCalendar(config)
      win.webContents.send('calendar:update', events)
    } catch (err) {
      console.error('Calendar fetch failed:', err)
    }
  }
  fetchAndSendCalendar()
  setInterval(fetchAndSendCalendar, FIVE_MINUTES)
}
