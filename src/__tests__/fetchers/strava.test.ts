import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getMondayEpoch,
  aggregateActivities,
  classifyTrainingLoad,
  parseStravaActivities,
} from '../../fetchers/strava'
import type { StravaWeekStats, TrainingClassification } from '../../types'

describe('getMondayEpoch', () => {
  afterEach(() => { vi.useRealTimers() })

  it('returns this Monday 00:00 local time for weeksAgo=0', () => {
    // Wednesday April 8, 2026 14:00
    vi.useFakeTimers({ now: new Date(2026, 3, 8, 14, 0, 0) })
    const epoch = getMondayEpoch(0)
    const monday = new Date(epoch * 1000)
    expect(monday.getDay()).toBe(1) // Monday
    expect(monday.getHours()).toBe(0)
    expect(monday.getMinutes()).toBe(0)
    expect(monday.getDate()).toBe(6) // April 6, 2026 is Monday
  })

  it('returns last Monday for weeksAgo=1', () => {
    vi.useFakeTimers({ now: new Date(2026, 3, 8, 14, 0, 0) })
    const epoch = getMondayEpoch(1)
    const monday = new Date(epoch * 1000)
    expect(monday.getDay()).toBe(1)
    expect(monday.getDate()).toBe(30) // March 30, 2026
    expect(monday.getMonth()).toBe(2) // March
  })

  it('handles Monday itself correctly (should return that same Monday)', () => {
    // Monday April 6, 2026 10:00
    vi.useFakeTimers({ now: new Date(2026, 3, 6, 10, 0, 0) })
    const epoch = getMondayEpoch(0)
    const monday = new Date(epoch * 1000)
    expect(monday.getDate()).toBe(6)
  })

  it('handles Sunday correctly (should return previous Monday)', () => {
    // Sunday April 12, 2026
    vi.useFakeTimers({ now: new Date(2026, 3, 12, 10, 0, 0) })
    const epoch = getMondayEpoch(0)
    const monday = new Date(epoch * 1000)
    expect(monday.getDate()).toBe(6)
  })
})

describe('aggregateActivities', () => {
  const ACTIVITIES = [
    { type: 'Run', distance: 10000, total_elevation_gain: 150, moving_time: 3000 },
    { type: 'Run', distance: 5000, total_elevation_gain: 50, moving_time: 1500 },
    { type: 'Ride', distance: 30000, total_elevation_gain: 500, moving_time: 5400 },
  ]

  it('aggregates only Run activities', () => {
    const stats = aggregateActivities(ACTIVITIES)
    expect(stats.runCount).toBe(2)
  })

  it('calculates total km correctly', () => {
    const stats = aggregateActivities(ACTIVITIES)
    expect(stats.totalKm).toBe(15) // (10000 + 5000) / 1000
  })

  it('calculates total elevation correctly', () => {
    const stats = aggregateActivities(ACTIVITIES)
    expect(stats.totalElevation).toBe(200) // 150 + 50
  })

  it('calculates moving time in minutes', () => {
    const stats = aggregateActivities(ACTIVITIES)
    expect(stats.totalMovingTimeMinutes).toBe(75) // (3000 + 1500) / 60
  })

  it('calculates load as km * (1 + elevation / 1000)', () => {
    const stats = aggregateActivities(ACTIVITIES)
    // 15 * (1 + 200/1000) = 15 * 1.2 = 18
    expect(stats.load).toBe(18)
  })

  it('returns zeroes for empty array', () => {
    const stats = aggregateActivities([])
    expect(stats.totalKm).toBe(0)
    expect(stats.load).toBe(0)
    expect(stats.runCount).toBe(0)
  })

  it('returns zeroes when no runs exist', () => {
    const stats = aggregateActivities([
      { type: 'Ride', distance: 30000, total_elevation_gain: 500, moving_time: 5400 },
    ])
    expect(stats.runCount).toBe(0)
    expect(stats.load).toBe(0)
  })
})

describe('classifyTrainingLoad', () => {
  const makeStats = (load: number): StravaWeekStats => ({
    totalKm: load, totalElevation: 0, totalMovingTimeMinutes: 0, runCount: 1, load,
  })

  it('returns "building" when ratio > 1.10', () => {
    const result = classifyTrainingLoad(makeStats(55), makeStats(45))
    expect(result.classification).toBe('building')
    expect(result.ratio).toBeCloseTo(55 / 45)
  })

  it('returns "maintaining" when ratio is 0.90-1.10', () => {
    const result = classifyTrainingLoad(makeStats(50), makeStats(50))
    expect(result.classification).toBe('maintaining')
    expect(result.ratio).toBeCloseTo(1.0)
  })

  it('returns "recovering" when ratio < 0.90', () => {
    const result = classifyTrainingLoad(makeStats(40), makeStats(55))
    expect(result.classification).toBe('recovering')
  })

  it('returns "insufficient" when last week load is 0', () => {
    const result = classifyTrainingLoad(makeStats(50), makeStats(0))
    expect(result.classification).toBe('insufficient')
    expect(result.ratio).toBe(0)
  })

  it('returns "insufficient" when both weeks are 0', () => {
    const result = classifyTrainingLoad(makeStats(0), makeStats(0))
    expect(result.classification).toBe('insufficient')
  })

  it('boundary: exactly 1.10 is maintaining', () => {
    const result = classifyTrainingLoad(makeStats(110), makeStats(100))
    expect(result.classification).toBe('maintaining')
  })

  it('boundary: exactly 0.90 is maintaining', () => {
    const result = classifyTrainingLoad(makeStats(90), makeStats(100))
    expect(result.classification).toBe('maintaining')
  })
})

describe('parseStravaActivities', () => {
  it('filters to Run type only', () => {
    const raw = [
      { type: 'Run', distance: 10000, total_elevation_gain: 100, moving_time: 3000 },
      { type: 'Ride', distance: 50000, total_elevation_gain: 800, moving_time: 7200 },
    ]
    const result = parseStravaActivities(raw)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('Run')
  })

  it('returns empty for non-array input', () => {
    expect(parseStravaActivities(null)).toEqual([])
    expect(parseStravaActivities(undefined)).toEqual([])
  })

  it('returns empty for empty array', () => {
    expect(parseStravaActivities([])).toEqual([])
  })
})
