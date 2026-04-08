import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { WeatherData, CalendarEvent, StravaData, Fixture, GoalEvent, PomodoroTick } from './types'

function onChannel<T>(channel: string, cb: (data: T) => void): () => void {
  const handler = (_: IpcRendererEvent, data: T) => cb(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.off(channel, handler)
}

function onSignal(channel: string, cb: () => void): () => void {
  const handler = () => cb()
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.off(channel, handler)
}

contextBridge.exposeInMainWorld('myday', {
  onWeatherUpdate: (cb: (data: WeatherData) => void) => onChannel('weather:update', cb),
  onCalendarUpdate: (cb: (data: CalendarEvent[]) => void) => onChannel('calendar:update', cb),
  onStravaUpdate: (cb: (data: StravaData) => void) => onChannel('strava:update', cb),
  onFootballUpdate: (cb: (data: Fixture[]) => void) => onChannel('football:update', cb),
  onGoalEvent: (cb: (data: GoalEvent) => void) => onChannel('football:goal', cb),
  onPomodoroTick: (cb: (data: PomodoroTick) => void) => onChannel('pomodoro:tick', cb),
  onScreensaverActivate: (cb: () => void) => onSignal('screensaver:activate', cb),
  onScreensaverDeactivate: (cb: () => void) => onSignal('screensaver:deactivate', cb),
  togglePomodoro: () => ipcRenderer.send('pomodoro:toggle'),
  resetPomodoro: () => ipcRenderer.send('pomodoro:reset'),
  setClickable: (clickable: boolean) => ipcRenderer.send('window:set-clickable', clickable),
})
