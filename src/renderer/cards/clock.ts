const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatTime(date: Date): string {
  return timeFormatter.format(date)
}

export function formatDate(date: Date): string {
  return dateFormatter.format(date)
}

export function initClock(container: HTMLElement): () => void {
  const timeEl = document.createElement('div')
  timeEl.className = 'clock-time'
  const dateEl = document.createElement('div')
  dateEl.className = 'clock-date'
  container.appendChild(timeEl)
  container.appendChild(dateEl)

  function tick(): void {
    const now = new Date()
    timeEl.textContent = formatTime(now)
    dateEl.textContent = formatDate(now)
  }

  tick()
  const interval = setInterval(tick, 1000)
  return () => clearInterval(interval)
}
