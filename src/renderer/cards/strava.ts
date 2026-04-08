import type { StravaData } from '../../types'

const CLASSIFICATION_COLORS: Record<string, string> = {
  building: '#D97706',
  maintaining: '#86868b',
  recovering: '#0D9488',
  insufficient: '#86868b',
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  building: 'Building \u2191',
  maintaining: 'Maintaining \u2192',
  recovering: 'Recovering \u2193',
  insufficient: 'First week',
}

function renderStrava(container: HTMLElement, data: StravaData): void {
  container.textContent = ''

  const label = document.createElement('div')
  label.className = 'card-label'
  label.textContent = 'Training'
  container.appendChild(label)

  // Stats row
  const stats = document.createElement('div')
  stats.className = 'strava-stats'
  stats.textContent = `${data.thisWeek.totalKm.toFixed(1)} km \u00B7 ${data.thisWeek.runCount} runs \u00B7 ${Math.round(data.thisWeek.totalElevation)} m \u2191`
  container.appendChild(stats)

  // Comparison bars
  const barsContainer = document.createElement('div')
  barsContainer.className = 'strava-bars'

  // Last week bar (reference = 100%)
  const lastBar = document.createElement('div')
  lastBar.className = 'strava-bar strava-bar-last'
  lastBar.style.width = '100%'

  // This week bar (proportional)
  const thisBar = document.createElement('div')
  thisBar.className = 'strava-bar strava-bar-this'
  const color = CLASSIFICATION_COLORS[data.classification]
  thisBar.style.backgroundColor = color

  if (data.classification === 'insufficient') {
    thisBar.style.width = '100%'
    lastBar.style.width = '0%'
  } else {
    const pct = Math.min(data.ratio * 100, 200)
    thisBar.style.width = `${pct}%`
  }

  barsContainer.append(lastBar, thisBar)
  container.appendChild(barsContainer)

  // Classification label
  const classLabel = document.createElement('div')
  classLabel.className = 'strava-classification'
  classLabel.style.color = color
  classLabel.textContent = CLASSIFICATION_LABELS[data.classification]
  container.appendChild(classLabel)

  // Comparison text
  if (data.classification !== 'insufficient') {
    const delta = Math.round((data.ratio - 1) * 100)
    const sign = delta >= 0 ? '+' : ''
    const comparison = document.createElement('div')
    comparison.className = 'strava-comparison'
    comparison.textContent = `${data.thisWeek.totalKm.toFixed(1)} km vs ${data.lastWeek.totalKm.toFixed(1)} km last week \u00B7 ${sign}${delta}%`
    container.appendChild(comparison)
  }
}

export function initStrava(container: HTMLElement): () => void {
  return window.myday.onStravaUpdate((data: StravaData) => {
    renderStrava(container, data)
  })
}
