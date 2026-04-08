import type { AppConfig, StravaData, StravaWeekStats, TrainingClassification } from '../types'
import { readJson, writeJson } from '../storage'

const TOKENS_FILE = 'strava-tokens.json'
const CACHE_FILE = 'strava-cache.json'

interface StravaTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface RawActivity {
  type: string
  distance: number
  total_elevation_gain: number
  moving_time: number
}

// --- Pure helpers (exported for testing) ---

export function getMondayEpoch(weeksAgo: number): number {
  const now = new Date()
  const day = now.getDay()
  // getDay(): 0=Sun, 1=Mon ... 6=Sat → days since Monday
  const daysSinceMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysSinceMonday - weeksAgo * 7)
  monday.setHours(0, 0, 0, 0)
  return Math.floor(monday.getTime() / 1000)
}

export function parseStravaActivities(raw: unknown): RawActivity[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (a): a is RawActivity =>
      typeof a === 'object' && a !== null &&
      (a as Record<string, unknown>).type === 'Run' &&
      typeof (a as Record<string, unknown>).distance === 'number' &&
      typeof (a as Record<string, unknown>).total_elevation_gain === 'number' &&
      typeof (a as Record<string, unknown>).moving_time === 'number',
  )
}

export function aggregateActivities(activities: RawActivity[]): StravaWeekStats {
  const runs = activities.filter((a) => a.type === 'Run')
  const totalKm = runs.reduce((sum, a) => sum + a.distance / 1000, 0)
  const totalElevation = runs.reduce((sum, a) => sum + a.total_elevation_gain, 0)
  const totalMovingTimeMinutes = runs.reduce((sum, a) => sum + a.moving_time / 60, 0)
  const load = totalKm * (1 + totalElevation / 1000)

  return {
    totalKm,
    totalElevation,
    totalMovingTimeMinutes,
    runCount: runs.length,
    load,
  }
}

export function classifyTrainingLoad(
  thisWeek: StravaWeekStats,
  lastWeek: StravaWeekStats,
): { classification: TrainingClassification; ratio: number } {
  if (lastWeek.load === 0) {
    return { classification: 'insufficient', ratio: 0 }
  }
  const ratio = thisWeek.load / lastWeek.load
  let classification: TrainingClassification
  if (ratio > 1.10) {
    classification = 'building'
  } else if (ratio < 0.90) {
    classification = 'recovering'
  } else {
    classification = 'maintaining'
  }
  return { classification, ratio }
}

// --- Token management ---

async function getStravaAccessToken(config: AppConfig): Promise<string> {
  const tokens = readJson<StravaTokens>(TOKENS_FILE)
  if (!tokens || !tokens.refreshToken) {
    throw new Error('No Strava tokens found. Run: node scripts/auth-strava.js')
  }

  if (tokens.accessToken && tokens.expiresAt > Date.now() + 60_000) {
    return tokens.accessToken
  }

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error(`Strava token refresh failed: ${response.status}`)
  }

  const data = await response.json()
  if (!data.access_token || !data.refresh_token || typeof data.expires_at !== 'number') {
    throw new Error(`Unexpected Strava token response: ${JSON.stringify(data)}`)
  }

  const updatedTokens: StravaTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // Strava rotates refresh tokens
    expiresAt: data.expires_at * 1000,
  }

  try {
    writeJson(TOKENS_FILE, updatedTokens)
  } catch (err) {
    console.error('Failed to persist rotated Strava refresh token:', err)
  }
  return updatedTokens.accessToken
}

// --- Fetcher ---

export async function fetchStrava(config: AppConfig): Promise<StravaData> {
  try {
    const accessToken = await getStravaAccessToken(config)
    const thisMondayEpoch = getMondayEpoch(0)
    const lastMondayEpoch = getMondayEpoch(1)

    const headers = { Authorization: `Bearer ${accessToken}` }

    const [thisWeekRes, lastWeekRes] = await Promise.all([
      fetch(`https://www.strava.com/api/v3/athlete/activities?after=${thisMondayEpoch}&per_page=100`, { headers }),
      fetch(`https://www.strava.com/api/v3/athlete/activities?after=${lastMondayEpoch}&before=${thisMondayEpoch}&per_page=100`, { headers }),
    ])

    if (!thisWeekRes.ok || !lastWeekRes.ok) {
      throw new Error(`Strava API error: this=${thisWeekRes.status} last=${lastWeekRes.status}`)
    }

    const thisWeekRaw = await thisWeekRes.json()
    const lastWeekRaw = await lastWeekRes.json()

    const thisWeek = aggregateActivities(parseStravaActivities(thisWeekRaw))
    const lastWeek = aggregateActivities(parseStravaActivities(lastWeekRaw))
    const { classification, ratio } = classifyTrainingLoad(thisWeek, lastWeek)

    const data: StravaData = { thisWeek, lastWeek, classification, ratio }
    try { writeJson(CACHE_FILE, data) } catch { /* non-fatal */ }
    return data
  } catch (err) {
    const cached = readJson<StravaData>(CACHE_FILE)
    if (cached) return cached
    throw new Error('Strava fetch failed and no cache available', { cause: err })
  }
}
