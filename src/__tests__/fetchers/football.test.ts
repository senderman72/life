import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Fixture } from '../../types'

describe('football', () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { vi.restoreAllMocks() })

  describe('isLiveStatus', () => {
    it('returns true for live statuses', async () => {
      const { isLiveStatus } = await import('../../fetchers/football')
      expect(isLiveStatus('IN_PLAY')).toBe(true)
      expect(isLiveStatus('PAUSED')).toBe(true)
      expect(isLiveStatus('HALF_TIME')).toBe(true)
      expect(isLiveStatus('EXTRA_TIME')).toBe(true)
      expect(isLiveStatus('PENALTY_SHOOTOUT')).toBe(true)
    })

    it('returns false for non-live statuses', async () => {
      const { isLiveStatus } = await import('../../fetchers/football')
      expect(isLiveStatus('SCHEDULED')).toBe(false)
      expect(isLiveStatus('FINISHED')).toBe(false)
      expect(isLiveStatus('POSTPONED')).toBe(false)
      expect(isLiveStatus('CANCELLED')).toBe(false)
    })
  })

  describe('parseFixtures', () => {
    const RAW_RESPONSE = {
      matches: [
        {
          id: 1001,
          status: 'IN_PLAY',
          minute: 35,
          homeTeam: { name: 'Liverpool FC', shortName: 'Liverpool' },
          awayTeam: { name: 'Arsenal FC', shortName: 'Arsenal' },
          score: { fullTime: { home: 1, away: 0 } },
        },
        {
          id: 1002,
          status: 'SCHEDULED',
          minute: null,
          homeTeam: { name: 'Manchester City FC', shortName: 'Man City' },
          awayTeam: { name: 'Chelsea FC', shortName: 'Chelsea' },
          score: { fullTime: { home: null, away: null } },
        },
      ],
    }

    it('parses fixtures from API response', async () => {
      const { parseFixtures } = await import('../../fetchers/football')
      const fixtures = parseFixtures(RAW_RESPONSE)
      expect(fixtures).toHaveLength(2)
    })

    it('maps fields correctly for a live match', async () => {
      const { parseFixtures } = await import('../../fetchers/football')
      const fixtures = parseFixtures(RAW_RESPONSE)
      const liverpool = fixtures[0]
      expect(liverpool.id).toBe(1001)
      expect(liverpool.homeTeam).toBe('Liverpool')
      expect(liverpool.awayTeam).toBe('Arsenal')
      expect(liverpool.score).toEqual({ home: 1, away: 0 })
      expect(liverpool.status).toBe('2H') // IN_PLAY maps to 2H
      expect(liverpool.minute).toBe(35)
    })

    it('handles null goals for scheduled matches', async () => {
      const { parseFixtures } = await import('../../fetchers/football')
      const fixtures = parseFixtures(RAW_RESPONSE)
      const manCity = fixtures[1]
      expect(manCity.score).toEqual({ home: 0, away: 0 })
      expect(manCity.status).toBe('NS')
    })

    it('returns empty for missing data', async () => {
      const { parseFixtures } = await import('../../fetchers/football')
      expect(parseFixtures({})).toEqual([])
      expect(parseFixtures({ matches: [] })).toEqual([])
    })
  })

  describe('parseStandings', () => {
    const RAW = {
      standings: [{
        type: 'TOTAL',
        table: [
          { position: 1, team: { name: 'Liverpool FC', shortName: 'Liverpool' }, points: 82, won: 26, draw: 4, lost: 4, goalDifference: 45 },
          { position: 2, team: { name: 'Arsenal FC', shortName: 'Arsenal' }, points: 75, won: 23, draw: 6, lost: 5, goalDifference: 38 },
        ],
      }],
    }

    it('parses standings correctly', async () => {
      const { parseStandings } = await import('../../fetchers/football')
      const standings = parseStandings(RAW)
      expect(standings).toHaveLength(2)
      expect(standings[0].rank).toBe(1)
      expect(standings[0].teamName).toBe('Liverpool')
      expect(standings[0].points).toBe(82)
      expect(standings[0].goalDifference).toBe(45)
    })

    it('returns empty for missing data', async () => {
      const { parseStandings } = await import('../../fetchers/football')
      expect(parseStandings({})).toEqual([])
    })
  })

  describe('detectGoals', () => {
    const CONFIG_FAVORITES = ['Liverpool', 'Malmö FF']

    function makeFixture(id: number, home: string, away: string, homeGoals: number, awayGoals: number): Fixture {
      return { id, homeTeam: home, awayTeam: away, score: { home: homeGoals, away: awayGoals }, status: '2H', minute: 60, league: 'Premier League' }
    }

    it('suppresses all events on startup poll', async () => {
      const { detectGoals, createScoreCache } = await import('../../fetchers/football')
      const cache = createScoreCache()
      const events = detectGoals([makeFixture(1, 'Liverpool', 'Arsenal', 1, 0)], cache, CONFIG_FAVORITES, true)
      expect(events).toEqual([])
    })

    it('detects a favorite team scoring', async () => {
      const { detectGoals, createScoreCache } = await import('../../fetchers/football')
      const cache = createScoreCache()
      detectGoals([makeFixture(1, 'Liverpool', 'Arsenal', 0, 0)], cache, CONFIG_FAVORITES, true)
      const events = detectGoals([makeFixture(1, 'Liverpool', 'Arsenal', 1, 0)], cache, CONFIG_FAVORITES, false)
      expect(events).toHaveLength(1)
      expect(events[0].scoringTeam).toBe('Liverpool')
      expect(events[0].isFavorite).toBe(true)
      expect(events[0].againstFavorite).toBe(false)
    })

    it('detects opponent scoring against favorite (red flash)', async () => {
      const { detectGoals, createScoreCache } = await import('../../fetchers/football')
      const cache = createScoreCache()
      detectGoals([makeFixture(1, 'Liverpool', 'Arsenal', 0, 0)], cache, CONFIG_FAVORITES, true)
      const events = detectGoals([makeFixture(1, 'Liverpool', 'Arsenal', 0, 1)], cache, CONFIG_FAVORITES, false)
      expect(events).toHaveLength(1)
      expect(events[0].scoringTeam).toBe('Arsenal')
      expect(events[0].isFavorite).toBe(false)
      expect(events[0].againstFavorite).toBe(true)
    })

    it('detects neutral goal', async () => {
      const { detectGoals, createScoreCache } = await import('../../fetchers/football')
      const cache = createScoreCache()
      detectGoals([makeFixture(1, 'Man City', 'Chelsea', 0, 0)], cache, CONFIG_FAVORITES, true)
      const events = detectGoals([makeFixture(1, 'Man City', 'Chelsea', 1, 0)], cache, CONFIG_FAVORITES, false)
      expect(events).toHaveLength(1)
      expect(events[0].isFavorite).toBe(false)
      expect(events[0].againstFavorite).toBe(false)
    })

    it('detects simultaneous goals as two events', async () => {
      const { detectGoals, createScoreCache } = await import('../../fetchers/football')
      const cache = createScoreCache()
      detectGoals([makeFixture(1, 'Liverpool', 'Arsenal', 0, 0)], cache, CONFIG_FAVORITES, true)
      const events = detectGoals([makeFixture(1, 'Liverpool', 'Arsenal', 1, 1)], cache, CONFIG_FAVORITES, false)
      expect(events).toHaveLength(2)
    })

    it('returns no events when score unchanged', async () => {
      const { detectGoals, createScoreCache } = await import('../../fetchers/football')
      const cache = createScoreCache()
      detectGoals([makeFixture(1, 'Liverpool', 'Arsenal', 1, 0)], cache, CONFIG_FAVORITES, true)
      const events = detectGoals([makeFixture(1, 'Liverpool', 'Arsenal', 1, 0)], cache, CONFIG_FAVORITES, false)
      expect(events).toEqual([])
    })
  })

  describe('shouldSkipNightMode', () => {
    it('returns true between 00:00 and 07:00', async () => {
      const { shouldSkipNightMode } = await import('../../fetchers/football')
      expect(shouldSkipNightMode(new Date(2026, 3, 8, 3, 0))).toBe(true)
      expect(shouldSkipNightMode(new Date(2026, 3, 8, 0, 0))).toBe(true)
    })

    it('returns false after 07:00', async () => {
      const { shouldSkipNightMode } = await import('../../fetchers/football')
      expect(shouldSkipNightMode(new Date(2026, 3, 8, 7, 0))).toBe(false)
      expect(shouldSkipNightMode(new Date(2026, 3, 8, 14, 0))).toBe(false)
    })
  })
})
