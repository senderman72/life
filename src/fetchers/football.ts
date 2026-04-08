import type { BrowserWindow } from 'electron'
import type { AppConfig, Fixture, FixtureScore, GoalEvent, Standing } from '../types'
import { readJson, writeJson } from '../storage'

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'PL' // Premier League

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'HALF_TIME', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'])
const TWO_MINUTES = 2 * 60 * 1000
const THIRTY_MINUTES = 30 * 60 * 1000
const STANDINGS_CACHE = 'football-standings-pl.json'

// Status mapping: football-data.org → display labels
const STATUS_MAP: Record<string, string> = {
  SCHEDULED: 'NS',
  TIMED: 'NS',
  IN_PLAY: '2H',
  PAUSED: 'HT',
  HALF_TIME: 'HT',
  EXTRA_TIME: 'ET',
  PENALTY_SHOOTOUT: 'PEN',
  FINISHED: 'FT',
  SUSPENDED: 'SUSP',
  POSTPONED: 'PST',
  CANCELLED: 'CANC',
  AWARDED: 'AWD',
}

// --- Pure helpers (exported for testing) ---

export function isLiveStatus(status: string): boolean {
  return LIVE_STATUSES.has(status)
}

export function shouldSkipNightMode(now: Date): boolean {
  const hour = now.getHours()
  return hour >= 0 && hour < 7
}

export function parseFixtures(raw: Record<string, unknown>): Fixture[] {
  try {
    const matches = raw.matches as Array<Record<string, unknown>> | undefined
    if (!matches || matches.length === 0) return []

    return matches.map((match) => {
      const homeTeam = match.homeTeam as Record<string, unknown>
      const awayTeam = match.awayTeam as Record<string, unknown>
      const score = match.score as Record<string, unknown>
      const fullTime = (score?.fullTime ?? {}) as Record<string, number | null>
      const status = match.status as string

      return {
        id: match.id as number,
        homeTeam: (homeTeam.shortName ?? homeTeam.name ?? 'Unknown') as string,
        awayTeam: (awayTeam.shortName ?? awayTeam.name ?? 'Unknown') as string,
        score: {
          home: fullTime.home ?? 0,
          away: fullTime.away ?? 0,
        },
        status: STATUS_MAP[status] ?? status,
        minute: (match.minute as number | null) ?? null,
        league: 'Premier League',
      }
    })
  } catch {
    return []
  }
}

export function parseStandings(raw: Record<string, unknown>): Standing[] {
  try {
    const standings = raw.standings as Array<Record<string, unknown>> | undefined
    if (!standings || standings.length === 0) return []
    // First standings group is the total table
    const table = standings[0].table as Array<Record<string, unknown>> | undefined
    if (!table) return []

    return table.map((entry) => {
      const team = entry.team as Record<string, unknown>
      return {
        rank: entry.position as number,
        teamName: (team.shortName ?? team.name ?? 'Unknown') as string,
        points: entry.points as number,
        wins: entry.won as number,
        draws: entry.draw as number,
        losses: entry.lost as number,
        goalDifference: entry.goalDifference as number,
      }
    })
  } catch {
    return []
  }
}

export type ScoreCache = Map<number, FixtureScore>

export function createScoreCache(): ScoreCache {
  return new Map()
}

export function detectGoals(
  fixtures: Fixture[],
  cache: ScoreCache,
  favoriteTeams: readonly string[],
  isStartupPoll: boolean,
): GoalEvent[] {
  if (isStartupPoll) {
    for (const f of fixtures) cache.set(f.id, f.score)
    return []
  }

  const events: GoalEvent[] = []
  for (const f of fixtures) {
    const prev = cache.get(f.id)
    if (prev) {
      if (f.score.home !== prev.home) {
        const isFavorite = favoriteTeams.includes(f.homeTeam)
        const againstFavorite = !isFavorite && favoriteTeams.includes(f.awayTeam)
        events.push({ fixtureId: f.id, scoringTeam: f.homeTeam, isFavorite, againstFavorite, newScore: f.score })
      }
      if (f.score.away !== prev.away) {
        const isFavorite = favoriteTeams.includes(f.awayTeam)
        const againstFavorite = !isFavorite && favoriteTeams.includes(f.homeTeam)
        events.push({ fixtureId: f.id, scoringTeam: f.awayTeam, isFavorite, againstFavorite, newScore: f.score })
      }
    }
    cache.set(f.id, f.score)
  }
  return events
}

// --- API calls ---

async function apiFetch(path: string, token: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-Auth-Token': token },
  })

  // Log rate limit info
  const remaining = response.headers.get('X-RequestsAvailable')
  const resetSeconds = response.headers.get('X-RequestCounter-Reset')
  if (remaining !== null && Number(remaining) <= 2) {
    console.warn(`Football API: only ${remaining} requests left, resets in ${resetSeconds}s`)
  }

  if (response.status === 429) {
    const waitSeconds = Number(resetSeconds) || 60
    console.warn(`Football API rate limited, waiting ${waitSeconds}s`)
    throw new Error(`Rate limited, retry after ${waitSeconds}s`)
  }

  if (!response.ok) {
    throw new Error(`football-data.org API returned ${response.status}`)
  }
  return response.json()
}

async function fetchTodayMatches(token: string): Promise<Fixture[]> {
  const raw = await apiFetch(`/competitions/${COMPETITION}/matches?status=SCHEDULED,LIVE,IN_PLAY,PAUSED,FINISHED&dateFrom=${getTodayDate()}&dateTo=${getTodayDate()}`, token)
  return parseFixtures(raw)
}

async function fetchStandingsData(token: string): Promise<Standing[]> {
  try {
    const raw = await apiFetch(`/competitions/${COMPETITION}/standings`, token)
    const standings = parseStandings(raw)
    try { writeJson(STANDINGS_CACHE, standings) } catch { /* non-fatal */ }
    return standings
  } catch {
    return readJson<Standing[]>(STANDINGS_CACHE) ?? []
  }
}

function getTodayDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// --- Adaptive Poller ---

export class FootballPoller {
  private interval: ReturnType<typeof setInterval> | null = null
  private readonly scoreCache: ScoreCache = createScoreCache()
  private isStartupPoll = true

  start(win: BrowserWindow, config: AppConfig): void {
    const poll = async () => {
      if (shouldSkipNightMode(new Date())) return

      try {
        const { apiToken, favoriteTeams } = config.football

        // Fetch today's matches
        const fixtures = await fetchTodayMatches(apiToken)

        // Detect goals
        const goals = detectGoals(fixtures, this.scoreCache, favoriteTeams, this.isStartupPoll)
        this.isStartupPoll = false

        // Send fixtures
        win.webContents.send('football:update', fixtures)

        // Send goal events
        for (const goal of goals) {
          win.webContents.send('football:goal', goal)
        }

        // Fetch standings (always — this powers the sidebar)
        const standings = await fetchStandingsData(apiToken)
        win.webContents.send('football:standings', standings)

        // Adaptive polling
        const hasLive = fixtures.some((f) => isLiveStatus(STATUS_MAP[f.status] ?? f.status) || f.status === '2H' || f.status === 'HT' || f.status === 'ET' || f.status === 'PEN')
        this.setPollingInterval(hasLive, poll)
      } catch (err) {
        console.error('Football poll failed:', err)
      }
    }

    poll().catch((err) => console.error('Football initial poll failed:', err))
    this.interval = setInterval(poll, THIRTY_MINUTES)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private setPollingInterval(isLive: boolean, pollFn: () => void): void {
    const targetInterval = isLive ? TWO_MINUTES : THIRTY_MINUTES
    if (this.interval) clearInterval(this.interval)
    this.interval = setInterval(pollFn, targetInterval)
  }
}
