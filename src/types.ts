// Pomodoro
export type PomodoroState = 'idle' | 'work' | 'break'

export interface PomodoroTick {
  readonly state: PomodoroState
  readonly remainingSeconds: number
  readonly sessionCount: number
}

export interface PomodoroPersistedState {
  readonly state: PomodoroState
  readonly startedAt: number
  readonly workMinutes: number
  readonly breakMinutes: number
  readonly sessionCount: number
}

// Weather
export interface HourlyWeather {
  readonly time: string
  readonly temperature: number
  readonly weatherCode: number
}

export interface WeatherData {
  readonly temperature: number
  readonly apparentTemperature: number
  readonly weatherCode: number
  readonly windSpeed: number
  readonly hourlyForecast: readonly HourlyWeather[]
  readonly dailyHigh: number
  readonly dailyLow: number
  readonly sunrise: string
  readonly sunset: string
}

// Calendar
export interface CalendarEvent {
  readonly id: string
  readonly summary: string
  readonly start: string
  readonly end: string
  readonly isAllDay: boolean
  readonly location?: string
}

// Strava
export interface StravaWeekStats {
  readonly totalKm: number
  readonly totalElevation: number
  readonly totalMovingTimeMinutes: number
  readonly runCount: number
  readonly load: number
}

export type TrainingClassification = 'building' | 'maintaining' | 'recovering' | 'insufficient'

export interface StravaData {
  readonly thisWeek: StravaWeekStats
  readonly lastWeek: StravaWeekStats
  readonly classification: TrainingClassification
  readonly ratio: number
}

// Football
export interface FixtureScore {
  readonly home: number
  readonly away: number
}

export interface Fixture {
  readonly id: number
  readonly homeTeam: string
  readonly awayTeam: string
  readonly score: FixtureScore
  readonly status: string
  readonly minute: number | null
  readonly league: string
}

export interface GoalEvent {
  readonly fixtureId: number
  readonly scoringTeam: string
  readonly isFavorite: boolean
  readonly againstFavorite: boolean
  readonly newScore: FixtureScore
}

export interface Standing {
  readonly rank: number
  readonly teamName: string
  readonly points: number
  readonly wins: number
  readonly draws: number
  readonly losses: number
  readonly goalDifference: number
}

// Screensaver
export interface ScreensaverConfig {
  readonly enabled: boolean
  readonly idleMinutes: number
  readonly dimCards: boolean
  readonly ambientAnimation: boolean
}

// Config
export interface AppConfig {
  readonly location: {
    readonly city: string
    readonly latitude: number
    readonly longitude: number
  }
  readonly strava: {
    readonly clientId: string
    readonly clientSecret: string
  }
  readonly google: {
    readonly clientId: string
    readonly clientSecret: string
    readonly redirectUri: string
  }
  readonly football: {
    readonly apiToken: string
    readonly favoriteTeams: readonly string[]
  }
  readonly pomodoro: {
    readonly workMinutes: number
    readonly breakMinutes: number
  }
  readonly window: {
    readonly position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
    readonly refreshIntervalMinutes: number
  }
  readonly screensaver: ScreensaverConfig
}
