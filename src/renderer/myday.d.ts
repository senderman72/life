import type { WeatherData, CalendarEvent, StravaData, Fixture, GoalEvent, PomodoroTick } from '../types'

interface MyDayAPI {
  onWeatherUpdate(cb: (data: WeatherData) => void): () => void
  onCalendarUpdate(cb: (data: CalendarEvent[]) => void): () => void
  onStravaUpdate(cb: (data: StravaData) => void): () => void
  onFootballUpdate(cb: (data: Fixture[]) => void): () => void
  onGoalEvent(cb: (data: GoalEvent) => void): () => void
  onPomodoroTick(cb: (data: PomodoroTick) => void): () => void
  onScreensaverActivate(cb: () => void): () => void
  onScreensaverDeactivate(cb: () => void): () => void
  togglePomodoro(): void
  resetPomodoro(): void
  setClickable(clickable: boolean): void
}

declare global {
  interface Window {
    myday: MyDayAPI
  }
}
