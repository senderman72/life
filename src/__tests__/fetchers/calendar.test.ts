import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseCalendarResponse, parseEventTime, isCurrentOrNext } from '../../fetchers/calendar'
import type { CalendarEvent } from '../../types'

describe('parseEventTime', () => {
  it('parses a dateTime field as non-all-day', () => {
    const result = parseEventTime({ dateTime: '2026-04-08T14:00:00+02:00' })
    expect(result.iso).toBe('2026-04-08T14:00:00+02:00')
    expect(result.isAllDay).toBe(false)
  })

  it('parses a date-only field as all-day', () => {
    const result = parseEventTime({ date: '2026-04-08' })
    expect(result.iso).toBe('2026-04-08')
    expect(result.isAllDay).toBe(true)
  })

  it('prefers dateTime over date when both present', () => {
    const result = parseEventTime({ dateTime: '2026-04-08T14:00:00+02:00', date: '2026-04-08' })
    expect(result.isAllDay).toBe(false)
  })
})

describe('parseCalendarResponse', () => {
  const VALID_RESPONSE = {
    items: [
      {
        id: '1',
        summary: 'Team standup',
        start: { dateTime: '2026-04-08T09:00:00+02:00' },
        end: { dateTime: '2026-04-08T09:30:00+02:00' },
        location: 'Zoom',
      },
      {
        id: '2',
        summary: 'All-day event',
        start: { date: '2026-04-08' },
        end: { date: '2026-04-09' },
      },
      {
        id: '3',
        summary: 'Lunch',
        start: { dateTime: '2026-04-08T12:00:00+02:00' },
        end: { dateTime: '2026-04-08T13:00:00+02:00' },
      },
    ],
  }

  it('parses events from a valid response', () => {
    const events = parseCalendarResponse(VALID_RESPONSE)
    expect(events).toHaveLength(3)
  })

  it('parses timed event fields correctly', () => {
    const events = parseCalendarResponse(VALID_RESPONSE)
    const standup = events.find(e => e.id === '1')!
    expect(standup.summary).toBe('Team standup')
    expect(standup.start).toBe('2026-04-08T09:00:00+02:00')
    expect(standup.end).toBe('2026-04-08T09:30:00+02:00')
    expect(standup.isAllDay).toBe(false)
    expect(standup.location).toBe('Zoom')
  })

  it('parses all-day event correctly', () => {
    const events = parseCalendarResponse(VALID_RESPONSE)
    const allDay = events.find(e => e.id === '2')!
    expect(allDay.isAllDay).toBe(true)
    expect(allDay.start).toBe('2026-04-08')
    expect(allDay.location).toBeUndefined()
  })

  it('returns empty array when items is missing', () => {
    expect(parseCalendarResponse({})).toEqual([])
  })

  it('returns empty array when items is empty', () => {
    expect(parseCalendarResponse({ items: [] })).toEqual([])
  })

  it('skips events without a summary', () => {
    const response = {
      items: [
        { id: '1', start: { dateTime: '2026-04-08T09:00:00+02:00' }, end: { dateTime: '2026-04-08T09:30:00+02:00' } },
      ],
    }
    const events = parseCalendarResponse(response)
    expect(events).toHaveLength(0)
  })
})

describe('isCurrentOrNext', () => {
  it('returns "current" if now is between start and end', () => {
    const now = new Date('2026-04-08T09:15:00+02:00')
    const event: CalendarEvent = {
      id: '1', summary: 'Meeting',
      start: '2026-04-08T09:00:00+02:00', end: '2026-04-08T09:30:00+02:00',
      isAllDay: false,
    }
    expect(isCurrentOrNext(event, now, false)).toBe('current')
  })

  it('returns "next" for the first future event when no current', () => {
    const now = new Date('2026-04-08T08:50:00+02:00')
    const event: CalendarEvent = {
      id: '1', summary: 'Meeting',
      start: '2026-04-08T09:00:00+02:00', end: '2026-04-08T09:30:00+02:00',
      isAllDay: false,
    }
    expect(isCurrentOrNext(event, now, false)).toBe('next')
  })

  it('returns null for past events', () => {
    const now = new Date('2026-04-08T10:00:00+02:00')
    const event: CalendarEvent = {
      id: '1', summary: 'Meeting',
      start: '2026-04-08T09:00:00+02:00', end: '2026-04-08T09:30:00+02:00',
      isAllDay: false,
    }
    expect(isCurrentOrNext(event, now, false)).toBeNull()
  })

  it('returns null for all-day events', () => {
    const now = new Date('2026-04-08T10:00:00+02:00')
    const event: CalendarEvent = {
      id: '1', summary: 'Holiday',
      start: '2026-04-08', end: '2026-04-09',
      isAllDay: true,
    }
    expect(isCurrentOrNext(event, now, false)).toBeNull()
  })

  it('returns null when nextAlreadyFound is true for a future event', () => {
    const now = new Date('2026-04-08T08:50:00+02:00')
    const event: CalendarEvent = {
      id: '1', summary: 'Meeting',
      start: '2026-04-08T09:00:00+02:00', end: '2026-04-08T09:30:00+02:00',
      isAllDay: false,
    }
    expect(isCurrentOrNext(event, now, true)).toBeNull()
  })
})
