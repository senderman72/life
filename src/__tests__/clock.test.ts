import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatTime, formatDate } from '../renderer/cards/clock'

describe('clock formatting', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('formatTime', () => {
    it('formats morning time as HH:MM:SS', () => {
      const date = new Date(2026, 3, 8, 9, 5, 3) // Apr 8, 09:05:03
      expect(formatTime(date)).toBe('09:05:03')
    })

    it('formats afternoon time as HH:MM:SS', () => {
      const date = new Date(2026, 3, 8, 14, 30, 45)
      expect(formatTime(date)).toBe('14:30:45')
    })

    it('formats midnight correctly', () => {
      const date = new Date(2026, 3, 8, 0, 0, 0)
      expect(formatTime(date)).toBe('00:00:00')
    })
  })

  describe('formatDate', () => {
    it('formats date as weekday, day month year', () => {
      const date = new Date(2026, 3, 8) // Wednesday, April 8
      const result = formatDate(date)
      expect(result).toContain('Wednesday')
      expect(result).toContain('8')
      expect(result).toContain('April')
      expect(result).toContain('2026')
    })

    it('formats a different date correctly', () => {
      const date = new Date(2026, 0, 1) // Thursday, January 1
      const result = formatDate(date)
      expect(result).toContain('Thursday')
      expect(result).toContain('1')
      expect(result).toContain('January')
      expect(result).toContain('2026')
    })
  })
})
