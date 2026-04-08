import type { AppConfig, CalendarEvent } from '../types'
import { readJson, writeJson } from '../storage'

const TOKENS_FILE = 'google-tokens.json'
const CACHE_FILE = 'calendar-cache.json'

interface GoogleTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

// --- Pure helpers (exported for testing) ---

interface GoogleTimeField {
  dateTime?: string
  date?: string
}

export function parseEventTime(field: GoogleTimeField): { iso: string; isAllDay: boolean } {
  if (field.dateTime) {
    return { iso: field.dateTime, isAllDay: false }
  }
  return { iso: field.date ?? '', isAllDay: true }
}

export function parseCalendarResponse(raw: Record<string, unknown>): CalendarEvent[] {
  const items = raw.items as Array<Record<string, unknown>> | undefined
  if (!items || items.length === 0) return []

  return items
    .filter((item) => typeof item.id === 'string' && typeof item.summary === 'string' && item.summary.length > 0)
    .map((item) => {
      const start = parseEventTime(item.start as GoogleTimeField)
      const end = parseEventTime(item.end as GoogleTimeField)
      return {
        id: item.id as string,
        summary: item.summary as string,
        start: start.iso,
        end: end.iso,
        isAllDay: start.isAllDay,
        location: item.location as string | undefined,
      }
    })
}

export function isCurrentOrNext(
  event: CalendarEvent,
  now: Date,
  nextAlreadyFound: boolean,
): 'current' | 'next' | null {
  if (event.isAllDay) return null

  const startTime = new Date(event.start).getTime()
  const endTime = new Date(event.end).getTime()
  const nowTime = now.getTime()

  if (nowTime >= startTime && nowTime < endTime) return 'current'
  if (nowTime < startTime && !nextAlreadyFound) return 'next'
  return null
}

// --- Token management ---

async function getAccessToken(config: AppConfig): Promise<string> {
  const tokens = readJson<GoogleTokens>(TOKENS_FILE)
  if (!tokens || !tokens.refreshToken) {
    throw new Error('No Google tokens found. Run: node scripts/auth-google.js')
  }

  if (tokens.accessToken && tokens.expiresAt > Date.now() + 60_000) {
    return tokens.accessToken
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokens.refreshToken,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status}`)
  }

  const data = await response.json()
  if (!data.access_token || typeof data.expires_in !== 'number') {
    throw new Error(`Unexpected token refresh response: ${JSON.stringify(data)}`)
  }
  const updatedTokens: GoogleTokens = {
    accessToken: data.access_token,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  try { writeJson(TOKENS_FILE, updatedTokens) } catch { /* non-fatal */ }
  return updatedTokens.accessToken
}

// --- Fetcher ---

export async function fetchCalendar(config: AppConfig): Promise<CalendarEvent[]> {
  try {
    const accessToken = await getAccessToken(config)

    const now = new Date()
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)

    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    url.searchParams.set('timeMin', now.toISOString())
    url.searchParams.set('timeMax', endOfDay.toISOString())
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('maxResults', '10')

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`Calendar API returned ${response.status}`)
    }

    const raw = await response.json()
    const events = parseCalendarResponse(raw)
    try { writeJson(CACHE_FILE, events) } catch { /* non-fatal */ }
    return events
  } catch (err) {
    const cached = readJson<CalendarEvent[]>(CACHE_FILE)
    if (cached) return cached
    throw new Error('Calendar fetch failed and no cache available', { cause: err })
  }
}
