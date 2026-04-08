import type { CalendarEvent } from '../../types'

function formatEventTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

function isCurrentEvent(event: CalendarEvent, now: Date): boolean {
  if (event.isAllDay) return false
  const start = new Date(event.start).getTime()
  const end = new Date(event.end).getTime()
  return now.getTime() >= start && now.getTime() < end
}

function isNextEvent(event: CalendarEvent, now: Date): boolean {
  if (event.isAllDay) return false
  return new Date(event.start).getTime() > now.getTime()
}

function renderCalendar(container: HTMLElement, events: CalendarEvent[]): void {
  container.textContent = ''

  if (events.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'calendar-empty'
    empty.textContent = 'No more events today'
    container.appendChild(empty)
    return
  }

  const label = document.createElement('div')
  label.className = 'card-label'
  label.textContent = 'Calendar'
  container.appendChild(label)

  const now = new Date()
  let nextFound = false

  // All-day events first
  const allDay = events.filter(e => e.isAllDay)
  const timed = events.filter(e => !e.isAllDay)

  for (const event of allDay) {
    const row = document.createElement('div')
    row.className = 'calendar-event calendar-allday'

    const time = document.createElement('span')
    time.className = 'calendar-time'
    time.textContent = 'All day'

    const summary = document.createElement('span')
    summary.className = 'calendar-summary'
    summary.textContent = event.summary

    row.append(time, summary)
    container.appendChild(row)
  }

  for (const event of timed) {
    const row = document.createElement('div')
    row.className = 'calendar-event'

    if (isCurrentEvent(event, now)) {
      row.classList.add('calendar-current')
    } else if (!nextFound && isNextEvent(event, now)) {
      row.classList.add('calendar-next')
      nextFound = true
    }

    const time = document.createElement('span')
    time.className = 'calendar-time'
    time.textContent = `${formatEventTime(event.start)} \u2013 ${formatEventTime(event.end)}`

    const summary = document.createElement('span')
    summary.className = 'calendar-summary'
    summary.textContent = event.summary

    row.append(time, summary)
    container.appendChild(row)
  }
}

export function initCalendar(container: HTMLElement): () => void {
  return window.myday.onCalendarUpdate((events: CalendarEvent[]) => {
    renderCalendar(container, events)
  })
}
