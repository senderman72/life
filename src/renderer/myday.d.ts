import type { WeatherData, CalendarEvent, StravaData, Fixture, GoalEvent, Standing } from '../types'

interface MyDayAPI {
  onWeatherUpdate(cb: (data: WeatherData) => void): () => void
  onCalendarUpdate(cb: (data: CalendarEvent[]) => void): () => void
  onStravaUpdate(cb: (data: StravaData) => void): () => void
  onFootballUpdate(cb: (data: Fixture[]) => void): () => void
  onGoalEvent(cb: (data: GoalEvent) => void): () => void
  onStandingsUpdate(cb: (data: Standing[]) => void): () => void
  onScreensaverActivate(cb: () => void): () => void
  onScreensaverDeactivate(cb: () => void): () => void
  setClickable(clickable: boolean): void
}

declare global {
  interface Window {
    myday: MyDayAPI
  }
}
